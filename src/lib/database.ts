import initSqlJs, { type Database, type SqlJsConfig, type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import schemaSql from '../../docs/specs/01-database-schema.sql?raw';
import { calculateSampleConfidencePercent } from './cycleEngine';
import { isDiagnosisAllowed } from './diagnosis';
import { newId } from './ids';
import {
  detectSchemaVersion,
  LATEST_SCHEMA_VERSION,
  prepareSchema,
  SchemaTooNewError,
} from './migrations';
import { normalizeStatement } from './questionImport';
import { getSaveStatus, updateSaveStatus } from './saveStatus';
import {
  clearLegacyLocalStorageDatabase,
  createDefaultStorage,
  createMemoryStorage,
  readLegacyLocalStorageDatabase,
  type BackupEntry,
  type DatabaseStorage,
} from './storage';
import { parentTopicCode } from './syllabusImport';
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
  AiProviderUsed,
  CareerTrack,
  CreateStudyPlanInput,
  CreateSubjectInput,
  CreateTopicInput,
  EditalPlanInput,
  ExamPart,
  FrozenBlock,
  ImportQuestionItem,
  ImportTopicItem,
  Notebook,
  PdfSource,
  Question,
  QuestionAttempt,
  SelfAssessmentInput,
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

// ============================================================================
// Estado do módulo
// ============================================================================

/**
 * Intervalo mínimo entre gravações. A 1ª alteração depois de um tempo parado é gravada na hora
 * (no mesmo ciclo, juntando tudo o que o clique alterou); rajadas (digitar, arrastar o controle de
 * horas) viram no máximo 1 gravação a cada intervalo + 1 final. Assim fechar/recarregar logo depois
 * de um clique não perde a alteração (uma espera fixa de 300 ms perdia — visto no teste E2E).
 */
export const SAVE_THROTTLE_MS = 400;
const SAVE_RETRY_BASE_MS = 2500;
const SAVE_RETRY_MAX_MS = 60000;

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;
let storage: DatabaseStorage | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaveStartedAt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 0;
let dirty = false;
let saveChain: Promise<void> = Promise.resolve();
let dailyBackupCheckedFor: string | null = null;
let lifecycleRegistered = false;

export interface InitDatabaseOptions {
  /** Onde gravar (testes injetam `createMemoryStorage()`); padrão: arquivo no Tauri, IndexedDB no navegador. */
  storage?: DatabaseStorage;
  /** Configuração do sql.js (testes em Node passam `{ wasmBinary }`). */
  sqlJsConfig?: SqlJsConfig;
}

export class InvalidBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

export class InconsistentDiagnosisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InconsistentDiagnosisError';
  }
}

// ============================================================================
// Utilitários de consulta
// ============================================================================

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

function enableForeignKeys(db: Database): void {
  db.run('PRAGMA foreign_keys = ON;');
}

/**
 * `Database.export()` do sql.js fecha e reabre a conexão, o que zera os PRAGMAs.
 * Antes desta correção, `foreign_keys` ficava desligado após o 1º salvamento e nenhuma
 * exclusão cascateava. Toda exportação passa por aqui e religa as chaves estrangeiras.
 */
function exportBytes(db: Database): Uint8Array {
  const bytes = db.export();
  enableForeignKeys(db);
  return bytes;
}

function requireSql(): SqlJsStatic {
  if (!SQL) throw new Error('SQLite ainda não foi inicializado. Chame await initDatabase() primeiro.');
  return SQL;
}

function requireStorage(): DatabaseStorage {
  if (!storage) throw new Error('Armazenamento ainda não inicializado. Chame await initDatabase() primeiro.');
  return storage;
}

