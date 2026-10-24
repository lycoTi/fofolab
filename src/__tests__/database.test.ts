// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import initSqlJs from 'sql.js';
import schemaV1Sql from './fixtures/schema-v1.sql?raw';
import { createMemoryStorage, LEGACY_LOCALSTORAGE_KEY, type MemoryStorage } from '../lib/storage';
import { LATEST_SCHEMA_VERSION } from '../lib/migrations';

// No Node o sql.js encontra o próprio .wasm ao lado do pacote (config vazia)
const sqlJsConfig = {};
const SQL = await initSqlJs(sqlJsConfig);

type DatabaseModule = typeof import('../lib/database');
type SaveStatusModule = typeof import('../lib/saveStatus');

let dbModule: DatabaseModule | null = null;

async function openDatabase(
  storage: MemoryStorage = createMemoryStorage()
): Promise<{ db: DatabaseModule; status: SaveStatusModule; storage: MemoryStorage }> {
  vi.resetModules();
  const db = await import('../lib/database');
  const status = await import('../lib/saveStatus');
  dbModule = db;
  await db.initDatabase({ storage, sqlJsConfig });
  return { db, status, storage };
}

function scalar(db: DatabaseModule, sql: string, params: (string | number)[] = []): unknown {
  return db.getDb().exec(sql, params)[0]?.values[0]?.[0];
}

function bytesOfV1Database(setup: (db: InstanceType<typeof SQL.Database>) => void): Uint8Array {
  const legacy = new SQL.Database();
  legacy.run(schemaV1Sql);
  setup(legacy);
  const bytes = legacy.export();
  legacy.close();
  return bytes;
}

afterEach(async () => {
  await dbModule?.closeDatabase();
  dbModule = null;
  vi.unstubAllGlobals();
});

