import type { Database } from 'sql.js';

/**
 * Versionamento do banco local via `PRAGMA user_version`.
 *
 * - Banco novo: executa o contrato completo (`docs/specs/01-database-schema.sql`, sempre na versão
 *   mais recente) e grava `user_version = LATEST_SCHEMA_VERSION`.
 * - Banco existente: aplica, em ordem, só as migrações com versão maior que a gravada.
 * - Bancos criados antes do versionamento têm `user_version = 0` com tabelas existentes: são a v1.
 *
 * Regra: toda mudança no contrato SQL precisa de uma migração aqui com o mesmo efeito
 * (o teste `migrations.test.ts` compara banco novo × banco v1 migrado).
 */
export const LATEST_SCHEMA_VERSION = 5;

export interface Migration {
  version: number;
  description: string;
  up: (db: Database) => void;
}

const SEED_DISSECTION_IDS = ['diss-1', 'diss-2', 'diss-3', 'diss-4', 'diss-5', 'diss-6'];

export const MIGRATIONS: Migration[] = [
  {
    version: 2,
    description:
      'Estratégia/momento de estudo no plano, explicações de exemplo marcadas como EXAMPLE e limpeza de registros órfãos',
    up: (db) => {
      db.run('ALTER TABLE study_plans ADD COLUMN strategy_mode TEXT');
      db.run('ALTER TABLE study_plans ADD COLUMN study_moment TEXT');

      // As explicações do seed foram escritas à mão como exemplo, não geradas pela IA do app
      db.run(
        `UPDATE ai_dissections SET provider_used = 'EXAMPLE'
         WHERE provider_used = 'GEMINI_FREE' AND id IN (${SEED_DISSECTION_IDS.map(() => '?').join(', ')})`,
        SEED_DISSECTION_IDS
      );

      // Até a v1, `PRAGMA foreign_keys` era desligado silenciosamente a cada salvamento
      // (o `export()` do sql.js reabre a conexão). Exclusões não cascateavam e deixaram órfãos.
      removeOrphanRows(db);
    },
  },
  {
    version: 3,
    description: 'Páginas lidas de cada PDF (marcadas pelo leitor)',
    up: (db) => {
      db.run("ALTER TABLE pdf_sources ADD COLUMN read_pages_json TEXT DEFAULT '[]'");
    },
  },
  {
    version: 4,
    description: 'Edital real: provas com nota mínima, prazo de inscrição, cargo e autoavaliação por tópico',
    up: (db) => {
      db.run('ALTER TABLE study_plans ADD COLUMN registration_deadline DATE');
      db.run('ALTER TABLE study_plans ADD COLUMN min_total_score REAL');
      db.run('ALTER TABLE study_plans ADD COLUMN selected_role TEXT');
      db.run(`CREATE TABLE IF NOT EXISTS exam_parts (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        item_count INTEGER NOT NULL,
        points_per_item REAL DEFAULT 1,
        min_score REAL,
        sort_order INTEGER DEFAULT 0
      )`);
      db.run('ALTER TABLE subjects ADD COLUMN exam_part_id TEXT REFERENCES exam_parts(id) ON DELETE SET NULL');
      db.run('ALTER TABLE topics ADD COLUMN initial_knowledge_level INTEGER');
    },
  },
  {
    version: 5,
    description: 'Roteiro do dia congelado (spec 09): a lista de blocos de hoje não muda conforme se estuda',
    up: (db) => {
      db.run(`CREATE TABLE IF NOT EXISTS daily_plans (
        plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        blocks_json TEXT NOT NULL,
        profile_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (plan_id, date)
      )`);
    },
  },
];

export function getUserVersion(db: Database): number {
  const result = db.exec('PRAGMA user_version;');
  return Number(result[0]?.values[0]?.[0] ?? 0);
}

function setUserVersion(db: Database, version: number): void {
  db.run(`PRAGMA user_version = ${Math.trunc(version)};`);
}

function tableExists(db: Database, tableName: string): boolean {
  const result = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [
    tableName,
  ]);
  return result.length > 0 && result[0].values.length > 0;
}

export class SchemaTooNewError extends Error {
  constructor(public readonly foundVersion: number) {
    super(
      `Este arquivo foi criado por uma versão mais nova do FofoLab (versão ${foundVersion}). Atualize o aplicativo antes de abri-lo.`
    );
    this.name = 'SchemaTooNewError';
  }
}

export interface SchemaPreparationResult {
  created: boolean;
  previousVersion: number;
  currentVersion: number;
  appliedMigrations: number[];
}

/** Retorna a versão efetiva de um banco já aberto (0 = vazio, 1 = legado sem versionamento). */
export function detectSchemaVersion(db: Database): number {
  const stored = getUserVersion(db);
  if (stored > 0) return stored;
  return tableExists(db, 'study_plans') ? 1 : 0;
}

export function prepareSchema(db: Database, latestSchemaSql: string): SchemaPreparationResult {
  const previousVersion = detectSchemaVersion(db);

  if (previousVersion === 0) {
    db.run(latestSchemaSql);
    setUserVersion(db, LATEST_SCHEMA_VERSION);
    return {
      created: true,
      previousVersion: 0,
      currentVersion: LATEST_SCHEMA_VERSION,
      appliedMigrations: [],
    };
  }

  if (previousVersion > LATEST_SCHEMA_VERSION) {
    throw new SchemaTooNewError(previousVersion);
  }

  const appliedMigrations: number[] = [];
  for (const migration of MIGRATIONS) {
    if (migration.version <= previousVersion) continue;
    db.run('BEGIN TRANSACTION;');
    try {
      migration.up(db);
      setUserVersion(db, migration.version);
      db.run('COMMIT;');
      appliedMigrations.push(migration.version);
    } catch (err) {
      db.run('ROLLBACK;');
      throw err;
    }
  }

  return {
    created: false,
    previousVersion,
    currentVersion: LATEST_SCHEMA_VERSION,
    appliedMigrations,
  };
}

function removeOrphanRows(db: Database): void {
  db.run('DELETE FROM subjects WHERE plan_id NOT IN (SELECT id FROM study_plans)');
  db.run('DELETE FROM topics WHERE subject_id NOT IN (SELECT id FROM subjects)');
  // Subtópicos órfãos podem estar em cadeia (pai e avô excluídos): repete até estabilizar
  for (let i = 0; i < 10; i++) {
    db.run(
      'DELETE FROM topics WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM topics)'
    );
    if (db.getRowsModified() === 0) break;
  }
  db.run(
    `DELETE FROM topic_links
     WHERE source_topic_id NOT IN (SELECT id FROM topics) OR target_topic_id NOT IN (SELECT id FROM topics)`
  );

  for (const table of ['notebooks', 'pdf_sources', 'questions', 'study_sessions']) {
    db.run(`DELETE FROM ${table} WHERE subject_id NOT IN (SELECT id FROM subjects)`);
  }
  for (const table of ['notebooks', 'pdf_sources', 'questions', 'question_attempts', 'study_sessions']) {
    db.run(
      `UPDATE ${table} SET topic_id = NULL WHERE topic_id IS NOT NULL AND topic_id NOT IN (SELECT id FROM topics)`
    );
  }

  db.run('DELETE FROM ai_dissections WHERE question_id NOT IN (SELECT id FROM questions)');
  db.run('DELETE FROM question_attempts WHERE question_id NOT IN (SELECT id FROM questions)');
  db.run(
    'UPDATE study_plans SET track_id = NULL WHERE track_id IS NOT NULL AND track_id NOT IN (SELECT id FROM career_tracks)'
  );
}
