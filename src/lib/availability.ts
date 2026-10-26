import { localDateKey } from './timeFormat';

/**
 * Disponibilidade do estudante (spec 13 §4.1): quantos minutos tem cada dia e cada semana. Há um padrão de segunda a
 * domingo (dia com 0 é folga fixa) e exceções por data — "hoje tenho menos tempo", "hoje não vou estudar" e a semana
 * atípica. O orçamento da semana é a soma dos sete dias dela, então folga e imprevisto diminuem a meta daquela semana
 * em vez de virarem dívida para o dia seguinte.
 */
export type WeekdayMinutes = [number, number, number, number, number, number, number];

export const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/** Revisão da semana: 10% do tempo da semana, entre 00:30 e 01:30; semana abaixo de 05:00 não tem bloco separado. */
const REVIEW_SHARE = 0.1;
const REVIEW_MIN = 30;
const REVIEW_MAX = 90;
const REVIEW_WEEK_MIN = 300;

const evenSplit = (weeklyMinutes: number): WeekdayMinutes => {
  const day = Math.round(weeklyMinutes / 7);
  return [day, day, day, day, day, day, day];
};

/** Padrão gravado; ausente ou inválido, nasce de `weeklyHoursTarget ÷ 7` em todos os dias (planos antigos). */
export function parseWeekdayMinutes(json: string | null | undefined, weeklyHoursTarget: number): WeekdayMinutes {
  const fallback = evenSplit(weeklyHoursTarget * 60);
  if (!json) return fallback;
  try {
    const parsed: unknown = JSON.parse(json);
    const valid = Array.isArray(parsed) && parsed.length === 7 && parsed.every((m) => typeof m === 'number' && m >= 0);
    return valid ? (parsed.map((m) => Math.round(m)) as WeekdayMinutes) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * As horas da semana mudaram por outro caminho (gestão do edital): cada dia muda na mesma proporção e as folgas
 * continuam folgas. Padrão todo de folga não tem proporção — o tempo se divide pelos sete dias.
 */
export function scaleWeekdayMinutes(pattern: WeekdayMinutes, weeklyMinutes: number): WeekdayMinutes {
  const total = pattern.reduce((acc, m) => acc + m, 0);
  if (total === 0) return evenSplit(weeklyMinutes);
  return pattern.map((m) => Math.round((m / total) * weeklyMinutes)) as WeekdayMinutes;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** 0 = segunda … 6 = domingo. */
export function weekdayIndex(dateKey: string): number {
  return (parseDateKey(dateKey).getDay() + 6) % 7;
}

/** As sete datas locais da semana que começa em `weekStart` (uma segunda). */
export function weekDateKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    localDateKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i))
  );
}

export function minutesForDay(dateKey: string, pattern: WeekdayMinutes, overrides: Record<string, number>): number {
  return overrides[dateKey] ?? pattern[weekdayIndex(dateKey)];
}

export function weekBudgetMinutes(weekStart: Date, pattern: WeekdayMinutes, overrides: Record<string, number>): number {
  return weekDateKeys(weekStart).reduce((acc, key) => acc + minutesForDay(key, pattern, overrides), 0);
}

/** Dia da Revisão da semana: o de mais horas; no empate, o mais tarde. Semana inteira de folga: nenhum. */
export function weeklyReviewDay(weekStart: Date, pattern: WeekdayMinutes, overrides: Record<string, number>): string | null {
  let best: { key: string; minutes: number } | null = null;
  for (const key of weekDateKeys(weekStart)) {
    const minutes = minutesForDay(key, pattern, overrides);
    if (minutes > 0 && (!best || minutes >= best.minutes)) best = { key, minutes };
  }
  return best?.key ?? null;
}

export function weekReviewDuration(weekBudget: number): number {
  if (weekBudget < REVIEW_WEEK_MIN) return 0;
  const minutes = Math.round((weekBudget * REVIEW_SHARE) / 5) * 5;
  return Math.min(REVIEW_MAX, Math.max(REVIEW_MIN, minutes));
}
