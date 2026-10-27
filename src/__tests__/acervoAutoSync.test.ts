// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../lib/storage';

const MINI = JSON.parse(readFileSync('src/__tests__/fixtures/acervo-mini.json', 'utf8')) as {
  vocabulario: { versao: number; assuntos: { id: string; caminho: string[]; sinonimos: string[]; origem: string }[] };
  itens: Record<string, unknown>[];
};

function makePacote(versao: number, extraItem?: Record<string, unknown>): string {
  const p = structuredClone(MINI);
  p.vocabulario.versao = versao;
  if (extraItem) p.itens.push(extraItem);
  return JSON.stringify(p);
}

async function setup() {
  vi.resetModules();
  const db = await import('../lib/database');
  await db.initDatabase({ storage: createMemoryStorage(), sqlJsConfig: {} });
  const store = await import('../lib/acervo/acervoStore');
  store.setAcervoStorageForTests(store.createMemoryAcervoStorage());
  const student = await import('../lib/acervo/studentAcervo');
  const acervoDb = await import('../lib/acervo/acervoDb');
  const autoSync = await import('../lib/acervo/autoSync');

  const plan = db.createStudyPlan({
    title: 'Plano CGU',
    organ: 'CGU',
    exam_board: 'Cebraspe',
    role_title: 'Auditor',
    exam_date: null,
    weekly_hours_target: 20,
  });
  const subject = db.createSubject({
    plan_id: plan.id,
    category: 'ESPECIFICO',
    name: 'Direito Administrativo',
    initial_knowledge_level: 2,
    initial_affinity_level: 2,
    exam_weight: 1,
  });
  const t1 = db.createTopic({ subject_id: subject.id, code: '1', title: 'Atos administrativos' });
  const t2 = db.createTopic({ subject_id: subject.id, code: '2', title: 'Assunto sem correspondente' });
  return { db, store, student, acervoDb, autoSync, plan, subject, topics: [t1, t2] };
}

