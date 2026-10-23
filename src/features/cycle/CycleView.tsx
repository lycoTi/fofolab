import { useState } from 'react';
import { CalendarClock, CheckCircle2, RefreshCw, Sliders, Sparkles } from 'lucide-react';
import { STRATEGY_LABELS, type CycleCalculationResult } from '../../lib/cycleEngine';
import { formatDuration } from '../../lib/timeFormat';
import type { ExamPart, StudyPlan } from '../../types/database';
import { CycleSubjectRow } from './CycleSubjectRow';
import { groupAllocations } from './cycleGroups';

/** Sugestões que mudam alguma decisão; o texto genérico sobre confiança da amostra fica só no "ⓘ". */
const ACTIONABLE_SUGGESTIONS = new Set(['REBALANCE', 'OVERLOAD_WARNING', 'PREREQUISITE_ALERT']);

/**
 * Aba Ciclo: a semana (meta, feito, dias até a prova), o bloco de estudo e as matérias agrupadas
 * pela prova, com tempo sempre em HH:mm. O Mapa de Calor fica numa aba própria.
 */
export function CycleView({
  plan,
  cycleData,
  examParts,
  onUpdateWeeklyHours,
  onApplyRecommendedCycle,
  onOpenSubject,
}: {
  plan: StudyPlan;
  cycleData: CycleCalculationResult;
  examParts: ExamPart[];
  onUpdateWeeklyHours: (hours: number) => void;
  onApplyRecommendedCycle: (allocations: { subjectId: string; minutes: number }[]) => void;
  onOpenSubject?: (subjectId: string) => void;
}) {
  const [applied, setApplied] = useState(false);
  // A mesma escala para todas as provas: dá para comparar a matéria de uma prova com a de outra
  const maxWeeklyMinutes = Math.max(1, ...cycleData.allocations.map((a) => a.currentWeeklyMinutes));
  const { allocations, daysUntilExam, totalWeeklyMinutesBudget } = cycleData;
  const studiedThisWeek = allocations.reduce((acc, a) => acc + a.studiedThisWeekMinutes, 0);
  const weekProgress = totalWeeklyMinutesBudget > 0 ? Math.min(100, (studiedThisWeek / totalWeeklyMinutesBudget) * 100) : 0;
  const suggestions = cycleData.suggestions.filter((s) => ACTIONABLE_SUGGESTIONS.has(s.type));
  const groups = groupAllocations(allocations, examParts);

  const applySuggestion = () => {
    onApplyRecommendedCycle(allocations.map((a) => ({ subjectId: a.subject.id, minutes: a.recommendedWeeklyMinutes })));
    setApplied(true);
    window.setTimeout(() => setApplied(false), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <section aria-label="Semana de estudo" className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">Esta semana</div>
            <div className="text-lg font-bold text-white font-mono">
              {formatDuration(studiedThisWeek)} <span className="text-slate-500 text-sm font-sans">de</span>{' '}
              {formatDuration(totalWeeklyMinutesBudget)}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <CalendarClock size={15} className="text-orange-400" />
            {daysUntilExam !== null ? (
              <span>
                Faltam <strong className="text-white">{daysUntilExam} dias</strong> para a prova
              </span>
            ) : (
              <span>Data da prova em aberto</span>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-orange-500" style={{ width: `${weekProgress}%` }} />
        </div>
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer select-none flex items-center gap-1.5 hover:text-slate-200">
            <Sliders size={12} />
            {formatDuration(totalWeeklyMinutesBudget)} por semana ({formatDuration(totalWeeklyMinutesBudget / 7)} por dia) • Estratégia:{' '}
            {cycleData.strategy ? STRATEGY_LABELS[cycleData.strategy] : 'neutra'}
          </summary>
          <div className="pt-3 space-y-1">
            <input
              type="range"
              min={7}
              max={49}
              step={3.5}
              aria-label="Horas disponíveis na semana"
              value={plan.weekly_hours_target}
              onChange={(e) => onUpdateWeeklyHours(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>07:00</span>
              <span>21:00</span>
              <span>31:30</span>
              <span>49:00</span>
            </div>
            <p className="text-[11px] text-slate-500">
              O tempo da semana é fixo; o ciclo só muda a divisão entre as matérias.
            </p>
          </div>
        </details>
      </section>

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
