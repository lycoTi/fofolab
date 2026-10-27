import type { StatusTone } from '../components/StatusSquare';
import type { ReviewConfidence, SelfDiagnosisType } from '../types/database';

/**
 * Rótulos do fluxo de resposta (spec 11 §5.5), iguais na aba Questões, na Revisão do dia e na calibração do Início.
 * Os valores gravados no banco não mudam; só o que o estudante lê.
 */
export const CONFIDENCE_LABEL: Record<ReviewConfidence, string> = {
  SURE: 'Sei',
  RECENT: 'Estou estudando',
  THINK: 'Acho que sei',
  GUESS: 'Vou chutar',
};

export const DIAGNOSIS_LABEL: Record<SelfDiagnosisType, string> = {
  MASTERED: 'Dominei',
  STUDYING: 'Pegando o jeito',
  DOUBT: 'Acertei na dúvida',
  LUCKY_GUESS: 'Acertei no chute',
  BASE_GAP: 'Não sabia',
  MISCONCEPTION: 'Confundi com outra coisa',
  BOARD_TRAP: 'Pegadinha ou desatenção',
};

/** Cor do quadradinho ao lado de cada diagnóstico (no lugar dos antigos 🟢🟡🔴). */
export const DIAGNOSIS_TONE: Record<SelfDiagnosisType, StatusTone> = {
  MASTERED: 'emerald',
  STUDYING: 'emerald',
  DOUBT: 'amber',
  LUCKY_GUESS: 'amber',
  BASE_GAP: 'rose',
  MISCONCEPTION: 'rose',
  BOARD_TRAP: 'orange',
};
