import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudentContextSnapshot } from '../lib/aiRouter';
import type { Notebook, Question, Subject, Topic } from '../types/database';

const saved = vi.fn();
vi.mock('../lib/database', () => ({
  getNotebookForTopic: () => ({ content_markdown: 'Notas antigas de B' }),
  saveTopicNotebook: (input: unknown) => saved(input),
}));

const { useFofoIaInputs } = await import('../features/fofoia/useFofoIaInputs');

const subject = { id: 's', name: 'Arquitetura', exam_weight: 2, exam_part_id: null } as unknown as Subject;
const topicA = { id: 'A', subject_id: 's', code: '1.1', title: 'Monolitos', parent_id: null, mastery_score: 50, last_studied_at: '2026-10-01T10:00:00Z' } as unknown as Topic;
const topicB = { id: 'B', subject_id: 's', code: '1.2', title: 'Mensageria', parent_id: null, mastery_score: 10, last_studied_at: null } as unknown as Topic;
const questionB = { id: 'qb', topic_id: 'B', statement: 'x', options_json: '[]', final_answer: 'C' } as unknown as Question;
const context = { currentTopicCode: '1.1', currentTopicTitle: 'Monolitos', currentTopicMastery: 50, relatedPrerequisites: [] } as unknown as StudentContextSnapshot;

function setup(activeQuestion: { question: Question; answered: boolean } | null, notebooks: Notebook[] = []) {
  const onNotebookSaved = vi.fn();
  const appendToCurrentNotebook = vi.fn();
  const { result } = renderHook(() =>
    useFofoIaInputs({
      studentContext: context,
      cycleData: null,
      subjects: [subject],
      topicsBySubject: { s: [topicA, topicB] },
      examParts: [],
      activeQuestion,
      topicQuestions: [],
      attempts: [],
      questionLogs: [],
      currentTopic: topicA,
      currentNotebookDraft: 'Rascunho de A',
      appendToCurrentNotebook,
      notebooks,
      onNotebookSaved,
    })
  );
  return { result, onNotebookSaved, appendToCurrentNotebook };
}

describe('Entradas da FofoIA: tópico e caderno da conversa', () => {
  it('sem questão ativa, conversa sobre o tópico selecionado com o rascunho dele', () => {
    const { result } = setup(null);
    expect(result.current?.topicKey).toBe('A');
    expect(result.current?.notebook).toBe('Rascunho de A');
  });

  it('com questão de outro tópico, o tópico, o domínio e o caderno são os dela (caderno sempre atual)', () => {
    const notebooks = [{ topic_id: 'B', content_markdown: 'Notas atuais de B' } as Notebook];
    const { result } = setup({ question: questionB, answered: false }, notebooks);
    expect(result.current?.topicKey).toBe('B');
    expect(result.current?.context.currentTopicMastery).toBe(10);
    expect(result.current?.notebook).toBe('Notas atuais de B');
    expect(result.current?.firstContact).toBe(true);
  });

  it('resumo salvo no tópico da conversa: o selecionado vai pelo rascunho; outro tópico grava e avisa o App', () => {
    const current = setup(null);
    current.result.current?.onSaveSummary('**Resumo A**');
    expect(current.appendToCurrentNotebook).toHaveBeenCalledWith('**Resumo A**');

    const other = setup({ question: questionB, answered: true });
    other.result.current?.onSaveSummary('**Resumo B**');
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ topicId: 'B', contentMarkdown: 'Notas antigas de B\n\n**Resumo B**' }));
    expect(other.onNotebookSaved).toHaveBeenCalled();
  });
});
