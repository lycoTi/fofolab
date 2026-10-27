// @vitest-environment node
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initSqlJs from 'sql.js';
import {
  acervoVocabVersion,
  assuntoCaminhos,
  buildAcervoDb,
  itemsByIds,
  itemsForAssuntos,
  itemsForAssuntosQuery,
  readAcervoVocab,
} from '../lib/acervo/acervoDb';
import { createIndexedDbAcervoStorage, createMemoryAcervoStorage } from '../lib/acervo/acervoStore';
import { parsePacote, type PacoteItem, type PacoteValido } from '../lib/acervo/pacote';
import { createMemoryStorage } from '../lib/storage';

const SQL = await initSqlJs({});

function miniPacote(): PacoteValido {
  const result = parsePacote(readFileSync('src/__tests__/fixtures/acervo-mini.json', 'utf8'));
  if (!result.ok) throw new Error(result.message);
  return result.pacote;
}

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
    procedencias: [{ banca: 'Cebraspe', concurso: 'TESTE 24', ano: 2024, numero: 1 }],
    assuntos: assuntos.map((a) => ({ id: a, confianca: 0.9 })),
    incerto: false,
    ...extra,
  };
}

function pacoteWith(itens: PacoteItem[]): PacoteValido {
  const ids = ['x', 'x>atos', 'x>atos>atributos', 'x>atos-normativos'];
  return {
    vocabVersion: 9,
    assuntos: ids.map((id) => ({ id, caminho: id.split('>'), sinonimos: [] })),
    itens,
    invalidItems: 0,
  };
}

describe('Banco do acervo (spec 12c §5.1)', () => {
  it('monta só os itens com assunto; figura e símbolo ilegível ficam escondidos e contam no resumo', () => {
    const { db, stats } = buildAcervoDb(SQL, miniPacote());
    expect(stats).toEqual({ withSubject: 3, hidden: 1 });
    expect(acervoVocabVersion(db)).toBe(5);
    expect(itemsByIds(db, ['TESTE_24:c1:5'])).toEqual([]);
    expect(itemsByIds(db, ['TESTE_24:c1:3']).map((r) => r.id)).toEqual(['TESTE_24:c1:3']);
    expect(itemsForAssuntos(db, ['direito-administrativo>licitacoes'])).toEqual([]);
  });

  it('Certo/Errado vira C) Certo / E) Errado; texto-base vai antes do enunciado; procedência e órgão com o ano inteiro', () => {
    const { db } = buildAcervoDb(SQL, miniPacote());
    const [ce] = itemsByIds(db, ['TESTE_24:c1:1']);
    expect(ce).toEqual({
      id: 'TESTE_24:c1:1',
      statement: 'Item de teste: a presunção de legitimidade é atributo do ato administrativo.',
      options_json: JSON.stringify(['C) Certo', 'E) Errado']),
      final_answer: 'C',
      anulado: 0,
      incerto: 0,
      source_label: 'Cebraspe · TESTE 2024 · item 1',
      exam_year: 2024,
      organ: 'TESTE 2024',
    });
    const [me] = itemsByIds(db, ['TESTE_24:c1:2']);
    expect(me.statement).toBe('Texto de apoio do item de teste.\n\nItem de teste: o decreto regulamentar é exemplo de ato');
    expect(JSON.parse(me.options_json)).toEqual(['A) ordinatório.', 'B) normativo.', 'C) negocial.', 'D) punitivo.']);
    expect(me.incerto).toBe(1);
    expect(me.source_label).toBe('Cebraspe · TESTE 2024 · item 2 (e em mais 1 prova)');
  });

  it('o assunto ligado traz os descendentes, sem confundir prefixo de palavra', () => {
    const { db } = buildAcervoDb(
      SQL,
      pacoteWith([item('i-atos', ['x>atos']), item('i-atributos', ['x>atos>atributos']), item('i-normativos', ['x>atos-normativos'])])
    );
    expect(itemsForAssuntos(db, ['x>atos']).map((r) => r.id).sort()).toEqual(['i-atos', 'i-atributos']);
    expect(itemsForAssuntos(db, ['x>atos-normativos']).map((r) => r.id)).toEqual(['i-normativos']);
  });

  it('a busca por assunto usa o índice (com o acervo todo classificado, varrer a tabela travaria "Todo o plano")', () => {
    const { db } = buildAcervoDb(SQL, pacoteWith([item('i-atos', ['x>atos'])]));
    const { sql, params } = itemsForAssuntosQuery(['x>atos', 'x>atos-normativos']);
    const plan = db
      .exec(`EXPLAIN QUERY PLAN ${sql}`, params)[0]
      .values.map((row) => String(row[3]))
      .join(' | ');
    expect(plan).toContain('idx_item_assuntos_assunto');
    expect(plan).not.toMatch(/SCAN a\b/);
  });

  it('item com dois assuntos ligados aparece uma vez; ordem pelo ano mais recente', () => {
    const { db } = buildAcervoDb(
      SQL,
      pacoteWith([
        item('velho', ['x>atos'], { procedencias: [{ banca: 'Cebraspe', concurso: 'TESTE 21', ano: 2021, numero: 3 }] }),
        item('dois', ['x>atos', 'x>atos-normativos']),
      ])
    );
    expect(itemsForAssuntos(db, ['x>atos', 'x>atos-normativos']).map((r) => r.id)).toEqual(['dois', 'velho']);
  });

  it('vocabulário e caminhos dos assuntos pedidos', () => {
    const { db } = buildAcervoDb(SQL, miniPacote());
    expect(readAcervoVocab(db).find((a) => a.id === 'direito-administrativo>licitacoes')).toEqual({
      id: 'direito-administrativo>licitacoes',
      caminho: ['Direito Administrativo', 'Licitações'],
      sinonimos: ['Licitações e contratos'],
    });
    expect(assuntoCaminhos(db, ['direito-administrativo>atos-normativos', 'nao-existe'])).toEqual({
      'direito-administrativo>atos-normativos': ['Direito Administrativo', 'Atos normativos'],
    });
  });
});

