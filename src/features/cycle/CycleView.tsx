import { useState } from 'react';
import { CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import type { CycleCalculationResult } from '../../lib/cycleEngine';
import { formatDuration } from '../../lib/timeFormat';
import type { ExamPart, StudyPlan } from '../../types/database';
import { CycleSubjectRow } from './CycleSubjectRow';
import { groupAllocations } from './cycleGroups';

/** Sugestões que mudam alguma decisão; o texto genérico sobre confiança da amostra fica só no "ⓘ". */
const ACTIONABLE_SUGGESTIONS = new Set(['REBALANCE', 'OVERLOAD_WARNING', 'PREREQUISITE_ALERT']);

/**
 * Divisão da semana por matéria, agrupada pela prova (pé da aba Plano de estudo, spec 13 §4.4): as sugestões do ciclo
 * e o tempo de cada matéria, sempre em HH:mm. A semana dia a dia fica no `WeekView`.
 */
export function CycleView({
  plan,
  cycleData,
  examParts,
  onApplyRecommendedCycle,
  onOpenSubject,
}: {
  plan: StudyPlan;
  cycleData: CycleCalculationResult;
  examParts: ExamPart[];
  onApplyRecommendedCycle: (allocations: { subjectId: string; minutes: number }[]) => void;
  onOpenSubject?: (subjectId: string) => void;
}) {
  const [applied, setApplied] = useState(false);
  // A mesma escala para todas as provas: dá para comparar a matéria de uma prova com a de outra
  const maxWeeklyMinutes = Math.max(1, ...cycleData.allocations.map((a) => a.currentWeeklyMinutes));
  const { allocations, totalWeeklyMinutesBudget } = cycleData;
  const suggestions = cycleData.suggestions.filter((s) => ACTIONABLE_SUGGESTIONS.has(s.type));
  const groups = groupAllocations(allocations, examParts);

  const applySuggestion = () => {
    onApplyRecommendedCycle(allocations.map((a) => ({ subjectId: a.subject.id, minutes: a.recommendedWeeklyMinutes })));
    setApplied(true);
    window.setTimeout(() => setApplied(false), 4000);
  };

  return (
    <div className="space-y-5">
      {suggestions.length > 0 && (
        <section aria-label="Sugestões para o próximo ciclo" className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-orange-400" />
              Sugestões para o próximo ciclo
            </h3>
            <button
              type="button"
              onClick={applySuggestion}
              className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              Aplicar sugestão
            </button>
          </div>
          {applied && (
            <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              Divisão atualizada, mantendo suas {formatDuration(totalWeeklyMinutesBudget)} semanais.
            </p>
          )}
          {suggestions.map((s) => (
            <div key={s.id} className="text-xs text-slate-300 space-y-0.5">
              <div className="font-semibold text-slate-100">{s.title}</div>
              <p className="text-slate-400 leading-relaxed">{s.description}</p>
            </div>
          ))}
        </section>
      )}

      {groups.map((group) => (
        <section key={group.key} aria-label={group.title} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">
                {group.title}
                {group.highlight && (
                  <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 align-middle">
                    {group.highlight}
                  </span>
                )}
              </h3>
              {group.details && <p className="text-[11px] text-slate-500">{group.details}</p>}
            </div>
            <span className="text-xs font-mono text-slate-300">{formatDuration(group.weeklyMinutes)} por semana</span>
          </div>
          <ul className="divide-y divide-slate-800/70">
            {group.allocations.map((allocation) => (
              <CycleSubjectRow
                key={allocation.subject.id}
                allocation={allocation}
                plan={plan}
                cycleData={cycleData}
                onOpenSubject={onOpenSubject}
                maxWeeklyMinutes={maxWeeklyMinutes}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
