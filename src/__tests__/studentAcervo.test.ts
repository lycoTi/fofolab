// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AcervoRow } from '../lib/acervo/acervoDb';
import { createMemoryStorage } from '../lib/storage';

type DatabaseModule = typeof import('../lib/database');
type StudentModule = typeof import('../lib/acervo/studentAcervo');

async function open(): Promise<{ db: DatabaseModule; acervo: StudentModule }> {
  vi.resetModules();
  const db = await import('../lib/database');
  await db.initDatabase({ storage: createMemoryStorage(), sqlJsConfig: {} });
  const acervo = await import('../lib/acervo/studentAcervo');
  return { db, acervo };
}

function setupPlan(db: DatabaseModule, title = 'Plano do acervo') {
  const plan = db.createStudyPlan({ title, organ: 'CGU', exam_board: 'Cebraspe', role_title: 'Auditor', exam_date: null, weekly_hours_target: 20 });
  const subject = db.createSubject({
    plan_id: plan.id,
    category: 'ESPECIFICO',
    name: 'Direito Administrativo',
    initial_knowledge_level: 2,
    initial_affinity_level: 2,
    exam_weight: 1,
  });
  const topicA = db.createTopic({ subject_id: subject.id, code: '1', title: 'Atos administrativos' });
  const topicB = db.createTopic({ subject_id: subject.id, code: '2', title: 'Licitações' });
  return { plan, subject, topicA, topicB };
}

const row = (id: string, extra: Partial<AcervoRow> = {}): AcervoRow => ({
  id,
  statement: `Enunciado do item ${id}`,
  options_json: JSON.stringify(['C) Certo', 'E) Errado']),
  final_answer: 'C',
  anulado: 0,
  incerto: 0,
  source_label: 'Cebraspe · TESTE 2024 · item 1',
  exam_year: 2024,
  organ: 'TESTE 2024',
  ...extra,
});

const count = (db: DatabaseModule, sql: string, params: (string | number)[] = []) => Number(db.getDb().exec(sql, params)[0]?.values[0]?.[0] ?? 0);

describe('Cópia ao usar (spec 12c §5.5)', () => {
  it('o item virtual tem o id fixo da matéria, a procedência e os selos; exibir não copia', async () => {
    const { db, acervo } = await open();
    const { subject, topicA } = setupPlan(db);
    const q = acervo.toVirtualQuestion(row('T:c1:1', { incerto: 1, anulado: 1, final_answer: 'X' }), subject.id, topicA.id);
    expect(q).toMatchObject({
      id: `acv:${subject.id}:T:c1:1`,
      subject_id: subject.id,
      topic_id: topicA.id,
      exam_board: 'Cebraspe',
      exam_year: 2024,
      organ: 'TESTE 2024',
      final_answer: 'X',
      is_annulled: 1,
      acervo_item_id: 'T:c1:1',
      source_label: 'Cebraspe · TESTE 2024 · item 1',
      acervo_uncertain: 1,
    });
    expect(count(db, 'SELECT COUNT(*) FROM questions WHERE acervo_item_id IS NOT NULL')).toBe(0);
  });

  it('materializar duas vezes grava uma linha só; questão própria não é tocada', async () => {
    const { db, acervo } = await open();
    const { subject, topicA } = setupPlan(db);
    const q = acervo.toVirtualQuestion(row('T:c1:1'), subject.id, topicA.id);
    acervo.materializeQuestion(q);
    acervo.materializeQuestion(q);
    expect(count(db, 'SELECT COUNT(*) FROM questions WHERE acervo_item_id = ?', ['T:c1:1'])).toBe(1);
    const before = count(db, 'SELECT COUNT(*) FROM questions');
    acervo.materializeQuestion({ ...q, id: 'propria', acervo_item_id: null });
    expect(count(db, 'SELECT COUNT(*) FROM questions')).toBe(before);
  });

  it('responder a cópia grava a tentativa no tópico em que foi respondida', async () => {
    const { db, acervo } = await open();
    const { subject, topicA, topicB } = setupPlan(db);
    const q = acervo.toVirtualQuestion(row('T:c1:1'), subject.id, topicA.id);
    acervo.materializeQuestion(q);
    db.recordQuestionDiagnosis({ questionId: q.id, topicId: topicB.id, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'MASTERED' });
    expect(count(db, 'SELECT COUNT(*) FROM question_attempts WHERE question_id = ? AND topic_id = ?', [q.id, topicB.id])).toBe(1);
  });

  it('o mesmo item em matérias de dois planos: duas cópias; apagar um plano mantém as tentativas do outro', async () => {
    const { db, acervo } = await open();
    const first = setupPlan(db, 'Plano 1');
    const second = setupPlan(db, 'Plano 2');
    const q1 = acervo.toVirtualQuestion(row('T:c1:1'), first.subject.id, first.topicA.id);
    const q2 = acervo.toVirtualQuestion(row('T:c1:1'), second.subject.id, second.topicA.id);
    for (const [q, topicId] of [[q1, first.topicA.id], [q2, second.topicA.id]] as const) {
      acervo.materializeQuestion(q);
      db.recordQuestionDiagnosis({ questionId: q.id, topicId, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'MASTERED' });
    }
    db.deleteStudyPlan(first.plan.id);
    expect(count(db, 'SELECT COUNT(*) FROM question_attempts WHERE question_id = ?', [q2.id])).toBe(1);
    expect(count(db, 'SELECT COUNT(*) FROM questions WHERE acervo_item_id = ?', ['T:c1:1'])).toBe(1);
  });
});