describe('Onde o acervo fica (fora do banco do estudante)', () => {
  it('grava e reabre pela memória e pelo armazenamento do navegador', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const memory = createMemoryAcervoStorage();
    expect(await memory.load()).toBeNull();
    await memory.save(bytes);
    expect(await memory.load()).toEqual(bytes);

    const idb = await createIndexedDbAcervoStorage({ dbName: `acervo-teste-${Math.random()}` });
    expect(await idb.load()).toBeNull();
    await idb.save(bytes);
    expect(await idb.load()).toEqual(bytes);
  });
});

describe('Acervo aberto sob demanda na sessão', () => {
  afterEach(() => vi.resetModules());

  async function freshModules() {
    vi.resetModules();
    const database = await import('../lib/database');
    await database.initDatabase({ storage: createMemoryStorage(), sqlJsConfig: {} });
    const store = await import('../lib/acervo/acervoStore');
    const storage = store.createMemoryAcervoStorage();
    store.setAcervoStorageForTests(storage);
    return { store, storage, database };
  }

  it('nada importado → openAcervo devolve null', async () => {
    const { store } = await freshModules();
    expect(await store.openAcervo()).toBeNull();
  });

  it('replaceAcervo grava fora do banco do estudante e troca o que está aberto', async () => {
    const { store, storage, database } = await freshModules();
    const first = buildAcervoDb(database.getSqlJs(), miniPacote()).db;
    await store.replaceAcervo(first);
    expect(storage.current).not.toBeNull();
    expect(acervoVocabVersion((await store.openAcervo())!)).toBe(5);

    const newer = buildAcervoDb(database.getSqlJs(), { ...pacoteWith([item('novo', ['x>atos'])]), vocabVersion: 6 }).db;
    await store.replaceAcervo(newer);
    expect(acervoVocabVersion((await store.openAcervo())!)).toBe(6);

    // Outra sessão (app reaberto) lê o que foi gravado
    store.setAcervoStorageForTests(storage);
    const reopened = await store.openAcervo();
    expect(reopened).not.toBe(newer);
    expect(acervoVocabVersion(reopened!)).toBe(6);
  });
});
