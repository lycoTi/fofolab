import type { SelfDiagnosisType } from '../types/database';

/**
 * Regras do auto-diagnóstico pós-questão (docs/specs/02-ai-router-and-metrics.md):
 * - Acertou  → 🟢 Dominei / 🟡 Acertei na dúvida
 * - Errou    → 🟠 Pegadinha da banca / 🔴 Lacuna de base
 * - 1º contato (abriu a explicação sem responder) → só 🔴 Lacuna
 * Usadas pela tela (botões habilitados) e pelo banco (recusa combinações incoerentes).
 */
export type AnswerState =
  | { kind: 'unanswered' }
  | { kind: 'answered'; isCorrect: boolean }
  | { kind: 'first-contact' };

export function getAllowedDiagnoses(state: AnswerState): SelfDiagnosisType[] {
  if (state.kind === 'answered') {
    return state.isCorrect ? ['MASTERED', 'DOUBT'] : ['BOARD_TRAP', 'BASE_GAP'];
  }
  if (state.kind === 'first-contact') return ['BASE_GAP'];
  return [];
}

export function isDiagnosisAllowed(
  params: { answered: boolean; isCorrect: boolean },
  diagnosis: SelfDiagnosisType
): boolean {
  const state: AnswerState = params.answered
    ? { kind: 'answered', isCorrect: params.isCorrect }
    : { kind: 'first-contact' };
  return getAllowedDiagnoses(state).includes(diagnosis);
}
