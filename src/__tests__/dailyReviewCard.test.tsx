import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyReviewCard, type DailyReviewCardProps } from '../features/good-morning/DailyReviewCard';
import { ReviewOpenPrompt } from '../features/good-morning/ReviewOpenPrompt';
import { ReviewQuestion } from '../features/good-morning/ReviewQuestion';
import type { Question, ReviewItem } from '../types/database';

const FORBIDDEN_JARGON = ['SQLite', '0 tokens', '_score', 'Seed', 'IndexedDB', 'localStorage', 'Cache', 'null', 'NaN', 'undefined', 'TEC', 'DAILY_REVIEW', 'COOLING'];

const certoErrado = {
  id: 'q1',
  statement: 'O controle interno é exercido por cada Poder.',
  options_json: JSON.stringify(['C) Certo', 'E) Errado']),
  final_answer: 'C',
  is_annulled: 0,
} as unknown as Question;

const multipla = {
  id: 'q2',
  statement: 'Assinale a correta.',
  options_json: JSON.stringify(['A) um', 'B) dois', 'C) três', 'D) quatro', 'E) cinco']),
  final_answer: 'B',
  is_annulled: 0,
} as unknown as Question;

describe('Questão da revisão: confiança antes, correção logo depois', () => {
  it('as alternativas só aparecem depois da confiança', () => {
    render(<ReviewQuestion question={certoErrado} dissection={null} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Certo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Acho que sei' }));
    expect(screen.getByRole('button', { name: 'Certo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Errado' })).toBeTruthy();
  });

  it('acerto com "Tenho certeza" chega como Dominei, e dá para trocar para dúvida', () => {
    const onSubmit = vi.fn();
    render(<ReviewQuestion question={certoErrado} dissection={null} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Certo' }));
    expect(screen.getByText(/Você acertou/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dominei/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Acertei na dúvida/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOption: 'C', isCorrect: true, confidence: 'SURE', diagnosis: 'DOUBT' })
    );
  });

  it('erro chega como lacuna e mostra o gabarito oficial', () => {
    const onSubmit = vi.fn();
    render(<ReviewQuestion question={multipla} dissection={null} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vou chutar' }));
    fireEvent.click(screen.getByRole('button', { name: /^A\)/ }));
    expect(screen.getByText(/Gabarito: B/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Dominei/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ selectedOption: 'A', isCorrect: false, confidence: 'GUESS', diagnosis: 'BASE_GAP' }));
  });
});

describe('Pergunta aberta: lembrar antes de reler', () => {
  it('as anotações só aparecem depois do botão, e o texto digitado não é gravado', () => {
    const onRate = vi.fn();
    render(<ReviewOpenPrompt topicLabel="2.1 Microsserviços" notebookExcerpt="**Bounded context** separa domínios." onRate={onRate} />);
    expect(screen.getByText('O que você lembra de 2.1 Microsserviços?')).toBeTruthy();
    expect(screen.queryByText(/separa domínios/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'algo que lembro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver minhas anotações' }));
    expect(screen.getByText(/separa domínios/)).toBeTruthy();
    expect(screen.queryByText(/\*\*/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lembrei bem' }));
    expect(onRate).toHaveBeenCalledWith('GOOD', expect.any(Number));
    expect(JSON.stringify(onRate.mock.calls)).not.toContain('algo que lembro');
  });

  it('sem anotações, diz isso com calma e ainda deixa se avaliar', () => {
    const onRate = vi.fn();
    render(<ReviewOpenPrompt topicLabel="JWT" notebookExcerpt={null} onRate={onRate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver minhas anotações' }));
    expect(screen.getByText('Você ainda não tem anotações deste tópico.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Não lembrei' }));
    expect(onRate).toHaveBeenCalledWith('FORGOT', expect.any(Number));
  });
});

const item = (topicId: string, kind: ReviewItem['kind'] = 'OPEN'): ReviewItem => ({ topicId, subjectId: 's', kind, questionId: kind === 'QUESTION' ? 'q1' : null, reason: 'COOLING' });

function cardProps(overrides: Partial<DailyReviewCardProps> = {}): DailyReviewCardProps {
  return {
    enabled: true,
    items: [item('a'), item('b'), item('c'), item('d')],
    doneCount: 1,
    skipped: false,
    current: { item: item('b'), topicLabel: '2.1 Microsserviços', subjectName: 'Arquitetura', question: null, notebookExcerpt: null },
    onAnswer: vi.fn(),
    onRate: vi.fn(),
    onSkip: vi.fn(),
    onOutside: vi.fn(),
    ...overrides,
  };
}

describe('Cartão da Revisão do dia', () => {
  it('mostra a posição, o tópico, o atalho de fora do app e o pular sem penalidade', () => {
    const props = cardProps();
    const { container } = render(<DailyReviewCard {...props} />);
    expect(screen.getByText('Revisão do dia · 2 de 4')).toBeTruthy();
    expect(screen.getByText(/Arquitetura · 2.1 Microsserviços/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fiz questões fora do app' }));
    expect(props.onOutside).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Pular a revisão de hoje' }));
    expect(props.onSkip).toHaveBeenCalled();
    for (const term of FORBIDDEN_JARGON) expect(container.textContent).not.toContain(term);
  });

  it('com questão no tópico, mostra a questão', () => {
    render(<DailyReviewCard {...cardProps({ current: { item: item('b', 'QUESTION'), topicLabel: 'X', subjectName: 'Y', question: { question: certoErrado, dissection: null }, notebookExcerpt: null } })} />);
    expect(screen.getByText(certoErrado.statement)).toBeTruthy();
  });

  it('concluída: mensagem de feito; pulada: os tópicos voltam amanhã; vazia ou desligada: nada', () => {
    const { rerender, container } = render(<DailyReviewCard {...cardProps({ doneCount: 4, current: null })} />);
    expect(screen.getByText('Revisão de hoje feita: 4 tópicos revisados.')).toBeTruthy();
    rerender(<DailyReviewCard {...cardProps({ skipped: true, current: null })} />);
    expect(screen.getByText('Revisão de hoje pulada. Os tópicos voltam amanhã.')).toBeTruthy();
    rerender(<DailyReviewCard {...cardProps({ items: [], current: null, doneCount: 0 })} />);
    expect(container.textContent).toBe('');
    rerender(<DailyReviewCard {...cardProps({ enabled: false })} />);
    expect(container.textContent).toBe('');
  });
});
