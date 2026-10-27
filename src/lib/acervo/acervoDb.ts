import type { Database, SqlJsStatic } from 'sql.js';
import { queryAll, queryOne } from '../database';
import { concursoComAno, formatProcedencia, type PacoteAssunto, type PacoteItem, type PacoteValido } from './pacote';

/**
 * Banco do acervo da Cebraspe (spec 12c §5.1): um sql.js à parte, só de leitura, montado na importação. Fica fora do
 * banco do estudante e das cópias de segurança (pode ser reimportado do pacote). Só entram os itens com assunto; o
 * texto já sai pronto para a tela (enunciado com o texto-base, alternativas, procedência).
 */

export interface AcervoRow {
  id: string;
  statement: string;
  options_json: string;
  final_answer: string;
  anulado: number;
  incerto: number;
  source_label: string;
  exam_year: number;
  organ: string;
}

const SCHEMA = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE assuntos (id TEXT PRIMARY KEY, caminho_json TEXT NOT NULL, sinonimos_json TEXT NOT NULL);
  CREATE TABLE itens (
    id TEXT PRIMARY KEY,
    statement TEXT NOT NULL,
    options_json TEXT NOT NULL,
    final_answer TEXT NOT NULL,
    anulado INTEGER NOT NULL,
    incerto INTEGER NOT NULL,
    hidden INTEGER NOT NULL,
    source_label TEXT NOT NULL,
    exam_year INTEGER NOT NULL,
    organ TEXT NOT NULL
  );
  CREATE TABLE item_assuntos (item_id TEXT NOT NULL, assunto_id TEXT NOT NULL, PRIMARY KEY (item_id, assunto_id));
  CREATE INDEX idx_item_assuntos_assunto ON item_assuntos(assunto_id);
`;

const ROW_COLUMNS = 'i.id, i.statement, i.options_json, i.final_answer, i.anulado, i.incerto, i.source_label, i.exam_year, i.organ';
const TRUE_FALSE_OPTIONS = JSON.stringify(['C) Certo', 'E) Errado']);

function itemValues(item: PacoteItem): (string | number)[] {
  const [first, ...others] = item.procedencias;
  const statement = item.textoBase ? `${item.textoBase}\n\n${item.enunciado}` : item.enunciado;
  const options = item.alternativas ? JSON.stringify(item.alternativas) : TRUE_FALSE_OPTIONS;
  // Figura que não vem no texto ou fórmula que o PDF não deixou ler: o estudante não teria como responder
  const hidden = item.dependeDeFigura || item.temSimboloIlegivel;
  return [
    item.id,
    statement,
    options,
    item.gabarito,
    item.anulado ? 1 : 0,
    item.incerto ? 1 : 0,
    hidden ? 1 : 0,
    formatProcedencia(first, others.length),
    first.ano,
    concursoComAno(first),
  ];
}

export function buildAcervoDb(SQL: SqlJsStatic, pacote: PacoteValido): { db: Database; stats: { withSubject: number; hidden: number } } {
  const db = new SQL.Database();
  db.run(SCHEMA);
  const stats = { withSubject: 0, hidden: 0 };

  db.run('BEGIN TRANSACTION;');
  db.run("INSERT INTO meta (key, value) VALUES ('vocab_version', ?), ('imported_at', ?)", [
    String(pacote.vocabVersion),
    new Date().toISOString(),
  ]);
  const insertAssunto = db.prepare('INSERT OR IGNORE INTO assuntos (id, caminho_json, sinonimos_json) VALUES (?, ?, ?)');
  for (const a of pacote.assuntos) insertAssunto.run([a.id, JSON.stringify(a.caminho), JSON.stringify(a.sinonimos)]);
  insertAssunto.free();

  const insertItem = db.prepare('INSERT OR IGNORE INTO itens VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertLink = db.prepare('INSERT OR IGNORE INTO item_assuntos (item_id, assunto_id) VALUES (?, ?)');
  for (const item of pacote.itens) {
    // Item sem assunto não aparece em tópico nenhum (anti-objetivo da spec): nem entra no acervo
    if (item.assuntos.length === 0) continue;
    const values = itemValues(item);
    insertItem.run(values);
    for (const a of item.assuntos) insertLink.run([item.id, a.id]);
    stats.withSubject += 1;
    if (values[6] === 1) stats.hidden += 1;
  }
  insertItem.free();
  insertLink.free();
  db.run('COMMIT;');
  return { db, stats };
}

export function acervoVocabVersion(db: Database): number {
  return Number(queryOne<{ value: string }>(db, "SELECT value FROM meta WHERE key = 'vocab_version'")?.value ?? 0);
}

function toAssunto(row: { id: string; caminho_json: string; sinonimos_json: string }): PacoteAssunto {
  return { id: row.id, caminho: JSON.parse(row.caminho_json) as string[], sinonimos: JSON.parse(row.sinonimos_json) as string[] };
}

export function readAcervoVocab(db: Database): PacoteAssunto[] {
  return queryAll<{ id: string; caminho_json: string; sinonimos_json: string }>(db, 'SELECT * FROM assuntos ORDER BY id').map(toAssunto);
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

export function assuntoCaminhos(db: Database, ids: string[]): Record<string, string[]> {
  if (ids.length === 0) return {};
  const rows = queryAll<{ id: string; caminho_json: string; sinonimos_json: string }>(
    db,
    `SELECT * FROM assuntos WHERE id IN (${placeholders(ids.length)})`,
    ids
  );
  return Object.fromEntries(rows.map((row) => [row.id, toAssunto(row).caminho]));
}

/**
 * Itens dos assuntos ligados e dos descendentes deles ("x>atos" traz "x>atos>atributos", mas não "x>atos-normativos":
 * o separador entra no padrão). Sem os escondidos, sem repetir, do ano mais recente para o mais antigo.
 */
export function itemsForAssuntos(db: Database, assuntoIds: string[]): AcervoRow[] {
  if (assuntoIds.length === 0) return [];
  const conditions = assuntoIds.map(() => '(a.assunto_id = ? OR a.assunto_id LIKE ?)').join(' OR ');
  const params = assuntoIds.flatMap((id) => [id, `${id}>%`]);
  return queryAll<AcervoRow>(
    db,
    `SELECT DISTINCT ${ROW_COLUMNS} FROM itens i JOIN item_assuntos a ON a.item_id = i.id
     WHERE i.hidden = 0 AND (${conditions}) ORDER BY i.exam_year DESC, i.id`,
    params
  );
}

export function itemsByIds(db: Database, ids: string[]): AcervoRow[] {
  if (ids.length === 0) return [];
  return queryAll<AcervoRow>(db, `SELECT ${ROW_COLUMNS} FROM itens i WHERE i.id IN (${placeholders(ids.length)}) ORDER BY i.id`, ids);
}
