import type { AiDissection, AiProviderUsed, Question } from '../types/database';
import { findCorrectOption, parseQuestionOptions } from './questionOptions';
import { formatDuration } from './timeFormat';

/**
 * Roteador de IA (docs/specs/02): Gateway FofoLab → Gemini (free tier) → DeepSeek.
 *
 * Sem nenhuma chave/gateway configurado o app entra em MODO DEMONSTRAÇÃO: as respostas são
 * exemplos montados localmente, sempre com `simulated: true` (a tela mostra o aviso) e
 * NUNCA gravadas como explicação da questão.
 */
export type AiResponder = AiProviderUsed | 'OFFLINE_DEMO';

export interface AiReply {
  reply: string;
  provider: AiResponder;
  /** Resposta de exemplo montada localmente (IA não configurada). */
  simulated: boolean;
  /** A IA estava configurada mas não respondeu (rede, chave, limite). */
  failed?: boolean;
}

export interface ChatTurn {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  createdAt: string;
  simulated?: boolean;
}

export interface QuestionComplexityProfile {
  stars: 1 | 2 | 3 | 4 | 5;
  levelLabel: 'Direta' | 'Intermediária' | 'Densa / Estudo de Caso';
  topicCount: number;
  linguisticLoad: 'Baixa' | 'Média' | 'Alta';
  summaryTip: string;
  statementLength?: number;
}

/**
 * Snapshot completo do contexto do estudante (Concurso, Banca, Tópico Atual,
 * Domínio, Confiança da Amostra, Tópicos Fortes para analogias e Mapa de Calor).
 */
export interface StudentContextSnapshot {
  planTitle: string;
  organ: string;
  examBoard: string;
  roleTitle: string;
  daysUntilExam: number | null;
  weeklyHoursTarget: number;
  currentSubjectName: string;
  currentSubjectWeight: number;
  currentSubjectMastery: number;
  currentSubjectCoverage: number;
  currentTopicCode: string;
  currentTopicTitle: string;
  currentTopicMastery: number;
  currentTopicConfidence: number;
  strongTopics: string[];
  priorityWeakTopics: string[];
  relatedPrerequisites: string[];
}

type RealProvider = 'GATEWAY' | 'GROQ_FREE' | 'GEMINI_FREE' | 'DEEPSEEK_FALLBACK';

export interface AiStatus {
  configured: boolean;
  providers: RealProvider[];
}

