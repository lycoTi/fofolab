import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Flame,
  Info,
  PieChart,
  RefreshCw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { MetricExplainer } from './MetricExplainer';
import { explainSubjectAllocation, explainTopicHeat } from '../lib/explainabilityEngine';
import { STRATEGY_LABELS, type CycleCalculationResult, type CycleSuggestion } from '../lib/cycleEngine';
import type { StudyPlan } from '../types/database';

interface CycleDashboardProps {
  plan: StudyPlan;
  cycleData: CycleCalculationResult;
  onUpdateWeeklyHours: (newWeeklyHours: number) => void;
  onApplyRecommendedCycle: (allocations: { subjectId: string; minutes: number }[]) => void;
  onJumpToTopic: (subjectId: string, topicId: string) => void;
}

function getSuggestionCardClass(type: CycleSuggestion['type']): string {
  if (type === 'OVERLOAD_WARNING') {
    return 'bg-amber-500/10 border-amber-500/30 text-amber-200';
  }
  if (type === 'REBALANCE') {
    return 'bg-orange-500/10 border-orange-500/30 text-slate-200';
  }
  if (type === 'PREREQUISITE_ALERT') {
    return 'bg-purple-500/10 border-purple-500/30 text-purple-200';
  }
  return 'bg-slate-950/70 border-slate-800 text-slate-300';
}

function getHeatBadgeClass(heatScore: number): string {
  if (heatScore >= 6.5) {
    return 'bg-red-500/20 text-red-300 border border-red-500/30';
  }
  if (heatScore >= 4.0) {
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  }
  return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
}

