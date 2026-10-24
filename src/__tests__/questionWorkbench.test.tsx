import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionWorkbench, type QuestionWorkbenchProps } from '../features/questions/QuestionWorkbench';
import { SEED_AI_DISSECTIONS, SEED_QUESTIONS } from '../data/initialSeed';
import type { Question } from '../types/database';

const bundles = SEED_QUESTIONS.map((q) => ({ question: q, dissection: SEED_AI_DISSECTIONS.find((d) => d.question_id === q.id) || null }));
const first = bundles[0]; // gabarito C, com explicação de exemplo

function renderWorkbench(overrides: Partial<QuestionWorkbenchProps> = {}) {
  const props: QuestionWorkbenchProps = {
    questions: [first],
    scopeFilter: 'all',
    onChangeScopeFilter: vi.fn(),
    onAnswer: vi.fn(() => ({ attemptId: 'att-1' })),
    onChangeDiagnosis: vi.fn(),
    lastDiagnosisFeedback: null,
    onAskFofoIa: vi.fn(),
    onActiveQuestionChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<QuestionWorkbench {...props} />), props };
}

const optionA = () => screen.queryByRole('button', { name: /^A\) Risco de Controle/ });

describe('Aba Questões: confiança antes de responder (spec 11 §5.5)', () => {
  it('as alternativas só aparecem depois da confiança', () => {
    renderWorkbench();
    expect(optionA()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    expect(optionA()).toBeTruthy();
  });

  it('responder grava na hora com o diagnóstico deduzido; o "Por quê?" corrige a mesma tentativa; a 1ª resposta vale', () => {
    const { props } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Acho que sei' }));
    fireEvent.click(optionA()!);
    expect(props.onAnswer).toHaveBeenCalledTimes(1);
    expect(props.onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOptionLetter: 'A', isCorrect: false, confidence: 'THINK', diagnosis: 'BASE_GAP', usedAiReview: false })
    );
    expect(screen.getByText('Por quê?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confundi com outra coisa/ }));
    expect(props.onChangeDiagnosis).toHaveBeenCalledWith('att-1', 'MISCONCEPTION');
    fireEvent.click(screen.getByRole('button', { name: /^C\) Risco Inerente/ }));
    expect(props.onAnswer).toHaveBeenCalledTimes(1);
  });

  it('Certo/Errado: "Sei" e acertou chega como Dominei', () => {
    const certoErrado: Question = { ...SEED_QUESTIONS[2], id: 'q-ce', statement: 'O DICT é operado pelo Banco Central.', options_json: JSON.stringify(['C) Certo', 'E) Errado']), final_answer: 'C' };
    const { props } = renderWorkbench({ questions: [{ question: certoErrado, dissection: null }] });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Certo' }));
    expect(screen.getByText('Você acertou.')).toBeTruthy();
    expect(props.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ selectedOptionLetter: 'C', isCorrect: true, diagnosis: 'MASTERED' }));
  });

  it('1º contato: ver a explicação antes de responder grava lacuna, sem confiança, e esconde as alternativas', () => {
    const { props } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: /Ver explicação antes de responder/ }));
    expect(props.onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOptionLetter: null, isCorrect: false, confidence: null, diagnosis: 'BASE_GAP', usedAiReview: true })
    );
    expect(screen.getByText(/Explicação de exemplo/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sei' })).toBeNull();
  });

  it('a explicação aparece embaixo da questão só depois de responder; não existe mais o painel lateral de IA', () => {
    renderWorkbench();
    expect(screen.queryByText(/Explicação de exemplo/)).toBeNull();
    expect(screen.queryByText('Explicação & Estudo Reverso')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(screen.getByText(/Explicação de exemplo/)).toBeTruthy();
  });

  it('pista antes de responder e aprofundar depois vão para a FofoIA; a questão ativa é avisada', () => {
    const { props } = renderWorkbench();
    expect(props.onActiveQuestionChange).toHaveBeenLastCalledWith({ question: first.question, answered: false });
    fireEvent.click(screen.getByRole('button', { name: /Pedir pista à FofoIA/ }));
    expect(props.onAskFofoIa).toHaveBeenCalledWith({ kind: 'hint', question: first.question });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(props.onActiveQuestionChange).toHaveBeenLastCalledWith({ question: first.question, answered: true });
    fireEvent.click(screen.getByRole('button', { name: /Aprofundar com a FofoIA/ }));
    expect(props.onAskFofoIa).toHaveBeenLastCalledWith({ kind: 'deepen', question: first.question });
  });

  it('pedir pista antes de responder fica registrado como ajuda da IA na tentativa', () => {
    const { props } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: /Pedir pista à FofoIA/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vou chutar' }));
    fireEvent.click(optionA()!);
    expect(props.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ usedAiReview: true, confidence: 'GUESS' }));
  });

  it('questão sem explicação: sem IA, aviso honesto; com IA, "Gerar explicação" só quando pedido', () => {
    const semExplicacao = { question: SEED_QUESTIONS[0], dissection: null };
    const { unmount } = renderWorkbench({ questions: [semExplicacao], aiConfigured: false, onGenerateDissection: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(screen.getByText(/ainda não tem explicação/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Gerar explicação/ })).toBeNull();
    unmount();

    const onGenerate = vi.fn(async () => ({ ok: true }));
    renderWorkbench({ questions: [semExplicacao], aiConfigured: true, onGenerateDissection: onGenerate });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Gerar explicação/ }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('sair da aba Questões avisa que não há mais questão ativa (a FofoIA não fica presa nela)', () => {
    const { props, unmount } = renderWorkbench();
    unmount();
    expect(props.onActiveQuestionChange).toHaveBeenLastCalledWith(null);
  });

  it('voltar a uma questão já respondida mostra a correção travada, sem segunda tentativa', () => {
    const { props } = renderWorkbench({ questions: bundles.slice(0, 2) });
    fireEvent.click(screen.getByRole('button', { name: 'Acho que sei' }));
    fireEvent.click(optionA()!);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima questão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Questão anterior' }));
    expect(screen.getByText(/^Gabarito: C/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sei' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Confundi com outra coisa/ }));
    expect(props.onChangeDiagnosis).toHaveBeenCalledWith('att-1', 'MISCONCEPTION');
    expect(props.onAnswer).toHaveBeenCalledTimes(1);
  });

  it('filtro por banca e navegação continuam', () => {
    renderWorkbench({ questions: bundles });
    fireEvent.change(screen.getByLabelText('Filtrar por banca'), { target: { value: 'Cebraspe' } });
    expect(screen.getAllByText(/Cebraspe/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Próxima questão' })).toBeTruthy();
  });
});
