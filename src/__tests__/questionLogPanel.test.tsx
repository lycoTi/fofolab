import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionLogPanel, type QuestionLogPanelProps } from '../features/routine/QuestionLogPanel';
import type { Topic } from '../types/database';

const topic = (id: string, code: string, title: string) => ({ id, subject_id: 's', code, title, parent_id: 'g' }) as unknown as Topic;
const topics = [topic('a', '1.1', 'Monolitos'), topic('b', '1.2', 'Acoplamento')];

function props(overrides: Partial<QuestionLogPanelProps> = {}): QuestionLogPanelProps {
  return { topics, defaultTopicId: 'a', invite: false, lastLogLabel: null, onSubmit: vi.fn(), onUndo: vi.fn(), onDismissInvite: vi.fn(), ...overrides };
}

const fill = (total: string, correct: string, blank: string) => {
  fireEvent.change(screen.getByLabelText('Total'), { target: { value: total } });
  fireEvent.change(screen.getByLabelText('Certas'), { target: { value: correct } });
  fireEvent.change(screen.getByLabelText('Em branco'), { target: { value: blank } });
};

describe('registro de questões feitas fora do app', () => {
  it('começa recolhido; abre e envia com o tópico do bloco por padrão', () => {
    const p = props();
    render(<QuestionLogPanel {...p} />);
    expect(screen.queryByLabelText('Total')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar questões feitas fora do app' }));
    expect((screen.getByLabelText('Tópico') as HTMLSelectElement).value).toBe('a');
    fill('20', '14', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(p.onSubmit).toHaveBeenCalledWith({ topicId: 'a', total: 20, correct: 14, blank: 2 });
  });

  it('números impossíveis não deixam registrar e dizem por quê', () => {
    render(<QuestionLogPanel {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar questões feitas fora do app' }));
    fill('10', '8', '3');
    expect((screen.getByRole('button', { name: 'Registrar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Confira os números: certas e em branco não passam do total.')).toBeTruthy();
  });

  it('ao concluir um bloco, abre sozinho com um convite que dá para dispensar', () => {
    const p = props({ invite: true });
    render(<QuestionLogPanel {...p} />);
    expect(screen.getByText('Resolveu questões em outro lugar? Registre seu desempenho.')).toBeTruthy();
    expect(screen.getByLabelText('Total')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(p.onDismissInvite).toHaveBeenCalled();
  });

  it('depois de registrar mostra o resumo e permite desfazer', () => {
    const p = props({ lastLogLabel: 'Registrado: 14 de 20 (70%)' });
    render(<QuestionLogPanel {...p} />);
    expect(screen.getByText('Registrado: 14 de 20 (70%)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(p.onUndo).toHaveBeenCalled();
  });

  it('texto genérico: não cita nenhum site específico nem jargão técnico', () => {
    const { container } = render(<QuestionLogPanel {...props({ invite: true })} />);
    for (const term of ['TEC', 'Tec Concursos', 'QConcursos', 'SQLite', 'Cache', 'null', 'NaN']) {
      expect(container.textContent).not.toContain(term);
    }
  });
});
