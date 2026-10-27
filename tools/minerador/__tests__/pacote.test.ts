// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeConcurso } from '../acervoStore';
import { writeClassificacao } from '../classificationStore';
import { buildPacote, writePacoteAndIndex, type PacoteIndex } from '../pacote';
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

  it('writePacoteAndIndex grava cebraspe.json, fofolab-acervo-cebraspe.json e atualiza index.json preservando outras bancas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pacote-idx-'));
    writeVocabulario(join(dir, 'vocabulario.json'), { versao: 7, assuntos: [{ id: 'bd>sql', caminho: ['BD', 'SQL'], sinonimos: [], origem: 'edital' }], historico: [] });
    writeConcurso(join(dir, 'cebraspe'), { identificador: 'A_23', concurso: 'A 23', ano: 2023, areas: [] }, [item(1), item(2)]);
    writeClassificacao(join(dir, 'classificacao'), {
      identificador: 'A_23',
      itens: {
        'A_23:C:1': {
          opinioes: { 'agy:g': { assuntos: [{ id: 'bd>sql', confianca: 0.9 }], versaoVocabulario: 7 } },
          consenso: [{ id: 'bd>sql', confianca: 0.9 }], incerto: false, concordancia: 'uma-opiniao',
        },
      },
    });

    const pacoteDir = join(dir, 'pacote');
    mkdirSync(pacoteDir, { recursive: true });
    writeFileSync(
      join(pacoteDir, 'index.json'),
      JSON.stringify({
        formato: 'fofolab-acervo-index',
        versao: 1,
        pacotes: [{ id: 'fgv', banca: 'FGV', arquivo: 'fgv.json', vocabVersion: 5, itensComAssunto: 42, atualizadoEm: '2026-10-20T00:00:00.000Z' }],
      })
    );

    const now = new Date('2026-10-27T18:00:00.000Z');
    const { entry } = writePacoteAndIndex(dir, now);
    expect(entry).toEqual({
      id: 'cebraspe',
      banca: 'Cebraspe',
      arquivo: 'cebraspe.json',
      vocabVersion: 7,
      itensComAssunto: 1,
      atualizadoEm: '2026-10-27T18:00:00.000Z',
    });

    expect(existsSync(join(pacoteDir, 'cebraspe.json'))).toBe(true);
    expect(existsSync(join(pacoteDir, 'fofolab-acervo-cebraspe.json'))).toBe(true);
    const index = JSON.parse(readFileSync(join(pacoteDir, 'index.json'), 'utf8')) as PacoteIndex;
    expect(index).toEqual({
      formato: 'fofolab-acervo-index',
      versao: 1,
      pacotes: [
        { id: 'cebraspe', banca: 'Cebraspe', arquivo: 'cebraspe.json', vocabVersion: 7, itensComAssunto: 1, atualizadoEm: '2026-10-27T18:00:00.000Z' },
        { id: 'fgv', banca: 'FGV', arquivo: 'fgv.json', vocabVersion: 5, itensComAssunto: 42, atualizadoEm: '2026-10-20T00:00:00.000Z' },
      ],
    });
  });
});
