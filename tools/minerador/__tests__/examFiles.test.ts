// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEventDetail } from '../cebraspeApi';
import { selectExamPairs } from '../examFiles';
import type { CebraspeEventDetail, CebraspeFile } from '../types';

const serpro = parseEventDetail(JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', 'evento-SERPRO_23.json'), 'utf8')));
const file = (descricao: string, nomeArquivo: string): CebraspeFile => ({ descricao, nomeArquivo, data: '' });
const detail = (arquivos: CebraspeFile[]): CebraspeEventDetail => ({ ...serpro, arquivos });

describe('Escolha da prova e do gabarito definitivo de cada caderno', () => {
  it('SERPRO 2023: dois cadernos objetivos; discursiva e padrões de resposta ficam de fora', () => {
    const { pares, ignorados, pendentes } = selectExamPairs(serpro);
    expect(pares.map((p) => p.caderno).sort()).toEqual(['846_SERPRO_23_001_01', '846_SERPRO_23_CB1_01']);
    const especificos = pares.find((p) => p.caderno === '846_SERPRO_23_001_01')!;
    expect(especificos.prova.nomeArquivo).toBe('846_SERPRO_23_001_01.PDF');
    expect(especificos.gabarito.nomeArquivo).toBe('GAB_DEFINITIVO_846_SERPRO_23_001_01.PDF');
    expect(ignorados).toContain('874_SERPRO_PRATICA_001.PDF');
    expect(ignorados).toContain('PADRAORESPOSTA_874001A01.PDF');
    expect(pendentes).toEqual([]);
  });

  it('prefere o definitivo ATUALIZADO e nunca usa o SEM EFEITO', () => {
    const { pares } = selectExamPairs(
      detail([
        file('PROVA OBJETIVA – CONHECIMENTOS GERAIS (P1)', '900_X_CG1_01.PDF'),
        file('GABARITO DEFINITIVO – CONHECIMENTOS GERAIS (P1) - SEM EFEITO', 'GAB_DEFINITIVO_900_X_CG1_01_SE.PDF'),
        file('GABARITO DEFINITIVO – CONHECIMENTOS GERAIS (P1)', 'GAB_DEFINITIVO_900_X_CG1_01.PDF'),
        file('GABARITO DEFINITIVO – CONHECIMENTOS GERAIS (P1) - ATUALIZADO', 'GAB_DEFINITIVO_900_X_CG1_01_AT.PDF'),
      ])
    );
    expect(pares).toHaveLength(1);
    expect(pares[0].gabarito.nomeArquivo).toBe('GAB_DEFINITIVO_900_X_CG1_01_AT.PDF');
  });

  it('"GABARITO DEFINITIVO - PROVA OBJETIVA" é gabarito, não prova; prova só com preliminar fica pendente', () => {
    const { pares, pendentes } = selectExamPairs(
      detail([
        file('PROVA OBJETIVA', '885_PGE_OBJ_001_01.PDF'),
        file('GABARITO DEFINITIVO - PROVA OBJETIVA (P1)', 'GAB_DEFINITIVO_885_PGE_OBJ_001_01.PDF'),
        file('PROVA OBJETIVA - CONHECIMENTOS BÁSICOS', '885_PGE_CB1_01.PDF'),
        file('GABARITO PRELIMINAR - CONHECIMENTOS BÁSICOS', 'GAB_PRELIMINAR_885_PGE_CB1_01.PDF'),
      ])
    );
    expect(pares.map((p) => p.prova.nomeArquivo)).toEqual(['885_PGE_OBJ_001_01.PDF']);
    expect(pendentes).toEqual(['885_PGE_CB1_01']);
  });

  it('nome do arquivo em hash: pareia pela descrição; edital de resultado "na prova objetiva" não é prova', () => {
    const { pares, pendentes } = selectExamPairs(
      detail([
        file('PROVA OBJETIVA – PROGRAMA DE CAPACITAÇÃO (PROCAP) – 2ª TURMA', '7CB3CA8191F93FA0DFF1.pdf'),
        file('GABARITO DEFINITIVO – PROGRAMA DE CAPACITAÇÃO (PROCAP) – 2ª TURMA', '0A7F0581FB096CC2E249.pdf'),
        file('GABARITO DEFINITIVO – PROGRAMA DE CAPACITAÇÃO (PROCAP) - ATUALIZADO', '1111.pdf'),
        file('PROVA OBJETIVA – PROGRAMA DE CAPACITAÇÃO (PROCAP)', '2222.pdf'),
        file('Edital nº 4 – Resultado final na prova objetiva e convocação', 'ED_4_RES_FINAL_OBJ.PDF'),
      ])
    );
    expect(pares.map((p) => [p.prova.nomeArquivo, p.gabarito.nomeArquivo])).toEqual([
      ['7CB3CA8191F93FA0DFF1.pdf', '0A7F0581FB096CC2E249.pdf'],
      ['2222.pdf', '1111.pdf'],
    ]);
    expect(pendentes).toEqual([]);
  });

  it('arquivo único com prova e gabarito é ignorado; justificativas vão à parte', () => {
    const { pares, ignorados, justificativas } = selectExamPairs(
      detail([
        file('PROVA OBJETIVA E GABARITO DEFINITIVO', '920_AGU_GABARITO_DEFINITIVO.PDF'),
        file('Justificativas de alterações de gabarito', 'JUSTIFICATIVAS_920.PDF'),
      ])
    );
    expect(pares).toEqual([]);
    expect(ignorados).toContain('920_AGU_GABARITO_DEFINITIVO.PDF');
    expect(justificativas.map((j) => j.nomeArquivo)).toEqual(['JUSTIFICATIVAS_920.PDF']);
  });
});
