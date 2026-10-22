import { MetricExplainer } from '../../components/MetricExplainer';
import type { CycleCalculationResult, SubjectCycleAllocation } from '../../lib/cycleEngine';
import { explainSubjectAllocation } from '../../lib/explainabilityEngine';
import { formatDuration } from '../../lib/timeFormat';
import type { StudyPlan } from '../../types/database';

const SUGGESTION_GAP_MINUTES = 15;

/** Uma matéria do ciclo: nome inteiro, quanto já fez da meta da semana e por quê. */
export function CycleSubjectRow({
  allocation,
  plan,
  cycleData,
}: {
  allocation: SubjectCycleAllocation;
  plan: StudyPlan;
  cycleData: CycleCalculationResult;
}) {
  const { subject, currentWeeklyMinutes, studiedThisWeekMinutes, recommendedWeeklyMinutes } = allocation;
  const progress = currentWeeklyMinutes > 0 ? Math.min(100, (studiedThisWeekMinutes / currentWeeklyMinutes) * 100) : 0;
  const suggestionDiffers = Math.abs(recommendedWeeklyMinutes - currentWeeklyMinutes) >= SUGGESTION_GAP_MINUTES;

  return (
    <li className="py-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
          <span className="text-xs font-semibold text-white leading-snug">{subject.name}</span>
          <MetricExplainer
            explanation={explainSubjectAllocation(allocation, plan.weekly_hours_target, cycleData.daysUntilExam, cycleData.strategy)}
          />
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-mono text-slate-200">
            <span className="text-white font-bold">{formatDuration(studiedThisWeekMinutes)}</span>
            <span className="text-slate-500"> de </span>
            {formatDuration(currentWeeklyMinutes)}
          </div>
          {suggestionDiffers && (
            <div className="text-[10px] text-orange-300" title="O que o ciclo sugere para a próxima semana">
              sugerido {formatDuration(recommendedWeeklyMinutes)}
            </div>
          )}
        </div>
      </div>
      <div
        className="h-1.5 rounded-full bg-slate-800 overflow-hidden ml-[18px]"
        role="progressbar"
        aria-label={`Feito da semana em ${subject.name}`}
        aria-valuemin={0}
        aria-valuemax={currentWeeklyMinutes}
        aria-valuenow={studiedThisWeekMinutes}
      >
        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: subject.color }} />
      </div>
      <p className="ml-[18px] text-[11px] text-slate-400">{allocation.dominantReason}</p>
    </li>
  );
}
