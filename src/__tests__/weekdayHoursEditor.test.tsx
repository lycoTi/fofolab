import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WeekdayMinutes } from '../lib/availability';
import { WeekdayHoursEditor } from '../features/study-plan/WeekdayHoursEditor';

const PATTERN: WeekdayMinutes = [150, 150, 150, 150, 150, 300, 0];

/** O editor é controlado: o teste faz o papel da tela que guarda o valor. */
function Harness({ initial, onChange }: { initial: WeekdayMinutes; onChange?: (v: WeekdayMinutes) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <WeekdayHoursEditor
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('Editor de dias de estudo e horas (spec 13 §4.1)', () => {
  it('cada dia é uma coluna: o dia em cima, o tempo logo embaixo; desligado mostra "Folga"', () => {
    render(<Harness initial={PATTERN} />);
    expect(screen.getByText('Em quais dias e quanto tempo você estuda?')).toBeTruthy();
    const sunday = screen.getByRole('group', { name: 'Domingo' });
    expect(sunday.textContent).toContain('Folga');
    const saturday = screen.getByRole('group', { name: 'Sábado' });
    expect(saturday.contains(screen.getByLabelText('Tempo de sábado'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Dom' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Sáb' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByLabelText('Tempo de domingo')).toBeNull();
    expect((screen.getByLabelText('Tempo de sábado') as HTMLSelectElement).value).toBe('300');
  });

  it('desligar um dia grava 0; religar volta ao tempo que ele tinha', () => {
    const onChange = vi.fn();
    render(<Harness initial={PATTERN} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sáb' }));
    expect(onChange).toHaveBeenLastCalledWith([150, 150, 150, 150, 150, 0, 0]);
    expect(screen.queryByLabelText('Tempo de sábado')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sáb' }));
    expect(onChange).toHaveBeenLastCalledWith(PATTERN);
    // Dia que nunca teve tempo começa com 01:00
    fireEvent.click(screen.getByRole('button', { name: 'Dom' }));
    expect(onChange).toHaveBeenLastCalledWith([150, 150, 150, 150, 150, 300, 60]);
  });

  it('mudar o tempo de um dia muda só ele', () => {
    const onChange = vi.fn();
    render(<Harness initial={PATTERN} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Tempo de terça'), { target: { value: '60' } });
    expect(onChange).toHaveBeenLastCalledWith([150, 60, 150, 150, 150, 300, 0]);
  });

  it('"Mesmo tempo nos dias de estudo" aplica o tempo só aos dias ligados', () => {
    const onChange = vi.fn();
    render(<Harness initial={PATTERN} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '02:00 nos dias de estudo' }));
    expect(onChange).toHaveBeenLastCalledWith([120, 120, 120, 120, 120, 120, 0]);
  });

  it('cada dia aparece uma vez só na seção (sem lista repetida de dias)', () => {
    const { container } = render(<Harness initial={PATTERN} />);
    expect(container.textContent?.match(/Sáb/g)).toHaveLength(1);
  });

  it('total da semana em HH:mm, sem minutos soltos', () => {
    const { container } = render(<Harness initial={PATTERN} />);
    expect(screen.getByText('17:30 por semana')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d+\s?min\b/);
  });
});
