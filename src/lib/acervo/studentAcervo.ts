import type { Question } from '../../types/database';
import { getDb, persistDatabase, queryAll, queryOne } from '../database';
import type { Database } from 'sql.js';
import { itemsForAssuntos, type AcervoRow } from './acervoDb';

/**
 * O que o acervo da Cebraspe grava no banco do ESTUDANTE (spec 12c §5.3, §5.5 e §5.7): ligações tópico ↔ assunto,
 * itens tirados de um tópico e a cópia de cada item no primeiro uso que grava algo. O acervo em si fica à parte.
 */

/** Id fixo da cópia de um item numa matéria: o item virtual já nasce com o id que terá quando for copiado. */
export function acervoQuestionId(subjectId: string, itemId: string): string {
  return `acv:${subjectId}:${itemId}`;
}

export function toVirtualQuestion(row: AcervoRow, subjectId: string, topicId: string): Question {
  return {
    id: acervoQuestionId(subjectId, row.id),
    subject_id: subjectId,
    topic_id: topicId,
    exam_board: 'Cebraspe',
    exam_year: row.exam_year,
    organ: row.organ,
    statement: row.statement,
    options_json: row.options_json,
    preliminary_answer: null,
    final_answer: row.final_answer,
    is_annulled: row.anulado,
    annulment_reason: null,
    acervo_item_id: row.id,
    source_label: row.source_label,
    acervo_uncertain: row.incerto,
  };
}

/**
 * Chamada antes de toda gravação que cita a questão (responder, 1º contato, explicação da IA): o item do acervo entra
 * no banco do estudante uma vez só. Não grava em disco sozinha — quem grava em seguida persiste tudo junto.
 */
export function materializeQuestion(question: Question): void {
  if (!question.acervo_item_id) return;
  getDb().run(
    `INSERT OR IGNORE INTO questions (
      id, subject_id, topic_id, exam_board, exam_year, organ, statement, options_json, preliminary_answer, final_answer,
      is_annulled, annulment_reason, acervo_item_id, source_label, acervo_uncertain
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)`,
    [
      question.id,
      question.subject_id,
      question.topic_id,
      question.exam_board,
      question.exam_year,
      question.organ,
      question.statement,
      question.options_json,
      question.final_answer,
      question.is_annulled,
      question.acervo_item_id,
      question.source_label ?? null,
      question.acervo_uncertain ?? 0,
    ]
  );
  // Cópia que saiu do tópico (assunto desligado ou reclassificado) e foi usada de novo num tópico que a cobre volta à
  // Revisão do dia dele
  getDb().run('UPDATE questions SET topic_id = ? WHERE id = ? AND topic_id IS NULL', [question.topic_id, question.id]);
}

/**
 * Cópias cujo tópico não cobre mais o item (assunto desligado, ou o item reclassificado num pacote novo) ficam sem
 * tópico: a Revisão do dia sorteia pelo tópico da cópia e traria questão de outro assunto (anti-objetivo do dono). As
 * tentativas não mudam (valem "dali em diante", spec 12c §5.6). `topicIds` limita a conferência; sem ele, todas.
 */
export function detachUncoveredCopies(acervo: Database, topicIds?: string[]): number {
  if (topicIds?.length === 0) return 0;
  const db = getDb();
  const filter = topicIds ? ` AND topic_id IN (${placeholders(topicIds.length)})` : '';
  const copies = queryAll<{ id: string; topic_id: string; acervo_item_id: string }>(
    db,
    `SELECT id, topic_id, acervo_item_id FROM questions WHERE acervo_item_id IS NOT NULL AND topic_id IS NOT NULL${filter}`,
    topicIds ?? []
  );
  const coveredByTopic = new Map<string, Set<string>>();
  let detached = 0;
  for (const copy of copies) {
    let covered = coveredByTopic.get(copy.topic_id);
    if (!covered) {
      const assuntos = getAcervoLinks([copy.topic_id])
        .filter((l) => l.disabled === 0)
        .map((l) => l.assunto_id);
      covered = new Set(itemsForAssuntos(acervo, assuntos).map((r) => r.id));
      coveredByTopic.set(copy.topic_id, covered);
    }
    if (covered.has(copy.acervo_item_id)) continue;
    db.run('UPDATE questions SET topic_id = NULL WHERE id = ?', [copy.id]);
    detached += 1;
  }
  if (detached > 0) persistDatabase();
  return detached;
}

// ============================================================================
// Ligações tópico ↔ assunto
// ============================================================================

