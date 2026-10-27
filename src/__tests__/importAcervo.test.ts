// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AiCallResult } from '../lib/aiRouter';
import { createMemoryStorage } from '../lib/storage';

const MINI = JSON.parse(readFileSync('src/__tests__/fixtures/acervo-mini.json', 'utf8')) as {
  vocabulario: { versao: number; assuntos: { id: string; caminho: string[]; sinonimos: string[]; origem: string }[] };
  itens: Record<string, unknown>[];
};

const assunto = (id: string, caminho: string[], sinonimos: string[] = []) => ({ id, caminho, sinonimos, origem: 'edital' });
const CONCEITOS = [
  assunto('direito-administrativo>atos-administrativos>conceito', ['Direito Administrativo', 'Atos administrativos', 'Conceito']),
  assunto('direito-administrativo>licitacoes>conceito', ['Direito Administrativo', 'Licitações', 'Conceito']),
];

/** Pacote da fixture com as mudanças do teste (vocabulário com "Conceito" repetido para haver ambiguidade). */
function pacoteText(change: (p: typeof MINI) => void = () => {}): string {
  const p = structuredClone(MINI);
  p.vocabulario.assuntos.push(...CONCEITOS);
  change(p);
  return JSON.stringify(p);
}

async function open() {
  vi.resetModules();
  const db = await import('../lib/database');
  await db.initDatabase({ storage: createMemoryStorage(), sqlJsConfig: {} });
  const store = await import('../lib/acervo/acervoStore');
  store.setAcervoStorageForTests(store.createMemoryAcervoStorage());
  const student = await import('../lib/acervo/studentAcervo');
  const { importAcervoPacote } = await import('../lib/acervo/importAcervo');
  const acervoDb = await import('../lib/acervo/acervoDb');

  const plan = db.createStudyPlan({ title: 'Plano', organ: 'CGU', exam_board: 'Cebraspe', role_title: 'Auditor', exam_date: null, weekly_hours_target: 20 });
  const subject = db.createSubject({
    plan_id: plan.id,
    category: 'ESPECIFICO',
    name: 'Direito Administrativo',
    initial_knowledge_level: 2,
    initial_affinity_level: 2,
    exam_weight: 1,
  });
  const titles = ['Atos administrativos', 'Licitações e contratos', 'Conceito', 'Processo administrativo disciplinar'];
  const topics = titles.map((title, i) => db.createTopic({ subject_id: subject.id, code: String(i + 1), title }));
  return { db, store, student, importAcervoPacote, acervoDb, plan, subject, topics };
}

const ok = (text: string): AiCallResult => ({ ok: true, text, provider: 'GROQ_FREE', truncated: false });
const linksOf = (student: typeof import('../lib/acervo/studentAcervo'), topicId: string) =>
  student.getAcervoLinks([topicId]).filter((l) => l.disabled === 0).map((l) => `${l.assunto_id}:${l.origin}`);