const REQUEST_TIMEOUT_MS = 30000;
// Alias que o Google mantém apontando para o Flash atual; nomes fixos (ex.: gemini-2.5-flash) são desligados.
const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
// deepseek-chat foi desligado em 24/07/2026; deepseek-flash é o nome atual do modelo barato.
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
// No teste de 21/10/2026 foi o único modelo grátis do Groq que acertou conceitos de auditoria (ISSAI);
// os gpt-oss inventaram definições.
const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function readEnv(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getAiStatus(): AiStatus {
  const providers: RealProvider[] = [];
  if (readEnv('VITE_FOFOLAB_AI_GATEWAY_URL')) providers.push('GATEWAY');
  if (readEnv('VITE_GROQ_API_KEY')) providers.push('GROQ_FREE');
  if (readEnv('VITE_GEMINI_API_KEY')) providers.push('GEMINI_FREE');
  if (readEnv('VITE_DEEPSEEK_API_KEY')) providers.push('DEEPSEEK_FALLBACK');
  return { configured: providers.length > 0, providers };
}

// ============================================================================
// Complexidade da questão
// ============================================================================

function resolveLinguisticLoad(charLength: number): 'Baixa' | 'Média' | 'Alta' {
  if (charLength > 260) return 'Alta';
  if (charLength > 150) return 'Média';
  return 'Baixa';
}

function resolveComplexityLabel(stars: 1 | 2 | 3 | 4 | 5): QuestionComplexityProfile['levelLabel'] {
  if (stars >= 4) return 'Densa / Estudo de Caso';
  if (stars === 3) return 'Intermediária';
  return 'Direta';
}

function resolveSummaryTip(linguisticLoad: 'Baixa' | 'Média' | 'Alta', topicCount: number): string {
  if (linguisticLoad === 'Alta') {
    return 'Enunciado longo: leia o comando final da questão antes de analisar o caso.';
  }
  if (topicCount >= 2) {
    return `Cruza ${topicCount} conceitos fundamentais deste tópico.`;
  }
  return 'Questão objetiva focada no núcleo essencial do edital.';
}

function parsePrerequisites(dissection: AiDissection | null): string[] {
  if (!dissection?.prerequisites_json) return [];
  try {
    const parsed = JSON.parse(dissection.prerequisites_json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Complexidade da questão (1 a 5 estrelas): tamanho do enunciado, conceitos cruzados
 * (pré-requisitos da explicação) e estudos de caso longos da FGV.
 */
export function getQuestionComplexityProfile(
  question: Question,
  dissection: AiDissection | null
): QuestionComplexityProfile {
  const topicCount = Math.max(1, parsePrerequisites(dissection).length);
  const charLength = question.statement.length;
  const linguisticLoad = resolveLinguisticLoad(charLength);

  let score = 2;
  if (charLength > 250) score += 1;
  if (topicCount >= 2) score += 1;
  if (question.exam_board.toUpperCase() === 'FGV' && charLength > 200) score += 1;

  const stars = Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;

  return {
    stars,
    levelLabel: resolveComplexityLabel(stars),
    topicCount,
    linguisticLoad,
    summaryTip: resolveSummaryTip(linguisticLoad, topicCount),
    statementLength: charLength,
  };
}

// ============================================================================
// Montagem dos prompts (grounding + regras anti-alucinação da spec 04)
// ============================================================================

export function escapeXml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildStudentContextXml(context?: StudentContextSnapshot): string {
  if (!context) return '';
  const list = (items: string[], empty: string) => escapeXml(items.join(' | ') || empty);
  return `<contexto_estudante>
  <concurso orgao="${escapeXml(context.organ)}" banca="${escapeXml(context.examBoard)}" cargo="${escapeXml(context.roleTitle)}" dias_ate_prova="${escapeXml(context.daysUntilExam ?? 'aberto')}" meta_semanal="${escapeXml(context.weeklyHoursTarget)}h" />
  <disciplina_atual nome="${escapeXml(context.currentSubjectName)}" peso="${escapeXml(context.currentSubjectWeight)}x" dominio="${escapeXml(context.currentSubjectMastery)}%" cobertura_edital="${escapeXml(context.currentSubjectCoverage)}%" />
  <topico_atual codigo="${escapeXml(context.currentTopicCode)}" titulo="${escapeXml(context.currentTopicTitle)}" dominio="${escapeXml(context.currentTopicMastery)}%" confianca_amostra="${escapeXml(context.currentTopicConfidence)}%" />
  <topicos_ja_dominados_para_analogia>${list(context.strongTopics, 'Em construção')}</topicos_ja_dominados_para_analogia>
  <topicos_prioritarios_mapa_de_calor>${list(context.priorityWeakTopics, 'Nenhum alerta crítico')}</topicos_prioritarios_mapa_de_calor>
  <pre_requisitos_conectados>${list(context.relatedPrerequisites, 'Direto')}</pre_requisitos_conectados>
</contexto_estudante>`;
}

function buildQuestionXml(question: Question, dissection: AiDissection | null): string {
  const options = parseQuestionOptions(question.options_json);
  return `<questao banca="${escapeXml(question.exam_board)}" orgao="${escapeXml(question.organ)}" ano="${escapeXml(question.exam_year)}">
  <enunciado>${escapeXml(question.statement)}</enunciado>
  <alternativas>${escapeXml(options.map((o) => o.label).join(' | '))}</alternativas>
  <gabarito_definitivo>${escapeXml(question.final_answer)}</gabarito_definitivo>
  <explicacao_base>${escapeXml(dissection?.dissection_markdown ?? '')}</explicacao_base>
</questao>`;
}

export const GROUNDING_RULES = `<regras>
1. Ancore tudo no enunciado oficial e no GABARITO DEFINITIVO acima. Nunca contradiga o gabarito; se suspeitar de erro, diga isso como observação separada, sem trocar a resposta.
2. Eliminação contrastiva: para cada alternativa incorreta, explique por que está errada e classifique a armadilha (Inversão Conceitual, Extrapolação, Troca de Competência, Exceção Literal ou Outra).
3. Separe com clareza: Letra da Lei / Jurisprudência (TCU, STF, STJ) / Entendimento da banca.
4. Regra de abstenção: só cite número de lei, artigo, súmula ou norma se tiver certeza. Se não tiver, escreva "não consigo confirmar o dispositivo exato" — NUNCA invente.
5. Responda em português do Brasil, de forma direta, em Markdown simples.
</regras>`;

export function buildDissectionPrompt(question: Question): string {
  return `<papel>Você é um professor especialista em concursos públicos brasileiros (banca ${escapeXml(question.exam_board)} / ${escapeXml(question.organ)}).</papel>
${buildQuestionXml(question, null)}
${GROUNDING_RULES}
<tarefa>
Escreva a explicação-base desta questão para o estudo reverso.
Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, neste formato:
{"explicacao_markdown": "...", "pre_requisitos": ["conceito 1", "conceito 2"]}
- explicacao_markdown: síntese direta (até 180 palavras) do porquê do gabarito, com a eliminação contrastiva das demais alternativas.
- pre_requisitos: de 1 a 4 micro-conceitos que o estudante precisa dominar para acertar.
</tarefa>`;
}

// ============================================================================
// Chamadas aos provedores (com tempo limite)
// ============================================================================

async function fetchJson(url: string, init: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`IA respondeu ${response.status}; usando o próximo provedor ou o exemplo simulado.`, body.slice(0, 500));
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callGateway(url: string, prompt: string, json: boolean): Promise<string | null> {
  const data = (await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, json }),
  })) as { reply?: unknown } | null;
  return typeof data?.reply === 'string' && data.reply.trim() ? data.reply : null;
}

