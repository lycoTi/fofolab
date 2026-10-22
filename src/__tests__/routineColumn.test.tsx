import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoutineColumn, type RoutineColumnProps } from '../features/routine/RoutineColumn';
import type { RoutineItem } from '../lib/dailyRoutine';
import type { Subject, Topic } from '../types/database';

const FORBIDDEN_JARGON = ['SQLite', '0 tokens', '_score', 'Elasticsearch', 'Anti-Alucinação', 'Seed', 'IndexedDB', 'localStorage', 'Cache', 'null', 'NaN'];

const subject = (id: string, name: string) => ({ id, name, color: '#3b82f6' }) as unknown as Subject;
const topic = (id: string, code: string, title: string) => ({ id, subject_id: 's', code, title, parent_id: 'g' }) as unknown as Topic;

const item = (n: number, status: RoutineItem['status'], name: string, t: Topic | null, minutes = 60, studied = 0): RoutineItem => ({
  block: { blockNumber: n, subjectId: `s${n}`, topicId: t?.id ?? null, durationMinutes: minutes, reasonText: `Faltam 01:00 desta matéria na semana (${n})` },
  subject: subject(`s${n}`, name),
  topic: t,
  status,
  studiedMinutes: studied,
  remainingMinutes: minutes - studied,
});

const owasp = topic('owasp', '2.2.1', 'OWASP Top 10');

function props(overrides: Partial<RoutineColumnProps> = {}): RoutineColumnProps {
  return {
    items: [
      item(1, 'done', 'Auditoria', topic('ctrl', '1.2', 'Controle interno'), 50, 50),
      item(2, 'current', 'TI', owasp, 72, 31),
      item(3, 'next', 'CASP', topic('pcasp', '3.1', 'PCASP'), 48),
    ],
    dayTotalMinutes: 170,
    weekStudiedMinutes: 260,
    weekTargetMinutes: 840,
    extraBlock: null,
    blockRunning: false,
    siblings: [topic('oauth', '2.2.2', 'OAuth 2.0'), topic('jwt', '2.2.3', 'JWT')],
    materials: { pdfLabel: 'PDF p. 12/40', questionCount: 8, hasNotes: true },
    peek: null,
    hint: null,
    onStartBlock: vi.fn(),
    onSelectTopic: vi.fn(),
    onReturnToBlock: vi.fn(),
    onOpenMaterial: vi.fn(),
    onOpenCycle: vi.fn(),
    onOpenEdital: vi.fn(),
    onRecalibrate: vi.fn(),
    adminToggle: null,
    ...overrides,
  };
}

describe('coluna do roteiro de hoje', () => {
  it('mostra o bloco atual aberto, o feito esmaecido e o próximo recolhido com o motivo', () => {
    render(<RoutineColumn {...props()} />);
    expect(screen.getByText('Hoje · 02:50')).toBeTruthy();
    expect(screen.getByText('OWASP Top 10')).toBeTruthy();
    expect(screen.getByRole('button', { name: /2\.2\.2 OAuth 2\.0/ })).toBeTruthy();
    expect(screen.getByText(/Faltam 01:00 desta matéria na semana \(3\)/)).toBeTruthy();
    expect(screen.getByTestId('routine-item-1').className).toMatch(/opacity/);
    expect(screen.getByText(/Intervalo sugerido de 10 minutos/)).toBeTruthy();
    expect(screen.getByText('Semana: 04:20 de 14:00')).toBeTruthy();
  });

  it('Iniciar bloco chama onStartBlock com o bloco atual; some quando o bloco já roda', () => {
    const p = props();
    const { rerender } = render(<RoutineColumn {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar bloco' }));
    expect(p.onStartBlock).toHaveBeenCalledWith(p.items[1]);
    rerender(<RoutineColumn {...p} blockRunning />);
    expect(screen.queryByRole('button', { name: 'Iniciar bloco' })).toBeNull();
  });

  it('atalhos de material abrem a aba certa e o irmão vira olhada', () => {
    const p = props();
    render(<RoutineColumn {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'PDF p. 12/40' }));
    fireEvent.click(screen.getByRole('button', { name: '8 questões' }));
    fireEvent.click(screen.getByRole('button', { name: 'Caderno' }));
    expect(p.onOpenMaterial).toHaveBeenNthCalledWith(1, 'pdf');
    expect(p.onOpenMaterial).toHaveBeenNthCalledWith(2, 'questions');
    expect(p.onOpenMaterial).toHaveBeenNthCalledWith(3, 'notes');
    fireEvent.click(screen.getByRole('button', { name: /2\.2\.3 JWT/ }));
    expect(p.onSelectTopic).toHaveBeenCalledWith('s', 'jwt');
  });

  it('faixa da olhada fala do irmão sem tom de bronca e volta ao bloco', () => {
    const p = props({ peek: { kind: 'sibling', topicLabel: '2.2.3 JWT', showNudge: true, nudgeText: 'Seu bloco de TI está esperando: faltam 00:41' } });
    render(<RoutineColumn {...p} />);
    expect(screen.getByText('Olhar 2.2.3 JWT não conta para o bloco de hoje')).toBeTruthy();
    expect(screen.getByText('Seu bloco de TI está esperando: faltam 00:41')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao bloco' }));
    expect(p.onReturnToBlock).toHaveBeenCalled();
  });

  it('roteiro cumprido oferece o bloco extra do motor', () => {
    const done = [item(1, 'done', 'TI', owasp, 60, 60)];
    const extra = item(2, 'current', 'CASP', topic('pcasp', '3.1', 'PCASP'), 30);
    const p = props({ items: done, extraBlock: extra });
    render(<RoutineColumn {...p} />);
    expect(screen.getByText('Roteiro de hoje cumprido')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar bloco extra' }));
    expect(p.onStartBlock).toHaveBeenCalledWith(extra);
  });

  it('aviso de recalibrar é só uma sugestão com botão', () => {
    const p = props({ hint: 'CASP está mais difícil do que você marcou. Quer recalibrar?' });
    render(<RoutineColumn {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recalibrar perfil' }));
    expect(p.onRecalibrate).toHaveBeenCalled();
  });

  it('AUDITORIA DE UX: a coluna não mostra jargão técnico', () => {
    const { container } = render(
      <RoutineColumn {...props({ peek: { kind: 'outside', topicLabel: '3.1 PCASP', showNudge: false, nudgeText: '' } })} />
    );
    for (const term of FORBIDDEN_JARGON) expect(container.textContent).not.toContain(term);
  });
});
