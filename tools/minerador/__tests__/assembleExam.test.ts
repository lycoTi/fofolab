// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseAnswerKey } from '../answerKey';
import { assembleExam, dependsOnFigure, detectCode } from '../assembleExam';
import { segmentMultipleChoice } from '../segmentMultipleChoice';
import { segmentTrueFalse } from '../segmentTrueFalse';
import type { AcervoItem, AnswerMark, ExtractedItem, Procedencia } from '../types';
import { fixtureLines, PMSC_GABARITO, PMSC_PROVA, SERPRO_GABARITO, SERPRO_PROVA } from './fixtures';

const origemSerpro: Omit<Procedencia, 'numero'> = {
  banca: 'Cebraspe', identificador: 'SERPRO_23', concurso: 'SERPRO 23', ano: 2023,
  prova: 'PROVA OBJETIVA - CONHECIMENTOS ESPECÍFICOS', caderno: '846_SERPRO_23_001_01',
};

describe('Montagem da prova: gabarito, anulados, código e figura', () => {
  let serproItems: ExtractedItem[];
  let serproKey: Map<number, AnswerMark>;
  let serpro: AcervoItem[];
  const item = (n: number) => serpro.find((i) => i.procedencias[0].numero === n)!;

  beforeAll(async () => {
    serproItems = segmentTrueFalse(await fixtureLines(SERPRO_PROVA));
    serproKey = parseAnswerKey(await fixtureLines(SERPRO_GABARITO, { singleColumn: true }));
    const outcome = assembleExam(serproItems, serproKey, origemSerpro);
    if (outcome.kind !== 'ok') throw new Error(outcome.motivo);
    serpro = outcome.itens;
  });

  it('SERPRO: 70 itens com gabarito; anulado sem gabarito; id e procedência', () => {
    expect(serpro).toHaveLength(70);
    expect(item(51)).toMatchObject({ id: 'SERPRO_23:846_SERPRO_23_001_01:51', gabarito: 'E', anulado: false, formato: 'CERTO_ERRADO' });
    expect(item(60)).toMatchObject({ gabarito: null, anulado: true });
    expect(item(51).procedencias).toEqual([{ ...origemSerpro, numero: 51 }]);
  });

  it('a prosa vira uma linha só; o código fica em bloco, com aspas retas', () => {
    expect(item(51).enunciado).not.toContain('\n');
    expect(item(72).temCodigo).toBe(true);
    expect(item(72).enunciado).toContain('```');
    expect(item(72).enunciado).toContain('raio = float(input("Digite o raio do círculo:');
    expect(item(72).enunciado.startsWith('O código a seguir está sintaticamente correto e atende à necessidade do usuário.')).toBe(true);
    expect(item(51).temCodigo).toBe(false);
  });

  it('código com recuo próprio (Flutter, item 78) fica inteiro no item, sem vazar para o seguinte', () => {
    const code = item(78).enunciado.match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
    expect(code.startsWith("import 'package:flutter/material.dart';")).toBe(true);
    expect(code).toContain('void main() {');
    expect(code.trim().endsWith('}')).toBe(true);
    expect(item(79).textoBase).toBe(item(78).textoBase);
    expect(item(79).temCodigo).toBe(false);
    expect(item(80).temCodigo).toBe(false);
  });

  it('PM SC: 80 questões de múltipla escolha, a 16 anulada', async () => {
    const outcome = assembleExam(
      segmentMultipleChoice(await fixtureLines(PMSC_PROVA)),
      parseAnswerKey(await fixtureLines(PMSC_GABARITO, { singleColumn: true })),
      { ...origemSerpro, identificador: 'PM_SC_23_OFICIAL', caderno: '860_PMSC_OFICIAL_OBJ_001_01' }
    );
    if (outcome.kind !== 'ok') throw new Error(outcome.motivo);
    expect(outcome.itens).toHaveLength(80);
    const q1 = outcome.itens.find((i) => i.procedencias[0].numero === 1)!;
    expect(q1).toMatchObject({ gabarito: 'D', formato: 'MULTIPLA_ESCOLHA' });
    expect(q1.alternativas).toHaveLength(5);
    expect(q1.alternativas![1]).toBe('B) civis competem as funções de polícia judiciária e a apuração de infrações penais comuns e militares.');
    expect(outcome.itens.find((i) => i.procedencias[0].numero === 16)!.anulado).toBe(true);
  }, 15000);

  it('contagens que não batem mandam a prova inteira para a quarentena', () => {
    const semResposta = new Map(serproKey);
    semResposta.delete(61);
    expect(assembleExam(serproItems, semResposta, origemSerpro)).toEqual({ kind: 'quarentena', motivo: 'itens sem resposta: 61' });
    const respostaSobrando = new Map(serproKey).set(121, 'C');
    expect(assembleExam(serproItems, respostaSobrando, origemSerpro)).toEqual({ kind: 'quarentena', motivo: 'respostas sem item: 121' });
    const formatoErrado = new Map(serproKey).set(51, 'A');
    expect(assembleExam(serproItems, formatoErrado, origemSerpro)).toEqual({
      kind: 'quarentena', motivo: 'resposta "A" incompatível com o item 51 (Certo/Errado)',
    });
  });

  it('prosa que começa com "definição", "importância", "classe" não vira código', () => {
    expect(detectCode('definição da arquitetura em camadas\nimportância da coesão do módulo\nclasse de equivalência').temCodigo).toBe(false);
    expect(detectCode('def area(r):\n    return 3.14 * r * r').temCodigo).toBe(true);
  });

  it('tabela ou quadro "a seguir" é figura; "a tabela clientes" não; símbolo de fórmula ilegível é marcado', () => {
    expect(dependsOnFigure('Com base na tabela a seguir, julgue o item.')).toBe(true);
    expect(dependsOnFigure('Considere o quadro abaixo.')).toBe(true);
    expect(dependsOnFigure('A tabela clientes possui chave primária.')).toBe(false);
    const item = (enunciado: string): ExtractedItem => ({ numero: 1, formato: 'CERTO_ERRADO', textoBase: null, enunciado, alternativas: null, materiaOrigem: null });
    const outcome = assembleExam([item('A função ᡘ䙦ᡶ䙧 é contínua.')], new Map([[1, 'C' as const]]), origemSerpro);
    expect(outcome.kind === 'ok' && outcome.itens[0].temSimboloIlegivel).toBe(true);
    const clean = assembleExam([item('A integridade é uma propriedade.')], new Map([[1, 'C' as const]]), origemSerpro);
    expect(clean.kind === 'ok' && clean.itens[0].temSimboloIlegivel).toBe(false);
  });

  it('código isolado numa linha não vira bloco; figura é reconhecida', () => {
    expect(detectCode('O valor de x = 2 foi usado\nno cálculo.')).toEqual({ temCodigo: false, texto: 'O valor de x = 2 foi usado no cálculo.' });
    expect(dependsOnFigure('Na figura a seguir, julgue o item.')).toBe(true);
    expect(dependsOnFigure('Considere o grafico apresentado.')).toBe(true);
    expect(dependsOnFigure('A integridade é uma propriedade.')).toBe(false);
    expect(dependsOnFigure('Os direitos da personalidade, como o direito à imagem, são inalienáveis.')).toBe(false);
    expect(dependsOnFigure('Com base na imagem a seguir, julgue o item.')).toBe(true);
  });
});
