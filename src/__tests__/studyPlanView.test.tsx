import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SEED_STUDY_PLANS, SEED_SUBJECTS, SEED_TOPIC_LINKS, SEED_TOPICS } from '../data/initialSeed';
import { weekBudgetMinutes, type WeekdayMinutes } from '../lib/availability';
import { calculateDynamicStudyCycle, startOfWeek } from '../lib/cycleEngine';
import { planDailyBlocks } from '../lib/dailyPlanner';
import { freezeDailyPlan } from '../lib/dailyRoutine';
import { forecastWeek } from '../lib/weekForecast';
import { examOutlook, type ExamOutlook } from '../lib/examProjection';
import { StudyPlanView } from '../features/study-plan/StudyPlanView';
import type { StudySession, Topic } from '../types/database';

const NOW = new Date(2026, 9, 27, 10, 0); // terça 27/10/2026
const MONDAY = startOfWeek(NOW);
const PATTERN: WeekdayMinutes = [150, 150, 150, 150, 150, 300, 0];
const plan = SEED_STUDY_PLANS[0];
const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
const topicsBySubject: Record<string, Topic[]> = {};
for (const s of subjects) topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);

function build(opts: { sessions?: StudySession[]; met?: boolean } = {}) {
  const sessions = opts.sessions ?? [];
  const weekBudget = weekBudgetMinutes(MONDAY, PATTERN, {});
  let cycleData = calculateDynamicStudyCycle({
    plan, subjects, topicsBySubject, attempts: [], sessions, topicLinks: SEED_TOPIC_LINKS, now: NOW, weeklyMinutesBudget: weekBudget,
  });
  if (opts.met) {
    cycleData = {
      ...cycleData,
      allocations: cycleData.allocations.map((a) => ({ ...a, studiedThisWeekMinutes: a.currentWeeklyMinutes, remainingThisWeekMinutes: 0 })),
    };
  }
  const todayBlocks = freezeDailyPlan(planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget: weekBudget / 60, dayMinutesBudget: 150 }));
  const days = forecastWeek({
    weekStart: MONDAY, now: NOW, pattern: PATTERN, overrides: {}, cycleData, topicsBySubject, weekSessions: sessions, todayBlocks, reviewEnabled: true,
  });
  return { cycleData, days, weekBudget };
}

function view(opts: { sessions?: StudySession[]; met?: boolean; thisWeek?: WeekdayMinutes | null; outlook?: ExamOutlook | null } = {}) {
  const { cycleData, days, weekBudget } = build(opts);
  const handlers = { onChangePattern: vi.fn(), onChangeThisWeek: vi.fn(), onApplyRecommendedCycle: vi.fn(), onChangeFinalStretch: vi.fn() };
  const utils = render(
    <StudyPlanView
      plan={plan}
      cycleData={cycleData}
      examParts={[]}
      days={days}
      weekBudget={weekBudget}
      weekStart={MONDAY}
      pattern={PATTERN}
      thisWeek={opts.thisWeek ?? null}
      outlook={opts.outlook ?? null}
      subjects={subjects}
      topicsBySubject={topicsBySubject}
      {...handlers}
    />
  );
  return { ...utils, ...handlers };
}

describe('aba Plano de estudo: Sua semana (spec 13 §4.2)', () => {
  it('mostra os 7 dias com as horas de cada um e "Folga" no dia desligado', () => {
    view();
    const week = screen.getByRole('region', { name: 'Sua semana' });
    const cards = within(week).getAllByRole('listitem', { name: /^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom) \d+/ });
    expect(cards).toHaveLength(7);
    expect(cards[5].textContent).toContain('05:00');
    expect(cards[6].textContent).toContain('Folga');
  });

  it('hoje fica destacado; o dia que passou mostra o que foi feito; os próximos, a previsão', () => {
    const monday = new Date(2026, 9, 26, 19, 0);
    const sessions: StudySession[] = [{
      id: 's1', subject_id: 'subj-cgu-contabilidade', topic_id: null, duration_minutes: 90, session_type: 'POMODORO',
      pauses_count: 0, was_skipped: 0, started_at: monday.toISOString(),
    }];
    view({ sessions });
    const week = screen.getByRole('region', { name: 'Sua semana' });
    const [mon, tue, wed] = within(week).getAllByRole('listitem', { name: /^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom) \d+/ });
    expect(tue.getAttribute('aria-current')).toBe('date');
    expect(mon.textContent).toContain('01:30 feito');
    expect(wed.textContent).toContain('previsão');
  });

  it('a Revisão da semana aparece com o nome, no dia mais longo', () => {
    view();
    const week = screen.getByRole('region', { name: 'Sua semana' });
    const saturday = within(week).getByRole('listitem', { name: /^Sáb 31/ });
    expect(saturday.textContent).toContain('Revisão');
  });

  it('saem os totais do topo (hoje, este ano, desde o começo)', () => {
    const { container } = view();
    expect(container.textContent).not.toContain('Este ano');
    expect(container.textContent).not.toContain('Desde o começo');
    expect(screen.queryByRole('region', { name: 'Seu estudo registrado' })).toBeNull();
  });

  it('semana cumprida ganha um parabéns', () => {
    view({ met: true });
    expect(screen.getByText('Meta da semana cumprida. Parabéns pela constância!')).toBeTruthy();
    // Os próximos dias não inventam bloco: dizem que a semana já está cumprida
    const week = screen.getByRole('region', { name: 'Sua semana' });
    expect(within(week).getByRole('listitem', { name: /^Qua 28/ }).textContent).toContain('semana cumprida');
  });

  it('"Só esta semana é diferente" grava a semana; "Voltar ao padrão" apaga', () => {
    const first = view();
    fireEvent.click(screen.getByText('Ajustar'));
    fireEvent.click(screen.getByRole('button', { name: 'Só esta semana é diferente' }));
    expect(first.onChangeThisWeek).toHaveBeenCalledWith(PATTERN);
    first.unmount();

    const custom = view({ thisWeek: [60, 60, 60, 60, 60, 60, 0] });
    fireEvent.click(screen.getByText('Ajustar'));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    expect(custom.onChangeThisWeek).toHaveBeenCalledWith(null);
  });

  it('não mostra o cartão do bloco (ele mora na coluna Hoje) e todo tempo vem em HH:mm', () => {
    const { container } = view();
    expect(screen.queryByRole('group', { name: 'FofoDoro' })).toBeNull();
    expect(container.textContent).not.toMatch(/\d+\s?min\b/);
  });
});

