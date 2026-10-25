// @vitest-environment node
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeConcurso } from '../acervoStore';
import { writeClassificacao } from '../classificationStore';
import { buildPacote } from '../pacote';
import type { AcervoItem } from '../types';
import { writeVocabulario } from '../vocab';

const item = (n: number): AcervoItem => ({
  id: `A_23:C:${n}`, formato: 'CERTO_ERRADO', textoBase: null, enunciado: `Item ${n}.`, alternativas: null, gabarito: 'C', anulado: false,
  materiaOrigem: null, temCodigo: false, dependeDeFigura: false, temSimboloIlegivel: false,
  procedencias: [{ banca: 'Cebraspe', identificador: 'A_23', concurso: 'A 23', ano: 2023, prova: 'P', caderno: 'C', numero: n }],
});

describe('Pacote do acervo para o app', () => {
  it('leva vocabulário, concursos com áreas e o consenso de cada item (não as opiniões)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pacote-'));
    writeVocabulario(join(dir, 'vocabulario.json'), { versao: 3, assuntos: [{ id: 'bd>sql', caminho: ['BD', 'SQL'], sinonimos: [], origem: 'edital' }], historico: [] });
    writeConcurso(join(dir, 'cebraspe'), { identificador: 'A_23', concurso: 'A 23', ano: 2023, areas: ['ANALISTA – TI'] }, [item(1), item(2)]);
    writeClassificacao(join(dir, 'classificacao'), {
      identificador: 'A_23',
      itens: {
        'A_23:C:1': {
          opinioes: { 'agy:g': { assuntos: [{ id: 'bd>sql', confianca: 0.9 }], versaoVocabulario: 3 } },
          consenso: [{ id: 'bd>sql', confianca: 0.9 }], incerto: false, concordancia: 'uma-opiniao',
        },
      },
    });
    const p = buildPacote(dir);
    expect(p).toMatchObject({ formato: 'fofolab-acervo', versao: 1 });
    expect(p.vocabulario.versao).toBe(3);
    expect(p.concursos).toEqual([{ identificador: 'A_23', concurso: 'A 23', ano: 2023, areas: ['ANALISTA – TI'] }]);
    const [c1, c2] = p.itens;
    expect(c1).toMatchObject({ id: 'A_23:C:1', assuntos: [{ id: 'bd>sql', confianca: 0.9 }], incerto: false, concordancia: 'uma-opiniao' });
    expect(c1).not.toHaveProperty('opinioes');
    expect(c2).toMatchObject({ id: 'A_23:C:2', assuntos: [], incerto: true, concordancia: 'sem-classificacao' });
  });
});