async function callGemini(apiKey: string, prompt: string, json: boolean, strong = false): Promise<string | null> {
  const model = (strong ? readEnv('VITE_GEMINI_MODEL_STRONG') : undefined) ?? readEnv('VITE_GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
  const data = (await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    }
  )) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] } | null;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' && text.trim() ? text : null;
}

/** Groq e DeepSeek falam o formato de chat da OpenAI; `extra` leva os campos próprios de cada um. */
async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
  json: boolean,
  extra: Record<string, unknown> = {}
): Promise<string | null> {
  const data = (await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      ...extra,
      messages: [{ role: 'user', content: prompt }],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })) as { choices?: { message?: { content?: unknown } }[] } | null;
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim() ? text : null;
}

function callGroq(apiKey: string, prompt: string, json: boolean, strong = false): Promise<string | null> {
  const model = (strong ? readEnv('VITE_GROQ_MODEL_STRONG') : undefined) ?? readEnv('VITE_GROQ_MODEL') ?? DEFAULT_GROQ_MODEL;
  return callOpenAiCompatible(GROQ_URL, apiKey, model, prompt, json);
}

function callDeepSeek(apiKey: string, prompt: string, json: boolean): Promise<string | null> {
  const model = readEnv('VITE_DEEPSEEK_MODEL') ?? DEFAULT_DEEPSEEK_MODEL;
  // O modo de raciocínio vem ligado por padrão e cobra os tokens de pensamento como saída.
  return callOpenAiCompatible(DEEPSEEK_URL, apiKey, model, prompt, json, { thinking: { type: 'disabled' } });
}

/**
 * Tenta os provedores configurados em ordem; `null` se nenhum respondeu. `strong`: usa o modelo mais forte se houver
 * (`VITE_*_MODEL_STRONG`) — a FofoIA pede isso só na aula completa e no "Cai no meu edital?".
 */
export async function callAiProviders(
  prompt: string,
  options: { json?: boolean; strong?: boolean } = {}
): Promise<{ text: string; provider: AiProviderUsed } | null> {
  const json = options.json ?? false;
  const strong = options.strong ?? false;

  const gatewayUrl = readEnv('VITE_FOFOLAB_AI_GATEWAY_URL');
  if (gatewayUrl) {
    const text = await callGateway(gatewayUrl, prompt, json);
    if (text) return { text, provider: 'GATEWAY' };
  }

  const groqKey = readEnv('VITE_GROQ_API_KEY');
  if (groqKey) {
    const text = await callGroq(groqKey, prompt, json, strong);
    if (text) return { text, provider: 'GROQ_FREE' };
  }

  const geminiKey = readEnv('VITE_GEMINI_API_KEY');
  if (geminiKey) {
    const text = await callGemini(geminiKey, prompt, json, strong);
    if (text) return { text, provider: 'GEMINI_FREE' };
  }

  const deepseekKey = readEnv('VITE_DEEPSEEK_API_KEY');
  if (deepseekKey) {
    const text = await callDeepSeek(deepseekKey, prompt, json);
    if (text) return { text, provider: 'DEEPSEEK_FALLBACK' };
  }

  return null;
}

const AI_UNAVAILABLE_REPLY =
  '⚠️ Não consegui falar com a IA agora (sem internet, chave inválida ou limite do plano gratuito atingido). Tente de novo em instantes.';

// ============================================================================
// Explicação-base da questão (gerada uma vez e guardada pelo banco)
// ============================================================================

export type DissectionResult =
  | { status: 'ok'; provider: AiProviderUsed; dissectionMarkdown: string; prerequisites: string[] }
  | { status: 'not-configured' }
  | { status: 'error'; message: string };

export function parseDissectionResponse(
  text: string
): { dissectionMarkdown: string; prerequisites: string[] } | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const markdown = data.explicacao_markdown ?? data.dissection_markdown;
    if (typeof markdown !== 'string' || !markdown.trim()) return null;
    const prereqsRaw = data.pre_requisitos ?? data.prerequisites;
    const prerequisites = Array.isArray(prereqsRaw)
      ? prereqsRaw.map((p) => String(p).trim()).filter(Boolean).slice(0, 4)
      : [];
    return { dissectionMarkdown: markdown.trim(), prerequisites };
  } catch {
    return null;
  }
}

export async function generateQuestionDissection(question: Question): Promise<DissectionResult> {
  if (!getAiStatus().configured) return { status: 'not-configured' };

  const result = await callAiProviders(buildDissectionPrompt(question), { json: true });
  if (!result) return { status: 'error', message: AI_UNAVAILABLE_REPLY };

  const parsed = parseDissectionResponse(result.text);
  if (!parsed) {
    return { status: 'error', message: 'A IA respondeu num formato inesperado. Tente gerar de novo.' };
  }
  return { status: 'ok', provider: result.provider, ...parsed };
}
