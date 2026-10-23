import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CycleView } from '../features/cycle/CycleView';
import { SEED_STUDY_PLANS, SEED_SUBJECTS, SEED_TOPIC_LINKS, SEED_TOPICS } from '../data/initialSeed';
import { calculateDynamicStudyCycle } from '../lib/cycleEngine';
import type { Topic } from '../types/database';

const plan = SEED_STUDY_PLANS[0];
const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
const topicsBySubject: Record<string, Topic[]> = {};
for (const s of subjects) topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
const cycleData = calculateDynamicStudyCycle({ plan, subjects, topicsBySubject, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS });

const view = (overrides: Partial<Parameters<typeof CycleView>[0]> = {}) => (
  <CycleView
    plan={plan}
    cycleData={cycleData}
    examParts={[]}
    onUpdateWeeklyHours={vi.fn()}
    onApplyRecommendedCycle={vi.fn()}
    totals={{ todayMinutes: 95, weekMinutes: 250, yearMinutes: 3000, allMinutes: 6150 }}
    {...overrides}
  />
);

describe('aba Ciclo: totais e semana cumprida', () => {
  it('mostra o estudo registrado de hoje, da semana, do ano e desde o começo', () => {
    render(view());
    const totals = screen.getByRole('region', { name: 'Seu estudo registrado' });
    expect(totals.textContent).toContain('Hoje01:35');
    expect(totals.textContent).toContain('Esta semana04:10');
    expect(totals.textContent).toContain('Este ano50:00');
    expect(totals.textContent).toContain('Desde o começo102:30');
  });

  it('semana cumprida ganha um parabéns', () => {
    const met = {
      ...cycleData,
      allocations: cycleData.allocations.map((a) => ({ ...a, studiedThisWeekMinutes: a.currentWeeklyMinutes, remainingThisWeekMinutes: 0 })),
    };
    render(view({ cycleData: met }));
    expect(screen.getByText('Meta da semana cumprida. Parabéns pela constância!')).toBeTruthy();
  });

  it('não mostra mais o cartão do bloco (ele mora na coluna Hoje)', () => {
    render(view());
    expect(screen.queryByRole('group', { name: 'FofoDoro' })).toBeNull();
  });
});
