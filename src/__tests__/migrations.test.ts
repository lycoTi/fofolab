// @vitest-environment node
import { describe, expect, it } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import latestSchemaSql from '../../docs/specs/01-database-schema.sql?raw';
import schemaV1Sql from './fixtures/schema-v1.sql?raw';
import {
  detectSchemaVersion,
  getUserVersion,
  LATEST_SCHEMA_VERSION,
  prepareSchema,
  SchemaTooNewError,
} from '../lib/migrations';

// No Node o sql.js encontra o próprio .wasm ao lado do pacote (config vazia)
const SQL = await initSqlJs({});

function describeStructure(db: Database): Record<string, string[]> {
  const tables = db
    .exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0]
    .values.map((row) => String(row[0]));
  const structure: Record<string, string[]> = {};
  for (const table of tables) {
    structure[table] = db
      .exec(`PRAGMA table_info(${table})`)[0]
      .values.map((row) => `${row[1]}:${row[2]}:${row[3]}:${row[4]}:${row[5]}`)
      .sort();
  }
  return structure;
}

describe('Versionamento do banco local (PRAGMA user_version + migrações)', () => {
  it('banco novo nasce direto na versão mais recente', () => {
    const db = new SQL.Database();
    const result = prepareSchema(db, latestSchemaSql);

    expect(result.created).toBe(true);
    expect(getUserVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    db.close();
  });

  it('banco legado (v1, sem versionamento) é reconhecido e migrado até a versão mais recente', () => {
    const db = new SQL.Database();
    db.run(schemaV1Sql);
    expect(detectSchemaVersion(db)).toBe(1);

    const result = prepareSchema(db, latestSchemaSql);
    expect(result.created).toBe(false);
    expect(result.previousVersion).toBe(1);
    expect(result.appliedMigrations).toEqual([2]);
    expect(getUserVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    db.close();
  });

  it('o contrato SQL mais recente e o caminho "v1 + migrações" produzem exatamente a mesma estrutura', () => {
    const fresh = new SQL.Database();
    prepareSchema(fresh, latestSchemaSql);

    const migrated = new SQL.Database();
    migrated.run(schemaV1Sql);
    prepareSchema(migrated, latestSchemaSql);

    expect(describeStructure(migrated)).toEqual(describeStructure(fresh));
    fresh.close();
    migrated.close();
  });

  it('a migração v2 remove registros órfãos deixados quando as exclusões não cascateavam', () => {
    const db = new SQL.Database();
    db.run(schemaV1Sql);
    db.run('PRAGMA foreign_keys = OFF;');
    db.run("INSERT INTO study_plans (id, title) VALUES ('p1', 'Plano')");
    db.run("INSERT INTO subjects (id, plan_id, name) VALUES ('s1', 'p1', 'Matéria viva')");
    db.run("INSERT INTO subjects (id, plan_id, name) VALUES ('s-orfa', 'plano-apagado', 'Órfã')");
    db.run("INSERT INTO topics (id, subject_id, title) VALUES ('t1', 's1', 'Tópico vivo')");
    db.run("INSERT INTO topics (id, subject_id, title) VALUES ('t-orfao', 's-orfa', 'Órfão')");
    db.run(
      "INSERT INTO notebooks (id, subject_id, topic_id, title) VALUES ('n1', 's1', 'topico-apagado', 'Caderno')"
    );

    prepareSchema(db, latestSchemaSql);
    db.run('PRAGMA foreign_keys = ON;');

    const ids = (sql: string) => db.exec(sql)[0]?.values.map((r) => r[0]) ?? [];
    expect(ids('SELECT id FROM subjects')).toEqual(['s1']);
    expect(ids('SELECT id FROM topics')).toEqual(['t1']);
    expect(ids('SELECT topic_id FROM notebooks')).toEqual([null]);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
    db.close();
  });

  it('recusa abrir banco criado por uma versão mais nova do app', () => {
    const db = new SQL.Database();
    prepareSchema(db, latestSchemaSql);
    db.run(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1};`);

    expect(() => prepareSchema(db, latestSchemaSql)).toThrow(SchemaTooNewError);
    db.close();
  });
});