function openDatabaseFromBytes(bytes: Uint8Array): Database {
  const db = new (requireSql().Database)(bytes);
  try {
    // O sql.js só lê o cabeçalho na 1ª consulta: força aqui para detectar arquivo inválido
    db.exec('SELECT count(*) FROM sqlite_master;');
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

function createFreshDatabase(): Database {
  const db = new (requireSql().Database)();
  prepareSchema(db, schemaSql);
  enableForeignKeys(db);
  seedInitialData(db);
  return db;
}

/** Data local 'YYYY-MM-DD' (não UTC): estudar às 23h conta para o dia de hoje. */
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function describeStorageError(err: unknown): string {
  const name = err instanceof Error || err instanceof DOMException ? err.name : '';
  if (name === 'QuotaExceededError') {
    return 'Sem espaço para salvar seus estudos neste computador. Faça um backup agora e libere espaço.';
  }
  return 'Não foi possível salvar seus estudos agora. Vamos tentar de novo automaticamente — se o aviso continuar, faça um backup.';
}

// ============================================================================
// Seed (exemplo inicial CGU + BACEN)
// ============================================================================

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
        `INSERT OR IGNORE INTO study_plans (
          id, track_id, title, organ, exam_board, role_title, exam_date, weekly_hours_target,
          is_active, created_at, strategy_mode, study_moment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          plan.strategy_mode,
          plan.study_moment,
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
        `INSERT OR IGNORE INTO pdf_sources (id, subject_id, topic_id, title, file_path, current_page, total_pages, highlights_json, last_opened_at, read_pages_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          pdf.read_pages_json,
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

// ============================================================================
// Inicialização, salvamento, cópias de segurança e restauração
// ============================================================================

async function resolveDefaultStorage(): Promise<DatabaseStorage> {
  try {
    return await createDefaultStorage();
  } catch (err) {
    console.error('[FofoLab] Armazenamento persistente indisponível:', err);
    updateSaveStatus({
      warning:
        'Não foi possível acessar o armazenamento deste computador: seus estudos ficam só nesta sessão. Use "Fazer Backup" para não perder nada.',
    });
    return createMemoryStorage();
  }
}

/** Troca para memória sem gravar nada (protege um banco que não podemos sobrescrever). */
function switchToMemoryStorage(warning: string): void {
  storage = createMemoryStorage();
  updateSaveStatus({ storageKind: 'memory', warning });
}

async function safelyQuarantine(bytes: Uint8Array, reason: string): Promise<void> {
  try {
    await requireStorage().quarantine(bytes, reason);
  } catch (err) {
    console.error('[FofoLab] Falha ao guardar cópia em quarentena:', err);
  }
}

async function safelyBackup(bytes: Uint8Array, label: string): Promise<void> {
  try {
    await requireStorage().createBackup(bytes, label);
  } catch (err) {
    console.error('[FofoLab] Falha ao criar cópia de segurança:', err);
  }
}

async function openStoredDatabase(bytes: Uint8Array): Promise<Database | null> {
  let db: Database;
  try {
    db = openDatabaseFromBytes(bytes);
  } catch (err) {
    console.error('[FofoLab] O banco salvo não abriu; guardando cópia em quarentena:', err);
    await safelyQuarantine(bytes, 'banco-nao-abriu');
    updateSaveStatus({
      warning:
        'Seus estudos salvos não puderam ser abertos e foram guardados à parte. Começamos com o exemplo inicial — restaure um backup em "Organizar Edital → Backup".',
    });
    return null;
  }

  const version = detectSchemaVersion(db);
  if (version > LATEST_SCHEMA_VERSION) {
    db.close();
    switchToMemoryStorage(
      `${new SchemaTooNewError(version).message} Nada será gravado nesta sessão para não estragar o arquivo.`
    );
    return null;
  }

  if (version > 0 && version < LATEST_SCHEMA_VERSION) {
    await safelyBackup(bytes, `antes-da-atualizacao-v${LATEST_SCHEMA_VERSION}`);
  }

  try {
    prepareSchema(db, schemaSql);
  } catch (err) {
    console.error('[FofoLab] Falha ao atualizar a estrutura do banco salvo:', err);
    db.close();
    await safelyQuarantine(bytes, 'falha-na-atualizacao');
    updateSaveStatus({
      warning:
        'Não conseguimos atualizar seus estudos salvos para esta versão. Uma cópia foi guardada à parte — restaure um backup em "Organizar Edital → Backup".',
    });
    return null;
  }

  return db;
}

function registerLifecycleFlush(): void {
  if (lifecycleRegistered || typeof window === 'undefined' || typeof document === 'undefined') return;
  lifecycleRegistered = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushDatabase();
  });
  window.addEventListener('pagehide', () => {
    void flushDatabase();
  });
}

export async function initDatabase(options: InitDatabaseOptions = {}): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise !== null) return initPromise;

  initPromise = (async () => {
    SQL = await initSqlJs(options.sqlJsConfig ?? { locateFile: () => sqlWasmUrl });
    storage = options.storage ?? (await resolveDefaultStorage());
    updateSaveStatus({ storageKind: storage.kind });

    let storedBytes: Uint8Array | null = null;
    try {
      storedBytes = await storage.load();
    } catch (err) {
      // Não conseguimos LER o que está salvo: nunca sobrescrever. Segue em memória e avisa.
      console.error('[FofoLab] Falha ao ler os estudos salvos:', err);
      switchToMemoryStorage(
        'Não foi possível abrir seus estudos salvos. Nada será gravado nesta sessão para não sobrescrevê-los — feche o FofoLab e abra de novo.'
      );
    }

    const legacyBytes = storedBytes ? null : readLegacyLocalStorageDatabase();
    const bytesToOpen = storedBytes ?? legacyBytes;

    let db = bytesToOpen ? await openStoredDatabase(bytesToOpen) : null;
    db ??= createFreshDatabase();
    enableForeignKeys(db);

    const countRow = queryOne<{ total: number }>(db, 'SELECT COUNT(*) as total FROM study_plans');
    if (!countRow || countRow.total === 0) seedInitialData(db);

    dbInstance = db;
    registerLifecycleFlush();
    dirty = true;
    await flushDatabase();

    // Formato antigo (base64 no localStorage) só é apagado depois de gravado no lugar novo
    if (legacyBytes && getSaveStatus().state === 'saved') clearLegacyLocalStorageDatabase();
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

/** Marca o banco como alterado e agenda a gravação (imediata se estava parado; ver `SAVE_THROTTLE_MS`). */
export function persistDatabase(): void {
  if (!dbInstance) return;
  dirty = true;
  updateSaveStatus({ state: 'pending' });
  if (saveTimer) return; // já há uma gravação agendada, que vai levar esta alteração junto
  const wait = Math.max(0, lastSaveStartedAt + SAVE_THROTTLE_MS - Date.now());
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushDatabase();
  }, wait);
}

