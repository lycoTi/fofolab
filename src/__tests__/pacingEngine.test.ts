import { describe, expect, it } from 'vitest';
import {
  calculatePacingProfile,
  formatPacingTime,
  simulateExamSession,
  type PacingAttemptRecord,
} from '../lib/pacingEngine';

describe('Inteligência de Ritmo e Simulação de Prova (pacingEngine)', () => {
  it('formata segundos no formato legível de ritmo mm:ss', () => {
    expect(formatPacingTime(45)).toBe('00:45');
    expect(formatPacingTime(90)).toBe('01:30');
    expect(formatPacingTime(155)).toBe('02:35');
    expect(formatPacingTime(0)).toBe('00:00');
  });

  it('calcula ritmo médio global e diferencia Certo/Errado de Múltipla Escolha', () => {
    const attempts: PacingAttemptRecord[] = [
      // 2 itens C/E: 60s e 80s -> média 70s
      {
        questionId: 'q1',
        isCE: true,
        timeSpentSeconds: 60,
        isCorrect: true,
        subjectId: 's1',
      },
      {
        questionId: 'q2',
        isCE: true,
        timeSpentSeconds: 80,
        isCorrect: false,
        subjectId: 's1',
      },
      // 2 itens ME: 180s e 220s -> média 200s
      {
        questionId: 'q3',
        isCE: false,
        timeSpentSeconds: 180,
        isCorrect: true,
        subjectId: 's2',
      },
      {
        questionId: 'q4',
        isCE: false,
        timeSpentSeconds: 220,
        isCorrect: true,
        subjectId: 's2',
      },
    ];

    const profile = calculatePacingProfile(attempts, [
      { id: 's1', name: 'Direito Constitucional' },
      { id: 's2', name: 'Português FGV' },
    ]);

    expect(profile.totalAttempts).toBe(4);
    // (60 + 80 + 180 + 220) / 4 = 135s
    expect(profile.overallAvgSeconds).toBe(135);
    expect(profile.certoErradoAvgSeconds).toBe(70);
    expect(profile.multiplaEscolhaAvgSeconds).toBe(200);

    // Análise por matéria
    expect(profile.bySubject).toHaveLength(2);
    const portugues = profile.bySubject.find((s) => s.subjectId === 's2');
    expect(portugues?.avgSeconds).toBe(200);
    expect(portugues?.isBottleneck).toBe(true); // > 180s é gargalo de lentidão
  });

  it('simula tempo de prova real com margens de folga (cartão, banheiro e pausas)', () => {
    // Prova de 70 questões ME no ritmo de 3 min (180s) por questão
    // Tempo de resolução: 70 * 180s = 12.600s = 210 min = 3h30
    // Folgas: 20 min cartão + 10 min banheiro = 30 min
    // Tempo total: 4h00 = 240 min
    const sim = simulateExamSession({
      questionCount: 70,
      format: 'ME',
      avgSecondsPerQuestion: 180,
      examDurationMinutes: 240, // 4h
      answerSheetMinutes: 20,
      breakMinutes: 10,
    });

    expect(sim.pureResolutionMinutes).toBe(210);
    expect(sim.buffersTotalMinutes).toBe(30);
    expect(sim.totalEstimatedMinutes).toBe(240);
    expect(sim.deltaMinutes).toBe(0); // Exatamente 4h
    expect(sim.verdict).toBe('TIGHT'); // Ritmo justo (menos de 15 min de folga)
  });

  it('alerta risco de esgotamento de tempo (DEFICIT) quando o tempo estimado estoura o prazo da prova', () => {
    // Prova estilo SEFAZ/FGV: 80 questões ME a 3 min e 30s (210s)
    // Resolução: 80 * 210s = 16.800s = 280 min
    // Folgas: 20 min cartão + 10 min banheiro = 30 min
    // Total necessário: 310 min = 5h10
    // Duração da prova: 4h30 = 270 min
    const sim = simulateExamSession({
      questionCount: 80,
      format: 'ME',
      avgSecondsPerQuestion: 210,
      examDurationMinutes: 270,
      answerSheetMinutes: 20,
      breakMinutes: 10,
    });

    expect(sim.totalEstimatedMinutes).toBe(310);
    expect(sim.deltaMinutes).toBe(-40); // Faltam 40 minutos!
    expect(sim.verdict).toBe('DEFICIT');
    expect(sim.advice).toContain('Faltariam');
  });

  it('indica ritmo seguro (SAFE) com folga confortável para revisão', () => {
    // Prova Cebraspe: 120 itens C/E a 1 min e 15s (75s)
    // Resolução: 120 * 75s = 9.000s = 150 min (2h30)
    // Folgas: 20 min cartão + 10 min banheiro = 30 min
    // Total: 180 min (3h00)
    // Duração da prova: 4h (240 min)
    const sim = simulateExamSession({
      questionCount: 120,
      format: 'CE',
      avgSecondsPerQuestion: 75,
      examDurationMinutes: 240,
      answerSheetMinutes: 20,
      breakMinutes: 10,
    });

    expect(sim.totalEstimatedMinutes).toBe(180);
    expect(sim.deltaMinutes).toBe(60); // Sobram 60 minutos
    expect(sim.verdict).toBe('SAFE');
  });
});
