import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchSessionHud } from '../features/questions/WorkbenchSessionHud';

describe('WorkbenchSessionHud (spec 15d)', () => {
  it('retorna nulo se nenhuma questão foi respondida na sessão', () => {
    const { container } = render(
      <WorkbenchSessionHud
        answeredCount={0}
        correctCount={0}
        accuracyPercent={0}
        avgSecondsPerQuestion={0}
        totalSessionSeconds={0}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza taxa de acertos, ritmo médio medido e tempo de foco', () => {
    const onOpen = vi.fn();
    render(
      <WorkbenchSessionHud
        answeredCount={10}
        correctCount={8}
        accuracyPercent={80}
        avgSecondsPerQuestion={75}
        totalSessionSeconds={750}
        blockRunning={true}
        onOpenSimulation={onOpen}
      />
    );

    expect(screen.getByText('Acertos da sessão:')).toBeTruthy();
    expect(screen.getByText('8/10')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('01:15/q')).toBeTruthy();
    expect(screen.getByText('Bloco ativo')).toBeTruthy();
    expect(screen.getByText(/Foco: 12:30/)).toBeTruthy();

    const simBtn = screen.getByRole('button', { name: /Simular prova/i });
    fireEvent.click(simBtn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