export interface AcervoLink {
  topic_id: string;
  assunto_id: string;
  origin: 'NAME' | 'AI';
  vocab_version: number;
  disabled: number;
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

export function getAcervoLinks(topicIds: string[]): AcervoLink[] {
  if (topicIds.length === 0) return [];
  return queryAll<AcervoLink>(
    getDb(),
    `SELECT topic_id, assunto_id, origin, vocab_version, disabled FROM acervo_links
     WHERE topic_id IN (${placeholders(topicIds.length)}) ORDER BY topic_id, assunto_id`,
    topicIds
  );
}

/**
 * Versão do vocabulário mais nova já usada numa ligação deste banco. O banco do estudante viaja entre computadores
 * (cópia de segurança) e o acervo não: é ela que impede trocar tudo por um pacote mais antigo num computador sem acervo.
 */
export function newestLinkVocabVersion(): number {
  return queryOne<{ v: number | null }>(getDb(), 'SELECT MAX(vocab_version) AS v FROM acervo_links')?.v ?? 0;
}

/** Ligação que já existe (inclusive desligada pelo estudante) fica como está: o "não" dele não é desfeito. */
export function saveAcervoLinks(links: { topicId: string; assuntoId: string; origin: 'NAME' | 'AI'; vocabVersion: number }[]): void {
  if (links.length === 0) return;
  const db = getDb();
  for (const link of links) {
    db.run('INSERT OR IGNORE INTO acervo_links (topic_id, assunto_id, origin, vocab_version) VALUES (?, ?, ?, ?)', [
      link.topicId,
      link.assuntoId,
      link.origin,
      link.vocabVersion,
    ]);
  }
  persistDatabase();
}

/** "Desligar este assunto": a ligação errada sai de uma vez e não volta nas importações seguintes. */
export function disableAcervoLink(topicId: string, assuntoId: string): void {
  getDb().run('UPDATE acervo_links SET disabled = 1 WHERE topic_id = ? AND assunto_id = ?', [topicId, assuntoId]);
  persistDatabase();
}

/**
 * Assunto que sumiu do vocabulário (juntado a outro no minerador): a ligação ATIVA sai, para o tópico ser ligado de
 * novo. A desligada fica, como memória do "não".
 */
export function removeVanishedLinks(validIds: ReadonlySet<string>): number {
  const db = getDb();
  const vanished = queryAll<{ topic_id: string; assunto_id: string }>(
    db,
    'SELECT topic_id, assunto_id FROM acervo_links WHERE disabled = 0'
  ).filter((link) => !validIds.has(link.assunto_id));
  for (const link of vanished) {
    db.run('DELETE FROM acervo_links WHERE topic_id = ? AND assunto_id = ?', [link.topic_id, link.assunto_id]);
  }
  if (vanished.length > 0) persistDatabase();
  return vanished.length;
}

// ============================================================================
// "Não é deste tópico"
// ============================================================================

export function excludeItemFromTopic(topicId: string, itemId: string): void {
  getDb().run('INSERT OR IGNORE INTO acervo_exclusions (topic_id, acervo_item_id) VALUES (?, ?)', [topicId, itemId]);
  persistDatabase();
}

export function restoreItemToTopic(topicId: string, itemId: string): void {
  getDb().run('DELETE FROM acervo_exclusions WHERE topic_id = ? AND acervo_item_id = ?', [topicId, itemId]);
  persistDatabase();
}

export function getExcludedItemIds(topicId: string): string[] {
  return queryAll<{ acervo_item_id: string }>(
    getDb(),
    'SELECT acervo_item_id FROM acervo_exclusions WHERE topic_id = ? ORDER BY created_at, acervo_item_id',
    [topicId]
  ).map((r) => r.acervo_item_id);
}

// ============================================================================
// Reimportação: as cópias acompanham o pacote novo, as tentativas não mudam
// ============================================================================

interface StoredCopy {
  id: string;
  acervo_item_id: string;
  final_answer: string;
  is_annulled: number;
  acervo_uncertain: number;
}

function staleCopies(rows: ReadonlyMap<string, AcervoRow>): { copy: StoredCopy; row: AcervoRow }[] {
  const copies = queryAll<StoredCopy>(
    getDb(),
    'SELECT id, acervo_item_id, final_answer, is_annulled, acervo_uncertain FROM questions WHERE acervo_item_id IS NOT NULL'
  );
  const stale: { copy: StoredCopy; row: AcervoRow }[] = [];
  for (const copy of copies) {
    // Item que sumiu do pacote fica como está (o que o estudante respondeu continua lá)
    const row = rows.get(copy.acervo_item_id);
    if (!row) continue;
    const changed =
      row.final_answer !== copy.final_answer || row.anulado !== copy.is_annulled || row.incerto !== copy.acervo_uncertain;
    if (changed) stale.push({ copy, row });
  }
  return stale;
}

/** Quantas questões já usadas o pacote novo vai mudar (a importação faz uma cópia de segurança antes, se houver). */
export function countStaleCopies(rows: ReadonlyMap<string, AcervoRow>): number {
  return staleCopies(rows).length;
}

/**
 * Gabarito, anulação e incerto passam a valer "dali em diante" (spec 12c §5.6): tentativas antigas não são recalculadas.
 * Gabarito trocado apaga a explicação guardada daquela questão, que contradiria o gabarito novo.
 */
export function refreshCopiedQuestions(rows: ReadonlyMap<string, AcervoRow>): { updated: number } {
  const db = getDb();
  const stale = staleCopies(rows);
  for (const { copy, row } of stale) {
    db.run('UPDATE questions SET final_answer = ?, is_annulled = ?, acervo_uncertain = ? WHERE id = ?', [
      row.final_answer,
      row.anulado,
      row.incerto,
      copy.id,
    ]);
    if (row.final_answer !== copy.final_answer) db.run('DELETE FROM ai_dissections WHERE question_id = ?', [copy.id]);
  }
  if (stale.length > 0) persistDatabase();
  return { updated: stale.length };
}