export function CycleDashboard({
  plan,
  cycleData,
  onUpdateWeeklyHours,
  onApplyRecommendedCycle,
  onJumpToTopic,
}: CycleDashboardProps) {
  const [hoveredSubjId, setHoveredSubjId] = useState<string | null>(null);
  const [appliedBanner, setAppliedBanner] = useState<boolean>(false);

  const { allocations, topicHeatmapRanking, suggestions, daysUntilExam, totalWeeklyMinutesBudget } =
    cycleData;

  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  const pieSlices = allocations.map((item) => {
    const startPercent = cumulativePercent;
    const slicePercent = item.sharePercent;
    cumulativePercent += slicePercent;
    const strokeDasharray = `${(slicePercent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((startPercent / 100) * circumference);

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const hoveredItem =
    allocations.find((a) => a.subject.id === hoveredSubjId) || allocations[0] || null;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* 1. Barra Superior: Carga Horária Semanal + Contagem Regressiva */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
            <Sliders size={14} />
            <span>Planejamento Semanal</span>
          </div>
          <h3 className="text-base font-bold text-white">
            {plan.weekly_hours_target}h por semana ({(plan.weekly_hours_target / 7).toFixed(1)}h /
            dia)
          </h3>
          <p className="text-xs text-slate-400">
            Sua carga horária semanal é fixa e respeita sua rotina. O ciclo redistribui apenas a
            proporção entre as disciplinas.
          </p>
          <p className="text-[11px] text-slate-500">
            Estratégia:{' '}
            <strong className="text-slate-300">
              {cycleData.strategy ? STRATEGY_LABELS[cycleData.strategy] : 'neutra (escolha em “Recalibrar Perfil”)'}
            </strong>
          </p>
        </div>

        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Horas disponíveis na semana:</span>
            <span className="font-bold text-orange-300">
              {plan.weekly_hours_target}h ({totalWeeklyMinutesBudget} min)
            </span>
          </div>
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
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>1h/dia (7h)</span>
            <span>3h/dia (21h)</span>
            <span>4.5h/dia (31.5h)</span>
            <span>7h/dia (49h)</span>
          </div>
        </div>

        <div className="lg:col-span-3 flex items-center justify-end">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3 w-full">
            <div className="p-2.5 rounded-lg bg-orange-500/15 text-orange-400">
              <Calendar size={18} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Contagem Regressiva</div>
              <div className="text-sm font-bold text-white">
                {daysUntilExam !== null ? `${daysUntilExam} dias até a prova` : 'Data em aberto'}
              </div>
              <div className="text-[10px] text-slate-500">Banca: {plan.exam_board || 'FGV'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Gráfico Pizza / Donut + Sugestões de Equilíbrio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart size={16} className="text-orange-400" />
              Distribuição do Ciclo
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Passe o mouse nas fatias
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg className="w-52 h-52 -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="26"
                />
                {pieSlices.map((slice) => {
                  const isHovered = hoveredItem?.subject.id === slice.subject.id;
                  return (
                    <circle
                      key={slice.subject.id}
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="transparent"
                      stroke={slice.subject.color || '#f97316'}
                      strokeWidth={isHovered ? '32' : '26'}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      className="transition-all duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredSubjId(slice.subject.id)}
                    />
                  );
                })}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                {hoveredItem ? (
                  <>
                    <span
                      className="text-xl font-extrabold"
                      style={{ color: hoveredItem.subject.color }}
                    >
                      {hoveredItem.sharePercent}%
                    </span>
                    <span className="text-[11px] font-semibold text-white line-clamp-2 leading-tight mt-0.5">
                      {hoveredItem.subject.name}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {(hoveredItem.recommendedWeeklyMinutes / 60).toFixed(1)}h/sem (
                      {hoveredItem.recommendedWeeklyMinutes}m)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Sem matérias</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            {allocations.map((item) => (
              <div
                key={item.subject.id}
                onMouseEnter={() => setHoveredSubjId(item.subject.id)}
                className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition ${
                  hoveredItem?.subject.id === item.subject.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.subject.color }}
                  />
                  <span className="truncate font-medium">{item.subject.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[11px]">
                  <span className="font-bold text-white">{item.sharePercent}%</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 text-orange-300 font-mono">
                    {(item.recommendedWeeklyMinutes / 60).toFixed(1)}h
                  </span>
                  <MetricExplainer
                    explanation={explainSubjectAllocation(item, plan.weekly_hours_target, daysUntilExam, cycleData.strategy)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna Direita: Sugestões para o Próximo Ciclo + Equilíbrio por Matéria */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-orange-400" />
                Sugestões para o Próximo Ciclo
              </h3>
              <button
                onClick={() => {
                  onApplyRecommendedCycle(
                    allocations.map((a) => ({
                      subjectId: a.subject.id,
                      minutes: a.recommendedWeeklyMinutes,
                    }))
                  );
                  setAppliedBanner(true);
                  setTimeout(() => setAppliedBanner(false), 4000);
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw size={13} />
                Aplicar Sugestão no Próximo Ciclo
              </button>
            </div>

            {appliedBanner && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={14} />
                Equilíbrio atualizado para o próximo ciclo mantendo suas {plan.weekly_hours_target}h
                semanais!
              </div>
            )}

            <div className="space-y-2.5">
              {suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${getSuggestionCardClass(sug.type)}`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {sug.type === 'OVERLOAD_WARNING' && <AlertTriangle size={14} />}
                    {sug.type === 'REVERSE_STUDY_INFO' && (
                      <Info size={14} className="text-blue-400" />
                    )}
                    <span>{sug.title}</span>
                  </div>
                  <p className="text-slate-300/90 leading-relaxed">{sug.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Detalhamento por Disciplina */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">📊 Carga Recomendada por Disciplina</h3>
            <div className="space-y-2.5">
              {allocations.map((item) => (
                <div
                  key={item.subject.id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.subject.color }}
                      />
                      <span className="font-semibold text-white">{item.subject.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-orange-300">
                        Prioridade {item.elasticScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Sugerido: <strong>{item.recommendedWeeklyMinutes} min/sem</strong> (
                      {item.blocksPerWeek} blocos de 1h)
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.sharePercent}%`,
                        backgroundColor: item.subject.color,
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>💡 {item.dominantReason}</span>
                    <span>
                      Domínio: <strong>{item.studiedTopicsMastery}%</strong> • Cobertura do Edital:{' '}
                      <strong>{item.coveragePercent}%</strong> • Afinidade:{' '}
                      {item.subject.initial_affinity_level}/3 • Nesta semana:{' '}
                      <strong>
                        {item.studiedThisWeekMinutes}/{item.currentWeeklyMinutes} min
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Mapa de Calor dos Tópicos (Heatmap Ranking Cross-Disciplinas) */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame size={16} className="text-orange-400" />
              Mapa de Calor dos Tópicos (Prioridade de Revisão)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranking cruzando todas as disciplinas, confiança da amostra e retenção espaçada.
              Clique em qualquer tópico para abrir na bancada!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topicHeatmapRanking.map((item, idx) => (
            <div
              key={item.topic.id}
              onClick={() => onJumpToTopic(item.topic.subject_id, item.topic.id)}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-orange-500/50 cursor-pointer transition flex flex-col justify-between gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-mono font-bold text-slate-400">#{idx + 1}</span>
                    <span
                      className="px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: `${item.subjectColor}20`,
                        color: item.subjectColor,
                      }}
                    >
                      {item.subjectName}
                    </span>
                    {item.isReverseStudyDiscovery && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px]">
                        🔍 Calibrando Amostra ({item.sampleConfidencePercent}%)
                      </span>
                    )}
                    {!item.isReverseStudyDiscovery && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                        📊 Confiança {item.sampleConfidencePercent}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white mt-1">
                    {item.topic.code} {item.topic.title}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-bold ${getHeatBadgeClass(item.heatScore)}`}
                  >
                    🔥 {item.heatScore}
                  </span>
                  <MetricExplainer explanation={explainTopicHeat(item)} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                <span>
                  Domínio: <strong className="text-slate-200">{item.topic.mastery_score}%</strong> •
                  Questões: {item.attemptsCount}
                  {item.daysSinceLastStudy !== null
                    ? ` • Visto há ${item.daysSinceLastStudy}d`
                    : ''}
                </span>
                <span className="text-orange-400 flex items-center gap-1 font-medium">
                  Estudar Tópico <ArrowRight size={12} />
                </span>
              </div>

              {item.relatedPrerequisiteTitles.length > 0 && (
                <div className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                  🔗 Conectado a: {item.relatedPrerequisiteTitles.join(' • ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
