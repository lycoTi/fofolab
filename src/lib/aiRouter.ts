import type { AiDissection, AiProviderUsed, Question } from '../types/database';
import { findCorrectOption, parseQuestionOptions } from './questionOptions';

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

type RealProvider = 'GATEWAY' | 'GEMINI_FREE' | 'DEEPSEEK_FALLBACK';

export interface AiStatus {
  configured: boolean;
  providers: RealProvider[];
}

const REQUEST_TIMEOUT_MS = 30000;
// Alias que o Google mantém apontando para o Flash atual; nomes fixos (ex.: gemini-2.5-flash) são desligados.
const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
// deepseek-chat foi desligado em 24/07/2026; deepseek-flash é o nome atual do modelo barato.
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';

function readEnv(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getAiStatus(): AiStatus {
  const providers: RealProvider[] = [];
  if (readEnv('VITE_FOFOLAB_AI_GATEWAY_URL')) providers.push('GATEWAY');
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

function buildStudentContextXml(context?: StudentContextSnapshot): string {
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

export function buildReverseStudyPrompt(params: {
  question: Question;
  dissection: AiDissection | null;
  promptText: string;
  context?: StudentContextSnapshot;
}): string {
  const { question, dissection, promptText, context } = params;
  return `${buildStudentContextXml(context)}
<papel>Você é um professor especialista em concursos públicos brasileiros (banca ${escapeXml(question.exam_board)} / ${escapeXml(question.organ)}).</papel>
${buildQuestionXml(question, dissection)}
${GROUNDING_RULES}
<estilo>Até 250 palavras. Se o estudante já domina tópicos de &lt;topicos_ja_dominados_para_analogia&gt;, use-os como ponte pedagógica.</estilo>
<duvida_do_estudante>${escapeXml(promptText)}</duvida_do_estudante>`;
}

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

async function callGemini(apiKey: string, prompt: string, json: boolean): Promise<string | null> {
  const model = readEnv('VITE_GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
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

async function callDeepSeek(apiKey: string, prompt: string, json: boolean): Promise<string | null> {
  const data = (await fetchJson('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: readEnv('VITE_DEEPSEEK_MODEL') ?? DEFAULT_DEEPSEEK_MODEL,
      // O modo de raciocínio vem ligado por padrão e cobra os tokens de pensamento como saída.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })) as { choices?: { message?: { content?: unknown } }[] } | null;
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim() ? text : null;
}

/** Tenta os provedores configurados em ordem; `null` se nenhum respondeu. */
async function callAiProviders(
  prompt: string,
  options: { json?: boolean } = {}
): Promise<{ text: string; provider: AiProviderUsed } | null> {
  const json = options.json ?? false;

  const gatewayUrl = readEnv('VITE_FOFOLAB_AI_GATEWAY_URL');
  if (gatewayUrl) {
    const text = await callGateway(gatewayUrl, prompt, json);
    if (text) return { text, provider: 'GATEWAY' };
  }

  const geminiKey = readEnv('VITE_GEMINI_API_KEY');
  if (geminiKey) {
    const text = await callGemini(geminiKey, prompt, json);
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

// ============================================================================
// Tutor do Estudo Reverso (por questão)
// ============================================================================

function buildDemoTutorReply(params: {
  question: Question;
  dissection: AiDissection | null;
  promptText: string;
  context?: StudentContextSnapshot;
}): string {
  const { question, dissection, promptText, context } = params;
  const normalizedPrompt = promptText.toLowerCase();
  const options = parseQuestionOptions(question.options_json);
  const correct = findCorrectOption(options, question.final_answer);
  const correctOptionText = correct?.label ?? `Alternativa ${question.final_answer}`;
  const wrongOptions = options.filter((opt) => opt.key !== correct?.key);

  const analogyBridge =
    context && context.strongTopics.length > 0
      ? `\n\n🔗 **Ponte com o que você já domina (${context.strongTopics[0]}):** Use a mesma lógica de controle e rastreabilidade que você já consolidou nesse ponto forte para fixar o gabarito **${question.final_answer}**.`
      : '';

  if (normalizedPrompt.includes('errada') || normalizedPrompt.includes('alternativa')) {
    const wrongBreakdown = wrongOptions
      .map(
        (opt) =>
          `• **${opt.key})** — (exemplo) aqui a IA explicaria por que esta alternativa está errada e qual armadilha da banca ${question.exam_board} ela usa.`
      )
      .join('\n');

    return `🔎 **Análise das Alternativas (${question.exam_board} — ${question.organ}):**\n\n✅ **Por que a ${question.final_answer} está correta:**\n${correctOptionText}\n\n❌ **Por que descartar as demais:**\n${wrongBreakdown}${analogyBridge}`;
  }

  if (normalizedPrompt.includes('pegadinha') || normalizedPrompt.includes('malícia')) {
    return `🎯 **Malícia da Banca (${question.exam_board}):**\n\n1. **Onde os candidatos costumam cair:** A banca mistura termos tecnicamente verdadeiros em outros contextos para parecerem componentes do conceito perguntado no comando.\n2. **Como blindar na prova:** Destaque sempre a palavra-chave do comando e associe diretamente ao gabarito (**${question.final_answer}**).${analogyBridge}`;
  }

  if (
    normalizedPrompt.includes('zero') ||
    normalizedPrompt.includes('base') ||
    normalizedPrompt.includes('1º contato')
  ) {
    return `🌱 **Explicação de 1º Contato (Estudo Reverso):**\n\nMesmo sem ter lido o PDF inteiro antes, veja o que esta questão ensina diretamente para a prova:\n\n${dissection?.dissection_markdown || ''}\n\n💡 **Regra de bolso para levar para a prova:** Sempre que a ${question.exam_board} cobrar este tema, lembre-se da definição exata da alternativa **${question.final_answer}**: *"${correctOptionText}"*.${analogyBridge}`;
  }

  return `📚 **Aprofundamento sobre "${promptText}":**\n\nNo contexto da prova da **${question.organ} (${question.exam_board})**, o ponto central exige dominar a relação que leva ao gabarito **${question.final_answer}** (*${correctOptionText}*).\n\n${dissection?.dissection_markdown || ''}${analogyBridge}`;
}

/**
 * Responde dúvidas do Estudo Reverso ancorado no enunciado oficial, no gabarito definitivo e no
 * contexto do estudante. Sem IA configurada, devolve um exemplo marcado como simulado.
 */
export async function askReverseStudyTutor(params: {
  question: Question;
  dissection: AiDissection | null;
  promptText: string;
  context?: StudentContextSnapshot;
}): Promise<AiReply> {
  if (!getAiStatus().configured) {
    return { reply: buildDemoTutorReply(params), provider: 'OFFLINE_DEMO', simulated: true };
  }

  const result = await callAiProviders(buildReverseStudyPrompt(params));
  if (!result) return { reply: AI_UNAVAILABLE_REPLY, provider: 'OFFLINE_DEMO', simulated: false, failed: true };
  return { reply: result.text, provider: result.provider, simulated: false };
}

// ============================================================================
// Copiloto de estudos contextual (painel lateral)
// ============================================================================

function buildDemoCopilotReply(params: {
  context: StudentContextSnapshot;
  promptText: string;
}): string {
  const { context, promptText } = params;
  const normalized = promptText.toLowerCase();

  const strongAnchor =
    context.strongTopics.length > 0
      ? context.strongTopics.slice(0, 2).join(' e ')
      : 'seus tópicos mais avançados do edital';

  const weakAlert =
    context.priorityWeakTopics.length > 0
      ? context.priorityWeakTopics.slice(0, 2).join(' • ')
      : `${context.currentTopicCode} ${context.currentTopicTitle}`;

  if (['relacione', 'domino', 'analogia', 'conecte'].some((word) => normalized.includes(word))) {
    const prerequisiteLine =
      context.relatedPrerequisites.length > 0
        ? `\n• **Pré-requisito direto conectado:** ${context.relatedPrerequisites.join(', ')}.`
        : '';
    return (
      `🔗 **Conectando "${context.currentTopicCode} ${context.currentTopicTitle}" com o que você já domina:**\n\n` +
      `• **Seu ponto forte atual:** Você já apresenta ótimo desempenho em **${strongAnchor}**.\n` +
      `• **Como fazer a ponte para ${context.currentSubjectName}:** Na banca **${context.examBoard}** (${context.organ}), a lógica de cobrança de **${context.currentTopicTitle}** segue o mesmo padrão de distinguir *competência/estrutura normativa* de *execução operacional*.\n` +
      `• **Status neste tópico:** Domínio em **${context.currentTopicMastery}%** (Confiança da amostra: **${context.currentTopicConfidence}%**).${prerequisiteLine}`
    );
  }

  if (['priorizar', 'hoje', 'roteiro', 'desempenho', 'ciclo'].some((word) => normalized.includes(word))) {
    const examCountdown = context.daysUntilExam !== null ? ` (${context.daysUntilExam} dias até a prova)` : '';
    return (
      `🎯 **Diagnóstico Contextual para ${context.organ} (${context.examBoard}):**\n\n` +
      `1. **Foco Imediato (${context.currentSubjectName} — Peso ${context.currentSubjectWeight}x):** Seu domínio nos tópicos iniciados está em **${context.currentSubjectMastery}%** (Cobertura do edital: **${context.currentSubjectCoverage}%**).\n` +
      `2. **Prioridade do Mapa de Calor:** Recomendamos atacar **${weakAlert}** em blocos curtos de questões comentadas.\n` +
      `3. **Meta da Semana:** Dentro das suas **${context.weeklyHoursTarget}h semanais**${examCountdown}, resolva mais 3 a 5 questões de **${context.currentTopicCode} ${context.currentTopicTitle}** para elevar sua confiança de amostra (hoje em **${context.currentTopicConfidence}%**).`
    );
  }

  if (['banca', 'cobra', 'fgv', 'cebraspe'].some((word) => normalized.includes(word))) {
    return (
      `🏛️ **Raio-X da Banca ${context.examBoard} para ${context.organ} (${context.roleTitle}):**\n\n` +
      `• Em **${context.currentSubjectName}** (tópico **${context.currentTopicCode} ${context.currentTopicTitle}**), a **${context.examBoard}** costuma cobrar situações práticas (estudos de caso) onde duas alternativas parecem corretas, mas apenas uma respeita a classificação técnica estrita.\n` +
      `• **Dica prática para sua bancada:** Ao resolver questões deste tópico, anote no seu Caderno Lateral a palavra-chave que diferencia o gabarito oficial das alternativas distratoras.`
    );
  }

  return (
    `🐹 **Copiloto Contextual (${context.organ} • ${context.examBoard}):**\n\n` +
    `Analisando seu estudo em **${context.currentSubjectName} → ${context.currentTopicCode} ${context.currentTopicTitle}** (Domínio: **${context.currentTopicMastery}%** | Confiança da Amostra: **${context.currentTopicConfidence}%**):\n\n` +
    `• Sobre **"${promptText}"**: Para o cargo de *${context.roleTitle}*, concentre-se nos conceitos centrais cobrados pela ${context.examBoard} e conecte-os com **${strongAnchor}**.\n` +
    `• **Próximo passo sugerido:** Confira os pontos prioritários do seu Mapa de Calor (**${weakAlert}**) e salve os conceitos-chave no Caderno Lateral!`
  );
}

/**
 * Copiloto de Estudos Contextual (Painel Lateral Expansível): conhece o concurso, a banca,
 * o domínio e a confiança do tópico atual, os tópicos fortes e os alertas do Mapa de Calor.
 */
export async function askContextualStudyCopilot(params: {
  context: StudentContextSnapshot;
  promptText: string;
  activeQuestion?: Question | null;
  notebookExcerpt?: string;
}): Promise<AiReply> {
  const { context, promptText, activeQuestion, notebookExcerpt } = params;

  if (!getAiStatus().configured) {
    return { reply: buildDemoCopilotReply({ context, promptText }), provider: 'OFFLINE_DEMO', simulated: true };
  }

  const questionLine = activeQuestion
    ? `${escapeXml(activeQuestion.statement)} [Gabarito: ${escapeXml(activeQuestion.final_answer)}]`
    : 'Nenhuma questão específica';
  const prompt = `${buildStudentContextXml(context)}
<papel>Você é o Copiloto Pedagógico do FofoLab, acompanhando o estudante rumo ao concurso ${escapeXml(context.organ)} (${escapeXml(context.roleTitle)} — banca ${escapeXml(context.examBoard)}).</papel>
<questao_aberta>${questionLine}</questao_aberta>
<trecho_do_caderno>${escapeXml(notebookExcerpt ? notebookExcerpt.slice(0, 400) : 'Sem resumo ainda')}</trecho_do_caderno>
${GROUNDING_RULES}
<estilo>Acolhedor, objetivo, até 200 palavras, conectado aos dados reais de desempenho acima e ao estilo da banca.</estilo>
<mensagem_do_estudante>${escapeXml(promptText)}</mensagem_do_estudante>`;

  const result = await callAiProviders(prompt);
  if (!result) return { reply: AI_UNAVAILABLE_REPLY, provider: 'OFFLINE_DEMO', simulated: false, failed: true };
  return { reply: result.text, provider: result.provider, simulated: false };
}
