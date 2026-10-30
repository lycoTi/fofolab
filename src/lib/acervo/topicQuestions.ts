import type { Database } from 'sql.js';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType, Topic } from '../../types/database';
import { getDb, queryAll, queryOne } from '../database';
import { assuntoCaminhos, itemsByIds, itemsForAssuntos, type AcervoRow } from './acervoDb';
import { openAcervo } from './acervoStore';
import {
  acervoQuestionId,
  detachUncoveredCopies,
  disableAcervoLink,
  getAcervoLinks,
  getExcludedItemIds,
  toVirtualQuestion,
} from './studentAcervo';

/**
 * Lista de questões da aba Questões (spec 12c §5.4 e 12d §3.2): as próprias (importadas por texto/JSON) mais os itens do
 * acervo ligados aos tópicos do escopo, com o resumo das tentativas já feitas naquele tópico.
 */
export type QuestionScope = 'topic' | 'group' | 'subject' | 'all';

export interface QuestionAttemptSummary {
  count: number;
  lastIsCorrect: boolean;
  lastConfidence: ReviewConfidence | null;
  lastDiagnosis: SelfDiagnosisType;
  lastAttemptAt: string;
  isFirstContact?: boolean;
  lastSelectedOption?: string | null;
  /** Tempo gasto na última tentativa (segundos). */
  lastTimeSpentSeconds?: number;
  /** Última tentativa foi erro, chute ou 1º contato: entra no filtro "Errei ou chutei". */
  needsRetry: boolean;
}

export interface QuestionsViewItem {
  question: Question;
  dissection: AiDissection | null;
  attemptSummary: QuestionAttemptSummary | null;
  /** [spec 12d / FofoIA] Assuntos minerados do acervo ligados à questão. */
  assuntos?: { id: string; label: string }[];
}

export interface QuestionsView {
  items: QuestionsViewItem[];
  /** Ligações ativas do tópico, para a linha "Do acervo: …" (só no escopo do tópico). */
  links: { assuntoId: string; caminho: string[] }[];
  /** Itens tirados do tópico ("Não é deste tópico"), para devolver (só no escopo do tópico). */
  excluded: { itemId: string; sourceLabel: string }[];
  /** Código (ou título) do grupo do tópico, para o "Ver as do grupo"; `null` sem grupo. */
  groupCode: string | null;
  /** Há ligação, mas o acervo não está neste computador (outro PC, backup restaurado). */
  acervoMissing: boolean;
}

