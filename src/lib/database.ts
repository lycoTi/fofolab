import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import schemaSql from '../../docs/specs/01-database-schema.sql?raw';
import { calculateSampleConfidencePercent } from './cycleEngine';
import {
  SEED_ADMIN_BLUEPRINTS,
  SEED_AI_DISSECTIONS,
  SEED_CAREER_TRACKS,
  SEED_NOTEBOOKS,
  SEED_PDF_SOURCES,
  SEED_QUESTIONS,
  SEED_STUDY_PLANS,
  SEED_SUBJECTS,
  SEED_TOPIC_LINKS,
  SEED_TOPICS,
} from '../data/initialSeed';
import type {
  AdminBoardBlueprint,
  AiDissection,
  CareerTrack,
  CreateStudyPlanInput,
  CreateSubjectInput,
  CreateTopicInput,
  Notebook,
  PdfSource,
  Question,
  QuestionAttempt,
  SelfDiagnosisType,
  StudyPlan,
  StudySession,
  StudySessionType,
  Subject,
  Topic,
  TopicLink,
  UpdateStudyPlanInput,
  UpdateSubjectInput,
  UpdateTopicInput,
} from '../types/database';

const STORAGE_KEY = 'fofolab_sqlite_db_v1';

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function persistDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    localStorage.setItem(STORAGE_KEY, uint8ToBase64(data));
  } catch (err) {
    console.error('[FofoLab SQLite] Erro ao persistir banco local:', err);
  }
}

function queryAll<T>(db: Database, sql: string, params: (string | number | null)[] = []): T[] {
  const results = db.exec(sql, params);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as T;
  });
}

