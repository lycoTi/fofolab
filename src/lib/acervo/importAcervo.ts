import type { AiCallResult } from '../aiRouter';
import { createSafetyBackup, getDb, getSqlJs, getSubjectsByPlan, getTopicsBySubject, persistDatabase, queryAll } from '../database';
import type { Topic } from '../../types/database';
import { acervoVocabVersion, buildAcervoDb, itemsByIds } from './acervoDb';
import { openAcervo, replaceAcervo } from './acervoStore';
import { aiCandidates, buildLinkPrompt, linkByName, MAX_AI_CANDIDATES, parseLinkResponse, topicCaminho } from './linking';
import { parsePacote, type PacoteAssunto } from './pacote';
import {
  countStaleCopies,
  getAcervoLinks,
  refreshCopiedQuestions,
  removeVanishedLinks,
  saveAcervoLinks,
} from './studentAcervo';

/** Chamada à IA do app (gateway → Groq → Gemini → DeepSeek); `null` = sem IA configurada. */
export type LinkAi = (prompt: string) => Promise<AiCallResult>;

export interface AcervoImportSummary {
  withSubject: number;
  hidden: number;
  invalidItems: number;
  topicsLinked: number;
  topicsWithoutLink: number;
  copiesUpdated: number;
  /** Havia tópico para a IA ligar, mas não há IA configurada neste computador. */
  aiSkipped: boolean;
}

export type AcervoImportResult = { ok: true; summary: AcervoImportSummary } | { ok: false; message: string };

const OLDER_PACOTE = 'Este pacote é mais antigo que o acervo deste computador. Use o pacote mais novo do minerador.';
/** Pausa pedida pelo plano grátis (429) é respeitada uma vez por tópico, até 1 minuto. */
const MAX_WAIT_SECONDS = 60;
/** Duas falhas seguidas = IA fora do ar ou sem limite: o resto fica para a próxima importação. */
const MAX_CONSECUTIVE_FAILURES = 2;
/** Teto da resposta da IA na ligação: até 3 ids em JSON curto (o plano grátis do Groq exige teto em todo pedido). */
export const ACERVO_LINK_MAX_TOKENS = 300;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface PendingTopic {
  topic: Topic;
  caminho: string[];
  candidates: PacoteAssunto[];
}

function planTopics(planId: string): { topic: Topic; subjectName: string; byId: Map<string, Topic> }[] {
  return getSubjectsByPlan(planId).flatMap((subject) => {
    const topics = getTopicsBySubject(subject.id);
    const byId = new Map(topics.map((t) => [t.id, t]));
    return topics.map((topic) => ({ topic, subjectName: subject.name, byId }));
  });
}