describe('Banco local: inicialização, salvamento e proteção dos dados', () => {
  it('cria banco novo na versão mais recente com o exemplo inicial e grava no armazenamento', async () => {
    const { db, storage } = await openDatabase();

    expect(storage.current).not.toBeNull();
    expect(storage.saveCount).toBeGreaterThanOrEqual(1);
    expect(scalar(db, 'PRAGMA user_version')).toBe(LATEST_SCHEMA_VERSION);
    expect(db.getStudyPlans().map((p) => p.id).sort()).toEqual(['plan-bacen', 'plan-cgu']);
  });

  it('mantém as chaves estrangeiras ligadas depois de salvar: excluir disciplina apaga tópicos e questões', async () => {
    const { db } = await openDatabase();
    db.exportDatabaseBinary(); // export() do sql.js reabre a conexão

    expect(scalar(db, 'PRAGMA foreign_keys')).toBe(1);
    db.deleteSubject('subj-cgu-auditoria');
    expect(scalar(db, "SELECT COUNT(*) FROM topics WHERE subject_id = 'subj-cgu-auditoria'")).toBe(0);
    expect(scalar(db, "SELECT COUNT(*) FROM questions WHERE subject_id = 'subj-cgu-auditoria'")).toBe(0);
  });

  it('migra banco antigo (v1) preservando os dados, com cópia de segurança antes da atualização', async () => {
    const legacyBytes = bytesOfV1Database((legacy) => {
      legacy.run("INSERT INTO study_plans (id, title, is_active) VALUES ('plan-meu', 'Meu Plano Real', 1)");
    });
    const { db, storage } = await openDatabase(createMemoryStorage(legacyBytes));

    expect(scalar(db, 'PRAGMA user_version')).toBe(LATEST_SCHEMA_VERSION);
    expect(db.getStudyPlans().map((p) => p.title)).toEqual(['Meu Plano Real']);
    expect(db.getStudyPlans()[0].strategy_mode).toBeNull();
    const backups = await storage.listBackups();
    expect(backups.some((b) => b.label === `antes-da-atualizacao-v${LATEST_SCHEMA_VERSION}`)).toBe(true);
  });

  it('banco salvo que não abre vai para a quarentena (não é sobrescrito sem cópia) e o app começa pelo exemplo', async () => {
    const garbage = new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 37) % 251));
    const { db, status, storage } = await openDatabase(createMemoryStorage(garbage));

    expect(storage.quarantined).toHaveLength(1);
    expect(Array.from(storage.quarantined[0].bytes)).toEqual(Array.from(garbage));
    expect(db.getStudyPlans()).toHaveLength(2);
    expect(status.getSaveStatus().warning).toMatch(/guardados à parte/);
  });

  it('nunca grava por cima de um banco criado por versão mais nova do app', async () => {
    const newer = new SQL.Database();
    newer.run(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 5};`);
    newer.run('CREATE TABLE study_plans (id TEXT PRIMARY KEY, title TEXT);');
    const newerBytes = newer.export();
    newer.close();

    const original = createMemoryStorage(newerBytes);
    const { status } = await openDatabase(original);

    expect(original.saveCount).toBe(0);
    expect(Array.from(original.current ?? [])).toEqual(Array.from(newerBytes));
    expect(status.getSaveStatus().storageKind).toBe('memory');
    expect(status.getSaveStatus().warning).toMatch(/versão mais nova/);
  });

  it('agrupa várias alterações em uma única gravação e grava na hora ao chamar flushDatabase', async () => {
    const { db, storage } = await openDatabase();
    const before = storage.saveCount;

    for (let i = 0; i < 3; i++) {
      db.createTopic({ subject_id: 'subj-cgu-auditoria', code: `9.${i}`, title: `Tópico ${i}` });
    }
    expect(storage.saveCount).toBe(before);

    await db.flushDatabase();
    expect(storage.saveCount).toBe(before + 1);
  });

  it('falha ao gravar vira erro visível (não fica só no console) e a próxima gravação recupera', async () => {
    const { db, status, storage } = await openDatabase();
    storage.failSaves = true;

    db.createTopic({ subject_id: 'subj-cgu-auditoria', code: '9.9', title: 'Vai falhar' });
    await db.flushDatabase();
    expect(status.getSaveStatus().state).toBe('error');
    expect(status.getSaveStatus().errorMessage).toMatch(/Não foi possível salvar/);

    storage.failSaves = false;
    await db.flushDatabase();
    expect(status.getSaveStatus().state).toBe('saved');
  });

  it('migra o formato antigo (base64 no localStorage) e só apaga a cópia antiga depois de gravar', async () => {
    const legacyBytes = bytesOfV1Database((legacy) => {
      legacy.run("INSERT INTO study_plans (id, title, is_active) VALUES ('plan-ls', 'Plano do localStorage', 1)");
    });
    let binary = '';
    for (const byte of legacyBytes) binary += String.fromCharCode(byte);
    const data = new Map<string, string>([[LEGACY_LOCALSTORAGE_KEY, btoa(binary)]]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });

    const { db, storage } = await openDatabase();

    expect(db.getStudyPlans().map((p) => p.title)).toEqual(['Plano do localStorage']);
    expect(storage.current).not.toBeNull();
    expect(data.has(LEGACY_LOCALSTORAGE_KEY)).toBe(false);
  });

  it('gera IDs únicos mesmo criando dezenas de registros no mesmo instante', async () => {
    const { db } = await openDatabase();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(db.createTopic({ subject_id: 'subj-cgu-ti-dev', code: `7.${i}`, title: `Lote ${i}` }).id);
    }
    expect(ids.size).toBe(50);
  });

  it('faz a cópia automática do dia no primeiro salvamento', async () => {
    const { db } = await openDatabase();
    const backups = await db.listDatabaseBackups();
    expect(backups.filter((b) => b.label === 'diaria')).toHaveLength(1);
  });
});

describe('Backup e restauração', () => {
  it('restaura um backup: valida, guarda cópia do estado atual e substitui tudo', async () => {
    const { db } = await openDatabase();
    db.createStudyPlan({ title: 'Plano X', organ: 'X', exam_board: 'FGV', role_title: 'R', exam_date: null, weekly_hours_target: 10 });
    const backupBytes = db.exportDatabaseBinary();
    db.createStudyPlan({ title: 'Plano Y', organ: 'Y', exam_board: 'FGV', role_title: 'R', exam_date: null, weekly_hours_target: 10 });

    await db.restoreDatabaseFromBytes(backupBytes, 'arquivo');

    const titles = db.getStudyPlans().map((p) => p.title);
    expect(titles).toContain('Plano X');
    expect(titles).not.toContain('Plano Y');
    const labels = (await db.listDatabaseBackups()).map((b) => b.label);
    expect(labels).toContain('antes-de-restaurar-arquivo');
  });

  it('recusa arquivo que não é backup do FofoLab sem mexer nos estudos atuais', async () => {
    const { db } = await openDatabase();
    const before = db.getStudyPlans().length;

    await expect(db.restoreDatabaseFromBytes(new Uint8Array([1, 2, 3, 4, 5]), 'arquivo')).rejects.toBeInstanceOf(
      db.InvalidBackupError
    );
    expect(db.getStudyPlans()).toHaveLength(before);
  });

  it('restaurar o exemplo inicial guarda uma cópia antes de apagar', async () => {
    const { db } = await openDatabase();
    db.createStudyPlan({ title: 'Plano Pessoal', organ: 'P', exam_board: 'FGV', role_title: 'R', exam_date: null, weekly_hours_target: 10 });

    await db.resetDatabaseToSeed();

    expect(db.getStudyPlans().map((p) => p.title)).not.toContain('Plano Pessoal');
    const copy = (await db.listDatabaseBackups()).find((b) => b.label === 'antes-de-restaurar-exemplo');
    expect(copy).toBeDefined();

    await db.restoreDatabaseBackup(copy!.id);
    expect(db.getStudyPlans().map((p) => p.title)).toContain('Plano Pessoal');
  });

  it('conta o que uma exclusão vai levar junto (para a confirmação)', async () => {
    const { db } = await openDatabase();
    const deps = db.countDependents('plan', 'plan-cgu');
    expect(deps.subjects).toBe(4);
    expect(deps.topics).toBeGreaterThanOrEqual(8);
    expect(deps.questions).toBeGreaterThanOrEqual(5);
  });
});

describe('Bancada: cadernos, PDFs e diagnóstico gravados no lugar certo', () => {
  it('caderno é sempre do próprio tópico (não mostra o caderno de outro tópico da disciplina)', async () => {
    const { db } = await openDatabase();
    expect(db.getNotebookForTopic('t-cgu-1-1')?.id).toBe('nb-cgu-1-1');
    expect(db.getNotebookForTopic('t-cgu-1-3')).toBeNull();
  });

  it('salvar o PDF de um tópico nunca sobrescreve o PDF de outro tópico', async () => {
    const { db } = await openDatabase();

    // Mesmo recebendo o id do PDF do tópico 1.1, salvar para o 1.3 cria/atualiza o registro do 1.3
    const saved = db.savePdfSourceProgress({
      pdfSourceId: 'pdf-cgu-1-1',
      subjectId: 'subj-cgu-auditoria',
      topicId: 't-cgu-1-3',
      title: 'Amostragem.pdf',
      filePath: 'Amostragem.pdf',
      currentPage: 3,
      totalPages: 20,
    });

    expect(saved.id).not.toBe('pdf-cgu-1-1');
    expect(saved.topic_id).toBe('t-cgu-1-3');
    const original = db.getPdfSourceForTopic('subj-cgu-auditoria', 't-cgu-1-1');
    expect(original?.title).toBe('Manual de Auditoria Governamental & ISSAI 100-400.pdf');
    expect(original?.current_page).toBe(24);
  });

  it('páginas lidas do PDF: ficam com o mesmo arquivo, zeram ao trocar de arquivo e respeitam o total', async () => {
    const { db } = await openDatabase();
    const base = { subjectId: 'subj-cgu-auditoria', topicId: 't-cgu-1-1', currentPage: 3 };
    const sourceId = 'pdf-cgu-1-1';
    const title = 'Manual de Auditoria Governamental & ISSAI 100-400.pdf';
    const filePath = 'docs/pdfs/issai-100-cgu.pdf';

    const marked = db.savePdfSourceProgress({ ...base, pdfSourceId: sourceId, title, filePath, totalPages: 68, readPages: [1, 2, 99] });
    expect(JSON.parse(marked.read_pages_json)).toEqual([1, 2]);

    // Só mudar a página atual mantém o que já foi lido
    const moved = db.savePdfSourceProgress({ ...base, pdfSourceId: sourceId, title, filePath, totalPages: 68, currentPage: 10 });
    expect(JSON.parse(moved.read_pages_json)).toEqual([1, 2]);

    // Outro arquivo no mesmo tópico começa do zero
    const other = db.savePdfSourceProgress({ ...base, pdfSourceId: sourceId, title: 'Outro.pdf', filePath: 'Outro.pdf', totalPages: 5 });
    expect(other.id).toBe(sourceId);
    expect(JSON.parse(other.read_pages_json)).toEqual([]);
  });

  it('recusa diagnóstico incoerente e grava tempo gasto e uso da explicação de verdade', async () => {
    const { db } = await openDatabase();
    const base = { questionId: 'q-fgv-cgu-issai-1', topicId: 't-cgu-1-1' };

    expect(() =>
      db.recordQuestionDiagnosis({ ...base, selectedOption: 'A', isCorrect: false, selfDiagnosis: 'MASTERED' })
    ).toThrow(db.InconsistentDiagnosisError);
    expect(() =>
      db.recordQuestionDiagnosis({ ...base, selectedOption: null, isCorrect: false, selfDiagnosis: 'DOUBT' })
    ).toThrow(db.InconsistentDiagnosisError);

    db.recordQuestionDiagnosis({
      ...base,
      selectedOption: 'C',
      isCorrect: true,
      selfDiagnosis: 'MASTERED',
      timeSpentSeconds: 73,
      usedAiReview: false,
    });
    db.recordQuestionDiagnosis({ ...base, selectedOption: null, isCorrect: false, selfDiagnosis: 'BASE_GAP', usedAiReview: true });

    const [firstContact, answered] = db.getRecentAttempts(2);
    expect(answered.time_spent_seconds).toBe(73);
    expect(answered.used_ai_review).toBe(0);
    expect(firstContact.selected_option).toBe('');
    expect(firstContact.used_ai_review).toBe(1);
  });
});

describe('Importação de questões, tópicos e explicações', () => {
  it('importa questões em lote e não duplica ao importar de novo', async () => {
    const { db } = await openDatabase();
    const items = [
      {
        statement: 'Questão importada número 1 sobre auditoria?',
        options: ['A) Sim', 'B) Não'],
        finalAnswer: 'A',
        examBoard: 'FGV',
        examYear: 2024,
        organ: 'CGU',
        topicId: 't-cgu-1-1',
      },
      {
        statement: 'Item Certo/Errado importado.',
        options: ['C) Certo', 'E) Errado'],
        finalAnswer: 'E',
        examBoard: 'Cebraspe',
        examYear: 2023,
        organ: 'TCU',
        topicId: null,
      },
    ];

    expect(db.importQuestions('subj-cgu-auditoria', items).inserted).toBe(2);
    const again = db.importQuestions('subj-cgu-auditoria', items);
    expect(again.inserted).toBe(0);
    expect(again.skippedDuplicates).toBe(2);

    const imported = db.getQuestionsForTopicOrSubject('', 'subj-cgu-auditoria', 'subject');
    const certoErrado = imported.find((q) => q.question.final_answer === 'E');
    expect(JSON.parse(certoErrado!.question.options_json)).toEqual(['C) Certo', 'E) Errado']);
  });

  it('importa tópicos do edital ligando subtópicos ao tópico pai', async () => {
    const { db } = await openDatabase();
    const result = db.importSyllabusTopics('subj-cgu-ti-dev', [
      { code: '5', title: 'Banco de Dados' },
      { code: '5.1', title: 'Modelagem relacional' },
    ]);
    expect(result.inserted).toBe(2);

    const topics = db.getTopicsBySubject('subj-cgu-ti-dev');
    const parent = topics.find((t) => t.code === '5')!;
    expect(topics.find((t) => t.code === '5.1')?.parent_id).toBe(parent.id);

    expect(db.importSyllabusTopics('subj-cgu-ti-dev', [{ code: '5', title: 'Banco de Dados' }]).skippedDuplicates).toBe(1);
  });

  it('guarda a explicação gerada pela IA e atualiza se gerar de novo, sem perder o histórico de dúvidas', async () => {
    const { db } = await openDatabase();
    const [{ insertedIds }] = [
      db.importQuestions('subj-cgu-auditoria', [
        { statement: 'Nova questão sem explicação?', options: ['A) x', 'B) y'], finalAnswer: 'B', examBoard: 'FGV', examYear: 2024, organ: 'CGU', topicId: null },
      ]),
    ];
    const questionId = insertedIds[0];

    db.saveAiDissection({ questionId, provider: 'GEMINI_FREE', dissectionMarkdown: 'v1', prerequisites: ['A'] });
    db.saveQuestionChatHistory(questionId, '[{"id":"1"}]');
    const updated = db.saveAiDissection({ questionId, provider: 'DEEPSEEK_FALLBACK', dissectionMarkdown: 'v2', prerequisites: [] });

    expect(updated.dissection_markdown).toBe('v2');
    expect(updated.provider_used).toBe('DEEPSEEK_FALLBACK');
    expect(updated.chat_history_json).toBe('[{"id":"1"}]');
  });
});

describe('Plano montado a partir do edital (docs/specs/07)', () => {
  const editalInput = {
    title: 'CGU 2026 — Desenvolvimento de Sistemas',
    organ: 'CGU',
    examBoard: 'Cebraspe',
    roleTitle: 'Tecnologia da Informação – Desenvolvimento de Sistemas',
    examDate: '2026-12-13',
    registrationDeadline: '2026-11-04',
    minTotalScore: 78,
    weeklyHoursTarget: 20,
    parts: [
      { code: 'P1', name: 'Conhecimentos básicos', itemCount: 40, pointsPerItem: 1, minScore: 8 },
      { code: 'P3', name: 'Conhecimentos específicos', itemCount: 90, pointsPerItem: 2, minScore: 54 },
    ],
    subjects: [
      { name: 'Ética Pública', partCode: 'P1', examWeight: 0.5, topics: [{ code: '1', title: 'Fundamentos' }] },
      {
        name: 'Arquitetura e Integração de Sistemas',
        partCode: 'P3',
        examWeight: 2.25,
        topics: [
          { code: '1', title: 'Arquiteturas de aplicações' },
          { code: '1.1', title: 'Monolitos e microsserviços' },
          { code: '2', title: 'APIs e identidade' },
        ],
      },
    ],
  };

  it('cria plano ativo, provas, matérias na prova certa e tópicos ligados ao pai', async () => {
    const { db } = await openDatabase();
    const plan = db.createPlanFromEdital(editalInput);

    expect(db.getActiveStudyPlan()?.id).toBe(plan.id);
    expect(plan).toMatchObject({ organ: 'CGU', exam_date: '2026-12-13', registration_deadline: '2026-11-04', min_total_score: 78, study_moment: 'POS_EDITAL' });

    const parts = db.getExamPartsByPlan(plan.id);
    expect(parts.map((p) => [p.code, p.item_count, p.points_per_item, p.min_score])).toEqual([
      ['P1', 40, 1, 8],
      ['P3', 90, 2, 54],
    ]);

    const subjects = db.getSubjectsByPlan(plan.id);
    const arquitetura = subjects.find((s) => s.name.startsWith('Arquitetura'))!;
    expect(arquitetura).toMatchObject({ category: 'ESPECIFICO', exam_weight: 2.25, exam_part_id: parts[1].id });
    expect(subjects.find((s) => s.name === 'Ética Pública')?.category).toBe('BASICO');

    const topics = db.getTopicsBySubject(arquitetura.id);
    const parent = topics.find((t) => t.code === '1')!;
    expect(topics.find((t) => t.code === '1.1')?.parent_id).toBe(parent.id);

    // O plano de exemplo continua lá
    expect(db.getStudyPlans().length).toBeGreaterThan(1);
  });

  it('grava a autoavaliação da matéria e do tópico (null = herda da matéria)', async () => {
    const { db } = await openDatabase();
    const plan = db.createPlanFromEdital(editalInput);
    const arquitetura = db.getSubjectsByPlan(plan.id).find((s) => s.name.startsWith('Arquitetura'))!;
    const [first, , second] = db.getTopicsBySubject(arquitetura.id);

    db.saveSelfAssessment({
      subjects: [{ subjectId: arquitetura.id, level: 1 }],
      topics: [
        { topicId: first.id, level: 3 },
        { topicId: second.id, level: 9 },
      ],
    });

    expect(db.getSubjectsByPlan(plan.id).find((s) => s.id === arquitetura.id)?.initial_knowledge_level).toBe(1);
    const levels = Object.fromEntries(db.getTopicsBySubject(arquitetura.id).map((t) => [t.code, t.initial_knowledge_level]));
    expect(levels).toEqual({ '1': 3, '1.1': null, '2': 4 });

    db.saveSelfAssessment({ subjects: [], topics: [{ topicId: first.id, level: null }] });
    expect(db.getTopicsBySubject(arquitetura.id).find((t) => t.code === '1')?.initial_knowledge_level).toBeNull();
  });

  it('apagar o plano leva junto as provas', async () => {
    const { db } = await openDatabase();
    const plan = db.createPlanFromEdital(editalInput);
    db.deleteStudyPlan(plan.id);
    expect(db.getExamPartsByPlan(plan.id)).toEqual([]);
  });
});

describe('Roteiro do dia congelado (docs/specs/09)', () => {
  it('guarda o roteiro do dia por plano e data', async () => {
    const { db } = await openDatabase();
    const planId = db.getActiveStudyPlan()!.id;
    const block = { blockNumber: 1, subjectId: 's1', topicId: 't1', durationMinutes: 60, reasonText: 'Faltam 01:00' };

    db.saveDailyPlan(planId, '2026-10-22', [block], 'perfil-1');
    expect(db.getDailyPlan(planId, '2026-10-22')).toEqual({ blocks: [block], profileKey: 'perfil-1' });
    expect(db.getDailyPlan(planId, '2026-10-23')).toBeNull();
    expect(db.getDailyPlan('outro-plano', '2026-10-22')).toBeNull();

    const replaced = { ...block, durationMinutes: 30 };
    db.saveDailyPlan(planId, '2026-10-22', [replaced], 'perfil-2');
    expect(db.getDailyPlan(planId, '2026-10-22')).toEqual({ blocks: [replaced], profileKey: 'perfil-2' });

    db.clearDailyPlan(planId, '2026-10-22');
    expect(db.getDailyPlan(planId, '2026-10-22')).toBeNull();
  });

  it('a chave do dia é a data local', async () => {
    const { db } = await openDatabase();
    expect(db.localDateKey(new Date(2026, 9, 22, 23, 59))).toBe('2026-10-22');
    expect(db.localDateKey(new Date(2026, 9, 23, 0, 1))).toBe('2026-10-23');
  });

  it('o banco está na versão da revisão do dia', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(8);
  });
});

describe('Questões do bloco com recuo para o grupo (docs/specs/09)', () => {
  const q = (statement: string, topicId: string | null) => ({
    statement,
    options: ['C) Certo', 'E) Errado'],
    finalAnswer: 'C',
    examBoard: 'Cebraspe',
    examYear: 2024,
    organ: 'CGU',
    topicId,
  });

  it('tópico sem questões mostra as do grupo; sem grupo, as da matéria', async () => {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const group = db.createTopic({ subject_id: subjectId, code: '9.2', title: 'Segurança' });
    const owasp = db.createTopic({ subject_id: subjectId, parent_id: group.id, code: '9.2.1', title: 'OWASP' });
    const jwt = db.createTopic({ subject_id: subjectId, parent_id: group.id, code: '9.2.2', title: 'JWT' });
    const lonely = db.createTopic({ subject_id: subjectId, code: '9.9', title: 'Sozinho' });
    db.importQuestions(subjectId, [q('Item sobre JWT na prova.', jwt.id)]);

    const own = db.getTopicQuestionsWithFallback(jwt.id, subjectId);
    expect(own.items).toHaveLength(1);
    expect(own.fallback).toBeNull();

    const fromGroup = db.getTopicQuestionsWithFallback(owasp.id, subjectId);
    expect(fromGroup.items.map((i) => i.question.topic_id)).toEqual([jwt.id]);
    expect(fromGroup.fallback).toEqual({ kind: 'group', code: '9.2' });

    const fromSubject = db.getTopicQuestionsWithFallback(lonely.id, subjectId);
    expect(fromSubject.fallback).toEqual({ kind: 'subject' });
    expect(fromSubject.items.length).toBeGreaterThan(0);
  });
});

describe('Registro rápido de questões feitas fora do app (docs/specs/07 §5.4)', () => {
  it('gravar muda domínio, status, data de estudo e domínio da matéria; desfazer volta só o último', async () => {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const topic = db.createTopic({ subject_id: subjectId, code: '8.1', title: 'Tópico externo', mastery_score: 40 });

    const first = db.recordQuestionLog({ subjectId, topicId: topic.id, total: 20, correct: 14, blank: 2 });
    expect(first.log.source).toBe('EXTERNAL');
    expect(first.log.mastery_before).toBe(40);
    expect(first.topic.mastery_score).toBe(70);
    expect(first.topic.last_studied_at).not.toBeNull();
    expect(db.getQuestionLogs().map((l) => l.id)).toContain(first.log.id);

    const second = db.recordQuestionLog({ subjectId, topicId: topic.id, total: 10, correct: 2, blank: 0 });
    expect(second.topic.mastery_score).toBeLessThan(70);

    expect(db.undoQuestionLog(second.log.id)).toBe(true);
    expect(db.getTopicsBySubject(subjectId).find((t) => t.id === topic.id)?.mastery_score).toBe(70);
    expect(db.getQuestionLogs().map((l) => l.id)).toEqual([first.log.id]);
  });

  it('desfazer um registro que já não é o último só apaga o registro, sem voltar o domínio a um valor velho', async () => {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const topic = db.createTopic({ subject_id: subjectId, code: '8.3', title: 'Com evidência depois', mastery_score: 40 });
    const first = db.recordQuestionLog({ subjectId, topicId: topic.id, total: 10, correct: 10, blank: 0 });
    const second = db.recordQuestionLog({ subjectId, topicId: topic.id, total: 10, correct: 10, blank: 0 });
    expect(db.undoQuestionLog(first.log.id)).toBe(true);
    expect(db.getTopicsBySubject(subjectId).find((t) => t.id === topic.id)?.mastery_score).toBe(second.topic.mastery_score);
    expect(db.getQuestionLogs().map((l) => l.id)).toEqual([second.log.id]);
  });

  it('desfazer o único registro de um tópico nunca estudado volta a data de estudo a vazio', async () => {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const topic = db.createTopic({ subject_id: subjectId, code: '8.4', title: 'Nunca estudado' });
    const { log } = db.recordQuestionLog({ subjectId, topicId: topic.id, total: 10, correct: 5, blank: 0 });
    db.undoQuestionLog(log.id);
    const after = db.getTopicsBySubject(subjectId).find((t) => t.id === topic.id)!;
    expect(after.last_studied_at).toBeNull();
    expect(after.mastery_score).toBe(0);
  });

  it('tópico "pai" (agrupador) não recebe registro', async () => {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const parent = db.createTopic({ subject_id: subjectId, code: '8', title: 'Grupo' });
    db.createTopic({ subject_id: subjectId, parent_id: parent.id, code: '8.9', title: 'Filho' });
    expect(() => db.recordQuestionLog({ subjectId, topicId: parent.id, total: 10, correct: 5, blank: 0 })).toThrow();
  });

  it('apagar um tópico avisa quantos registros de questões vão junto', async () => {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const topic = db.createTopic({ subject_id: subjectId, code: '8.5', title: 'Com registros' });
    db.recordQuestionLog({ subjectId, topicId: topic.id, total: 10, correct: 5, blank: 0 });
    expect(db.countDependents('topic', topic.id).questionLogs).toBe(1);
  });

  it('recusa números impossíveis', async () => {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const topic = db.createTopic({ subject_id: subjectId, code: '8.2', title: 'Outro' });
    expect(() => db.recordQuestionLog({ subjectId, topicId: topic.id, total: 10, correct: 8, blank: 3 })).toThrow();
    expect(() => db.recordQuestionLog({ subjectId, topicId: topic.id, total: 0, correct: 0, blank: 0 })).toThrow();
  });
});

describe('Totais de estudo (docs/specs/10 §3.5)', () => {
  it('soma o estudo de hoje, da semana, do ano e de tudo', async () => {
    const { db } = await openDatabase();
    const subjectId = String(scalar(db, 'SELECT id FROM subjects LIMIT 1'));
    db.getDb().run('DELETE FROM study_sessions');
    const insert = (iso: string, minutes: number) =>
      db.getDb().run(
        "INSERT INTO study_sessions (id, subject_id, topic_id, duration_minutes, session_type, pauses_count, was_skipped, started_at) VALUES (?, ?, NULL, ?, 'POMODORO', 0, 0, ?)",
        [`s-${iso}-${minutes}`, subjectId, minutes, iso]
      );
    const now = new Date(2026, 9, 22, 15, 0); // quinta-feira, 22/10/2026
    insert(new Date(2026, 9, 22, 9, 0).toISOString(), 50); // hoje
    insert(new Date(2026, 9, 20, 9, 0).toISOString(), 30); // terça desta semana
    insert(new Date(2026, 2, 10, 9, 0).toISOString(), 40); // este ano
    insert(new Date(2025, 11, 31, 9, 0).toISOString(), 25); // ano passado
    expect(db.getStudyTotals(now)).toEqual({ todayMinutes: 50, weekMinutes: 80, yearMinutes: 120, allMinutes: 145 });
  });
});

describe('Revisão do dia (docs/specs/09 §5.3, migração v8)', () => {
  const certoErrado = (statement: string, topicId: string) => ({
    statement,
    options: ['C) Certo', 'E) Errado'],
    finalAnswer: 'C',
    examBoard: 'Cebraspe',
    examYear: 2024,
    organ: 'CGU',
    topicId,
  });

  async function topicWithQuestions(statements: string[]) {
    const { db } = await openDatabase();
    const subjectId = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0].id;
    const topic = db.createTopic({ subject_id: subjectId, code: '7.7', title: 'Revisão', mastery_score: 40 });
    db.importQuestions(subjectId, statements.map((s) => certoErrado(s, topic.id)));
    const questionIds = db.getQuestionsForTopicOrSubject(topic.id, subjectId).map((i) => i.question.id);
    return { db, subjectId, topic, questionIds };
  }

  it('tentativa da revisão grava a confiança e a origem; fora da revisão ficam vazias', async () => {
    const { db, topic, questionIds } = await topicWithQuestions(['Primeiro item da revisão.', 'Segundo item da revisão.']);
    db.recordQuestionDiagnosis({
      questionId: questionIds[0],
      topicId: topic.id,
      selectedOption: 'C',
      isCorrect: true,
      selfDiagnosis: 'MASTERED',
      confidence: 'SURE',
      source: 'DAILY_REVIEW',
    });
    db.recordQuestionDiagnosis({ questionId: questionIds[1], topicId: topic.id, selectedOption: 'E', isCorrect: false, selfDiagnosis: 'BASE_GAP' });
    const rows = db.getRecentAttempts(10).filter((a) => a.topic_id === topic.id);
    const review = rows.find((a) => a.question_id === questionIds[0])!;
    const plain = rows.find((a) => a.question_id === questionIds[1])!;
    expect([review.confidence, review.source]).toEqual(['SURE', 'DAILY_REVIEW']);
    expect([plain.confidence, plain.source]).toEqual([null, null]);
  });

  it('autoavaliação da pergunta aberta conta como estudo, mas não mexe no domínio', async () => {
    const { db, subjectId, topic } = await topicWithQuestions([]);
    const check = db.recordRecallCheck({ subjectId, topicId: topic.id, rating: 'GOOD' });
    expect(check.rating).toBe('GOOD');
    const after = db.getTopicsBySubject(subjectId).find((t) => t.id === topic.id)!;
    expect(after.last_studied_at).not.toBeNull();
    expect(after.mastery_score).toBe(40);
    expect(db.getRecallChecks().map((c) => c.id)).toEqual([check.id]);
  });

  it('a revisão do dia fica guardada por plano e data, e pular fica registrado', async () => {
    const { db } = await openDatabase();
    const planId = db.getActiveStudyPlan()!.id;
    const item = { topicId: 't1', subjectId: 's1', kind: 'OPEN' as const, questionId: null, reason: 'COOLING' as const };
    expect(db.getDailyReview(planId, '2026-10-24')).toBeNull();
    db.saveDailyReview(planId, '2026-10-24', [item]);
    const saved = db.getDailyReview(planId, '2026-10-24')!;
    expect(saved.items).toEqual([item]);
    expect(saved.skipped).toBe(false);
    expect(saved.createdAt).toBeTruthy();
    db.skipDailyReview(planId, '2026-10-24');
    expect(db.getDailyReview(planId, '2026-10-24')!.skipped).toBe(true);
    expect(db.getDailyReview(planId, '2026-10-25')).toBeNull();
  });

  it('candidatas da revisão: sem anuladas, com a data da última tentativa', async () => {
    const { db, topic, questionIds } = await topicWithQuestions(['Item respondido.', 'Item nunca visto.', 'Item anulado.']);
    db.getDb().run('UPDATE questions SET is_annulled = 1 WHERE id = ?', [questionIds[2]]);
    db.recordQuestionDiagnosis({ questionId: questionIds[0], topicId: topic.id, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'DOUBT' });
    const candidates = db.getReviewQuestionCandidates([topic.id])[topic.id];
    expect(candidates.map((c) => c.questionId).sort()).toEqual([questionIds[0], questionIds[1]].sort());
    expect(candidates.find((c) => c.questionId === questionIds[0])!.lastAttemptAt).not.toBeNull();
    expect(candidates.find((c) => c.questionId === questionIds[1])!.lastAttemptAt).toBeNull();
    expect(db.getQuestionWithDissection(questionIds[1])!.question.id).toBe(questionIds[1]);
    expect(db.getQuestionWithDissection('nao-existe')).toBeNull();
  });

  it('primeira data de estudo de cada tópico vem da origem mais antiga', async () => {
    const { db, subjectId, topic, questionIds } = await topicWithQuestions(['Item para a data.']);
    db.recordQuestionLog({ subjectId, topicId: topic.id, total: 10, correct: 7, blank: 0 });
    db.getDb().run("UPDATE question_logs SET logged_at = '2026-10-01T10:00:00.000Z' WHERE topic_id = ?", [topic.id]);
    db.recordQuestionDiagnosis({ questionId: questionIds[0], topicId: topic.id, selectedOption: 'C', isCorrect: true, selfDiagnosis: 'DOUBT' });
    expect(db.getTopicFirstStudyDates()[topic.id]).toBe('2026-10-01T10:00:00.000Z');
  });

  it('sessão da revisão conta o tempo, mas não mexe no atrito da matéria', async () => {
    const { db } = await openDatabase();
    const subject = db.getSubjectsByPlan(db.getActiveStudyPlan()!.id)[0];
    db.getDb().run('UPDATE subjects SET behavioral_friction_score = 0.6 WHERE id = ?', [subject.id]);
    db.recordStudySession({ subjectId: subject.id, topicId: null, durationMinutes: 1, sessionType: 'REVIEW', pausesCount: 0, wasSkipped: false });
    expect(scalar(db, 'SELECT behavioral_friction_score FROM subjects WHERE id = ?', [subject.id])).toBe(0.6);
  });

  it('último PDF aberto do plano (para "Continuar de onde parou"), nunca de outro plano', async () => {
    const { db } = await openDatabase();
    const plan = db.getActiveStudyPlan()!;
    const subject = db.getSubjectsByPlan(plan.id)[0];
    const topic = db.createTopic({ subject_id: subject.id, code: '6.6', title: 'Leitura' });
    db.savePdfSourceProgress({ subjectId: subject.id, topicId: topic.id, title: 'Apostila.pdf', filePath: 'Apostila.pdf', currentPage: 12, totalPages: 40 });
    db.getDb().run("UPDATE pdf_sources SET last_opened_at = '2099-01-01T00:00:00.000Z' WHERE topic_id = ?", [topic.id]);
    expect(db.getLastOpenedPdf(plan.id)).toMatchObject({ topic_id: topic.id, current_page: 12 });
    expect(db.getLastOpenedPdf('outro-plano')).toBeNull();
  });

  it('plano nasce com a revisão do dia ligada e o Wizard pode desligar', async () => {
    const { db } = await openDatabase();
    const plan = db.getActiveStudyPlan()!;
    expect(plan.daily_review_enabled).toBe(1);
    expect(db.updateStudyPlan({ id: plan.id, daily_review_enabled: 0 })!.daily_review_enabled).toBe(0);
  });
});
