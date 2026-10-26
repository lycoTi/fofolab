import { RotateCcw, Sliders } from 'lucide-react';
import type { WeekdayMinutes } from '../../lib/availability';
import { STRATEGY_LABELS, type CycleCalculationResult } from '../../lib/cycleEngine';
import type { DayForecast } from '../../lib/weekForecast';
import type { ExamPart, StudyPlan, Subject, Topic } from '../../types/database';
import { CycleView } from '../cycle/CycleView';
import { WeekdayHoursEditor } from './WeekdayHoursEditor';
import { WeekView } from './WeekView';

const secondaryButton =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-200 ' +
  'hover:border-orange-500/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400';

/**
 * Aba Plano de estudo (spec 13 §4.4): Sua semana → Ajustar (dias e horas do padrão; semana atípica) → divisão da semana
 * por matéria. O caminho até a prova (13b) entra entre a semana e a divisão.
 */
export function StudyPlanView({
  plan,
  cycleData,
  examParts,
  days,
  weekBudget,
  weekStart,
  pattern,
  thisWeek,
  subjects,
  topicsBySubject,
  onChangePattern,
  onChangeThisWeek,
  onApplyRecommendedCycle,
  onOpenSubject,
}: {
  plan: StudyPlan;
  cycleData: CycleCalculationResult;
  examParts: ExamPart[];
  days: DayForecast[];
  weekBudget: number;
  weekStart: Date;
  pattern: WeekdayMinutes;
  /** Horas desta semana quando ela é diferente do padrão; `null` = segue o padrão. */
  thisWeek: WeekdayMinutes | null;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  onChangePattern: (minutes: WeekdayMinutes) => void;
  onChangeThisWeek: (minutes: WeekdayMinutes | null) => void;
  onApplyRecommendedCycle: (allocations: { subjectId: string; minutes: number }[]) => void;
  onOpenSubject?: (subjectId: string) => void;
}) {
  const weekMet = cycleData.allocations.length > 0 && cycleData.allocations.every((a) => a.remainingThisWeekMinutes <= 0);
  const currentWeek = days.map((d) => d.plannedMinutes) as WeekdayMinutes;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <WeekView
        days={days}
        weekStart={weekStart}
        weekBudget={weekBudget}
        daysUntilExam={cycleData.daysUntilExam}
        weekMet={weekMet && weekBudget > 0}
        subjects={subjects}
        topicsBySubject={topicsBySubject}
      />

      <details className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-slate-200 hover:text-white">
          <Sliders size={13} />
          Ajustar
          <span className="text-slate-500">· Estratégia: {cycleData.strategy ? STRATEGY_LABELS[cycleData.strategy] : 'neutra'}</span>
        </summary>
        <div className="mt-4 space-y-5">
          <WeekdayHoursEditor value={pattern} onChange={onChangePattern} />
          <div className="space-y-3 border-t border-slate-800 pt-4">
            {thisWeek === null ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-slate-400">Viagem, plantão, semana de provas?</p>
                <button type="button" className={secondaryButton} onClick={() => onChangeThisWeek(currentWeek)}>
                  Só esta semana é diferente
                </button>
              </div>
            ) : (
              <>
                <WeekdayHoursEditor title="Horas só desta semana" value={thisWeek} onChange={onChangeThisWeek} />
                <button type="button" className={secondaryButton} onClick={() => onChangeThisWeek(null)}>
                  <RotateCcw size={11} />
                  Voltar ao padrão
                </button>
              </>
            )}
          </div>
        </div>
      </details>

      <CycleView
        plan={plan}
        cycleData={cycleData}
        examParts={examParts}
        onApplyRecommendedCycle={onApplyRecommendedCycle}
        onOpenSubject={onOpenSubject}
      />
    </div>
  );
}
