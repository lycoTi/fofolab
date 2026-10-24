import type { QuestionAttempt, SelfDiagnosisType } from '../types/database';

/**
 * Regras do auto-diagnóstico pós-questão (docs/specs/02-ai-router-and-metrics.md):
 * - Acertou  → Dominei / Acertei na dúvida / Acertei no chute (spec 11: deduzido da confiança)
 * - Errou    → Não sabia / Confundi com outra coisa / Pegadinha ou desatenção
 * - 1º contato (abriu a explicação sem responder) → só 🔴 Lacuna
 * Usadas pela tela (botões habilitados) e pelo banco (recusa combinações incoerentes).
 */
export type AnswerState =
  | { kind: 'unanswered' }
  | { kind: 'answered'; isCorrect: boolean }
  | { kind: 'first-contact' };

export function getAllowedDiagnoses(state: AnswerState): SelfDiagnosisType[] {
  if (state.kind === 'answered') {
    return state.isCorrect ? ['MASTERED', 'DOUBT', 'LUCKY_GUESS'] : ['BASE_GAP', 'MISCONCEPTION', 'BOARD_TRAP'];
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

/**
 * Falsa certeza: disse "Sei" e errou (spec 11 §5.5). O erro com certeza, quando corrigido, é dos que mais se fixam
 * (hipercorreção), então pesa mais no calor. Pegadinha/desatenção fica de fora: o estudante leu errado, não pensava errado.
 */
export function isFalseCertainty(attempt: Pick<QuestionAttempt, 'confidence' | 'is_correct' | 'self_diagnosis'>): boolean {
  return attempt.confidence === 'SURE' && attempt.is_correct === 0 && attempt.self_diagnosis !== 'BOARD_TRAP';
}