function queryOne<T>(db: Database, sql: string, params: (string | number | null)[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

function seedInitialData(db: Database): void {
  db.run('BEGIN TRANSACTION;');
  try {
    for (const track of SEED_CAREER_TRACKS) {
      db.run(
        `INSERT OR IGNORE INTO career_tracks (id, slug, name, sphere, catalog_status, dossier_markdown, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          track.id,
          track.slug,
          track.name,
          track.sphere,
          track.catalog_status,
          track.dossier_markdown,
          track.updated_at,
        ]
      );
    }

    for (const plan of SEED_STUDY_PLANS) {
      db.run(
        `INSERT OR IGNORE INTO study_plans (id, track_id, title, organ, exam_board, role_title, exam_date, weekly_hours_target, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id,
          plan.track_id,
          plan.title,
          plan.organ,
          plan.exam_board,
          plan.role_title,
          plan.exam_date,
          plan.weekly_hours_target,
          plan.is_active,
          plan.created_at,
        ]
      );
    }

    for (const subj of SEED_SUBJECTS) {
      db.run(
        `INSERT OR IGNORE INTO subjects (
          id, plan_id, category, name, color,
          initial_knowledge_level, initial_affinity_level, exam_weight,
          measured_mastery_score, behavioral_friction_score, cycle_allocated_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subj.id,
          subj.plan_id,
          subj.category,
          subj.name,
          subj.color,
          subj.initial_knowledge_level,
          subj.initial_affinity_level,
          subj.exam_weight,
          subj.measured_mastery_score,
          subj.behavioral_friction_score,
          subj.cycle_allocated_minutes,
        ]
      );
    }

    for (const topic of SEED_TOPICS) {
      db.run(
        `INSERT OR IGNORE INTO topics (id, subject_id, parent_id, code, title, mastery_score, status, last_studied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          topic.id,
          topic.subject_id,
          topic.parent_id,
          topic.code,
          topic.title,
          topic.mastery_score,
          topic.status,
          topic.last_studied_at,
        ]
      );
    }

    for (const link of SEED_TOPIC_LINKS) {
      db.run(
        `INSERT OR IGNORE INTO topic_links (id, source_topic_id, target_topic_id, relation_type, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [link.id, link.source_topic_id, link.target_topic_id, link.relation_type, link.notes]
      );
    }

    for (const nb of SEED_NOTEBOOKS) {
      db.run(
        `INSERT OR IGNORE INTO notebooks (id, subject_id, topic_id, title, content_markdown, ai_summary_markdown, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          nb.id,
          nb.subject_id,
          nb.topic_id,
          nb.title,
          nb.content_markdown,
          nb.ai_summary_markdown,
          nb.updated_at,
        ]
      );
    }

    for (const pdf of SEED_PDF_SOURCES) {
      db.run(
        `INSERT OR IGNORE INTO pdf_sources (id, subject_id, topic_id, title, file_path, current_page, total_pages, highlights_json, last_opened_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pdf.id,
          pdf.subject_id,
          pdf.topic_id,
          pdf.title,
          pdf.file_path,
          pdf.current_page,
          pdf.total_pages,
          pdf.highlights_json,
          pdf.last_opened_at,
        ]
      );
    }

    for (const q of SEED_QUESTIONS) {
      db.run(
        `INSERT OR IGNORE INTO questions (
          id, subject_id, topic_id, exam_board, exam_year, organ,
          statement, options_json, preliminary_answer, final_answer, is_annulled, annulment_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          q.subject_id,
          q.topic_id,
          q.exam_board,
          q.exam_year,
          q.organ,
          q.statement,
          q.options_json,
          q.preliminary_answer,
          q.final_answer,
          q.is_annulled,
          q.annulment_reason,
        ]
      );
    }

    for (const diss of SEED_AI_DISSECTIONS) {
      db.run(
        `INSERT OR IGNORE INTO ai_dissections (
          id, question_id, provider_used, dissection_markdown, prerequisites_json, chat_history_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          diss.id,
          diss.question_id,
          diss.provider_used,
          diss.dissection_markdown,
          diss.prerequisites_json,
          diss.chat_history_json,
          diss.created_at,
        ]
      );
    }

    for (const bp of SEED_ADMIN_BLUEPRINTS) {
      db.run(
        `INSERT OR IGNORE INTO admin_board_blueprints (
          id, board_name, target_url, expected_selectors_json, last_dom_hash, health_status, last_checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          bp.id,
          bp.board_name,
          bp.target_url,
          bp.expected_selectors_json,
          bp.last_dom_hash,
          bp.health_status,
          bp.last_checked_at,
        ]
      );
    }

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });

    const savedBase64 = localStorage.getItem(STORAGE_KEY);
    let db: Database;

    if (savedBase64) {
      try {
        const bytes = base64ToUint8(savedBase64);
        db = new SQL.Database(bytes);
        db.run('PRAGMA foreign_keys = ON;');
        db.run(schemaSql);
      } catch (err) {
        console.warn('[FofoLab SQLite] Banco salvo corrompido, recriando a partir do contrato SQL:', err);
        db = new SQL.Database();
        db.run(schemaSql);
        seedInitialData(db);
      }
    } else {
      db = new SQL.Database();
      db.run(schemaSql);
      seedInitialData(db);
    }

    // Caso o banco esteja sem planos (ex: migração inicial), popula o seed
    const countRow = queryOne<{ total: number }>(db, 'SELECT COUNT(*) as total FROM study_plans');
    if (!countRow || countRow.total === 0) {
      seedInitialData(db);
    }

    dbInstance = db;
    persistDatabase();
    return db;
  })();

  return initPromise;
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('SQLite ainda não foi inicializado. Chame await initDatabase() primeiro.');
  }
  return dbInstance;
}

export async function resetDatabaseToSeed(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  initPromise = null;
  await initDatabase();
}

export function exportDatabaseBinary(): Uint8Array {
  return getDb().export();
}

// ============================================================================
// CRUD 1: Planos de Estudo (study_plans) — Ex: CGU, BACEN
// ============================================================================

export function getStudyPlans(): StudyPlan[] {
  return queryAll<StudyPlan>(
    getDb(),
    'SELECT * FROM study_plans ORDER BY is_active DESC, created_at ASC'
  );
}

export function getActiveStudyPlan(): StudyPlan | null {
  const active = queryOne<StudyPlan>(
    getDb(),
    'SELECT * FROM study_plans WHERE is_active = 1 LIMIT 1'
  );
  if (active) return active;
  return queryOne<StudyPlan>(getDb(), 'SELECT * FROM study_plans LIMIT 1');
}