/** Grava imediatamente o que estiver pendente (fila única: nunca há duas gravações simultâneas). */
export function flushDatabase(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!dirty) return saveChain;
  saveChain = saveChain.then(runSave, runSave);
  return saveChain;
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryDelayMs = retryDelayMs ? Math.min(SAVE_RETRY_MAX_MS, retryDelayMs * 2) : SAVE_RETRY_BASE_MS;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushDatabase();
  }, retryDelayMs);
}

async function runSave(): Promise<void> {
  if (!dbInstance || !storage || !dirty) return;
  dirty = false;
  lastSaveStartedAt = Date.now();
  const bytes = exportBytes(dbInstance);
  updateSaveStatus({ state: 'saving' });

  try {
    await storage.save(bytes);
  } catch (err) {
    dirty = true;
    console.error('[FofoLab] Falha ao salvar os estudos:', err);
    updateSaveStatus({ state: 'error', errorMessage: describeStorageError(err) });
    scheduleRetry();
    return;
  }

  retryDelayMs = 0;
  updateSaveStatus({
    state: dirty ? 'pending' : 'saved',
    lastSavedAt: new Date().toISOString(),
    errorMessage: null,
  });
  await maybeCreateDailyBackup(bytes);
}

/** Uma cópia automática por dia (a do 1º salvamento do dia = como os estudos estavam ao começar). */
async function maybeCreateDailyBackup(bytes: Uint8Array): Promise<void> {
  if (!storage) return;
  const today = localDateKey(new Date());
  if (dailyBackupCheckedFor === today) return;
  dailyBackupCheckedFor = today;
  try {
    const backups = await storage.listBackups();
    const hasToday = backups.some(
      (b) => b.label === 'diaria' && localDateKey(new Date(b.createdAt)) === today
    );
    if (!hasToday) await storage.createBackup(bytes, 'diaria');
  } catch (err) {
    console.error('[FofoLab] Falha ao criar a cópia diária:', err);
  }
}

/** Cópia de segurança imediata — chamada antes de qualquer ação que apaga ou substitui dados. */
export async function createSafetyBackup(label: string): Promise<BackupEntry> {
  const db = getDb();
  await flushDatabase();
  return requireStorage().createBackup(exportBytes(db), label);
}

export async function listDatabaseBackups(): Promise<BackupEntry[]> {
  return requireStorage().listBackups();
}

function replaceDatabase(next: Database): void {
  const previous = dbInstance;
  dbInstance = next;
  previous?.close();
  dirty = true;
}

/**
 * Substitui todos os estudos pelo conteúdo de um backup (arquivo baixado ou cópia automática).
 * Valida ANTES de trocar, atualiza backups de versões antigas e guarda uma cópia do estado atual.
 */
export async function restoreDatabaseFromBytes(bytes: Uint8Array, originLabel: string): Promise<void> {
  getDb();
  let candidate: Database;
  try {
    candidate = openDatabaseFromBytes(bytes);
  } catch {
    throw new InvalidBackupError('Este arquivo não é um backup do FofoLab.');
  }

  if (detectSchemaVersion(candidate) === 0) {
    candidate.close();
    throw new InvalidBackupError('Este arquivo não contém estudos do FofoLab.');
  }

  try {
    prepareSchema(candidate, schemaSql);
  } catch (err) {
    candidate.close();
    if (err instanceof SchemaTooNewError) throw err;
    throw new InvalidBackupError('Não foi possível atualizar este backup para a versão atual do FofoLab.');
  }
  enableForeignKeys(candidate);

  await createSafetyBackup(`antes-de-restaurar-${originLabel}`);
  replaceDatabase(candidate);
  await flushDatabase();
}

