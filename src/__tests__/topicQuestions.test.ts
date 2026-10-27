// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Database } from 'sql.js';
import type { PacoteItem, PacoteValido } from '../lib/acervo/pacote';
import { createMemoryStorage } from '../lib/storage';

function item(id: string, assuntos: string[], extra: Partial<PacoteItem> = {}): PacoteItem {
  return {
    id,
    formato: 'CERTO_ERRADO',
    textoBase: null,
    enunciado: `Enunciado ${id}`,
    alternativas: null,
    gabarito: 'C',
    anulado: false,
    dependeDeFigura: false,
    temSimboloIlegivel: false,
    procedencias: [{ banca: 'Cebraspe', concurso: 'TESTE 24', ano: 2024, numero: Number(id.slice(1)) }],
    assuntos: assuntos.map((a) => ({ id: a, confianca: 0.9 })),
    incerto: false,
    ...extra,
  };
}

const PACOTE: PacoteValido = {
  vocabVersion: 7,
  assuntos: ['x', 'x>atos', 'x>atos>atributos', 'x>licit', 'x>fig', 'x>outro'].map((id) => ({ id, caminho: id.split('>'), sinonimos: [] })),
  itens: [
    item('i1', ['x>atos>atributos']),
    item('i2', ['x>atos>atributos', 'x>licit'], { procedencias: [{ banca: 'Cebraspe', concurso: 'TESTE 22', ano: 2022, numero: 2 }] }),
    item('i3', ['x>licit'], { incerto: true }),
    item('i4', ['x>atos'], { anulado: true, gabarito: 'X' }),
    item('i5', ['x>atos'], { dependeDeFigura: true }),
    item('i6', ['x>outro']),
  ],
  invalidItems: 0,
};

async function open() {
  vi.resetModules();
  const db = await import('../lib/database');
  await db.initDatabase({ storage: createMemoryStorage(), sqlJsConfig: {} });
  const student = await import('../lib/acervo/studentAcervo');
  const view = await import('../lib/acervo/topicQuestions');
  const { buildAcervoDb } = await import('../lib/acervo/acervoDb');
  const acervo = buildAcervoDb(db.getSqlJs(), PACOTE).db;

  const newPlan = (title: string) =>
    db.createStudyPlan({ title, organ: 'CGU', exam_board: 'Cebraspe', role_title: 'Auditor', exam_date: null, weekly_hours_target: 20 });
  const newSubject = (planId: string, name: string) =>
    db.createSubject({ plan_id: planId, category: 'ESPECIFICO', name, initial_knowledge_level: 2, initial_affinity_level: 2, exam_weight: 1 });

  const plan = newPlan('Plano');
  const subject = newSubject(plan.id, 'Direito Administrativo');
  const parent = db.createTopic({ subject_id: subject.id, code: '1', title: 'Atos e licitações' });
  const [a, b, c] = ['Atos', 'Licitações', 'Contratos'].map((title, i) =>
    db.createTopic({ subject_id: subject.id, parent_id: parent.id, code: `1.${i + 1}`, title })
  );
  const other = newSubject(plan.id, 'Português');
  const d = db.createTopic({ subject_id: other.id, code: '1', title: 'Crase' });
  db.importQuestions(subject.id, [
    { statement: 'Questão própria do tópico A', options: ['C) Certo', 'E) Errado'], finalAnswer: 'C', examBoard: 'FGV', examYear: 2020, organ: 'CGU', topicId: a.id },
  ]);
  student.saveAcervoLinks([
    { topicId: a.id, assuntoId: 'x>atos', origin: 'NAME', vocabVersion: 7 },
    { topicId: b.id, assuntoId: 'x>licit', origin: 'AI', vocabVersion: 7 },
  ]);
  return { db, student, view, acervo, plan, subject, parent, a, b, c, d, newPlan, newSubject };
}

type Ctx = Awaited<ReturnType<typeof open>>;
const viewOf = (ctx: Ctx, topicId: string, scope: 'topic' | 'group' | 'subject' | 'all' = 'topic', acervo: Database | null = ctx.acervo) =>
  ctx.view.getQuestionsView({ scope, planId: ctx.plan.id, subjectId: ctx.subject.id, topicId, acervo });
const labels = (v: { items: { question: { statement: string; acervo_item_id?: string | null } }[] }) =>
  v.items.map((i) => i.question.acervo_item_id ?? i.question.statement);

