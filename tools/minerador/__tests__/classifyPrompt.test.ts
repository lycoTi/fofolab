// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildBatchPrompt, estimateTokens, parseBatchResponse, type BatchEntry } from '../classifyPrompt';
import type { AcervoItem } from '../types';
import type { Assunto } from '../vocab';

const item = (id: string, enunciado: string): AcervoItem => ({
  id, formato: 'CERTO_ERRADO', textoBase: 'Julgue os itens sobre bancos de dados.', enunciado, alternativas: null, gabarito: 'C',
  anulado: false, materiaOrigem: 'CONHECIMENTOS ESPECÍFICOS', temCodigo: false, dependeDeFigura: false, temSimboloIlegivel: false,
  procedencias: [{ banca: 'Cebraspe', identificador: 'X', concurso: 'X', ano: 2023, prova: 'P', caderno: 'C', numero: 1 }],
});
const assunto = (id: string, caminho: string[]): Assunto => ({ id, caminho, sinonimos: [], origem: 'edital' });

const batch: BatchEntry[] = [
  { item: item('X:C:1', 'O LEFT JOIN retorna clientes sem pedidos.'), candidatos: [assunto('bd>sql', ['Banco', 'SQL']), assunto('bd>modelo', ['Banco', 'Modelagem'])] },
  { item: item('X:C:2', 'A terceira forma normal elimina dependências transitivas.'), candidatos: [assunto('bd>modelo', ['Banco', 'Modelagem'])] },
];

describe('Prompt do lote e validação da resposta', () => {
  it('o prompt leva o item, os candidatos por id e avisa que a matéria de origem é só pista', () => {
    const prompt = buildBatchPrompt(batch);
    expect(prompt).toContain('O LEFT JOIN retorna clientes sem pedidos.');
    expect(prompt).toContain('bd>sql');
    expect(prompt).toMatch(/matéria de origem é só uma pista/i);
    expect(prompt).toMatch(/somente/i);
    expect(estimateTokens(prompt)).toBeGreaterThan(50);
  });

  it('lista as matérias que já existem e pede proposta geral, como num edital', () => {
    const prompt = buildBatchPrompt(batch, ['Língua Portuguesa', 'Engenharia de Software e Programação']);
    expect(prompt).toContain('Matérias que já existem');
    expect(prompt).toContain('- Língua Portuguesa');
    expect(prompt).toMatch(/assunto geral, como os tópicos de um edital/i);
    expect(prompt).toMatch(/nunca específico de um órgão/i);
  });

  it('aceita cercas de código, descarta assunto fora da lista do item e id fora do lote; corta a confiança em 0–1', () => {
    const text = '```json\n' + JSON.stringify({
      resultados: [
        { id: 'X:C:1', assuntos: [{ id: 'bd>sql', confianca: 1.4 }, { id: 'inventado', confianca: 0.9 }], proposta: null },
        { id: 'X:C:2', assuntos: [{ id: 'bd>sql', confianca: 0.9 }], proposta: { caminho: ['Banco', 'Normalização'], confianca: 0.85 } },
        { id: 'FORA:1', assuntos: [{ id: 'bd>sql', confianca: 0.9 }], proposta: null },
      ],
    }) + '\n```';
    const parsed = parseBatchResponse(text, batch);
    expect(parsed.get('X:C:1')).toEqual({ assuntos: [{ id: 'bd>sql', confianca: 1 }], proposta: null });
    // bd>sql não era candidato do item 2: sai; a proposta fica
    expect(parsed.get('X:C:2')).toEqual({ assuntos: [], proposta: { caminho: ['Banco', 'Normalização'], confianca: 0.85 } });
    expect(parsed.has('FORA:1')).toBe(false);
  });

  it('item ausente na resposta não aparece; JSON quebrado devolve mapa vazio sem exceção', () => {
    const parsed = parseBatchResponse(JSON.stringify({ resultados: [{ id: 'X:C:1', assuntos: [{ id: 'bd>sql', confianca: 0.9 }] }] }), batch);
    expect(parsed.has('X:C:2')).toBe(false);
    expect(parseBatchResponse('{"resultados": [', batch).size).toBe(0);
    expect(parseBatchResponse('não sou json', batch).size).toBe(0);
  });
});
