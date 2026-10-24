import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalibrationCard } from '../features/good-morning/CalibrationCard';
import { ResumeCard } from '../features/good-morning/ResumeCard';
import { SituationCard } from '../features/good-morning/SituationCard';
import { StudyCalendar } from '../features/good-morning/StudyCalendar';

const FORBIDDEN_JARGON = ['SQLite', '0 tokens', '_score', 'Seed', 'IndexedDB', 'localStorage', 'Cache', 'null', 'NaN', 'undefined', 'TEC', 'SURE'];

describe('Situação com cobertura × proficiência e ritmo', () => {
  it('mostra os dois números separados e a linha do ritmo', () => {
    const { container } = render(
      <SituationCard
        daysLine="Faltam 50 dias para a prova (13/12/2026)."
        parts={[]}
        warning={null}
        progress={{ coveragePercent: 34, seenTopics: 38, totalTopics: 112, proficiencyPercent: 68, paceLine: 'Faltam 74 tópicos…', onPace: false }}
      />
    );
    expect(screen.getByText('Cobertura do edital')).toBeTruthy();
    expect(screen.getByText('34%')).toBeTruthy();
    expect(screen.getByText('38 de 112 tópicos vistos')).toBeTruthy();
    expect(screen.getByText('Proficiência nos tópicos estudados')).toBeTruthy();
    expect(screen.getByText('68%')).toBeTruthy();
    expect(screen.getByText('Faltam 74 tópicos…')).toBeTruthy();
    for (const term of FORBIDDEN_JARGON) expect(container.textContent).not.toContain(term);
  });

  it('sem tópicos vistos, a proficiência espera os primeiros estudos', () => {
    render(<SituationCard daysLine={null} parts={[]} warning={null} progress={{ coveragePercent: 0, seenTopics: 0, totalTopics: 10, proficiencyPercent: null, paceLine: null, onPace: null }} />);
    expect(screen.getByText('Aparece depois dos primeiros estudos')).toBeTruthy();
  });
});

describe('Continuar de onde parou', () => {
  it('leva ao PDF na página em que parou e à última anotação', () => {
    const onOpenPdf = vi.fn();
    const onOpenNotes = vi.fn();
    render(
      <ResumeCard
        pdf={{ title: 'Apostila.pdf', page: 12, totalPages: 40, topicLabel: '2.1 Microsserviços', subjectId: 's', topicId: 't' }}
        note={{ topicLabel: '3.2 SQL', subjectId: 's2', topicId: 't2' }}
        onOpenPdf={onOpenPdf}
        onOpenNotes={onOpenNotes}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Apostila\.pdf · página 12 de 40/ }));
    expect(onOpenPdf).toHaveBeenCalledWith('s', 't');
    fireEvent.click(screen.getByRole('button', { name: /3\.2 SQL/ }));
    expect(onOpenNotes).toHaveBeenCalledWith('s2', 't2');
  });

  it('sem PDF nem anotação, não aparece', () => {
    const { container } = render(<ResumeCard pdf={null} note={null} onOpenPdf={vi.fn()} onOpenNotes={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});

describe('Calibração e últimas 4 semanas', () => {
  it('calibração: uma linha por nível; sem amostra, explica quando aparece', () => {
    const { rerender } = render(<CalibrationCard lines={[{ confidence: 'SURE', label: 'Tenho certeza', answered: 5, accuracyPercent: 80 }]} />);
    expect(screen.getByText('“Tenho certeza”: acertou 80% (5 questões)')).toBeTruthy();
    rerender(<CalibrationCard lines={[]} />);
    expect(screen.getByText(/Responda algumas questões na Revisão do dia/)).toBeTruthy();
  });

  it('calendário: um quadradinho por dia com o tempo em HH:mm, sem contagem de sequência', () => {
    const days = Array.from({ length: 28 }, (_, i) => ({ dateKey: `2026-10-${String(i + 1).padStart(2, '0')}`, minutes: i === 27 ? 100 : 0, level: (i === 27 ? 3 : 0) as 0 | 3 }));
    const { container } = render(<StudyCalendar days={days} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(28);
    expect(screen.getByLabelText('28/10: 01:40')).toBeTruthy();
    expect(screen.getByLabelText('01/10: sem estudo')).toBeTruthy();
    expect(container.textContent).not.toMatch(/sequência|seguidos/i);
  });
});