describe('Sua semana: cartão enxuto + detalhe do dia (opção A, 26/10)', () => {
  const allTopics = Object.values(topicsBySubject).flat();

  it('o cartão tem uma linha por bloco, com o nome curto da matéria e sem o tópico', () => {
    view();
    const week = screen.getByRole('region', { name: 'Sua semana' });
    const tuesday = within(week).getByRole('listitem', { name: /^Ter 27/ });
    for (const t of allTopics) expect(tuesday.textContent).not.toContain(t.title);
    expect(tuesday.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('o detalhe abre no dia de hoje, com o nome inteiro da matéria e o tópico; clicar noutro dia troca', () => {
    view();
    const detail = screen.getByRole('region', { name: 'Dia escolhido' });
    expect(detail.textContent).toContain('Terça 27');
    expect(allTopics.some((t) => detail.textContent?.includes(t.title))).toBe(true);
    fireEvent.click(within(screen.getByRole('region', { name: 'Sua semana' })).getByRole('button', { name: /^Qua 28/ }));
    expect(screen.getByRole('region', { name: 'Dia escolhido' }).textContent).toContain('Quarta 28');
  });

  it('a Revisão da semana aparece no detalhe do dia dela', () => {
    view();
    fireEvent.click(within(screen.getByRole('region', { name: 'Sua semana' })).getByRole('button', { name: /^Sáb 31/ }));
    expect(screen.getByRole('region', { name: 'Dia escolhido' }).textContent).toContain('Revisão da semana');
  });
});

describe('Reta final no Ajustar (spec 13 §4.3 e 12d §3.3)', () => {
  it('o Ajustar mostra a reta final, muda pelo select e permite liberar tópicos inéditos na reta final', () => {
    const onChangeAllowNewInFinalStretch = vi.fn();
    const { cycleData, days, weekBudget } = build();
    render(
      <StudyPlanView
        plan={plan}
        cycleData={cycleData}
        examParts={[]}
        days={days}
        weekBudget={weekBudget}
        weekStart={MONDAY}
        pattern={PATTERN}
        thisWeek={null}
        outlook={null}
        subjects={subjects}
        topicsBySubject={topicsBySubject}
        onChangePattern={vi.fn()}
        onChangeThisWeek={vi.fn()}
        onApplyRecommendedCycle={vi.fn()}
        onChangeFinalStretch={vi.fn()}
        onChangeAllowNewInFinalStretch={onChangeAllowNewInFinalStretch}
      />
    );
    fireEvent.click(screen.getByText('Ajustar'));
    const select = screen.getByLabelText('Dias da reta final') as HTMLSelectElement;
    expect(select.value).toBe('14');
    expect([...select.options].map((o) => o.value)).toEqual(['7', '10', '14', '21']);
    const checkbox = screen.getByRole('checkbox', { name: /Continuar avançando em tópicos novos na reta final/ });
    fireEvent.click(checkbox);
    expect(onChangeAllowNewInFinalStretch).toHaveBeenCalledWith(true);
  });
});

describe('Caminho até a prova no Plano (spec 13 §4.4)', () => {
  const projected = () => {
    const { cycleData } = build();
    return examOutlook({
      plan: { ...plan, exam_date: '2026-12-13', final_stretch_days: 14 }, now: NOW, pattern: [30, 0, 0, 0, 0, 0, 0], overrides: {},
      subjects, topicsBySubject, cycleData, examParts: [], sessions: [], firstStudyDates: {}, todayStudiedMinutes: 0,
    });
  };

  it('ordem: Sua semana → Dá tempo? → linha do tempo → Ajustar → divisão por matéria', () => {
    const { container } = view({ outlook: projected() });
    const order = ['Sua semana', 'Dá tempo?', 'Linha do tempo até a prova'].map((name) => screen.getByRole('region', { name }));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const adjust = [...container.querySelectorAll('details')].find((d) => d.querySelector('summary')?.textContent?.includes('Ajustar'))!;
    expect(order[2].compareDocumentPosition(adjust) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"+HH:mm por semana" abre o Ajustar', () => {
    const { container } = view({ outlook: projected() });
    const adjust = [...container.querySelectorAll('details')].find((d) => d.querySelector('summary')?.textContent?.includes('Ajustar'))!;
    expect(adjust.open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^\+\d{2}:\d{2} por semana$/ }));
    expect(adjust.open).toBe(true);
  });
});

