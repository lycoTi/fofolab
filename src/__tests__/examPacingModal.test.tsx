import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExamPacingModal } from '../features/pacing/ExamPacingModal';
import type { Question, QuestionAttempt } from '../types/database';

describe('ExamPacingModal (spec 15d)', () => {
  const dummySubjects = [{ id: 's1', name: 'Direito Administrativo' }];
  const dummyQuestions: { question: Question }[] = [
    {
      question: {
        id: 'q1',
        subject_id: 's1',
        topic_id: 't1',
        exam_board: 'FGV',
        exam_year: 2024,
        organ: 'SEFAZ',
        statement: 'Texto longo de prova',
        options_json: JSON.stringify([
          { key: 'A', text: 'Opcao A' },
          { key: 'B', text: 'Opcao B' },
        ]),
        preliminary_answer: 'A',
        final_answer: 'A',
        is_annulled: 0,
        annulment_reason: null,
      },
    },
  ];

  const dummyAttempts: QuestionAttempt[] = [
    {
      id: 'a1',
      question_id: 'q1',
      topic_id: 't1',
      selected_option: 'A',
      is_correct: 1,
      used_ai_review: 0,
      self_diagnosis: 'MASTERED',
      time_spent_seconds: 220, // Ritmo lento (3m40s)
      attempted_at: new Date().toISOString(),
      confidence: 'SURE',
    },
  ];

  it('não renderiza nada quando open for falso', () => {
    const { container } = render(
      <ExamPacingModal
        open={false}
        onClose={vi.fn()}
        attempts={dummyAttempts}
        questions={dummyQuestions}
        subjects={dummySubjects}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza diagnósticos de ritmo e simulação de prova real', () => {
    const onClose = vi.fn();
    render(
      <ExamPacingModal
        open={true}
        onClose={onClose}
        attempts={dummyAttempts}
        questions={dummyQuestions}
        subjects={dummySubjects}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Simulação de Tempo de Prova Real' })).toBeTruthy();
    expect(screen.getByText('Simulação de Prova Real & Ritmo Histórico')).toBeTruthy();
    expect(screen.getByText('FGV 70 questões (4h)')).toBeTruthy();

    const closeBtn = screen.getByRole('button', { name: /Fechar/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('permite alternar entre presets de concurso (Cebraspe e FGV)', () => {
    render(
      <ExamPacingModal
        open={true}
        onClose={vi.fn()}
        attempts={dummyAttempts}
        questions={dummyQuestions}
        subjects={dummySubjects}
      />
    );

    const cebraspeBtn = screen.getByRole('button', { name: /Cebraspe 120 itens/i });
    fireEvent.click(cebraspeBtn);

    // Deve alternar para 120 questões
    const inputQuestions = screen.getByDisplayValue('120');
    expect(inputQuestions).toBeTruthy();
  });
});
