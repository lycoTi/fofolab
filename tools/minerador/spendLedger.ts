import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Gasto do dia com a DeepSeek (paga): o crédito é pré-pago e uma rodada do minerador sobre o acervo inteiro poderia
 * gastá-lo de uma vez. Conta pelo uso que cada resposta informa, no **preço de pico** do `deepseek-flash`
 * (US$ 0,30 por milhão de entrada, US$ 1,20 de saída; fora do pico custa a metade): se o preço real for menor, o teto
 * só fica mais folgado. O arquivo guarda um total por dia; outra rodada no mesmo dia continua a conta.
 */
export const DEEPSEEK_PICO_USD_POR_TOKEN = { entrada: 0.3 / 1_000_000, saida: 1.2 / 1_000_000 };

export interface SpendLedger {
  /** Gasto de hoje, em reais. */
  hoje(): number;
  somar(reais: number): void;
  /** Custo em reais de uma resposta, pelo campo `usage` que a API devolve. */
  custo(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): number;
  /** Segundos até a virada do dia (quando o teto zera). */
  segundosAteAmanha(): number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Só a última semana fica no arquivo. */
const KEEP_DAYS = 7;

export function createSpendLedger(file: string, opts: { now?: () => Date; usdBrl: number }): SpendLedger {
  const now = opts.now ?? (() => new Date());

  const read = (): Record<string, number> => {
    if (!existsSync(file)) return {};
    try {
      const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) as Record<string, number>;
    } catch {
      // Arquivo estragado: começa do zero (o pior caso é gastar até o teto de novo hoje)
      return {};
    }
  };

  return {
    hoje: () => read()[dayKey(now())] ?? 0,
    somar(reais) {
      const data = read();
      const key = dayKey(now());
      data[key] = (data[key] ?? 0) + reais;
      const recent = Object.keys(data).sort().slice(-KEEP_DAYS);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(Object.fromEntries(recent.map((k) => [k, data[k]])), null, 2));
    },
    custo(usage) {
      const usd =
        (usage?.prompt_tokens ?? 0) * DEEPSEEK_PICO_USD_POR_TOKEN.entrada + (usage?.completion_tokens ?? 0) * DEEPSEEK_PICO_USD_POR_TOKEN.saida;
      return usd * opts.usdBrl;
    },
    segundosAteAmanha() {
      const t = now();
      const midnight = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
      return Math.max(1, Math.round((midnight.getTime() - t.getTime()) / 1000));
    },
  };
}
