// @vitest-environment node
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { candidatesFor, keywords, queueOrder } from '../candidates';
import type { AcervoItem } from '../types';
import { readEditalLines, seedFromEdital, type Vocabulario } from '../vocab';

const EDITAL = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'cgu-2026-affc-edital.pdf');

const item = (id: string, enunciado: string, materiaOrigem: string | null = null): AcervoItem => ({
  id, formato: 'CERTO_ERRADO', textoBase: null, enunciado, alternativas: null, gabarito: 'C', anulado: false, materiaOrigem,
  temCodigo: false, dependeDeFigura: false, temSimboloIlegivel: false,
  procedencias: [{ banca: 'Cebraspe', identificador: 'X', concurso: 'X', ano: 2023, prova: 'P', caderno: 'C', numero: 1 }],
});

describe('Candidatos locais (antes da IA) e ordem da fila', () => {
  let vocab: Vocabulario;
  beforeAll(async () => {
    vocab = seedFromEdital(await readEditalLines(EDITAL));
  }, 60_000);

  it('palavras-chave sem acento, sem palavras vazias de prova, cortadas no 6º caractere', () => {
    const k = keywords('Julgue os itens a seguir acerca da Normalização de bancos de dados relacionais.');
    expect(k.has('normal')).toBe(true);
    expect(k.has('relaci')).toBe(true);
    expect(k.has('julgue')).toBe(false);
    expect(k.has('itens')).toBe(false);
  });

  it('item de SQL tem como 1º candidato um assunto de banco de dados; k limita a lista', () => {
    const sql = item('a', 'O comando SQL com junção entre tabelas relacionais retorna linhas da chave estrangeira.');
    const top = candidatesFor(sql, vocab, 5);
    expect(top.length).toBeLessThanOrEqual(5);
    const first = vocab.assuntos.find((a) => a.id === top[0].id)!;
    expect(first.caminho.join(' › ')).toMatch(/dados|SQL/i);
  });

  it('item sem palavra em comum com o vocabulário não tem candidato', () => {
    expect(candidatesFor(item('b', 'Xyzzy plugh frobozz.'), vocab, 5)).toEqual([]);
  });

  it('fila: o que mais casa com o vocabulário vem primeiro', () => {
    const sql = item('a', 'O comando SQL com junção entre tabelas relacionais retorna linhas da chave estrangeira.');
    const militar = item('b', 'O regime disciplinar dos militares estaduais prevê punição por transgressão.');
    expect(queueOrder([militar, sql], vocab).map((i) => i.id)).toEqual(['a', 'b']);
  });
});