describe('Sincronização automática do acervo (spec 12d §3.1)', () => {
  it('encerra em silêncio quando /__acervo/index.json não existe (404)', async () => {
    const { autoSync, plan } = await setup();
    const fetchText = vi.fn(async () => null);
    const res = await autoSync.syncLocalAcervoIfNeeded({ planId: plan.id, ai: null, fetchText });
    expect(res).toEqual({ synced: false });
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(fetchText).toHaveBeenCalledWith('/__acervo/index.json');
  });

  it('sincroniza na 1ª vez, ignora na 2ª quando nada mudou (mesmo com tópico sem ligação), e sincroniza de novo quando entram mais itens ou tópico novo', async () => {
    const { db, store, student, acervoDb, autoSync, plan, subject, topics } = await setup();
    let currentIndex = JSON.stringify({
      formato: 'fofolab-acervo-index',
      versao: 1,
      pacotes: [{ id: 'cebraspe', banca: 'Cebraspe', arquivo: 'cebraspe.json', vocabVersion: 5, itensComAssunto: 3, atualizadoEm: '2026-10-27T18:00:00Z' }],
    });
    let currentPacote = makePacote(5);

    const fetchText = vi.fn(async (url: string) => {
      if (url === '/__acervo/index.json') return currentIndex;
      if (url === '/__acervo/cebraspe.json') return currentPacote;
      return null;
    });

    // 1ª abertura: sincroniza
    const first = await autoSync.syncLocalAcervoIfNeeded({ planId: plan.id, ai: null, fetchText });
    expect(first.synced).toBe(true);
    expect(first.summary?.withSubject).toBe(3);
    expect(student.getAcervoLinks([topics[0].id]).map((l) => l.assunto_id)).toEqual(['direito-administrativo>atos-administrativos']);
    expect(acervoDb.acervoWithSubjectCount((await store.openAcervo())!)).toBe(3);

    // 2ª abertura (F5 sem mudança no pacote, mesmo com topics[1] sem ligação): não reimporta
    fetchText.mockClear();
    const second = await autoSync.syncLocalAcervoIfNeeded({ planId: plan.id, ai: null, fetchText });
    expect(second).toEqual({ synced: false });
    expect(fetchText).toHaveBeenCalledTimes(1);

    // Tópico novo criado no plano: sincroniza para ligar o tópico novo
    const t3 = db.createTopic({ subject_id: subject.id, code: '3', title: 'Licitações e contratos' });
    const third = await autoSync.syncLocalAcervoIfNeeded({ planId: plan.id, ai: null, fetchText });
    expect(third.synced).toBe(true);
    expect(student.getAcervoLinks([t3.id]).map((l) => l.assunto_id)).toEqual(['direito-administrativo>licitacoes']);

    // Minerador classificou mais 1 item na mesma versão de vocabulário: sincroniza!
    currentIndex = JSON.stringify({
      formato: 'fofolab-acervo-index',
      versao: 1,
      pacotes: [{ id: 'cebraspe', banca: 'Cebraspe', arquivo: 'cebraspe.json', vocabVersion: 5, itensComAssunto: 4, atualizadoEm: '2026-10-27T19:00:00Z' }],
    });
    currentPacote = makePacote(5, {
      id: 'NOVO_25:c1:99',
      formato: 'CERTO_ERRADO',
      textoBase: null,
      enunciado: 'Item novo classificado.',
      alternativas: null,
      gabarito: 'C',
      anulado: false,
      dependeDeFigura: false,
      temSimboloIlegivel: false,
      procedencias: [{ banca: 'Cebraspe', concurso: 'NOVO 25', ano: 2025, numero: 99 }],
      assuntos: [{ id: 'direito-administrativo>atos-administrativos', confianca: 0.92 }],
      incerto: false,
    });
    const fourth = await autoSync.syncLocalAcervoIfNeeded({ planId: plan.id, ai: null, fetchText });
    expect(fourth.synced).toBe(true);
    expect(fourth.summary?.withSubject).toBe(4);
    expect(acervoDb.acervoWithSubjectCount((await store.openAcervo())!)).toBe(4);
  });

  it('mescla múltiplos pacotes do index.json (ex.: Cebraspe + FGV) preservando a banca de cada item', async () => {
    const { store, acervoDb, student, autoSync, plan, subject, topics } = await setup();
    const index = JSON.stringify({
      formato: 'fofolab-acervo-index',
      versao: 1,
      pacotes: [
        { id: 'cebraspe', banca: 'Cebraspe', arquivo: 'cebraspe.json', vocabVersion: 5, itensComAssunto: 3, atualizadoEm: '2026-10-27T18:00:00Z' },
        { id: 'fgv', banca: 'FGV', arquivo: 'fgv.json', vocabVersion: 6, itensComAssunto: 1, atualizadoEm: '2026-10-27T18:30:00Z' },
      ],
    });
    const fgvPacote = JSON.stringify({
      formato: 'fofolab-acervo',
      versao: 1,
      vocabulario: {
        versao: 6,
        assuntos: [{ id: 'direito-administrativo>atos-administrativos', caminho: ['Direito Administrativo', 'Atos administrativos'], sinonimos: [] }],
      },
      concursos: [],
      itens: [
        {
          id: 'FGV_24:c1:10',
          formato: 'MULTIPLA_ESCOLHA',
          textoBase: null,
          enunciado: 'Questão da FGV sobre atos.',
          alternativas: ['A) Um', 'B) Dois'],
          gabarito: 'A',
          anulado: false,
          dependeDeFigura: false,
          temSimboloIlegivel: false,
          procedencias: [{ banca: 'FGV', concurso: 'RFB 24', ano: 2024, numero: 10 }],
          assuntos: [{ id: 'direito-administrativo>atos-administrativos', confianca: 0.95 }],
          incerto: false,
        },
      ],
    });

    const fetchText = vi.fn(async (url: string) => {
      if (url === '/__acervo/index.json') return index;
      if (url === '/__acervo/cebraspe.json') return makePacote(5);
      if (url === '/__acervo/fgv.json') return fgvPacote;
      return null;
    });

    const res = await autoSync.syncLocalAcervoIfNeeded({ planId: plan.id, ai: null, fetchText });
    expect(res.synced).toBe(true);
    expect(res.summary?.withSubject).toBe(4);
    const db = (await store.openAcervo())!;
    const rows = acervoDb.itemsByIds(db, ['FGV_24:c1:10']);
    expect(rows[0]?.source_label).toBe('FGV · RFB 2024 · item 10');
    const virtual = student.toVirtualQuestion(rows[0], subject.id, topics[0].id);
    expect(virtual.exam_board).toBe('FGV');
  });
});