interface ScopeInput {
  scope: QuestionScope;
  planId: string;
  subjectId: string;
  topicId: string;
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

function planSubjectIds(planId: string): string[] {
  return queryAll<{ id: string }>(getDb(), 'SELECT id FROM subjects WHERE plan_id = ?', [planId]).map((r) => r.id);
}

function topicIdsWhere(sql: string, params: string[]): string[] {
  return queryAll<{ id: string }>(getDb(), `SELECT id FROM topics WHERE ${sql}`, params).map((r) => r.id);
}

/** Tópicos cujas ligações valem no escopo. */
export function scopeTopicIds(input: ScopeInput): string[] {
  switch (input.scope) {
    case 'topic':
      return [input.topicId];
    case 'group': {
      const parentId = queryOne<{ parent_id: string | null }>(getDb(), 'SELECT parent_id FROM topics WHERE id = ?', [input.topicId])?.parent_id;
      return parentId ? topicIdsWhere('parent_id = ?', [parentId]) : [input.topicId];
    }
    case 'subject':
      return topicIdsWhere('subject_id = ?', [input.subjectId]);
    case 'all': {
      const subjects = planSubjectIds(input.planId);
      return subjects.length > 0 ? topicIdsWhere(`subject_id IN (${placeholders(subjects.length)})`, subjects) : [];
    }
  }
}

/** Síncrona e barata: decide se vale abrir o acervo (que fica fechado até alguém precisar). */
export function hasActiveLinks(topicIds: string[]): boolean {
  return getAcervoLinks(topicIds).some((l) => l.disabled === 0);
}

function ownQuestions(input: ScopeInput, topicIds: string[]): Question[] {
  const base = 'SELECT * FROM questions WHERE acervo_item_id IS NULL AND';
  const order = 'ORDER BY exam_year DESC';
  switch (input.scope) {
    case 'topic':
      return queryAll<Question>(getDb(), `${base} topic_id = ? ${order}`, [input.topicId]);
    case 'group':
      return queryAll<Question>(getDb(), `${base} topic_id IN (${placeholders(topicIds.length)}) ${order}`, topicIds);
    case 'subject':
      return queryAll<Question>(getDb(), `${base} subject_id = ? ${order}`, [input.subjectId]);
    case 'all': {
      const subjects = planSubjectIds(input.planId);
      if (subjects.length === 0) return [];
      return queryAll<Question>(getDb(), `${base} subject_id IN (${placeholders(subjects.length)}) ${order}`, subjects);
    }
  }
}

/**
 * Tópicos do mais específico para o mais geral. Um item coberto pela folha e pelo grupo dela (o grupo também é ligado)
 * fica na folha: tentativa no tópico agrupador sairia do Mapa de Calor, da cobertura e da Revisão do dia.
 */
function deepestFirst(topicIds: string[], subjectIds: string[]): string[] {
  if (subjectIds.length === 0) return topicIds;
  const parentOf = new Map(
    queryAll<{ id: string; parent_id: string | null }>(
      getDb(),
      `SELECT id, parent_id FROM topics WHERE subject_id IN (${placeholders(subjectIds.length)})`,
      subjectIds
    ).map((t) => [t.id, t.parent_id])
  );
  const depth = (id: string): number => {
    let d = 0;
    const seen = new Set<string>();
    for (let p = parentOf.get(id) ?? null; p && !seen.has(p); p = parentOf.get(p) ?? null) {
      seen.add(p);
      d += 1;
    }
    return d;
  };
  const depths = new Map(topicIds.map((id) => [id, depth(id)]));
  // sort é estável: na mesma profundidade, fica a ordem do edital
  return [...topicIds].sort((a, b) => (depths.get(b) ?? 0) - (depths.get(a) ?? 0));
}

/** Itens ligados aos tópicos do escopo, cada um uma vez (no tópico mais específico em que aparece). */
function acervoQuestions(acervo: Database, topicIds: string[]): Question[] {
  const links = getAcervoLinks(topicIds).filter((l) => l.disabled === 0);
  if (links.length === 0) return [];
  const topics = queryAll<Pick<Topic, 'id' | 'subject_id'>>(
    getDb(),
    `SELECT id, subject_id FROM topics WHERE id IN (${placeholders(topicIds.length)})`,
    topicIds
  );
  const subjectOf = new Map(topics.map((t) => [t.id, t.subject_id]));
  const assuntosByTopic = new Map<string, string[]>();
  for (const link of links) assuntosByTopic.set(link.topic_id, [...(assuntosByTopic.get(link.topic_id) ?? []), link.assunto_id]);

  const picked: { row: AcervoRow; topicId: string; subjectId: string }[] = [];
  const seen = new Set<string>();
  for (const topicId of deepestFirst(topicIds, [...new Set(subjectOf.values())])) {
    const assuntos = assuntosByTopic.get(topicId);
    const subjectId = subjectOf.get(topicId);
    if (!assuntos || !subjectId) continue;
    const excluded = new Set(getExcludedItemIds(topicId));
    for (const row of itemsForAssuntos(acervo, assuntos)) {
      if (seen.has(row.id) || excluded.has(row.id)) continue;
      seen.add(row.id);
      picked.push({ row, topicId, subjectId });
    }
  }
  picked.sort((x, y) => y.row.exam_year - x.row.exam_year || x.row.id.localeCompare(y.row.id));

  // A cópia já gravada (gabarito/anulação atualizados) vence o item virtual; fica no tópico desta lista
  const ids = picked.map((p) => acervoQuestionId(p.subjectId, p.row.id));
  const stored = new Map(
    ids.length > 0
      ? queryAll<Question>(getDb(), `SELECT * FROM questions WHERE id IN (${placeholders(ids.length)})`, ids).map((q) => [q.id, q])
      : []
  );
  return picked.map(({ row, topicId, subjectId }) => {
    const copy = stored.get(acervoQuestionId(subjectId, row.id));
    return copy ? { ...copy, topic_id: topicId } : toVirtualQuestion(row, subjectId, topicId);
  });
}

interface AttemptRow {
  question_id: string;
  topic_id: string | null;
  selected_option: string;
  is_correct: number;
  confidence: ReviewConfidence | null;
  self_diagnosis: SelfDiagnosisType;
  attempted_at: string;
  time_spent_seconds?: number | null;
}

function summarizeAttempts(questions: Question[]): Map<string, QuestionAttemptSummary> {
  if (questions.length === 0) return new Map();
  const ids = [...new Set(questions.map((q) => q.id))];
  const rows = queryAll<AttemptRow>(
    getDb(),
    `SELECT question_id, topic_id, selected_option, is_correct, confidence, self_diagnosis, attempted_at, time_spent_seconds
     FROM question_attempts
     WHERE question_id IN (${placeholders(ids.length)})
     ORDER BY attempted_at ASC, rowid ASC`,
    ids
  );
  const byKey = new Map<string, QuestionAttemptSummary>();
  for (const r of rows) {
    const key = `${r.topic_id ?? ''}:${r.question_id}`;
    const prev = byKey.get(key);
    const lastIsCorrect = r.is_correct === 1;
    const isFirstContact = r.selected_option === '';
    const needsRetry =
      !lastIsCorrect ||
      isFirstContact ||
      r.confidence === 'GUESS' ||
      r.self_diagnosis === 'LUCKY_GUESS';
    byKey.set(key, {
      count: (prev?.count ?? 0) + 1,
      lastIsCorrect,
      lastConfidence: r.confidence,
      lastDiagnosis: r.self_diagnosis,
      lastAttemptAt: r.attempted_at,
      isFirstContact,
      lastSelectedOption: r.selected_option || null,
      lastTimeSpentSeconds: typeof r.time_spent_seconds === 'number' ? r.time_spent_seconds : undefined,
      needsRetry,
    });
  }
  return byKey;
}

function withDissectionsAndAttempts(questions: Question[], acervo?: Database | null): QuestionsView['items'] {
  const ids = questions.map((q) => q.id);
  const dissections = new Map(
    ids.length > 0
      ? queryAll<AiDissection>(getDb(), `SELECT * FROM ai_dissections WHERE question_id IN (${placeholders(ids.length)})`, ids).map((d) => [
          d.question_id,
          d,
        ])
      : []
  );
  const summaries = summarizeAttempts(questions);

  // Mapeia os assuntos do acervo para cada item (para o botão de próxima do mesmo assunto)
  const acervoItemIds = [...new Set(questions.map((q) => q.acervo_item_id).filter((id): id is string => Boolean(id)))];
  const assuntosByItemId = new Map<string, { id: string; label: string }[]>();
  if (acervo && acervoItemIds.length > 0) {
    try {
      const rows = queryAll<{ item_id: string; assunto_id: string; caminho_json: string }>(
        acervo,
        `SELECT a.item_id, a.assunto_id, s.caminho_json
         FROM item_assuntos a
         JOIN assuntos s ON s.id = a.assunto_id
         WHERE a.item_id IN (${placeholders(acervoItemIds.length)})`,
        acervoItemIds
      );
      for (const r of rows) {
        let label = r.assunto_id;
        try {
          const caminho = JSON.parse(r.caminho_json) as string[];
          if (caminho.length > 0) label = caminho[caminho.length - 1] ?? r.assunto_id;
        } catch {
          // Mantém id como fallback
        }
        const list = assuntosByItemId.get(r.item_id) ?? [];
        list.push({ id: r.assunto_id, label });
        assuntosByItemId.set(r.item_id, list);
      }
    } catch {
      // Ignora erro se a tabela de assuntos não existir
    }
  }

  return questions.map((question) => ({
    question,
    dissection: dissections.get(question.id) ?? null,
    attemptSummary: summaries.get(`${question.topic_id ?? ''}:${question.id}`) ?? null,
    assuntos: question.acervo_item_id ? assuntosByItemId.get(question.acervo_item_id) ?? [] : [],
  }));
}

/** Quantas questões não anuladas existem na lista (item anulado é só leitura e não entra na contagem do bloco). */
export function countNonAnnulledQuestions(items: { question: Question }[]): number {
  return items.filter((i) => i.question.is_annulled !== 1).length;
}

function groupCodeOf(topicId: string): string | null {
  const parent = queryOne<{ code: string | null; title: string }>(
    getDb(),
    'SELECT p.code, p.title FROM topics t JOIN topics p ON p.id = t.parent_id WHERE t.id = ?',
    [topicId]
  );
  if (!parent) return null;
  return [parent.code, parent.title].filter(Boolean).join(' · ');
}

export function getQuestionsView(input: ScopeInput & { acervo: Database | null }): QuestionsView {
  const topicIds = scopeTopicIds(input);
  const own = ownQuestions(input, topicIds);
  const fromAcervo = input.acervo ? acervoQuestions(input.acervo, topicIds) : [];
  const view: QuestionsView = {
    items: withDissectionsAndAttempts([...own, ...fromAcervo], input.acervo),
    links: [],
    excluded: [],
    groupCode: groupCodeOf(input.topicId),
    acervoMissing: input.acervo === null && hasActiveLinks(topicIds),
  };
  if (input.scope !== 'topic' || !input.acervo) return view;

  const activeIds = getAcervoLinks([input.topicId])
    .filter((l) => l.disabled === 0)
    .map((l) => l.assunto_id);
  const caminhos = assuntoCaminhos(input.acervo, activeIds);
  view.links = activeIds.map((assuntoId) => ({ assuntoId, caminho: caminhos[assuntoId] ?? [] }));
  view.excluded = itemsByIds(input.acervo, getExcludedItemIds(input.topicId)).map((row) => ({
    itemId: row.id,
    sourceLabel: row.source_label,
  }));
  return view;
}

export interface NextSubjectMatch {
  questionId: string;
  subjectLabel: string;
}

/**
 * Encontra a próxima questão inédita (não respondida) que compartilha o mesmo assunto minerado
 * da questão atual (ou o mesmo tópico se for questão própria/sem assunto específico).
 */
export function findNextSameSubjectQuestion(
  currentQuestion: Question | null | undefined,
  items: QuestionsViewItem[],
  sessionAttempts: Record<string, { picked: string | null; firstContact: boolean }> = {}
): NextSubjectMatch | null {
  if (!currentQuestion) return null;

  const currentItem = items.find((i) => i.question.id === currentQuestion.id);
  const currentAssuntos = currentItem?.assuntos ?? [];
  const currentAssuntoIds = currentAssuntos.map((a) => a.id);
  const preferredLabel =
    currentAssuntos[currentAssuntos.length - 1]?.label || null;

  // 1. Prioridade máxima: outra questão não anulada e inédita que compartilha ao menos um assunto específico
  if (currentAssuntoIds.length > 0) {
    const match = items.find((item) => {
      if (item.question.id === currentQuestion.id) return false;
      if (item.question.is_annulled === 1) return false;
      const touched = Boolean(sessionAttempts[`${item.question.topic_id ?? ''}:${item.question.id}`]);
      if (item.attemptSummary || touched) return false;
      return item.assuntos?.some((a) => currentAssuntoIds.includes(a.id));
    });

    if (match) {
      const matchLabel =
        match.assuntos?.find((a) => currentAssuntoIds.includes(a.id))?.label || preferredLabel || 'este assunto';
      return { questionId: match.question.id, subjectLabel: matchLabel };
    }
  }

  // 2. Se não houver do mesmo assunto específico ou questão for própria: outra questão inédita do mesmo tópico
  const topicMatch = items.find((item) => {
    if (item.question.id === currentQuestion.id) return false;
    if (item.question.is_annulled === 1) return false;
    if (item.question.topic_id !== currentQuestion.topic_id) return false;
    const touched = Boolean(sessionAttempts[`${item.question.topic_id ?? ''}:${item.question.id}`]);
    if (item.attemptSummary || touched) return false;
    return true;
  });

  if (topicMatch) {
    return { questionId: topicMatch.question.id, subjectLabel: preferredLabel || 'este tópico' };
  }

  return null;
}

/**
 * "Desligar este assunto" (spec 12c §5.3): a ligação sai de vez e as cópias que só ela cobria saem da Revisão do dia
 * daquele tópico (as tentativas ficam).
 */
export async function disableLinkForTopic(topicId: string, assuntoId: string): Promise<void> {
  disableAcervoLink(topicId, assuntoId);
  const acervo = await openAcervo();
  if (acervo) detachUncoveredCopies(acervo, [topicId]);
}
