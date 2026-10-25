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

  it('pista de matéria: item de Português traz os tópicos de Língua Portuguesa, mesmo falando de outro assunto', () => {
    const v: Vocabulario = {
      versao: 1, historico: [], assuntos: [
        ['Língua Portuguesa'], ['Língua Portuguesa', 'Domínio dos mecanismos de coesão textual'], ['Língua Portuguesa', 'Domínio da ortografia oficial'],
        ['Raciocínio Lógico'], ['Raciocínio Lógico', 'Lógica proposicional'],
        ['Sociedade Brasileira'], ['Sociedade Brasileira', 'Tecnologia social e desenvolvimento'],
      ].map((c) => ({ id: c.join('>').toLowerCase(), caminho: c, sinonimos: [], origem: 'edital' as const })),
    };
    const pt = item('p', 'No trecho “as tecnologias sociais valorizam saberes”, a substituição do vocábulo “valorizam” por “estimam” manteria a correção gramatical do texto.');
    const ids = candidatesFor(pt, v, 10).map((c) => c.id);
    expect(ids).toContain('língua portuguesa>domínio dos mecanismos de coesão textual');
    expect(ids).toContain('língua portuguesa>domínio da ortografia oficial');
    // O assunto do texto continua entre os candidatos
    expect(ids).toContain('sociedade brasileira>tecnologia social e desenvolvimento');
    // Itens de Português da ITAIPU 2023 que ficaram sem candidato (e sem resposta) na amostra de 25/10
    for (const enunciado of [
      'No que concerne a tipologia e gênero textual, o texto CB2A1 classifica-se como',
      'No quinto período do primeiro parágrafo do texto CB2A1, a palavra “ainda” expressa uma ideia de',
      'A respeito das ideias veiculadas no texto CB3A1, julgue os itens a seguir.',
      'No primeiro período do último parágrafo, o termo “a eólica” exerce a mesma função sintática que',
    ]) {
      expect(candidatesFor(item('t', enunciado), v, 10).map((c) => c.id)).toContain('língua portuguesa>domínio dos mecanismos de coesão textual');
    }
    // "Período" de Contabilidade não é pista de Português
    const contabil = item('c', 'No período contábil, a entidade reconheceu a despesa de depreciação do ativo.');
    expect(candidatesFor(contabil, v, 10).map((c) => c.id)).not.toContain('língua portuguesa>domínio da ortografia oficial');
    const rl = item('r', 'A proposição “se chove, então a rua molha” tem a mesma tabela-verdade de sua contrapositiva.');
    expect(candidatesFor(rl, v, 10).map((c) => c.id)).toContain('raciocínio lógico>lógica proposicional');
  });

  it('item sem palavra em comum com o vocabulário não tem candidato', () => {
    expect(candidatesFor(item('b', 'Xyzzy plugh frobozz.'), vocab, 5)).toEqual([]);
  });

  it('fila: o que mais casa com o vocabulário vem primeiro', () => {
    const sql = item('a', 'O comando SQL com junção entre tabelas relacionais retorna linhas da chave estrangeira.');
    const militar = item('b', 'O regime disciplinar dos militares estaduais prevê punição por transgressão.');
    expect(queueOrder([militar, sql], vocab).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('fila com prioridade: itens das matérias do edital do dono vêm antes, mesmo casando menos', () => {
    const v: Vocabulario = {
      versao: 1, historico: [], assuntos: [
        ['Banco de Dados'], ['Banco de Dados', 'Linguagem SQL junção tabelas relacionais chave estrangeira'],
        ['Contabilidade'], ['Contabilidade', 'Depreciação do ativo imobilizado'],
      ].map((c) => ({ id: c.join('>').toLowerCase(), caminho: c, sinonimos: [], origem: 'edital' as const })),
    };
    const sql = item('a', 'O comando SQL com junção entre tabelas relacionais retorna linhas da chave estrangeira.');
    const contabil = item('b', 'A depreciação reduz o valor do ativo.');
    expect(queueOrder([contabil, sql], v).map((i) => i.id)).toEqual(['a', 'b']);
    expect(queueOrder([sql, contabil], v, new Set(['contabilidade'])).map((i) => i.id)).toEqual(['b', 'a']);
  });
});
