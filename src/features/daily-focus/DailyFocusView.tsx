import { useMemo, type ReactNode } from 'react';
import { ArrowRight, Calendar, CheckCircle2, Clock, Coffee, Compass, Play, Zap } from 'lucide-react';
import { MetricExplainer } from '../../components/MetricExplainer';
import { explainSubjectAllocation } from '../../lib/explainabilityEngine';
import { planDailyBlocks, type CostBenefitBadge } from '../../lib/dailyPlanner';
import type { CycleCalculationResult } from '../../lib/cycleEngine';
import { formatDuration } from '../../lib/timeFormat';
import type { StudyPlan, Subject, Topic } from '../../types/database';

interface DailyFocusViewProps {
  plan: StudyPlan;
  cycleData: CycleCalculationResult;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  onStartBlock: (subjectId: string, topicId: string, durationMinutes: number) => void;
  onSwitchToProWorkbench: () => void;
  onOpenWizard: () => void;
  /** Cartão do bloco de estudo em andamento (o mesmo da aba Ciclo). */
  blockCard?: ReactNode;
}

const BADGE_STYLES: Record<CostBenefitBadge, { className: string; label: string }> = {
  ALTA_RENTABILIDADE: { className: 'bg-red-500/15 text-red-300 border-red-500/30', label: '🔥 Alta Rentabilidade' },
  REVISAO_URGENTE: { className: 'bg-amber-500/15 text-amber-300 border-amber-500/30', label: '⚡ Revisão de Ponto Fraco' },
  BASE_ESTRATEGICA: { className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: '🎯 Base Estratégica' },
};

function formatDailyBudget(minutes: number): string {
  return `${formatDuration(minutes)} de estudo planejado para hoje`;
}

export function DailyFocusView({
  plan,
  cycleData,
  subjects,
  topicsBySubject,
  onStartBlock,
  onSwitchToProWorkbench,
  onOpenWizard,
  blockCard,
}: DailyFocusViewProps) {
  const { topicHeatmapRanking, daysUntilExam, totalWeeklyMinutesBudget } = cycleData;

  const dailyPlan = useMemo(
    () => planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget: plan.weekly_hours_target }),
    [cycleData, topicsBySubject, plan.weekly_hours_target]
  );
  const { blocks, dailyMinutesBudget, weekCompleted, studiedThisWeekMinutes } = dailyPlan;
  const weekProgress = Math.min(100, Math.round((studiedThisWeekMinutes / totalWeeklyMinutesBudget) * 100));

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
            <Calendar size={14} />
            <span>Roteiro de Hoje • Modo Essencial</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">{formatDailyBudget(dailyMinutesBudget)}</h2>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Nada de perder tempo escolhendo o que fazer: os blocos seguem o que ainda falta do seu ciclo nesta semana
            em <strong className="text-slate-200">[{plan.organ || 'Geral'}] {plan.title}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenWizard}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium flex items-center gap-1.5 transition"
            title="Recalibrar momento, horas ou estratégia"
          >
            <Compass size={13} className="text-orange-400" />
            Recalibrar Perfil
          </button>
          <button
            type="button"
            onClick={onSwitchToProWorkbench}
            className="px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-xs text-orange-300 font-semibold flex items-center gap-1.5 transition"
          >
            <span>Ver Bancada Completa Pro</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {blockCard}

      {weekCompleted && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
          🎉 Você já cumpriu a meta desta semana em todas as matérias! Os blocos abaixo são revisões extras da maior
          prioridade.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Zap size={14} className="text-orange-400" />
            Seu Plano Passo a Passo de Hoje ({blocks.length} {blocks.length === 1 ? 'bloco' : 'blocos'})
          </h3>
          <span className="text-xs text-slate-500">
            {daysUntilExam !== null ? `Faltam ${daysUntilExam} dias para a prova` : 'Pré-Edital Contínuo'}
          </span>
        </div>

        {blocks.length === 0 && (
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400">
            Cadastre as disciplinas do seu edital para montarmos o roteiro do dia.
          </div>
        )}

        {blocks.map((block, idx) => {
          const heatItem = topicHeatmapRanking.find((h) => h.topic.id === block.topic?.id);
          const badge = BADGE_STYLES[block.costBenefitBadge];
          const { allocation } = block;

          return (
            <div key={block.subject.id} className="space-y-3">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-orange-500/40 transition space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="h-7 w-7 rounded-lg bg-orange-500/20 text-orange-300 font-bold text-xs flex items-center justify-center">
                      #{block.blockNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: block.subject.color }} />
                      <span className="text-xs font-bold text-white">{block.subject.name}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 flex items-center gap-1 font-mono">
                      <Clock size={12} className="text-slate-500" />
                      {formatDuration(block.durationMinutes)} sugeridos
                    </span>
                    <MetricExplainer
                      explanation={explainSubjectAllocation(allocation, plan.weekly_hours_target, daysUntilExam, cycleData.strategy)}
                      buttonLabel="Por que hoje?"
                      className="bg-slate-950 border border-slate-800"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="text-[11px] text-slate-400">Tópico verticalizado selecionado para este bloco:</div>
                    <div className="text-sm font-semibold text-white">
                      {block.topic ? (
                        <>
                          <span className="font-mono text-orange-300 mr-1.5">{block.topic.code}</span>
                          {block.topic.title}
                        </>
                      ) : (
                        'Início do edital da matéria'
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 pt-0.5">
                      <span>💡 {block.reasonText}</span>
                      {heatItem && (
                        <span className="text-orange-400 font-mono text-[10px]">• Urgência: {heatItem.heatScore}/10</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Nesta semana: {formatDuration(allocation.studiedThisWeekMinutes)} de {formatDuration(allocation.currentWeeklyMinutes)} do ciclo
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartBlock(block.subject.id, block.topic?.id || '', block.durationMinutes)}
                    className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 shrink-0 transition"
                  >
                    <Play size={13} className="fill-white" />
                    Iniciar Estudo Direto 🚀
                  </button>
                </div>
              </div>

              {idx === 0 && blocks.length > 1 && (
                <div className="flex items-center justify-center gap-2 py-1 text-slate-500 text-xs">
                  <div className="h-px bg-slate-800 w-16" />
                  <span className="flex items-center gap-1.5">
                    <Coffee size={13} className="text-amber-500" />
                    Pausa sugerida de 00:10 para fixar a memória
                  </span>
                  <div className="h-px bg-slate-800 w-16" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>
              Meta da semana: <strong className="text-white">{formatDuration(totalWeeklyMinutesBudget)}</strong> — estudado até agora:{' '}
              <strong className="text-white">{formatDuration(studiedThisWeekMinutes)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onSwitchToProWorkbench}
            className="text-orange-400 hover:text-orange-300 font-semibold"
          >
            Explorar todas as {subjects.length} disciplinas →
          </button>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden" aria-label="Progresso da semana">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${weekProgress}%` }} />
        </div>
      </div>
    </div>
  );
}