describe('Peso do item incerto (spec 12c §5.6)', () => {
  it('Dominei num item incerto soma metade; trocar o diagnóstico desfaz e aplica com o mesmo peso', async () => {
    const { db, acervo } = await open();
    const { subject, topicA, topicB } = setupPlan(db);
    const safe = acervo.toVirtualQuestion(row('T:c1:1'), subject.id, topicA.id);
    const uncertain = acervo.toVirtualQuestion(row('T:c1:2', { incerto: 1 }), subject.id, topicB.id);
    acervo.materializeQuestion(safe);
    acervo.materializeQuestion(uncertain);

    const a = db.recordQuestionDiagnosis({ questionId: safe.id, topicId: topicA.id, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'MASTERED' });
    const b = db.recordQuestionDiagnosis({ questionId: uncertain.id, topicId: topicB.id, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'MASTERED' });
    expect(a.deltaMastery).toBe(8);
    expect(b.deltaMastery).toBe(4);
    expect(a.updatedTopic?.mastery_score).toBe(8);
    expect(b.updatedTopic?.mastery_score).toBe(4);

    const { updatedTopic } = db.updateAttemptDiagnosis(b.attemptId, 'DOUBT');
    expect(updatedTopic?.mastery_score).toBe(1);
  });
});

describe('Ligações e itens tirados (spec 12c §5.3 e §5.7)', () => {
  it('ligação desligada não volta ao salvar de novo e não é apagada quando o assunto some', async () => {
    const { db, acervo } = await open();
    const { topicA } = setupPlan(db);
    acervo.saveAcervoLinks([
      { topicId: topicA.id, assuntoId: 'dir>atos', origin: 'NAME', vocabVersion: 5 },
      { topicId: topicA.id, assuntoId: 'dir>velho', origin: 'AI', vocabVersion: 5 },
    ]);
    acervo.disableAcervoLink(topicA.id, 'dir>atos');
    acervo.saveAcervoLinks([{ topicId: topicA.id, assuntoId: 'dir>atos', origin: 'NAME', vocabVersion: 6 }]);
    expect(acervo.getAcervoLinks([topicA.id]).map((l) => [l.assunto_id, l.disabled, l.vocab_version])).toEqual([
      ['dir>atos', 1, 5],
      ['dir>velho', 0, 5],
    ]);

    // Novo vocabulário sem nenhum dos dois: só a ativa sai; a desligada fica como memória do "não"
    expect(acervo.removeVanishedLinks(new Set(['dir>outro']))).toBe(1);
    expect(acervo.getAcervoLinks([topicA.id]).map((l) => l.assunto_id)).toEqual(['dir>atos']);
  });

  it('tirar e devolver um item do tópico; apagar o tópico leva ligações e exclusões', async () => {
    const { db, acervo } = await open();
    const { topicA, topicB } = setupPlan(db);
    acervo.excludeItemFromTopic(topicA.id, 'T:c1:1');
    acervo.excludeItemFromTopic(topicA.id, 'T:c1:1');
    acervo.excludeItemFromTopic(topicB.id, 'T:c1:2');
    expect(acervo.getExcludedItemIds(topicA.id)).toEqual(['T:c1:1']);
    acervo.restoreItemToTopic(topicA.id, 'T:c1:1');
    expect(acervo.getExcludedItemIds(topicA.id)).toEqual([]);

    acervo.saveAcervoLinks([{ topicId: topicB.id, assuntoId: 'dir>lic', origin: 'NAME', vocabVersion: 5 }]);
    db.deleteTopic(topicB.id);
    expect(acervo.getAcervoLinks([topicB.id])).toEqual([]);
    expect(acervo.getExcludedItemIds(topicB.id)).toEqual([]);
  });

  it('item tirado do tópico sai da Revisão do dia daquele tópico', async () => {
    const { db, acervo } = await open();
    const { subject, topicA } = setupPlan(db);
    const q = acervo.toVirtualQuestion(row('T:c1:1'), subject.id, topicA.id);
    acervo.materializeQuestion(q);
    expect(db.getReviewQuestionCandidates([topicA.id])[topicA.id]?.map((c) => c.questionId)).toEqual([q.id]);
    acervo.excludeItemFromTopic(topicA.id, 'T:c1:1');
    expect(db.getReviewQuestionCandidates([topicA.id])[topicA.id]).toBeUndefined();
  });
});

