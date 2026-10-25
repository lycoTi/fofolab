// @vitest-environment node
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLote, LOTE_PALAVRAS_PADRAO, mergeDuplicates, readConcurso, writeConcurso } from '../acervoStore';
import type { AcervoItem, CebraspeEvent } from '../types';

const event = (identificador: string, nome: string, ano: number): CebraspeEvent => ({ identificador, nome, ano, tipo: 'concursos', status: 'encerrado' });

const acervoItem = (caderno: string, numero: number, enunciado: string): AcervoItem => ({
  id: `X_23:${caderno}:${numero}`, formato: 'CERTO_ERRADO', textoBase: 'Julgue os itens.', enunciado, alternativas: null,
  gabarito: 'C', anulado: false, materiaOrigem: null, temCodigo: false, dependeDeFigura: false,
  procedencias: [{ banca: 'Cebraspe', identificador: 'X_23', concurso: 'X 23', ano: 2023, areas: [], prova: 'P', caderno, numero }],
});

describe('Acervo: lote, repetidas e arquivo estável', () => {
  it('o lote pega concursos de 2021 em diante cujo nome casa as palavras do recorte', () => {
    const lote = buildLote(
      [event('SERPRO_23', 'SERPRO 23', 2023), event('PM_SC_23_OFICIAL', 'PM SC 23 OFICIAL', 2023), event('TCE_PB_19_AUDITOR', 'TCE PB 19 AUDITOR', 2019), event('BANCO_CENTRAL_24', 'Banco Central 24', 2024)],
      { anoMinimo: 2021, palavras: LOTE_PALAVRAS_PADRAO }
    );
    expect(lote).toEqual(['BANCO_CENTRAL_24', 'SERPRO_23']);
  });

  it('item repetido vira um só, juntando as procedências', () => {
    const merged = mergeDuplicates([acervoItem('B', 7, 'A  regra vale.'), acervoItem('A', 51, 'A regra vale.'), acervoItem('A', 52, 'Outra.')]);
    expect(merged).toHaveLength(2);
    const regra = merged.find((i) => i.enunciado.startsWith('A'))!;
    expect(regra.id).toBe('X_23:A:51');
    expect(regra.procedencias.map((p) => `${p.caderno}:${p.numero}`)).toEqual(['A:51', 'B:7']);
  });

  it('grava em ordem de caderno e número, e a releitura devolve o mesmo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acervo-'));
    const itens = [acervoItem('A', 100, 'Cem.'), acervoItem('A', 51, 'Cinquenta e um.')];
    writeConcurso(dir, 'X_23', itens);
    const lidos = readConcurso(dir, 'X_23');
    expect(lidos.map((i) => i.procedencias[0].numero)).toEqual([51, 100]);
    expect(readConcurso(dir, 'NAO_EXISTE')).toEqual([]);
  });
});