export async function restoreDatabaseBackup(backupId: string): Promise<void> {
  const bytes = await requireStorage().readBackup(backupId);
  if (!bytes) throw new InvalidBackupError('Cópia de segurança não encontrada.');
  await restoreDatabaseFromBytes(bytes, 'copia-automatica');
}

export async function resetDatabaseToSeed(): Promise<void> {
  getDb();
  await createSafetyBackup('antes-de-restaurar-exemplo');
  replaceDatabase(createFreshDatabase());
  await flushDatabase();
}

export function exportDatabaseBinary(): Uint8Array {
  return exportBytes(getDb());
}

/** Fecha o banco e zera o estado do módulo (testes; futura troca de arquivo). */
export async function closeDatabase(): Promise<void> {
  if (initPromise !== null) {
    try {
      await initPromise;
    } catch {
      // Falha na inicialização: nada a fechar
    }
  }
  if (dbInstance && storage) await flushDatabase();
  if (saveTimer) clearTimeout(saveTimer);
  if (retryTimer) clearTimeout(retryTimer);
  saveTimer = null;
  retryTimer = null;
  dbInstance?.close();
  dbInstance = null;
  initPromise = null;
  storage = null;
  dirty = false;
  retryDelayMs = 0;
  lastSaveStartedAt = 0;
  dailyBackupCheckedFor = null;
  saveChain = Promise.resolve();
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
  const id = newId('plan');
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
     SET title = ?, organ = ?, exam_board = ?, role_title = ?, exam_date = ?, weekly_hours_target = ?,
         strategy_mode = ?, study_moment = ?
     WHERE id = ?`,
    [
      input.title ?? existing.title,
      input.organ ?? existing.organ,
      input.exam_board ?? existing.exam_board,
      input.role_title ?? existing.role_title,
      input.exam_date !== undefined ? input.exam_date : existing.exam_date,
      input.weekly_hours_target ?? existing.weekly_hours_target,
      input.strategy_mode !== undefined ? input.strategy_mode : existing.strategy_mode,
      input.study_moment !== undefined ? input.study_moment : existing.study_moment,
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

const EDITAL_SUBJECT_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#eab308', '#06b6d4',
  '#ec4899', '#84cc16', '#6366f1', '#14b8a6', '#f43f5e', '#8b5cf6', '#22c55e',
];

/** Primeira prova = básica, última = específica, as do meio = gerais (rótulos usados pela estratégia). */
function categoryForPart(partIndex: number, partCount: number): Subject['category'] {
  if (partIndex < 0) return 'GERAL';
  if (partIndex === partCount - 1) return 'ESPECIFICO';
  return partIndex === 0 ? 'BASICO' : 'GERAL';
}

/**
 * Cria o plano inteiro lido do edital (provas, matérias com peso e tópicos) numa transação só e o
 * deixa ativo. O plano de exemplo e os demais continuam existindo.
 */
export function createPlanFromEdital(input: EditalPlanInput): StudyPlan {
  const db = getDb();
  const planId = newId('plan');
  const now = new Date().toISOString();

  db.run('BEGIN TRANSACTION;');
  try {
    // 1. Plano (edital publicado = pós-edital)
    db.run('UPDATE study_plans SET is_active = 0');
    db.run(
      `INSERT INTO study_plans (id, track_id, title, organ, exam_board, role_title, exam_date, weekly_hours_target,
         is_active, created_at, study_moment, registration_deadline, min_total_score, selected_role)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1, ?, 'POS_EDITAL', ?, ?, ?)`,
      [
        planId,
        input.title.trim(),
        input.organ,
        input.examBoard,
        input.roleTitle,
        input.examDate,
        input.weeklyHoursTarget,
        now,
        input.registrationDeadline,
        input.minTotalScore,
        input.roleTitle,
      ]
    );

    // 2. Provas
    const partIdByCode = new Map<string, string>();
    input.parts.forEach((part, index) => {
      const partId = newId('part');
      partIdByCode.set(part.code, partId);
      db.run(
        `INSERT INTO exam_parts (id, plan_id, code, name, item_count, points_per_item, min_score, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [partId, planId, part.code, part.name, part.itemCount, part.pointsPerItem, part.minScore, index]
      );
    });

    // 3. Matérias e tópicos (nível inicial neutro até a autoavaliação do Wizard)
    input.subjects.forEach((subject, index) => {
      const subjectId = newId('subj');
      const partIndex = input.parts.findIndex((p) => p.code === subject.partCode);
      db.run(
        `INSERT INTO subjects (id, plan_id, category, name, color, initial_knowledge_level, initial_affinity_level,
           exam_weight, measured_mastery_score, behavioral_friction_score, cycle_allocated_minutes, exam_part_id)
         VALUES (?, ?, ?, ?, ?, 2, 2, ?, 0, 0, ?, ?)`,
        [
          subjectId,
          planId,
          categoryForPart(partIndex, input.parts.length),
          subject.name.trim(),
          EDITAL_SUBJECT_COLORS[index % EDITAL_SUBJECT_COLORS.length],
          subject.examWeight,
          Math.round(45 + subject.examWeight * 25 + 20),
          subject.partCode ? (partIdByCode.get(subject.partCode) ?? null) : null,
        ]
      );
      insertTopicItems(db, subjectId, subject.topics, []);
    });

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  persistDatabase();
  return queryOne<StudyPlan>(db, 'SELECT * FROM study_plans WHERE id = ?', [planId])!;
}

