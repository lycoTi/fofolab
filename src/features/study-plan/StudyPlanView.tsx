import { useRef, useState } from 'react';
import { RotateCcw, Sliders } from 'lucide-react';
import type { WeekdayMinutes } from '../../lib/availability';
import { STRATEGY_LABELS, type CycleCalculationResult } from '../../lib/cycleEngine';
import type { DayForecast } from '../../lib/weekForecast';
import type { ExamPart, StudyPlan, Subject, Topic } from '../../types/database';
import { CycleView } from '../cycle/CycleView';
import type { ExamOutlook } from '../../lib/examProjection';
import { ExamOutlookCard } from './ExamOutlookCard';
import { WeekdayHoursEditor } from './WeekdayHoursEditor';
import { WeekTimeline } from './WeekTimeline';
import { WeekView } from './WeekView';

/** Reta final: 7 a 21 dias antes da prova (spec 13 §4.3). */
const FINAL_STRETCH_OPTIONS = [7, 10, 14, 21];

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
  outlook,
  subjects,
  topicsBySubject,
  onChangePattern,
  onChangeThisWeek,
  onApplyRecommendedCycle,
  onChangeFinalStretch,
  onChangeAllowNewInFinalStretch,
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
  /** "Dá tempo?" e a linha do tempo (13b); nulo sem data da prova. */
  outlook: ExamOutlook | null;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  onChangePattern: (minutes: WeekdayMinutes) => void;
  onChangeThisWeek: (minutes: WeekdayMinutes | null) => void;
  onApplyRecommendedCycle: () => void;
  onChangeFinalStretch: (days: number) => void;
  onChangeAllowNewInFinalStretch?: (allow: boolean) => void;
  onOpenSubject?: (subjectId: string) => void;
}) {
  const weekMet = cycleData.allocations.length > 0 && cycleData.allocations.every((a) => a.remainingThisWeekMinutes <= 0);
  const currentWeek = days.map((d) => d.plannedMinutes) as WeekdayMinutes;
  // "+HH:mm por semana" no "Dá tempo?" abre o Ajustar e leva até ele
  const [adjustOpen, setAdjustOpen] = useState(false);
  const adjustRef = useRef<HTMLDetailsElement>(null);
  const openAdjust = () => {
    setAdjustOpen(true);
    adjustRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

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

      <ExamOutlookCard outlook={outlook} onAdjust={openAdjust} />
      {outlook?.status === 'PROJETANDO' && outlook.weeks.length > 0 && <WeekTimeline weeks={outlook.weeks} />}

      <details
        ref={adjustRef}
        open={adjustOpen}
        onToggle={(e) => setAdjustOpen(e.currentTarget.open)}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300"
      >
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-slate-200 hover:text-white">
          <Sliders size={13} />
          Ajustar
          <span className="text-slate-500">· Estratégia: {cycleData.strategy ? STRATEGY_LABELS[cycleData.strategy] : 'neutra'}</span>
        </summary>
        <div className="mt-4 space-y-5">
          <WeekdayHoursEditor value={pattern} onChange={onChangePattern} />
          <label className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-300">
            Reta final: últimos
            <select
              aria-label="Dias da reta final"
              value={String(plan.final_stretch_days ?? 14)}
              onChange={(e) => onChangeFinalStretch(Number(e.target.value))}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
            >
              {FINAL_STRETCH_OPTIONS.map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
            dias antes da prova — só revisão e questões
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={plan.final_stretch_allow_new === 1}
              onChange={(e) => onChangeAllowNewInFinalStretch?.(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-orange-400"
            />
            Continuar avançando em tópicos novos na reta final
          </label>
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
