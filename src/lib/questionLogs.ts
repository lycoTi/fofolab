/**
 * Questões resolvidas fora do app (outro site, caderno de provas), registradas como números agregados
 * (docs/specs/07 §5.4). Viram evidência real de domínio — nunca tentativas falsas.
 */

/** O histórico pesa no máximo como 40 questões: assim um registro novo grande ainda move o domínio. */
export const LOG_EVIDENCE_CAP = 40;
export const LOG_MAX_TOTAL = 500;

/**
 * Domínio novo = média ponderada entre o domínio atual (peso = evidência anterior, até o teto) e o acerto
 * do registro (peso = número de questões). Em branco conta como "não sabia", sem penalidade extra.
 */
export function blendMastery(current: number, evidenceWeight: number, correct: number, total: number): number {
  const weight = Math.min(LOG_EVIDENCE_CAP, Math.max(0, evidenceWeight));
  const accuracy = (correct / total) * 100;
  return Math.round((current * weight + accuracy * total) / (weight + total));
}

export function isValidLog(input: { total: number; correct: number; blank: number }): boolean {
  const { total, correct, blank } = input;
  const integers = [total, correct, blank].every((n) => Number.isInteger(n) && n >= 0);
  return integers && total >= 1 && total <= LOG_MAX_TOTAL && correct + blank <= total;
}

/** Registro com menos questões que isso conta como amostra, mas não como "dominei"/lacuna para a memória. */
export const LOG_MIN_FOR_MEMORY_SIGNAL = 5;

/** Acerto do registro (0..1), para o motor decidir se ele conta como "dominei" ou como lacuna. */
export function logAccuracy(log: { total: number; correct: number }): number {
  return log.total > 0 ? log.correct / log.total : 0;
}