export function setActiveStudyPlan(planId: string): StudyPlan[] {
  const db = getDb();
  db.run('UPDATE study_plans SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END', [planId]);
  persistDatabase();
  return getStudyPlans();
}

export function createStudyPlan(input: CreateStudyPlanInput): StudyPlan {
  const db = getDb();
  const id = `plan-${Date.now()}`;
  const now = new Date().toISOString();

  db.run('UPDATE study_plans SET is_active = 0');
  db.run(
    `INSERT INTO study_plans (id, track_id, title, organ, exam_board, role_title, exam_date, weekly_hours_target, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      input.track_id ?? null,
      input.title.trim(),
      input.organ.trim(),
      input.exam_board.trim(),
      input.role_title.trim(),
      input.exam_date,
      input.weekly_hours_target,
      now,
    ]
  );

  persistDatabase();
  return queryOne<StudyPlan>(db, 'SELECT * FROM study_plans WHERE id = ?', [id])!;
}

export function updateStudyPlan(input: UpdateStudyPlanInput): StudyPlan | null {
  const db = getDb();
  const existing = queryOne<StudyPlan>(db, 'SELECT * FROM study_plans WHERE id = ?', [input.id]);
  if (!existing) return null;

  db.run(
    `UPDATE study_plans
     SET title = ?, organ = ?, exam_board = ?, role_title = ?, exam_date = ?, weekly_hours_target = ?
     WHERE id = ?`,
    [
      input.title ?? existing.title,
      input.organ ?? existing.organ,
      input.exam_board ?? existing.exam_board,
      input.role_title ?? existing.role_title,
      input.exam_date !== undefined ? input.exam_date : existing.exam_date,
      input.weekly_hours_target ?? existing.weekly_hours_target,
      input.id,
    ]
  );

  persistDatabase();
  return queryOne<StudyPlan>(db, 'SELECT * FROM study_plans WHERE id = ?', [input.id]);
}

export function deleteStudyPlan(planId: string): void {
  const db = getDb();
  db.run('DELETE FROM study_plans WHERE id = ?', [planId]);

  const remaining = getStudyPlans();
  if (remaining.length > 0 && !remaining.some((p) => p.is_active === 1)) {
    db.run('UPDATE study_plans SET is_active = 1 WHERE id = ?', [remaining[0].id]);
  }
  persistDatabase();
}

// ============================================================================
// CRUD 2: Disciplinas do Edital (subjects)
// ============================================================================

export function getSubjectsByPlan(planId: string): Subject[] {
  return queryAll<Subject>(
    getDb(),
    'SELECT * FROM subjects WHERE plan_id = ? ORDER BY category DESC, name ASC',
    [planId]
  );
}

export function recalculateSubjectMastery(subjectId: string): void {
  const db = getDb();
  const startedRow = queryOne<{ avg_mastery: number | null }>(
    db,
    `SELECT ROUND(AVG(mastery_score), 1) as avg_mastery
     FROM topics
     WHERE subject_id = ? AND (mastery_score > 0 OR status != 'PENDING' OR last_studied_at IS NOT NULL)`,
    [subjectId]
  );
  const nextMastery = startedRow?.avg_mastery ?? 0;
  db.run('UPDATE subjects SET measured_mastery_score = ? WHERE id = ?', [nextMastery, subjectId]);
  persistDatabase();
}

export function createSubject(input: CreateSubjectInput): Subject {
  const db = getDb();
  const id = `subj-${Date.now()}`;
  const allocatedMinutes =
    input.cycle_allocated_minutes ??
    Math.round(45 + input.exam_weight * 25 + (4 - input.initial_knowledge_level) * 10);

  db.run(
    `INSERT INTO subjects (
      id, plan_id, category, name, color,
      initial_knowledge_level, initial_affinity_level, exam_weight,
      measured_mastery_score, behavioral_friction_score, cycle_allocated_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    [
      id,
      input.plan_id,
      input.category,
      input.name.trim(),
      input.color ?? '#f97316',
      input.initial_knowledge_level,
      input.initial_affinity_level,
      input.exam_weight,
      allocatedMinutes,
    ]
  );

  persistDatabase();
  return queryOne<Subject>(db, 'SELECT * FROM subjects WHERE id = ?', [id])!;
}

export function updateSubject(input: UpdateSubjectInput): Subject | null {
  const db = getDb();
  const existing = queryOne<Subject>(db, 'SELECT * FROM subjects WHERE id = ?', [input.id]);
  if (!existing) return null;

  db.run(
    `UPDATE subjects
     SET name = ?, category = ?, color = ?,
         initial_knowledge_level = ?, initial_affinity_level = ?,
         exam_weight = ?, cycle_allocated_minutes = ?, measured_mastery_score = ?
     WHERE id = ?`,
    [
      input.name ?? existing.name,
      input.category ?? existing.category,
      input.color ?? existing.color,
      input.initial_knowledge_level ?? existing.initial_knowledge_level,
      input.initial_affinity_level ?? existing.initial_affinity_level,
      input.exam_weight ?? existing.exam_weight,
      input.cycle_allocated_minutes ?? existing.cycle_allocated_minutes,
      input.measured_mastery_score ?? existing.measured_mastery_score,
      input.id,
    ]
  );

  persistDatabase();
  return queryOne<Subject>(db, 'SELECT * FROM subjects WHERE id = ?', [input.id]);
}

export function deleteSubject(subjectId: string): void {
  const db = getDb();
  db.run('DELETE FROM subjects WHERE id = ?', [subjectId]);
  persistDatabase();
}

// ============================================================================
// CRUD 3: Tópicos Verticalizados do Edital (topics)
// ============================================================================

export function getTopicsBySubject(subjectId: string): Topic[] {
  return queryAll<Topic>(
    getDb(),
    'SELECT * FROM topics WHERE subject_id = ? ORDER BY code ASC, title ASC',
    [subjectId]
  );
}

export function createTopic(input: CreateTopicInput): Topic {
  const db = getDb();
  const id = `topic-${Date.now()}`;

  db.run(
    `INSERT INTO topics (id, subject_id, parent_id, code, title, mastery_score, status, last_studied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      input.subject_id,
      input.parent_id ?? null,
      input.code.trim(),
      input.title.trim(),
      input.mastery_score ?? 0,
      input.status ?? 'PENDING',
    ]
  );

  recalculateSubjectMastery(input.subject_id);
  persistDatabase();
  return queryOne<Topic>(db, 'SELECT * FROM topics WHERE id = ?', [id])!;
}

function resolveTopicStatus(masteryScore: number): Topic['status'] {
  if (masteryScore >= 85) return 'MASTERED';
  if (masteryScore >= 70) return 'REVIEW';
  if (masteryScore > 0) return 'STUDYING';
  return 'PENDING';
}

export function updateTopic(input: UpdateTopicInput): Topic | null {
  const db = getDb();
  const existing = queryOne<Topic>(db, 'SELECT * FROM topics WHERE id = ?', [input.id]);
  if (!existing) return null;

  const newMastery =
    input.mastery_score !== undefined
      ? Math.max(0, Math.min(100, input.mastery_score))
      : existing.mastery_score;

  const newStatus = input.status ?? resolveTopicStatus(newMastery);

  db.run(
    `UPDATE topics
     SET code = ?, title = ?, mastery_score = ?, status = ?, last_studied_at = ?
     WHERE id = ?`,
    [
      input.code ?? existing.code,
      input.title ?? existing.title,
      newMastery,
      newStatus,
      input.last_studied_at !== undefined ? input.last_studied_at : existing.last_studied_at,
      input.id,
    ]
  );

  recalculateSubjectMastery(existing.subject_id);
  persistDatabase();
  return queryOne<Topic>(db, 'SELECT * FROM topics WHERE id = ?', [input.id]);
}

export function deleteTopic(topicId: string): void {
  const db = getDb();
  const existing = queryOne<Topic>(db, 'SELECT * FROM topics WHERE id = ?', [topicId]);
  db.run('DELETE FROM topics WHERE id = ?', [topicId]);
  if (existing) {
    recalculateSubjectMastery(existing.subject_id);
  }
  persistDatabase();
}

// ============================================================================
// Domínio Sem Viés (docs/specs/02-ai-router-and-metrics.md) & Entidades da Bancada
// ============================================================================

export function recordQuestionDiagnosis(params: {
  questionId: string;
  topicId: string;
  selectedOption: string;
  isCorrect: boolean;
  selfDiagnosis: SelfDiagnosisType;
}): {
  updatedTopic: Topic | null;
  deltaMastery: number;
  isColdStartDiscovery: boolean;
  sampleConfidencePercent: number;
} {
  const db = getDb();
  const topic = queryOne<Topic>(db, 'SELECT * FROM topics WHERE id = ?', [params.topicId]);

  const prevAttemptsCount =
    queryOne<{ c: number }>(
      db,
      'SELECT COUNT(*) as c FROM question_attempts WHERE topic_id = ?',
      [params.topicId]
    )?.c ?? 0;

  const subjectTopicCount = topic
    ? (queryOne<{ c: number }>(
        db,
        'SELECT COUNT(*) as c FROM topics WHERE subject_id = ?',
        [topic.subject_id]
      )?.c ?? 4)
    : 4;

  // Curva Contínua de Confiança da Amostra (estilo saturação BM25 + Mandinach & Gummer):
  // Substitui a regra fixa de "3 questões" por uma saturação proporcional à extensão da matéria.
  const sampleConfidencePercent = calculateSampleConfidencePercent(
    prevAttemptsCount + 1,
    subjectTopicCount
  );
  const isColdStartDiscovery = sampleConfidencePercent < 55;

  // Enquanto a amostra ainda está em fase de calibração (<55% confiança), o erro de 1º contato
  // aplica ajuste suave (-2 a -3) para mapear o Mapa de Calor sem derrubar abruptamente a nota.
  const baseGapPenalty = Math.round(-2 - 4 * (sampleConfidencePercent / 100));

  const deltaMap: Record<SelfDiagnosisType, number> = {
    MASTERED: 8,
    DOUBT: 2,
    BOARD_TRAP: 0,
    BASE_GAP: baseGapPenalty,
  };
  const deltaMastery = deltaMap[params.selfDiagnosis];

  db.run(
    `INSERT INTO question_attempts (
      id, question_id, topic_id, selected_option, is_correct, used_ai_review, self_diagnosis, time_spent_seconds, attempted_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, 45, ?)`,
    [
      `att-${Date.now()}`,
      params.questionId,
      params.topicId,
      params.selectedOption,
      params.isCorrect ? 1 : 0,
      params.selfDiagnosis,
      new Date().toISOString(),
    ]
  );

  if (!topic) {
    persistDatabase();
    return {
      updatedTopic: null,
      deltaMastery,
      isColdStartDiscovery,
      sampleConfidencePercent,
    };
  }

  const nextMastery = Math.max(0, Math.min(100, Math.round(topic.mastery_score + deltaMastery)));
  const updatedTopic = updateTopic({
    id: topic.id,
    mastery_score: nextMastery,
    last_studied_at: new Date().toISOString(),
  });

  // IMPORTANTE: O ciclo atual NÃO soma minutos soltos por questão errada (respeita o teto de horas semanais).
  // O diagnóstico alimenta o Mapa de Calor (question_attempts) para sugerir rebalanceamento no próximo ciclo!
  return {
    updatedTopic,
    deltaMastery,
    isColdStartDiscovery,
    sampleConfidencePercent,
  };
}

export function applyRecommendedCycleAllocations(
  allocations: { subjectId: string; minutes: number }[]
): void {
  const db = getDb();
  db.run('BEGIN TRANSACTION;');
  try {
    for (const item of allocations) {
      db.run('UPDATE subjects SET cycle_allocated_minutes = ? WHERE id = ?', [
        item.minutes,
        item.subjectId,
      ]);
    }
    db.run('COMMIT;');
    persistDatabase();
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}

export function recordStudySession(params: {
  subjectId: string;
  topicId: string | null;
  durationMinutes: number;
  sessionType?: StudySessionType;
  pausesCount: number;
  wasSkipped: boolean;
}): StudySession {
  const db = getDb();
  const id = `sess-${Date.now()}`;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO study_sessions (
      id, subject_id, topic_id, duration_minutes, session_type, pauses_count, was_skipped, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.subjectId,
      params.topicId,
      params.durationMinutes,
      params.sessionType ?? 'POMODORO',
      params.pausesCount,
      params.wasSkipped ? 1 : 0,
      now,
    ]
  );

  // Atualiza fricção comportamental da disciplina suavemente (média móvel 0.0 a 1.0)
  const subj = queryOne<Subject>(db, 'SELECT * FROM subjects WHERE id = ?', [params.subjectId]);
  if (subj) {
    const sessionFriction = Math.min(
      1.0,
      params.pausesCount * 0.15 + (params.wasSkipped ? 0.35 : 0)
    );
    const updatedFriction = Number(
      (subj.behavioral_friction_score * 0.7 + sessionFriction * 0.3).toFixed(2)
    );
    db.run('UPDATE subjects SET behavioral_friction_score = ? WHERE id = ?', [
      updatedFriction,
      params.subjectId,
    ]);
  }

  if (params.topicId) {
    db.run('UPDATE topics SET last_studied_at = ? WHERE id = ?', [now, params.topicId]);
  }

  persistDatabase();
  return queryOne<StudySession>(db, 'SELECT * FROM study_sessions WHERE id = ?', [id])!;
}

export function getStudySessions(limit = 50): StudySession[] {
  return queryAll<StudySession>(
    getDb(),
    'SELECT * FROM study_sessions ORDER BY started_at DESC LIMIT ?',
    [limit]
  );
}

export function getQuestionsForTopicOrSubject(
  topicId: string,
  subjectId: string,
  scope: 'topic' | 'subject' | 'all' = 'topic'
): { question: Question; dissection: AiDissection | null }[] {
  const db = getDb();
  let questions: Question[] = [];

  if (scope === 'all') {
    questions = queryAll<Question>(db, 'SELECT * FROM questions ORDER BY exam_year DESC');
  } else if (scope === 'subject') {
    questions = queryAll<Question>(
      db,
      'SELECT * FROM questions WHERE subject_id = ? ORDER BY exam_year DESC',
      [subjectId]
    );
  } else {
    questions = queryAll<Question>(
      db,
      'SELECT * FROM questions WHERE topic_id = ? ORDER BY exam_year DESC',
      [topicId]
    );
    if (questions.length === 0) {
      questions = queryAll<Question>(
        db,
        'SELECT * FROM questions WHERE subject_id = ? ORDER BY exam_year DESC',
        [subjectId]
      );
    }
  }

  return questions.map((question) => {
    const dissection = queryOne<AiDissection>(
      db,
      'SELECT * FROM ai_dissections WHERE question_id = ?',
      [question.id]
    );
    return { question, dissection };
  });
}

export function saveQuestionChatHistory(questionId: string, chatHistoryJson: string): void {
  const db = getDb();
  db.run('UPDATE ai_dissections SET chat_history_json = ? WHERE question_id = ?', [
    chatHistoryJson,
    questionId,
  ]);
  persistDatabase();
}

export function getNotebookForTopic(subjectId: string, topicId: string): Notebook | null {
  return queryOne<Notebook>(
    getDb(),
    'SELECT * FROM notebooks WHERE topic_id = ? OR subject_id = ? ORDER BY CASE WHEN topic_id = ? THEN 0 ELSE 1 END LIMIT 1',
    [topicId, subjectId, topicId]
  );
}

export function saveTopicNotebook(params: {
  subjectId: string;
  topicId: string;
  title: string;
  contentMarkdown: string;
}): Notebook {
  const db = getDb();
  const existing = queryOne<Notebook>(db, 'SELECT * FROM notebooks WHERE topic_id = ?', [
    params.topicId,
  ]);
  const now = new Date().toISOString();

  if (existing) {
    db.run(
      'UPDATE notebooks SET title = ?, content_markdown = ?, updated_at = ? WHERE id = ?',
      [params.title, params.contentMarkdown, now, existing.id]
    );
    persistDatabase();
    return queryOne<Notebook>(db, 'SELECT * FROM notebooks WHERE id = ?', [existing.id])!;
  }

  const id = `nb-${Date.now()}`;
  db.run(
    `INSERT INTO notebooks (id, subject_id, topic_id, title, content_markdown, ai_summary_markdown, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, params.subjectId, params.topicId, params.title, params.contentMarkdown, now]
  );
  persistDatabase();
  return queryOne<Notebook>(db, 'SELECT * FROM notebooks WHERE id = ?', [id])!;
}

export function getPdfSourceForTopic(subjectId: string, topicId: string): PdfSource | null {
  return queryOne<PdfSource>(
    getDb(),
    'SELECT * FROM pdf_sources WHERE topic_id = ? OR subject_id = ? ORDER BY CASE WHEN topic_id = ? THEN 0 ELSE 1 END LIMIT 1',
    [topicId, subjectId, topicId]
  );
}

export function savePdfSourceProgress(params: {
  subjectId: string;
  topicId: string;
  title: string;
  filePath: string;
  currentPage: number;
  totalPages: number;
}): PdfSource {
  const db = getDb();
  const existing = getPdfSourceForTopic(params.subjectId, params.topicId);
  const now = new Date().toISOString();
  const safeTotal = Math.max(1, params.totalPages);
  const safeCurrent = Math.max(1, Math.min(safeTotal, params.currentPage));

  if (existing) {
    db.run(
      `UPDATE pdf_sources
       SET title = ?, file_path = ?, current_page = ?, total_pages = ?, last_opened_at = ?
       WHERE id = ?`,
      [params.title, params.filePath, safeCurrent, safeTotal, now, existing.id]
    );
    persistDatabase();
    return queryOne<PdfSource>(db, 'SELECT * FROM pdf_sources WHERE id = ?', [existing.id])!;
  }

  const id = `pdf-${Date.now()}`;
  db.run(
    `INSERT INTO pdf_sources (id, subject_id, topic_id, title, file_path, current_page, total_pages, highlights_json, last_opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
    [
      id,
      params.subjectId,
      params.topicId,
      params.title,
      params.filePath,
      safeCurrent,
      safeTotal,
      now,
    ]
  );
  persistDatabase();
  return queryOne<PdfSource>(db, 'SELECT * FROM pdf_sources WHERE id = ?', [id])!;
}

export function getNotebooksByPlan(planId: string): Notebook[] {
  return queryAll<Notebook>(
    getDb(),
    `SELECT n.* FROM notebooks n
     INNER JOIN subjects s ON s.id = n.subject_id
     WHERE s.plan_id = ?
     ORDER BY n.updated_at DESC`,
    [planId]
  );
}

export function getTopicLinks(): TopicLink[] {
  return queryAll<TopicLink>(getDb(), 'SELECT * FROM topic_links');
}

export function getRecentAttempts(limit = 10): QuestionAttempt[] {
  return queryAll<QuestionAttempt>(
    getDb(),
    'SELECT * FROM question_attempts ORDER BY attempted_at DESC LIMIT ?',
    [limit]
  );
}

export function getAdminCatalogAndBlueprints(): {
  tracks: CareerTrack[];
  blueprints: AdminBoardBlueprint[];
  stats: { plans: number; subjects: number; topics: number; questions: number; attempts: number };
} {
  const db = getDb();
  const tracks = queryAll<CareerTrack>(db, 'SELECT * FROM career_tracks ORDER BY name ASC');
  const blueprints = queryAll<AdminBoardBlueprint>(
    db,
    'SELECT * FROM admin_board_blueprints ORDER BY board_name ASC'
  );
  const plans = queryOne<{ c: number }>(db, 'SELECT COUNT(*) as c FROM study_plans')?.c ?? 0;
  const subjects = queryOne<{ c: number }>(db, 'SELECT COUNT(*) as c FROM subjects')?.c ?? 0;
  const topics = queryOne<{ c: number }>(db, 'SELECT COUNT(*) as c FROM topics')?.c ?? 0;
  const questions = queryOne<{ c: number }>(db, 'SELECT COUNT(*) as c FROM questions')?.c ?? 0;
  const attempts =
    queryOne<{ c: number }>(db, 'SELECT COUNT(*) as c FROM question_attempts')?.c ?? 0;

  return {
    tracks,
    blueprints,
    stats: { plans, subjects, topics, questions, attempts },
  };
}
