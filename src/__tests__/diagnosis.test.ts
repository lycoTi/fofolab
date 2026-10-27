import { describe, expect, it } from 'vitest';
import { getAllowedDiagnoses, isDiagnosisAllowed, isFalseCertainty } from '../lib/diagnosis';
import type { QuestionAttempt } from '../types/database';

describe('Diagnóstico pela confiança (spec 11 §5.5)', () => {
  it('acerto permite dominei, em fixação, dúvida e chute; erro permite não sabia, confundi e pegadinha; 1º contato só lacuna', () => {
    expect(getAllowedDiagnoses({ kind: 'answered', isCorrect: true })).toEqual(['MASTERED', 'STUDYING', 'DOUBT', 'LUCKY_GUESS']);
    expect(getAllowedDiagnoses({ kind: 'answered', isCorrect: false })).toEqual(['BASE_GAP', 'MISCONCEPTION', 'BOARD_TRAP']);
    expect(getAllowedDiagnoses({ kind: 'first-contact' })).toEqual(['BASE_GAP']);
    expect(isDiagnosisAllowed({ answered: true, isCorrect: true }, 'STUDYING')).toBe(true);
    expect(isDiagnosisAllowed({ answered: true, isCorrect: false }, 'STUDYING')).toBe(false);
    expect(isDiagnosisAllowed({ answered: true, isCorrect: false }, 'LUCKY_GUESS')).toBe(false);
    expect(isDiagnosisAllowed({ answered: true, isCorrect: true }, 'MISCONCEPTION')).toBe(false);
  });

  it('falsa certeza: "Sei" e errou — menos quando o estudante diz que foi pegadinha ou desatenção', () => {
    const attempt = (confidence: QuestionAttempt['confidence'], correct: boolean, diagnosis: QuestionAttempt['self_diagnosis']) =>
      ({ confidence, is_correct: correct ? 1 : 0, self_diagnosis: diagnosis }) as QuestionAttempt;
    expect(isFalseCertainty(attempt('SURE', false, 'BASE_GAP'))).toBe(true);
    expect(isFalseCertainty(attempt('SURE', false, 'MISCONCEPTION'))).toBe(true);
    expect(isFalseCertainty(attempt('SURE', false, 'BOARD_TRAP'))).toBe(false);
    expect(isFalseCertainty(attempt('GUESS', false, 'BASE_GAP'))).toBe(false);
    expect(isFalseCertainty(attempt('SURE', true, 'MASTERED'))).toBe(false);
    expect(isFalseCertainty(attempt(null, false, 'BASE_GAP'))).toBe(false);
  });
});