export function getExamPartsByPlan(planId: string): ExamPart[] {
  return queryAll<ExamPart>(getDb(), 'SELECT * FROM exam_parts WHERE plan_id = ? ORDER BY sort_order', [planId]);
}

/** Grava a autoavaliação do Wizard (nível 1..4 da matéria e, quando ajustado, do tópico). */
export function saveSelfAssessment(input: SelfAssessmentInput): void {
  const db = getDb();
  const clampLevel = (level: number) => Math.min(4, Math.max(1, Math.round(level)));
  db.run('BEGIN TRANSACTION;');
  try {
    for (const { subjectId, level } of input.subjects) {
      db.run('UPDATE subjects SET initial_knowledge_level = ? WHERE id = ?', [clampLevel(level), subjectId]);
    }
    for (const { topicId, level } of input.topics) {
      db.run('UPDATE topics SET initial_knowledge_level = ? WHERE id = ?', [
        level === null ? null : clampLevel(level),
        topicId,
      ]);
    }
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
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
  const id = newId('subj');
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
  const id = newId('topic');

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

/** Conta o que uma exclusão vai levar junto (para a confirmação mostrar o tamanho do estrago). */
export function countDependents(
  kind: 'plan' | 'subject' | 'topic',
  id: string
): { subjects: number; topics: number; questions: number; notebooks: number } {
  const db = getDb();
  const count = (sql: string, params: string[]) => queryOne<{ c: number }>(db, sql, params)?.c ?? 0;

  if (kind === 'plan') {
    return {
      subjects: count('SELECT COUNT(*) as c FROM subjects WHERE plan_id = ?', [id]),
      topics: count(
        'SELECT COUNT(*) as c FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = ?)',
        [id]
      ),
      questions: count(
        'SELECT COUNT(*) as c FROM questions WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = ?)',
        [id]
      ),
      notebooks: count(
        'SELECT COUNT(*) as c FROM notebooks WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = ?)',
        [id]
      ),
    };
  }
  if (kind === 'subject') {
    return {
      subjects: 0,
      topics: count('SELECT COUNT(*) as c FROM topics WHERE subject_id = ?', [id]),
      questions: count('SELECT COUNT(*) as c FROM questions WHERE subject_id = ?', [id]),
      notebooks: count('SELECT COUNT(*) as c FROM notebooks WHERE subject_id = ?', [id]),
    };
  }
  return {
    subjects: 0,
    topics: count('SELECT COUNT(*) as c FROM topics WHERE parent_id = ?', [id]),
    questions: count('SELECT COUNT(*) as c FROM questions WHERE topic_id = ?', [id]),
    notebooks: count('SELECT COUNT(*) as c FROM notebooks WHERE topic_id = ?', [id]),
  };
}

/**
 * Adiciona em lote os tópicos colados do conteúdo programático. Liga subtópicos ao pai pelo
 * código ("2.1" → "2") e ignora os que já existem (mesmo código e título) na disciplina.
 */
export function importSyllabusTopics(
  subjectId: string,
  items: ImportTopicItem[]
): { inserted: number; skippedDuplicates: number } {
  const db = getDb();
  let result: { inserted: number; skippedDuplicates: number };
  db.run('BEGIN TRANSACTION;');
  try {
    result = insertTopicItems(db, subjectId, items, getTopicsBySubject(subjectId));
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  recalculateSubjectMastery(subjectId);
  return result;
}

/** Insere tópicos ligando subtópicos ao pai pelo código ("2.1" → "2"); pula repetidos. Sem transação própria. */
function insertTopicItems(
  db: Database,
  subjectId: string,
  items: ImportTopicItem[],
  existing: Topic[]
): { inserted: number; skippedDuplicates: number } {
  const idByCode = new Map(existing.filter((t) => t.code).map((t) => [String(t.code), t.id]));
  const existingKeys = new Set(existing.map((t) => `${t.code ?? ''}|${normalizeStatement(t.title)}`));

  let inserted = 0;
  let skippedDuplicates = 0;
  for (const item of items) {
    const key = `${item.code ?? ''}|${normalizeStatement(item.title)}`;
    if (existingKeys.has(key)) {
      skippedDuplicates++;
      continue;
    }
    existingKeys.add(key);

    const id = newId('topic');
    const parentCode = parentTopicCode(item.code);
    db.run(
      `INSERT INTO topics (id, subject_id, parent_id, code, title, mastery_score, status, last_studied_at)
       VALUES (?, ?, ?, ?, ?, 0, 'PENDING', NULL)`,
      [id, subjectId, parentCode ? (idByCode.get(parentCode) ?? null) : null, item.code, item.title]
    );
    if (item.code) idByCode.set(item.code, id);
    inserted++;
  }
  return { inserted, skippedDuplicates };
}

// ============================================================================
// Domínio Sem Viés (docs/specs/02-ai-router-and-metrics.md) & Entidades da Bancada
// ============================================================================

function describeAnswer(answered: boolean, isCorrect: boolean): string {
  if (!answered) return 'um 1º contato sem resposta';
  return isCorrect ? 'um acerto' : 'um erro';
}

export function recordQuestionDiagnosis(params: {
  questionId: string;
  topicId: string;
  /** Letra marcada; `null` = 1º contato (abriu a explicação sem responder). */
  selectedOption: string | null;
  isCorrect: boolean;
  selfDiagnosis: SelfDiagnosisType;
  timeSpentSeconds?: number;
  usedAiReview?: boolean;
}): {
  updatedTopic: Topic | null;
  deltaMastery: number;
  isColdStartDiscovery: boolean;
  sampleConfidencePercent: number;
} {
  const answered = params.selectedOption !== null;
  if (!isDiagnosisAllowed({ answered, isCorrect: params.isCorrect }, params.selfDiagnosis)) {
    throw new InconsistentDiagnosisError(
      `Diagnóstico ${params.selfDiagnosis} não combina com ${describeAnswer(answered, params.isCorrect)}.`
    );
  }

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
  const timeSpentSeconds = Math.max(0, Math.min(3600, Math.round(params.timeSpentSeconds ?? 0)));

  db.run(
    `INSERT INTO question_attempts (
      id, question_id, topic_id, selected_option, is_correct, used_ai_review, self_diagnosis, time_spent_seconds, attempted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId('att'),
      params.questionId,
      params.topicId,
      params.selectedOption ?? '',
      params.isCorrect ? 1 : 0,
      params.usedAiReview ? 1 : 0,
      params.selfDiagnosis,
      timeSpentSeconds,
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
  const id = newId('sess');
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

/** Sessões a partir de uma data (ISO) — usado para saber o que já foi estudado na semana. */
export function getStudySessionsSince(sinceIso: string): StudySession[] {
  return queryAll<StudySession>(
    getDb(),
    'SELECT * FROM study_sessions WHERE started_at >= ? ORDER BY started_at DESC',
    [sinceIso]
  );
}

// ============================================================================
// Roteiro do dia congelado (spec 09): gravado na primeira abertura do dia, por plano
// ============================================================================

export function getDailyPlan(planId: string, dateKey: string): FrozenBlock[] | null {
  const row = queryOne<{ blocks_json: string }>(
    getDb(),
    'SELECT blocks_json FROM daily_plans WHERE plan_id = ? AND date = ?',
    [planId, dateKey]
  );
  if (!row) return null;
  try {
    return JSON.parse(row.blocks_json) as FrozenBlock[];
  } catch {
    // Roteiro gravado ilegível: tratado como ausente, e o app congela um novo
    return null;
  }
}

export function saveDailyPlan(planId: string, dateKey: string, blocks: FrozenBlock[]): void {
  getDb().run(
    `INSERT INTO daily_plans (plan_id, date, blocks_json) VALUES (?, ?, ?)
     ON CONFLICT(plan_id, date) DO UPDATE SET blocks_json = excluded.blocks_json`,
    [planId, dateKey, JSON.stringify(blocks)]
  );
  persistDatabase();
}

export function clearDailyPlan(planId: string, dateKey: string): void {
  getDb().run('DELETE FROM daily_plans WHERE plan_id = ? AND date = ?', [planId, dateKey]);
  persistDatabase();
}

// ============================================================================
// Questões, explicações e importação
// ============================================================================

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

export type QuestionFallback = { kind: 'group'; code: string } | { kind: 'subject' } | null;

/**
 * Questões do tópico do bloco (spec 09). Sem questões no tópico, sobe para o grupo (tópicos com o mesmo
 * pai) e, sem grupo, para a matéria — e diz de onde vieram, para a tela não fingir que são do tópico.
 */
export function getTopicQuestionsWithFallback(
  topicId: string,
  subjectId: string
): { items: { question: Question; dissection: AiDissection | null }[]; fallback: QuestionFallback } {
  const db = getDb();
  const withDissection = (questions: Question[]) =>
    questions.map((question) => ({
      question,
      dissection: queryOne<AiDissection>(db, 'SELECT * FROM ai_dissections WHERE question_id = ?', [question.id]),
    }));

  const own = queryAll<Question>(db, 'SELECT * FROM questions WHERE topic_id = ? ORDER BY exam_year DESC', [topicId]);
  if (own.length > 0) return { items: withDissection(own), fallback: null };

  const topic = queryOne<Topic>(db, 'SELECT * FROM topics WHERE id = ?', [topicId]);
  const parent = topic?.parent_id ? queryOne<Topic>(db, 'SELECT * FROM topics WHERE id = ?', [topic.parent_id]) : null;
  if (parent) {
    const group = queryAll<Question>(
      db,
      `SELECT q.* FROM questions q JOIN topics t ON t.id = q.topic_id
       WHERE t.parent_id = ? ORDER BY q.exam_year DESC`,
      [parent.id]
    );
    if (group.length > 0) return { items: withDissection(group), fallback: { kind: 'group', code: parent.code ?? parent.title } };
  }

  const subjectQuestions = queryAll<Question>(db, 'SELECT * FROM questions WHERE subject_id = ? ORDER BY exam_year DESC', [subjectId]);
  if (subjectQuestions.length === 0) return { items: [], fallback: null };
  return { items: withDissection(subjectQuestions), fallback: { kind: 'subject' } };
}

/**
 * Grava em lote as questões importadas (texto/JSON). Ignora enunciados que já existem na
 * disciplina, para que importar o mesmo arquivo duas vezes não duplique nada.
 */
export function importQuestions(
  subjectId: string,
  items: ImportQuestionItem[]
): { inserted: number; skippedDuplicates: number; insertedIds: string[] } {
  const db = getDb();
  const existing = new Set(
    queryAll<{ statement: string }>(db, 'SELECT statement FROM questions WHERE subject_id = ?', [
      subjectId,
    ]).map((row) => normalizeStatement(row.statement))
  );

  const insertedIds: string[] = [];
  let skippedDuplicates = 0;
  db.run('BEGIN TRANSACTION;');
  try {
    for (const item of items) {
      const key = normalizeStatement(item.statement);
      if (existing.has(key)) {
        skippedDuplicates++;
        continue;
      }
      existing.add(key);

      const id = newId('q');
      db.run(
        `INSERT INTO questions (
          id, subject_id, topic_id, exam_board, exam_year, organ,
          statement, options_json, preliminary_answer, final_answer, is_annulled, annulment_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL)`,
        [
          id,
          subjectId,
          item.topicId,
          item.examBoard,
          item.examYear,
          item.organ,
          item.statement,
          JSON.stringify(item.options),
          item.finalAnswer,
        ]
      );
      insertedIds.push(id);
    }
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  persistDatabase();
  return { inserted: insertedIds.length, skippedDuplicates, insertedIds };
}

/**
 * Guarda a explicação gerada pela IA REAL (Camada 0 do roteador: consultas futuras não gastam tokens).
 * Respostas simuladas do modo demonstração nunca passam por aqui.
 */
export function saveAiDissection(params: {
  questionId: string;
  provider: AiProviderUsed;
  dissectionMarkdown: string;
  prerequisites: string[];
}): AiDissection {
  const db = getDb();
  db.run(
    `INSERT INTO ai_dissections (
      id, question_id, provider_used, dissection_markdown, prerequisites_json, chat_history_json, created_at
    ) VALUES (?, ?, ?, ?, ?, '[]', ?)
    ON CONFLICT(question_id) DO UPDATE SET
      provider_used = excluded.provider_used,
      dissection_markdown = excluded.dissection_markdown,
      prerequisites_json = excluded.prerequisites_json`,
    [
      newId('diss'),
      params.questionId,
      params.provider,
      params.dissectionMarkdown,
      JSON.stringify(params.prerequisites),
      new Date().toISOString(),
    ]
  );
  persistDatabase();
  return queryOne<AiDissection>(db, 'SELECT * FROM ai_dissections WHERE question_id = ?', [
    params.questionId,
  ])!;
}

export function saveQuestionChatHistory(questionId: string, chatHistoryJson: string): void {
  const db = getDb();
  db.run('UPDATE ai_dissections SET chat_history_json = ? WHERE question_id = ?', [
    chatHistoryJson,
    questionId,
  ]);
  persistDatabase();
}

// ============================================================================
// Cadernos e PDFs — sempre do PRÓPRIO tópico (nunca o de outro tópico da disciplina)
// ============================================================================

export function getNotebookForTopic(topicId: string): Notebook | null {
  return queryOne<Notebook>(
    getDb(),
    'SELECT * FROM notebooks WHERE topic_id = ? ORDER BY updated_at DESC LIMIT 1',
    [topicId]
  );
}

export function saveTopicNotebook(params: {
  subjectId: string;
  topicId: string;
  title: string;
  contentMarkdown: string;
}): Notebook {
  const db = getDb();
  const existing = getNotebookForTopic(params.topicId);
  const now = new Date().toISOString();

  if (existing) {
    db.run(
      'UPDATE notebooks SET title = ?, content_markdown = ?, updated_at = ? WHERE id = ?',
      [params.title, params.contentMarkdown, now, existing.id]
    );
    persistDatabase();
    return queryOne<Notebook>(db, 'SELECT * FROM notebooks WHERE id = ?', [existing.id])!;
  }

  const id = newId('nb');
  db.run(
    `INSERT INTO notebooks (id, subject_id, topic_id, title, content_markdown, ai_summary_markdown, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, params.subjectId, params.topicId, params.title, params.contentMarkdown, now]
  );
  persistDatabase();
  return queryOne<Notebook>(db, 'SELECT * FROM notebooks WHERE id = ?', [id])!;
}

/** PDF do próprio tópico ou, na falta dele, o PDF geral da disciplina (sem tópico). */
export function getPdfSourceForTopic(subjectId: string, topicId: string): PdfSource | null {
  return queryOne<PdfSource>(
    getDb(),
    `SELECT * FROM pdf_sources
     WHERE topic_id = ? OR (subject_id = ? AND topic_id IS NULL)
     ORDER BY CASE WHEN topic_id = ? THEN 0 ELSE 1 END, last_opened_at DESC
     LIMIT 1`,
    [topicId, subjectId, topicId]
  );
}

/**
 * Atualiza o progresso do PDF exibido (`pdfSourceId`, só se for do próprio tópico ou o geral da
 * disciplina) ou o PDF do tópico; se não houver, cria um registro novo PARA ESTE TÓPICO.
 * Antes, salvar o PDF do tópico B sobrescrevia o registro do tópico A da mesma disciplina.
 */
export function savePdfSourceProgress(params: {
  pdfSourceId?: string | null;
  subjectId: string;
  topicId: string;
  title: string;
  filePath: string;
  currentPage: number;
  totalPages: number;
  /** Omitido: mantém as páginas lidas do mesmo arquivo e zera ao trocar de arquivo. */
  readPages?: number[];
}): PdfSource {
  const db = getDb();
  const now = new Date().toISOString();
  const safeTotal = Math.max(1, Math.round(params.totalPages));
  const safeCurrent = Math.max(1, Math.min(safeTotal, Math.round(params.currentPage)));

  let target: PdfSource | null = null;
  if (params.pdfSourceId) {
    target = queryOne<PdfSource>(
      db,
      'SELECT * FROM pdf_sources WHERE id = ? AND (topic_id = ? OR (subject_id = ? AND topic_id IS NULL))',
      [params.pdfSourceId, params.topicId, params.subjectId]
    );
  }
  target ??= queryOne<PdfSource>(
    db,
    'SELECT * FROM pdf_sources WHERE topic_id = ? ORDER BY last_opened_at DESC LIMIT 1',
    [params.topicId]
  );

  const readPagesJson = (previous: string) =>
    params.readPages ? JSON.stringify(params.readPages.filter((p) => p >= 1 && p <= safeTotal)) : previous;

  if (target) {
    db.run(
      `UPDATE pdf_sources
       SET title = ?, file_path = ?, current_page = ?, total_pages = ?, last_opened_at = ?, read_pages_json = ?
       WHERE id = ?`,
      [
        params.title,
        params.filePath,
        safeCurrent,
        safeTotal,
        now,
        readPagesJson(target.file_path === params.filePath ? target.read_pages_json : '[]'),
        target.id,
      ]
    );
    persistDatabase();
    return queryOne<PdfSource>(db, 'SELECT * FROM pdf_sources WHERE id = ?', [target.id])!;
  }

  const id = newId('pdf');
  db.run(
    `INSERT INTO pdf_sources (id, subject_id, topic_id, title, file_path, current_page, total_pages, highlights_json, last_opened_at, read_pages_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
    [id, params.subjectId, params.topicId, params.title, params.filePath, safeCurrent, safeTotal, now, readPagesJson('[]')]
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
    'SELECT * FROM question_attempts ORDER BY attempted_at DESC, rowid DESC LIMIT ?',
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