describe('Reimportação atualiza as cópias sem tocar nas tentativas (spec 12c §5.2 e §5.6)', () => {
  it('gabarito trocado atualiza e apaga a explicação; anulação e incerto atualizados; tentativas intactas', async () => {
    const { db, acervo } = await open();
    const { subject, topicA } = setupPlan(db);
    const changed = acervo.toVirtualQuestion(row('T:c1:1', { incerto: 1 }), subject.id, topicA.id);
    const same = acervo.toVirtualQuestion(row('T:c1:2'), subject.id, topicA.id);
    acervo.materializeQuestion(changed);
    acervo.materializeQuestion(same);
    const attempt = db.recordQuestionDiagnosis({ questionId: changed.id, topicId: topicA.id, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'MASTERED' });
    db.saveAiDissection({ questionId: changed.id, provider: 'GROQ_FREE', dissectionMarkdown: 'Explicação', prerequisites: [] });
    db.saveAiDissection({ questionId: same.id, provider: 'GROQ_FREE', dissectionMarkdown: 'Outra', prerequisites: [] });
    const deltaBefore = count(db, 'SELECT mastery_delta FROM question_attempts WHERE id = ?', [attempt.attemptId]);

    const rows = new Map([
      ['T:c1:1', row('T:c1:1', { final_answer: 'E', incerto: 0 })],
      ['T:c1:2', row('T:c1:2')],
    ]);
    expect(acervo.countStaleCopies(rows)).toBe(1);
    expect(acervo.refreshCopiedQuestions(rows)).toEqual({ updated: 1 });
    expect(acervo.countStaleCopies(rows)).toBe(0);

    const stored = db.getQuestionWithDissection(changed.id)!;
    expect(stored.question).toMatchObject({ final_answer: 'E', acervo_uncertain: 0, is_annulled: 0 });
    expect(stored.dissection).toBeNull();
    expect(db.getQuestionWithDissection(same.id)!.dissection).not.toBeNull();
    expect(count(db, 'SELECT COUNT(*) FROM question_attempts WHERE question_id = ?', [changed.id])).toBe(1);
    expect(count(db, 'SELECT mastery_delta FROM question_attempts WHERE id = ?', [attempt.attemptId])).toBe(deltaBefore);

    // Item anulado num pacote mais novo vira só leitura dali em diante
    acervo.refreshCopiedQuestions(new Map([['T:c1:2', row('T:c1:2', { anulado: 1, final_answer: 'X' })]]));
    expect(db.getQuestionWithDissection(same.id)!.question).toMatchObject({ is_annulled: 1, final_answer: 'X' });
  });
});

