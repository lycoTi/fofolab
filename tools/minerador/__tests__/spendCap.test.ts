// @vitest-environment node
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createProvider, LimiteDiario } from '../aiProvider';
import { createSpendLedger } from '../spendLedger';

const reply = (usage: Record<string, number>) =>
  new Response(JSON.stringify({ choices: [{ message: { content: '{"resultados":[]}' } }], usage }), { status: 200 });

describe('Teto diário de gasto da DeepSeek', () => {
  it('soma o custo de cada resposta pelo uso que ela informa, no preço de pico, em reais', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'gasto-')), 'gasto.json');
    const ledger = createSpendLedger(file, { now: () => new Date(2026, 9, 26, 20, 0), usdBrl: 5 });
    const fetchImpl = vi.fn().mockResolvedValue(reply({ prompt_tokens: 1_000_000, completion_tokens: 500_000 }));
    const p = createProvider({ nome: 'deepseek', chave: 'x', fetchImpl, gasto: { ledger, tetoBrl: 5 } });
    await p.complete('oi', 100);
    // 1 milhão de entrada × US$ 0,30 + meio milhão de saída × US$ 1,20 = US$ 0,90 = R$ 4,50
    expect(ledger.hoje()).toBeCloseTo(4.5, 6);
  });

  it('ao bater o teto, para com o limite diário sem chamar a API; o gasto fica no arquivo e zera no dia seguinte', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'gasto-')), 'gasto.json');
    const day1 = createSpendLedger(file, { now: () => new Date(2026, 9, 26, 20, 0), usdBrl: 5 });
    day1.somar(5);
    const fetchImpl = vi.fn();
    const p = createProvider({ nome: 'deepseek', chave: 'x', fetchImpl, gasto: { ledger: day1, tetoBrl: 5 } });
    await expect(p.complete('oi', 100)).rejects.toBeInstanceOf(LimiteDiario);
    expect(fetchImpl).not.toHaveBeenCalled();

    // Outra rodada no mesmo dia lê o gasto do arquivo; no dia seguinte começa do zero
    expect(createSpendLedger(file, { now: () => new Date(2026, 9, 26, 23, 0), usdBrl: 5 }).hoje()).toBe(5);
    expect(createSpendLedger(file, { now: () => new Date(2026, 9, 27, 8, 0), usdBrl: 5 }).hoje()).toBe(0);
  });
});