describe('Questões do tópico com o acervo (spec 12c §5.4)', () => {
  it('próprias primeiro, depois os itens ligados (inclusive por descendente), sem figura e sem item de outro assunto', async () => {
    const ctx = await open();
    const v = viewOf(ctx, ctx.a.id);
    expect(labels(v)).toEqual(['Questão própria do tópico A', 'i1', 'i4', 'i2']);
    expect(v.items[1].question).toMatchObject({ id: `acv:${ctx.subject.id}:i1`, topic_id: ctx.a.id, source_label: 'Cebraspe · TESTE 2024 · item 1' });
    expect(v.links).toEqual([{ assuntoId: 'x>atos', caminho: ['x', 'atos'] }]);
    expect(v.acervoMissing).toBe(false);
  });

  it('item em dois tópicos aparece nos dois e uma vez na matéria inteira', async () => {
    const ctx = await open();
    expect(labels(viewOf(ctx, ctx.b.id))).toEqual(['i3', 'i2']);
    expect(labels(viewOf(ctx, ctx.a.id, 'subject')).filter((l) => l === 'i2')).toHaveLength(1);
    expect(viewOf(ctx, ctx.b.id).items[0].question.acervo_uncertain).toBe(1);
  });

  it('item tirado some só daquele tópico e aparece na lista de tirados com a procedência', async () => {
    const ctx = await open();
    ctx.student.excludeItemFromTopic(ctx.a.id, 'i2');
    const v = viewOf(ctx, ctx.a.id);
    expect(labels(v)).not.toContain('i2');
    expect(v.excluded).toEqual([{ itemId: 'i2', sourceLabel: 'Cebraspe · TESTE 2022 · item 2' }]);
    expect(labels(viewOf(ctx, ctx.b.id))).toContain('i2');
  });

  it('a cópia já gravada vence o item virtual (gabarito atualizado aparece) e fica no tópico da lista', async () => {
    const ctx = await open();
    const virtual = viewOf(ctx, ctx.a.id).items.find((i) => i.question.acervo_item_id === 'i1')!.question;
    ctx.student.materializeQuestion(virtual);
    ctx.db.getDb().run("UPDATE questions SET final_answer = 'E', topic_id = ? WHERE id = ?", [ctx.b.id, virtual.id]);
    const shown = viewOf(ctx, ctx.a.id).items.find((i) => i.question.acervo_item_id === 'i1')!.question;
    expect(shown).toMatchObject({ id: virtual.id, final_answer: 'E', topic_id: ctx.a.id });
  });

  it('nos escopos amplos, o item vai para o tópico mais específico que o cobre (folha antes do grupo)', async () => {
    const ctx = await open();
    // O grupo também ligado (a importação liga tópicos pai): o assunto dele cobre o da folha A
    ctx.student.saveAcervoLinks([{ topicId: ctx.parent.id, assuntoId: 'x>atos', origin: 'NAME', vocabVersion: 7 }]);
    for (const scope of ['subject', 'all'] as const) {
      const topicOf = (itemId: string) => viewOf(ctx, ctx.a.id, scope).items.find((i) => i.question.acervo_item_id === itemId)!.question.topic_id;
      expect(topicOf('i1')).toBe(ctx.a.id);
      expect(topicOf('i2')).toBe(ctx.a.id);
      expect(topicOf('i3')).toBe(ctx.b.id);
    }
  });

  it('anulado aparece marcado (só para leitura)', async () => {
    const ctx = await open();
    expect(viewOf(ctx, ctx.a.id).items.find((i) => i.question.acervo_item_id === 'i4')!.question).toMatchObject({
      is_annulled: 1,
      final_answer: 'X',
    });
  });

  it('tópico sem questões fica vazio, com o código e título do tópico-pai; nada de outro tópico aparece sozinho', async () => {
    const ctx = await open();
    const v = viewOf(ctx, ctx.c.id);
    expect(v.items).toEqual([]);
    expect(v.groupCode).toBe('1 · Atos e licitações');
    expect(viewOf(ctx, ctx.d.id).groupCode).toBeNull();
  });

  it('"Ver as do grupo" traz próprias e acervo dos irmãos', async () => {
    const ctx = await open();
    const v = viewOf(ctx, ctx.c.id, 'group');
    expect(labels(v).sort()).toEqual(['Questão própria do tópico A', 'i1', 'i2', 'i3', 'i4'].sort());
    expect(v.links).toEqual([]);
  });

  it('"Todo o plano" não traz questão de outro plano nem item sem ligação', async () => {
    const ctx = await open();
    const otherPlan = ctx.newPlan('Outro plano');
    const otherSubject = ctx.newSubject(otherPlan.id, 'Contabilidade');
    ctx.db.importQuestions(otherSubject.id, [
      { statement: 'Questão de outro plano', options: ['C) Certo', 'E) Errado'], finalAnswer: 'C', examBoard: 'FGV', examYear: 2021, organ: null, topicId: null },
    ]);
    const all = labels(viewOf(ctx, ctx.a.id, 'all'));
    expect(all).not.toContain('Questão de outro plano');
    expect(all).not.toContain('i6');
    expect(all).toContain('i3');
  });

  it('com ligação e sem o acervo neste computador: só as próprias e o aviso', async () => {
    const ctx = await open();
    const v = viewOf(ctx, ctx.a.id, 'topic', null);
    expect(labels(v)).toEqual(['Questão própria do tópico A']);
    expect(v.acervoMissing).toBe(true);
    expect(viewOf(ctx, ctx.c.id, 'topic', null).acervoMissing).toBe(false);
  });

  it('"Desligar este assunto" tira o assunto da lista e as cópias dele da Revisão do dia do tópico', async () => {
    const ctx = await open();
    const store = await import('../lib/acervo/acervoStore');
    store.setAcervoStorageForTests(store.createMemoryAcervoStorage());
    await store.replaceAcervo(ctx.acervo);
    const used = viewOf(ctx, ctx.a.id).items.find((i) => i.question.acervo_item_id === 'i1')!.question;
    ctx.student.materializeQuestion(used);
    expect(ctx.db.getReviewQuestionCandidates([ctx.a.id])[ctx.a.id]?.map((c) => c.questionId)).toContain(used.id);

    await ctx.view.disableLinkForTopic(ctx.a.id, 'x>atos');
    expect(labels(viewOf(ctx, ctx.a.id))).toEqual(['Questão própria do tópico A']);
    expect(ctx.db.getReviewQuestionCandidates([ctx.a.id])[ctx.a.id]?.map((c) => c.questionId)).not.toContain(used.id);
  });

  it('tópicos do escopo e se há ligação ativa neles', async () => {
    const ctx = await open();
    const ids = (scope: 'topic' | 'group' | 'subject' | 'all', topicId = ctx.c.id) =>
      ctx.view.scopeTopicIds({ scope, planId: ctx.plan.id, subjectId: ctx.subject.id, topicId }).sort();
    expect(ids('topic')).toEqual([ctx.c.id]);
    expect(ids('group')).toEqual([ctx.a.id, ctx.b.id, ctx.c.id].sort());
    expect(ids('subject')).toEqual([ctx.parent.id, ctx.a.id, ctx.b.id, ctx.c.id].sort());
    expect(ids('all')).toEqual([ctx.parent.id, ctx.a.id, ctx.b.id, ctx.c.id, ctx.d.id].sort());
    expect(ctx.view.hasActiveLinks([ctx.c.id])).toBe(false);
    expect(ctx.view.hasActiveLinks(ids('group'))).toBe(true);
    ctx.student.disableAcervoLink(ctx.a.id, 'x>atos');
    ctx.student.disableAcervoLink(ctx.b.id, 'x>licit');
    expect(ctx.view.hasActiveLinks(ids('group'))).toBe(false);
  });

  it('resume as tentativas por tópico (inédita, precisa refazer por erro/chute, ou dominada) e conta só não anuladas para o bloco', async () => {
    const ctx = await open();
    const itemsBefore = viewOf(ctx, ctx.a.id).items;
    expect(itemsBefore.every((i) => i.attemptSummary === null)).toBe(true);
    // 4 itens no tópico A (1 própria + i1, i4 anulada, i2) -> 3 não anuladas
    expect(ctx.view.countNonAnnulledQuestions(viewOf(ctx, ctx.a.id).items)).toBe(3);

    const i1 = itemsBefore.find((i) => i.question.acervo_item_id === 'i1')!.question;
    const i2 = itemsBefore.find((i) => i.question.acervo_item_id === 'i2')!.question;
    ctx.student.materializeQuestion(i1);
    ctx.student.materializeQuestion(i2);

    // i1: respondeu errado no tópico A -> needsRetry = true
    ctx.db.recordQuestionDiagnosis({
      questionId: i1.id,
      topicId: ctx.a.id,
      selectedOption: 'E',
      isCorrect: false,
      selfDiagnosis: 'BASE_GAP',
      confidence: 'THINK',
      timeSpentSeconds: 15,
      usedAiReview: false,
    });

    // i2: acertou com certeza no tópico A -> needsRetry = false (mas no tópico B continua inédita!)
    ctx.db.recordQuestionDiagnosis({
      questionId: i2.id,
      topicId: ctx.a.id,
      selectedOption: 'C',
      isCorrect: true,
      selfDiagnosis: 'MASTERED',
      confidence: 'SURE',
      timeSpentSeconds: 10,
      usedAiReview: false,
    });

    const vA = viewOf(ctx, ctx.a.id);
    const sum1 = vA.items.find((i) => i.question.acervo_item_id === 'i1')!.attemptSummary;
    const sum2 = vA.items.find((i) => i.question.acervo_item_id === 'i2')!.attemptSummary;
    expect(sum1).toMatchObject({ count: 1, lastIsCorrect: false, lastDiagnosis: 'BASE_GAP', needsRetry: true });
    expect(sum2).toMatchObject({ count: 1, lastIsCorrect: true, lastDiagnosis: 'MASTERED', needsRetry: false });

    const vB = viewOf(ctx, ctx.b.id);
    expect(vB.items.find((i) => i.question.acervo_item_id === 'i2')!.attemptSummary).toBeNull();
  });
});
