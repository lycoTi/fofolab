// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatProcedencia, MAX_PACOTE_BYTES, parsePacote } from '../lib/acervo/pacote';

const MINI = readFileSync('src/__tests__/fixtures/acervo-mini.json', 'utf8');
const REAL_PACOTE = 'acervo/pacote/fofolab-acervo-cebraspe.json';

function withChanges(change: (pacote: Record<string, unknown>) => void): string {
  const pacote = JSON.parse(MINI) as Record<string, unknown>;
  change(pacote);
  return JSON.stringify(pacote);
}

describe('Pacote do acervo (spec 12c §5.2)', () => {
  it('aceita a fixture: 4 itens válidos e 1 inválido contado', () => {
    const result = parsePacote(MINI);
    if (!result.ok) throw new Error(result.message);
    expect(result.pacote.vocabVersion).toBe(5);
    expect(result.pacote.assuntos).toHaveLength(5);
    expect(result.pacote.itens.map((i) => i.id)).toEqual(['TESTE_24:c1:1', 'TESTE_24:c1:2', 'TESTE_24:c1:3', 'TESTE_24:c1:5']);
    expect(result.pacote.invalidItems).toBe(1);
    const me = result.pacote.itens[1];
    expect(me).toMatchObject({
      formato: 'MULTIPLA_ESCOLHA',
      textoBase: 'Texto de apoio do item de teste.',
      alternativas: ['A) ordinatório.', 'B) normativo.', 'C) negocial.', 'D) punitivo.'],
      gabarito: 'B',
      incerto: true,
      assuntos: [{ id: 'direito-administrativo>atos-normativos', confianca: 0.62 }],
    });
    expect(me.procedencias[1]).toEqual({ banca: 'Cebraspe', concurso: 'TESTE 24', ano: 2024, numero: 12 });
  });

  it('recusa o que não é pacote, versão mais nova e arquivo acima de 80 MB', () => {
    expect(parsePacote('isto não é json')).toEqual({ ok: false, message: 'Este arquivo não é um pacote do acervo.' });
    expect(parsePacote(withChanges((p) => (p.formato = 'outra-coisa')))).toEqual({
      ok: false,
      message: 'Este arquivo não é um pacote do acervo.',
    });
    expect(parsePacote(withChanges((p) => delete p.vocabulario))).toEqual({
      ok: false,
      message: 'Este arquivo não é um pacote do acervo.',
    });
    expect(parsePacote(withChanges((p) => (p.versao = 2)))).toEqual({
      ok: false,
      message: 'Este pacote é de uma versão mais nova do FofoLab.',
    });
    expect(parsePacote(' '.repeat(MAX_PACOTE_BYTES + 1))).toEqual({ ok: false, message: 'O arquivo passa de 80 MB.' });
  });

  it('item com alternativa sem letra, gabarito estranho ou formato desconhecido conta como inválido e não derruba', () => {
    const text = withChanges((p) => {
      const itens = p.itens as Record<string, unknown>[];
      itens[1].alternativas = ['ordinatório', 'B) normativo.'];
      itens[0].gabarito = 'Certo';
      itens[2].formato = 'DISCURSIVA';
    });
    const result = parsePacote(text);
    if (!result.ok) throw new Error(result.message);
    expect(result.pacote.itens.map((i) => i.id)).toEqual(['TESTE_24:c1:5']);
    expect(result.pacote.invalidItems).toBe(4);
  });

  it('anulado vem sem gabarito e vira X; alternativa com código começa pela cerca e continua válida', () => {
    const text = withChanges((p) => {
      const itens = p.itens as Record<string, unknown>[];
      itens[0].gabarito = null;
      itens[0].anulado = true;
      itens[1].alternativas = ['```\nA) { "a": 1 }\n```', 'B) normativo.', '```\nC) [1]\n```', 'D) punitivo.'];
    });
    const result = parsePacote(text);
    if (!result.ok) throw new Error(result.message);
    expect(result.pacote.invalidItems).toBe(1);
    expect(result.pacote.itens[0]).toMatchObject({ id: 'TESTE_24:c1:1', anulado: true, gabarito: 'X' });
    expect(result.pacote.itens[1].alternativas).toEqual(['A) ```\n{ "a": 1 }\n```', 'B) normativo.', 'C) ```\n[1]\n```', 'D) punitivo.']);
  });

  it('gabarito nulo em item que não foi anulado é inválido', () => {
    const result = parsePacote(withChanges((p) => ((p.itens as Record<string, unknown>[])[0].gabarito = null)));
    if (!result.ok) throw new Error(result.message);
    expect(result.pacote.invalidItems).toBe(2);
  });

  it('procedência com o ano inteiro, como na tela', () => {
    const base = { banca: 'Cebraspe', concurso: 'ANATEL 24', ano: 2024, numero: 40 };
    expect(formatProcedencia(base, 0)).toBe('Cebraspe · ANATEL 2024 · item 40');
    expect(formatProcedencia({ ...base, concurso: 'APEX BRASIL 21 ANALISTA', ano: 2021, numero: 51 }, 0)).toBe(
      'Cebraspe · APEX BRASIL 2021 ANALISTA · item 51'
    );
    // TRT10 não é ano: só o número solto de 2 dígitos vira o ano
    expect(formatProcedencia({ ...base, concurso: 'TRT10 24', numero: 12 }, 1)).toBe(
      'Cebraspe · TRT10 2024 · item 12 (e em mais 1 prova)'
    );
    expect(formatProcedencia(base, 2)).toBe('Cebraspe · ANATEL 2024 · item 40 (e em mais 2 provas)');
  });

  it.skipIf(!existsSync(REAL_PACOTE))('aceita o pacote real do minerador, sem itens inválidos', () => {
    const result = parsePacote(readFileSync(REAL_PACOTE, 'utf8'));
    if (!result.ok) throw new Error(result.message);
    expect(result.pacote.invalidItems).toBe(0);
    expect(result.pacote.itens.length).toBeGreaterThan(20000);
    expect(result.pacote.itens.filter((i) => i.assuntos.length > 0).length).toBeGreaterThan(500);
  });
});
