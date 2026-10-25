// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { segmentTrueFalse } from '../segmentTrueFalse';
import type { ExtractedItem, PdfLine } from '../types';
import { parseAnswerKey } from '../answerKey';
import { DATAPREV_CG1_GABARITO, DATAPREV_CG1_PROVA, fixtureLines, SERPRO_PROVA } from './fixtures';

const line = (text: string, atMargin: boolean): PdfLine => ({ page: 1, column: 'L', x: atMargin ? 28 : 46, y: 0, text, atMargin });

describe('Itens Certo/Errado com o texto-base (SERPRO 2023, específicos)', () => {
  let items: ExtractedItem[];
  const item = (n: number) => items.find((i) => i.numero === n)!;
  beforeAll(async () => {
    items = segmentTrueFalse(await fixtureLines(SERPRO_PROVA));
  });

  it('70 itens, de 51 a 120, em sequência', () => {
    expect(items.map((i) => i.numero)).toEqual(Array.from({ length: 70 }, (_, k) => 51 + k));
    expect(items.every((i) => i.formato === 'CERTO_ERRADO' && i.alternativas === null)).toBe(true);
  });

  it('cada item leva o texto-base vigente; o texto-base troca quando aparece outro', () => {
    expect(item(51).textoBase).toContain('Com base na NBR ISO/IEC 27000, julgue os próximos itens');
    expect(item(51).enunciado.startsWith('A integridade é uma propriedade')).toBe(true);
    expect(item(52).textoBase).toBe(item(51).textoBase);
    expect(item(53).textoBase).toContain('controle de acesso');
    expect(item(51).materiaOrigem).toBe('CONHECIMENTOS ESPECÍFICOS');
  });

  it('parágrafo de texto-base com recuo de primeira linha não gruda no item anterior', () => {
    expect(item(71).enunciado.endsWith('Nginx Full.')).toBe(true);
    expect(item(72).textoBase!.startsWith('Um usuário solicitou a um programador a criação de um')).toBe(true);
  });

  it('o código do item 72 fica no item 72 e o 73 começa no lugar certo', () => {
    expect(item(72).enunciado).toContain('PI = 3.14159');
    expect(item(72).enunciado).toContain('print(');
    expect(item(73).enunciado.startsWith('Para permitir a integração entre os frameworks React e')).toBe(true);
  });

  it('parágrafo recuado com parênteses na prosa abre texto-base; código recuado continua o item', () => {
    const at = (text: string, x: number): PdfLine => ({ page: 1, column: 'L', x, y: 0, text, atMargin: x === 28 });
    const synthetic = segmentTrueFalse([
      at('10 O trecho a seguir é válido.', 28),
      at('continuação do item.', 46),
      at('  runApp(Center(', 60),
      at('SPA (single-page app), ou aplicativo de página', 56),
      at('única, julgue o item.', 28),
      at('11 O SPA recarrega a página.', 28),
      at('fim.', 46),
    ]);
    expect(synthetic[0].enunciado).toContain('runApp(Center(');
    expect(synthetic[1].textoBase!.startsWith('SPA (single-page app)')).toBe(true);
  });

  it('linha solitária mais à esquerda (resto das instruções) não muda a margem da coluna', async () => {
    const items = segmentTrueFalse(await fixtureLines(DATAPREV_CG1_PROVA));
    const key = parseAnswerKey(await fixtureLines(DATAPREV_CG1_GABARITO, { singleColumn: true }));
    expect(items.map((i) => i.numero)).toEqual([...key.keys()].sort((a, b) => a - b));
    expect(items.find((i) => i.numero === 6)!.enunciado.startsWith('No trecho “desde eletrodomésticos até equipamentos')).toBe(true);
  });

  it('linha que começa com número fora da sequência não abre item (vira texto-base)', () => {
    const synthetic = segmentTrueFalse([
      line('10 O prazo foi prorrogado no', true),
      line('ano em que a lei mudou.', false),
      line('2023 foi o ano da nova regra; julgue o item a seguir.', true),
      line('11 A regra vale para todos.', true),
    ]);
    expect(synthetic.map((i) => i.numero)).toEqual([10, 11]);
    // As quebras do PDF ficam: a montagem (Tarefa 8) junta a prosa e preserva blocos de código
    expect(synthetic[0].enunciado).toBe('O prazo foi prorrogado no\nano em que a lei mudou.');
    expect(synthetic[1].textoBase).toBe('2023 foi o ano da nova regra; julgue o item a seguir.');
  });
});