describe('Importar o pacote do acervo (spec 12c §5.2 e §5.3)', () => {
  it('sem IA: liga pelo nome, conta o resto como sem ligação e não grava nada como IA', async () => {
    const { student, importAcervoPacote, plan, topics } = await open();
    const result = await importAcervoPacote(pacoteText(), { planId: plan.id, ai: null });
    if (!result.ok) throw new Error(result.message);
    expect(result.summary).toEqual({
      withSubject: 3,
      hidden: 1,
      invalidItems: 1,
      topicsLinked: 2,
      topicsWithoutLink: 2,
      copiesUpdated: 0,
      aiSkipped: true,
    });
    expect(linksOf(student, topics[0].id)).toEqual(['direito-administrativo>atos-administrativos:NAME']);
    expect(linksOf(student, topics[1].id)).toEqual(['direito-administrativo>licitacoes:NAME']);
    expect(student.getAcervoLinks(topics.map((t) => t.id)).some((l) => l.origin === 'AI')).toBe(false);
  });

  it('com IA: o ambíguo liga ao id escolhido; id inventado é ignorado', async () => {
    const { student, importAcervoPacote, plan, topics } = await open();
    const ai = vi.fn(async (prompt: string) => {
      if (prompt.includes('TÓPICO DO PLANO: Direito Administrativo › Conceito')) {
        return ok('{"assuntos":[{"id":"direito-administrativo>atos-administrativos>conceito","confianca":0.9}]}');
      }
      return ok('{"assuntos":[{"id":"direito-administrativo>inventado","confianca":0.95}]}');
    });
    const progress: [number, number][] = [];
    const result = await importAcervoPacote(pacoteText(), { planId: plan.id, ai, onProgress: (d, t) => progress.push([d, t]) });
    if (!result.ok) throw new Error(result.message);
    expect(result.summary).toMatchObject({ topicsLinked: 3, topicsWithoutLink: 1, aiSkipped: false });
    expect(linksOf(student, topics[2].id)).toEqual(['direito-administrativo>atos-administrativos>conceito:AI']);
    expect(linksOf(student, topics[3].id)).toEqual([]);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(progress.at(-1)).toEqual([2, 2]);
  });

  it('IA com limite (429) e depois fora do ar: o que ligou fica gravado, o resto fica sem ligação', async () => {
    const { db, student, importAcervoPacote, plan, subject, topics } = await open();
    const extra = ['Improbidade administrativa', 'Responsabilidade civil do Estado'].map((title, i) =>
      db.createTopic({ subject_id: subject.id, code: String(5 + i), title })
    );
    const responses: AiCallResult[] = [
      ok('{"assuntos":[{"id":"direito-administrativo>licitacoes>conceito","confianca":0.8}]}'),
      { ok: false, retryAfterSec: 5 },
      { ok: false, retryAfterSec: null },
      { ok: false, retryAfterSec: null },
    ];
    const ai = vi.fn(async () => responses.shift() ?? ok('{"assuntos":[]}'));
    const wait = vi.fn(async () => {});
    const result = await importAcervoPacote(pacoteText(), { planId: plan.id, ai, wait });
    if (!result.ok) throw new Error(result.message);

    expect(linksOf(student, topics[2].id)).toEqual(['direito-administrativo>licitacoes>conceito:AI']);
    expect(wait).toHaveBeenCalledWith(5000);
    // 2 falhas seguidas param a IA: o último tópico nem é perguntado
    expect(ai).toHaveBeenCalledTimes(4);
    expect(result.summary).toMatchObject({ topicsLinked: 3, topicsWithoutLink: 3 });
    expect(linksOf(student, extra[1].id)).toEqual([]);
  });

  it('reimportar o mesmo pacote não muda nada; assunto juntado no minerador religa só aquele tópico', async () => {
    const { student, importAcervoPacote, plan, topics } = await open();
    await importAcervoPacote(pacoteText(), { planId: plan.id, ai: null });
    const before = student.getAcervoLinks(topics.map((t) => t.id));
    const again = await importAcervoPacote(pacoteText(), { planId: plan.id, ai: null });
    expect(again.ok && again.summary.topicsLinked).toBe(2);
    expect(student.getAcervoLinks(topics.map((t) => t.id))).toEqual(before);

    const merged = pacoteText((p) => {
      p.vocabulario.versao = 6;
      p.vocabulario.assuntos = p.vocabulario.assuntos.filter((a) => a.id !== 'direito-administrativo>atos-administrativos');
      p.vocabulario.assuntos.push(assunto('direito-administrativo>atos-adm', ['Direito Administrativo', 'Atos adm'], ['Atos administrativos']));
    });
    await importAcervoPacote(merged, { planId: plan.id, ai: null });
    expect(linksOf(student, topics[0].id)).toEqual(['direito-administrativo>atos-adm:NAME']);
    expect(student.getAcervoLinks([topics[1].id])).toEqual(before.filter((l) => l.topic_id === topics[1].id));
  });

  it('ligação desligada pelo estudante não volta, nem pelo nome', async () => {
    const { student, importAcervoPacote, plan, topics } = await open();
    await importAcervoPacote(pacoteText(), { planId: plan.id, ai: null });
    student.disableAcervoLink(topics[0].id, 'direito-administrativo>atos-administrativos');
    const result = await importAcervoPacote(pacoteText(), { planId: plan.id, ai: null });
    expect(linksOf(student, topics[0].id)).toEqual([]);
    expect(result.ok && result.summary.topicsLinked).toBe(1);
  });

  it('pacote mais antigo que o acervo do computador é recusado e o atual continua aberto', async () => {
    const { store, acervoDb, importAcervoPacote, plan } = await open();
    await importAcervoPacote(pacoteText(), { planId: plan.id, ai: null });
    const older = await importAcervoPacote(pacoteText((p) => (p.vocabulario.versao = 4)), { planId: plan.id, ai: null });
    expect(older).toEqual({ ok: false, message: 'Este pacote é mais antigo que o acervo deste computador. Use o pacote mais novo do minerador.' });
    expect(acervoDb.acervoVocabVersion((await store.openAcervo())!)).toBe(5);
  });

  it('pacote que muda o gabarito de uma questão usada faz cópia de segurança antes; pacote igual não faz', async () => {
    const { db, store, student, acervoDb, importAcervoPacote, plan, subject, topics } = await open();
    await importAcervoPacote(pacoteText(), { planId: plan.id, ai: null });
    const [row] = acervoDb.itemsByIds((await store.openAcervo())!, ['TESTE_24:c1:1']);
    student.materializeQuestion(student.toVirtualQuestion(row, subject.id, topics[0].id));

    const changed = pacoteText((p) => {
      p.vocabulario.versao = 6;
      (p.itens[0] as { gabarito: string }).gabarito = 'E';
    });
    const result = await importAcervoPacote(changed, { planId: plan.id, ai: null });
    expect(result.ok && result.summary.copiesUpdated).toBe(1);
    const labels = async () => (await db.listDatabaseBackups()).filter((b) => b.label === 'antes-de-atualizar-acervo').length;
    expect(await labels()).toBe(1);
    await importAcervoPacote(changed, { planId: plan.id, ai: null });
    expect(await labels()).toBe(1);
  });
});
