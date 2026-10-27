import type { Database } from 'sql.js';
import type { AiDissection, Question, Topic } from '../../types/database';
import { getDb, queryAll, queryOne } from '../database';
import { assuntoCaminhos, itemsByIds, itemsForAssuntos, type AcervoRow } from './acervoDb';
import { acervoQuestionId, getAcervoLinks, getExcludedItemIds, toVirtualQuestion } from './studentAcervo';

/**
 * Lista de questões da aba Questões (spec 12c §5.4): as próprias (importadas por texto/JSON) mais os itens do acervo
 * ligados aos tópicos do escopo. Substitui o recuo automático para o grupo e a matéria da 9b (decisão do dono): tópico
 * sem questões fica vazio, e o grupo só aparece quando o estudante pede ("Ver as do grupo").
 */
export type QuestionScope = 'topic' | 'group' | 'subject' | 'all';

export interface QuestionsView {
  items: { question: Question; dissection: AiDissection | null }[];
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

/** Itens ligados aos tópicos do escopo, cada um uma vez (no primeiro tópico em que aparece). */
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
  for (const topicId of topicIds) {
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

function withDissections(questions: Question[]): QuestionsView['items'] {
  const ids = questions.map((q) => q.id);
  const dissections = new Map(
    ids.length > 0
      ? queryAll<AiDissection>(getDb(), `SELECT * FROM ai_dissections WHERE question_id IN (${placeholders(ids.length)})`, ids).map((d) => [
          d.question_id,
          d,
        ])
      : []
  );
  return questions.map((question) => ({ question, dissection: dissections.get(question.id) ?? null }));
}

function groupCodeOf(topicId: string): string | null {
  const parent = queryOne<{ code: string | null; title: string }>(
    getDb(),
    'SELECT p.code, p.title FROM topics t JOIN topics p ON p.id = t.parent_id WHERE t.id = ?',
    [topicId]
  );
  if (!parent) return null;
  return parent.code ?? parent.title;
}

export function getQuestionsView(input: ScopeInput & { acervo: Database | null }): QuestionsView {
  const topicIds = scopeTopicIds(input);
  const own = ownQuestions(input, topicIds);
  const fromAcervo = input.acervo ? acervoQuestions(input.acervo, topicIds) : [];
  const view: QuestionsView = {
    items: withDissections([...own, ...fromAcervo]),
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
