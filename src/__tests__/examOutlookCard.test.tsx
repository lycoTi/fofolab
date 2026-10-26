import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExamOutlook, ProjectedWeek } from '../lib/examProjection';
import { ExamOutlookCard } from '../features/study-plan/ExamOutlookCard';
import { WeekTimeline } from '../features/study-plan/WeekTimeline';
import type { Topic } from '../types/database';

const week = (key: string, phase: ProjectedWeek['phase'], newTopics: number, coveragePercent: number): ProjectedWeek => ({
  weekStart: new Date(`${key}T00:00:00`), weekStartKey: key, newTopicMinutes: newTopics * 90, phase, newTopics, coveragePercent,
});
const weeks = [
  week('2026-10-26', 'TEORIA', 8, 30), week('2026-11-02', 'TEORIA', 9, 50), week('2026-11-23', 'ULTIMOS', 7, 80),
  week('2026-11-30', 'RETA_FINAL', 0, 80), week('2026-12-07', 'RETA_FINAL', 0, 80),
];
const base: ExamOutlook = {
  status: 'PROJETANDO', stretchStartKey: '2026-11-29', weeks, coverageAtStretch: 100, real: null, extraWeeklyMinutes: 0,
  leftForLater: [], parts: [
    { code: 'P1', name: 'Conhecimentos básicos', coverageAtStretch: 100 },
    { code: 'P2', name: 'Conhecimentos complementares', coverageAtStretch: 95 },
  ],
  partWarning: null, topicMinutes: { estimate: 90, source: 'AUTOAVALIACAO', sample: 0 },
};
const topic = (id: string, title: string) => ({ id, code: id, title }) as unknown as Topic;

describe('"Dá tempo?" na tela (spec 13 §4.3)', () => {
  it('a resposta direta: % do edital visto até a véspera da reta final; sem saídas quando dá', () => {
    const { container } = render(<ExamOutlookCard outlook={base} onAdjust={vi.fn()} />);
    expect(screen.getByText('100% do edital visto até 28/11')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /por semana/ })).toBeNull();
    expect(container.textContent).not.toMatch(/\d+\s?min\b/);
  });

  it('quando não dá: as horas a mais por semana (abre o Ajustar) e o que fica para depois', () => {
    const onAdjust = vi.fn();
    const left = [topic('3.4', 'Mensageria'), topic('2.5', 'Kubernetes'), topic('1.9', 'GraphQL')];
    render(<ExamOutlookCard outlook={{ ...base, coverageAtStretch: 80, extraWeeklyMinutes: 210, leftForLater: left }} onAdjust={onAdjust} />);
    fireEvent.click(screen.getByRole('button', { name: '+03:30 por semana' }));
    expect(onAdjust).toHaveBeenCalled();
    fireEvent.click(screen.getByText('3 tópicos de menor prioridade ficam para depois'));
    expect(screen.getByText('3.4 Mensageria')).toBeTruthy();
  });

  it('ritmo real abaixo do plano aparece ao lado do plano', () => {
    render(<ExamOutlookCard outlook={{ ...base, coverageAtStretch: 80, real: { weeklyMinutes: 930, coverageAtStretch: 65 } }} onAdjust={vi.fn()} />);
    expect(screen.getByText(/No seu ritmo das últimas 2 semanas \(15:30 por semana\): 65%/)).toBeTruthy();
  });

  it('cada prova com o % projetado; a do aviso fica em atenção', () => {
    render(<ExamOutlookCard outlook={{ ...base, partWarning: 'P2 está ficando para trás: 40% visto (as outras: 90%). Ela tem nota mínima.', parts: [
      { code: 'P1', name: 'Conhecimentos básicos', coverageAtStretch: 90 },
      { code: 'P2', name: 'Conhecimentos complementares', coverageAtStretch: 40 },
    ] }} onAdjust={vi.fn()} />);
    const p2 = screen.getByRole('listitem', { name: /^P2/ });
    expect(within(p2).getByText('atenção')).toBeTruthy();
    expect(screen.getByText(/P2 está ficando para trás/)).toBeTruthy();
  });

  it('sem data da prova, na reta final e depois da prova: a frase certa, sem projeção', () => {
    const { rerender } = render(<ExamOutlookCard outlook={null} onAdjust={vi.fn()} />);
    expect(screen.getByText('Defina a data da prova no edital para ver o caminho até ela.')).toBeTruthy();
    rerender(<ExamOutlookCard outlook={{ ...base, status: 'RETA_FINAL' }} onAdjust={vi.fn()} />);
    expect(screen.getByText('Reta final: só revisão e questões até a prova.')).toBeTruthy();
    rerender(<ExamOutlookCard outlook={{ ...base, status: 'PROVA_PASSOU' }} onAdjust={vi.fn()} />);
    expect(screen.getByText('A prova já passou.')).toBeTruthy();
  });
});

describe('Linha do tempo por semana (spec 13 §4.3, visão A)', () => {
  it('uma linha por semana com a fase, os tópicos novos e o % visto; a semana de hoje destacada', () => {
    render(<WeekTimeline weeks={weeks} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0].getAttribute('aria-current')).toBe('date');
    expect(rows[0].textContent).toContain('26/10');
    expect(rows[0].textContent).toContain('Teoria + questões');
    expect(rows[0].textContent).toContain('8 tópicos novos');
    expect(rows[2].textContent).toContain('Últimos tópicos');
    expect(rows[3].textContent).toContain('Reta final: revisão');
    expect(rows[1].textContent).toContain('50%');
  });
});