/** Candidatos da IA: os empatados pelo nome primeiro, depois os de palavras; nunca um assunto que o estudante desligou. */
function candidatesFor(caminho: string[], ambiguous: string[], vocab: PacoteAssunto[], disabled: ReadonlySet<string>): PacoteAssunto[] {
  const byId = new Map(vocab.map((a) => [a.id, a]));
  const first = ambiguous.map((id) => byId.get(id)).filter((a): a is PacoteAssunto => a !== undefined);
  const seen = new Set<string>();
  return [...first, ...aiCandidates(caminho, vocab)]
    .filter((a) => {
      if (seen.has(a.id) || disabled.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .slice(0, MAX_AI_CANDIDATES);
}

/** Uma chamada por tópico; no 429 espera o que o provedor pediu (uma vez) e tenta de novo. `null` = falhou. */
async function askAi(ai: LinkAi, prompt: string, wait: (ms: number) => Promise<void>): Promise<string | null> {
  const first = await ai(prompt);
  if (first.ok) return first.text;
  if (first.retryAfterSec === null) return null;
  await wait(Math.min(first.retryAfterSec, MAX_WAIT_SECONDS) * 1000);
  const second = await ai(prompt);
  return second.ok ? second.text : null;
}

/**
 * Importa (ou reimporta) o pacote do minerador: troca o acervo deste computador, atualiza as questões já usadas e liga
 * os tópicos do plano que ainda não têm ligação — pelo nome e, para o que sobrar, pela IA. Ligação existente não é
 * refeita (a IA não responde sempre igual; item visto não pode sumir à toa). Spec 12c §5.2 e §5.3.
 */
export async function importAcervoPacote(
  text: string,
  input: { planId: string; ai: LinkAi | null; onProgress?: (done: number, total: number) => void; wait?: (ms: number) => Promise<void> }
): Promise<AcervoImportResult> {
  // 1. Ler e validar (entrada não confiável)
  const parsed = parsePacote(text);
  if (!parsed.ok) return parsed;
  const { pacote } = parsed;

  // 2. Nunca trocar o acervo por um mais antigo
  const current = await openAcervo();
  if (current && acervoVocabVersion(current) > pacote.vocabVersion) return { ok: false, message: OLDER_PACOTE };

  // 3. Montar o acervo novo e passar a usá-lo
  const { db: acervo, stats } = buildAcervoDb(getSqlJs(), pacote);
  await replaceAcervo(acervo);

  // 4. Questões já usadas acompanham o pacote (cópia de segurança antes de mudar alguma)
  const copiedIds = queryAll<{ id: string }>(
    getDb(),
    'SELECT DISTINCT acervo_item_id AS id FROM questions WHERE acervo_item_id IS NOT NULL'
  ).map((r) => r.id);
  const rows = new Map(itemsByIds(acervo, copiedIds).map((row) => [row.id, row]));
  if (countStaleCopies(rows) > 0) await createSafetyBackup('antes-de-atualizar-acervo');
  const { updated: copiesUpdated } = refreshCopiedQuestions(rows);

  // 5. Assunto que sumiu do vocabulário (juntado a outro): a ligação ativa sai para o tópico ser ligado de novo
  removeVanishedLinks(new Set(pacote.assuntos.map((a) => a.id)));

  // 6. Tópicos do plano sem ligação ativa
  const topics = planTopics(input.planId);
  const links = getAcervoLinks(topics.map((t) => t.topic.id));
  const linked = new Set(links.filter((l) => l.disabled === 0).map((l) => l.topic_id));
  const disabledByTopic = new Map<string, Set<string>>();
  for (const l of links.filter((link) => link.disabled === 1)) {
    const set = disabledByTopic.get(l.topic_id) ?? new Set<string>();
    set.add(l.assunto_id);
    disabledByTopic.set(l.topic_id, set);
  }

  // 7. Pelo nome
  const pending: PendingTopic[] = [];
  const byName: Parameters<typeof saveAcervoLinks>[0] = [];
  for (const { topic, subjectName, byId } of topics) {
    if (linked.has(topic.id)) continue;
    const caminho = topicCaminho(subjectName, topic, byId);
    const disabled = disabledByTopic.get(topic.id) ?? new Set<string>();
    const result = linkByName(caminho, pacote.assuntos);
    if (result.kind === 'linked' && !disabled.has(result.assuntoId)) {
      byName.push({ topicId: topic.id, assuntoId: result.assuntoId, origin: 'NAME', vocabVersion: pacote.vocabVersion });
      linked.add(topic.id);
      continue;
    }
    const ambiguous = result.kind === 'ambiguous' ? result.candidates : [];
    const candidates = candidatesFor(caminho, ambiguous, pacote.assuntos, disabled);
    if (candidates.length > 0) pending.push({ topic, caminho, candidates });
  }
  saveAcervoLinks(byName);

  // 8. Pela IA, um tópico por vez; cada ligação aceita é gravada na hora (fechar a tela no meio não perde nada)
  if (input.ai) {
    const wait = input.wait ?? sleep;
    let failures = 0;
    for (const [index, item] of pending.entries()) {
      input.onProgress?.(index, pending.length);
      const answer = await askAi(input.ai, buildLinkPrompt(item.caminho, item.candidates), wait);
      if (answer === null) {
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) break;
        continue;
      }
      failures = 0;
      const ids = parseLinkResponse(answer, new Set(item.candidates.map((c) => c.id))) ?? [];
      if (ids.length === 0) continue;
      saveAcervoLinks(ids.map((assuntoId) => ({ topicId: item.topic.id, assuntoId, origin: 'AI' as const, vocabVersion: pacote.vocabVersion })));
      linked.add(item.topic.id);
    }
    input.onProgress?.(pending.length, pending.length);
  }

  // 9. Gravar e resumir (números do plano inteiro: reimportar o mesmo pacote mostra o mesmo resumo)
  persistDatabase();
  return {
    ok: true,
    summary: {
      withSubject: stats.withSubject,
      hidden: stats.hidden,
      invalidItems: pacote.invalidItems,
      topicsLinked: linked.size,
      topicsWithoutLink: topics.length - linked.size,
      copiesUpdated,
      aiSkipped: input.ai === null && pending.length > 0,
    },
  };
}