describe('Cópia fora do assunto ligado sai da Revisão do dia (revisão independente da 12c)', () => {
  async function withAcervoDb() {
    const ctx = await open();
    const { buildAcervoDb } = await import('../lib/acervo/acervoDb');
    const base = { formato: 'CERTO_ERRADO' as const, textoBase: null, alternativas: null, gabarito: 'C', anulado: false, dependeDeFigura: false, temSimboloIlegivel: false, incerto: false };
    const proc = [{ banca: 'Cebraspe', concurso: 'TESTE 24', ano: 2024, numero: 1 }];
    const acervoDb = buildAcervoDb(ctx.db.getSqlJs(), {
      vocabVersion: 3,
      assuntos: ['x', 'x>atos', 'x>licit'].map((id) => ({ id, caminho: id.split('>'), sinonimos: [] })),
      itens: [
        { ...base, id: 'T:c1:1', enunciado: 'Item de atos', procedencias: proc, assuntos: [{ id: 'x>atos', confianca: 0.9 }] },
        { ...base, id: 'T:c1:2', enunciado: 'Item de licitação', procedencias: proc, assuntos: [{ id: 'x>licit', confianca: 0.9 }] },
      ],
      invalidItems: 0,
    }).db;
    const plan = setupPlan(ctx.db);
    const rowOf = (id: string) => row(id);
    return { ...ctx, ...plan, acervoDb, rowOf };
  }

  it('desligar o assunto tira a cópia da revisão do tópico; as tentativas ficam', async () => {
    const { db, acervo, acervoDb, subject, topicA } = await withAcervoDb();
    acervo.saveAcervoLinks([{ topicId: topicA.id, assuntoId: 'x>atos', origin: 'NAME', vocabVersion: 3 }]);
    const q = acervo.toVirtualQuestion(row('T:c1:1'), subject.id, topicA.id);
    acervo.materializeQuestion(q);
    db.recordQuestionDiagnosis({ questionId: q.id, topicId: topicA.id, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'MASTERED' });
    expect(db.getReviewQuestionCandidates([topicA.id])[topicA.id]?.map((c) => c.questionId)).toEqual([q.id]);

    acervo.disableAcervoLink(topicA.id, 'x>atos');
    expect(acervo.detachUncoveredCopies(acervoDb, [topicA.id])).toBe(1);
    expect(db.getReviewQuestionCandidates([topicA.id])[topicA.id]).toBeUndefined();
    expect(count(db, 'SELECT COUNT(*) FROM question_attempts WHERE question_id = ? AND topic_id = ?', [q.id, topicA.id])).toBe(1);
  });

  it('cópia ainda coberta pelo tópico fica onde está', async () => {
    const { acervo, acervoDb, subject, topicA } = await withAcervoDb();
    acervo.saveAcervoLinks([{ topicId: topicA.id, assuntoId: 'x', origin: 'AI', vocabVersion: 3 }]);
    acervo.materializeQuestion(acervo.toVirtualQuestion(row('T:c1:1'), subject.id, topicA.id));
    expect(acervo.detachUncoveredCopies(acervoDb)).toBe(0);
  });

  it('responder de novo num tópico que cobre o item devolve a cópia à revisão dele', async () => {
    const { db, acervo, acervoDb, subject, topicA, topicB } = await withAcervoDb();
    const q = acervo.toVirtualQuestion(row('T:c1:1'), subject.id, topicA.id);
    acervo.materializeQuestion(q);
    acervo.detachUncoveredCopies(acervoDb, [topicA.id]);
    expect(count(db, 'SELECT COUNT(*) FROM questions WHERE id = ? AND topic_id IS NULL', [q.id])).toBe(1);
    acervo.materializeQuestion({ ...q, topic_id: topicB.id });
    expect(db.getReviewQuestionCandidates([topicB.id])[topicB.id]?.map((c) => c.questionId)).toEqual([q.id]);
  });
});
