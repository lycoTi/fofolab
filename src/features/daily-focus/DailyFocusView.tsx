import { useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Compass,
  Play,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { MetricExplainer } from '../../components/MetricExplainer';
import { explainSubjectAllocation, explainTopicHeat } from '../../lib/explainabilityEngine';
import type { CycleCalculationResult } from '../../lib/cycleEngine';
import type { StudyPlan, Subject, Topic } from '../../types/database';

export interface DailyFocusBlock {
  blockNumber: number;
  subject: Subject;
  topic: Topic | null;
  durationMinutes: number;
  costBenefitBadge: 'ALTA_RENTABILIDADE' | 'BASE_ESTRATEGICA' | 'REVISAO_URGENTE';
  reasonText: string;
}

interface DailyFocusViewProps {
  plan: StudyPlan;
  cycleData: CycleCalculationResult;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  onStartBlock: (subjectId: string, topicId: string, durationMinutes: number) => void;
  onSwitchToProWorkbench: () => void;
  onOpenWizard: () => void;
}

export function DailyFocusView({
  plan,
  cycleData,
  subjects,
  topicsBySubject,
  onStartBlock,
  onSwitchToProWorkbench,
  onOpenWizard,
}: DailyFocusViewProps) {
  const { allocations, topicHeatmapRanking, daysUntilExam, totalWeeklyMinutesBudget } = cycleData;

  const dailyMinutesBudget = Math.round((plan.weekly_hours_target / 7) * 60);

  // Calcula os blocos de estudo de maior custo-benefício para hoje
  const blocks = useMemo<DailyFocusBlock[]>(() => {
    if (allocations.length === 0) return [];

    const topAlloc1 = allocations[0];
    const topAlloc2 = allocations[1] || allocations[0];

    // Busca o tópico mais quente da matéria 1 no Mapa de Calor
    const heat1 = topicHeatmapRanking.find((h) => h.topic.subject_id === topAlloc1.subject.id);
    const topTopic1 = heat1?.topic || (topicsBySubject[topAlloc1.subject.id] || [])[0] || null;

    // Busca o tópico mais quente da matéria 2 no Mapa de Calor
    const heat2 = topicHeatmapRanking.find((h) => h.topic.subject_id === topAlloc2.subject.id && h.topic.id !== topTopic1?.id);
    const topTopic2 = heat2?.topic || (topicsBySubject[topAlloc2.subject.id] || [])[0] || null;

    // Se o orçamento for menor que 70 min, faz 1 bloco focado de maior rentabilidade
    if (dailyMinutesBudget <= 60) {
      return [
        {
          blockNumber: 1,
          subject: topAlloc1.subject,
          topic: topTopic1,
          durationMinutes: dailyMinutesBudget,
          costBenefitBadge: 'ALTA_RENTABILIDADE',
          reasonText: `Maior retorno hoje: Peso ${topAlloc1.subject.exam_weight}x na prova e prioridade no ciclo semanal.`,
        },
      ];
    }

    // Caso contrário, divide em 2 blocos de alto retorno (ex: 50m + 30m para 90m total)
    const block1Min = Math.round(dailyMinutesBudget * 0.6);
    const block2Min = dailyMinutesBudget - block1Min;

    return [
      {
        blockNumber: 1,
        subject: topAlloc1.subject,
        topic: topTopic1,
        durationMinutes: block1Min,
        costBenefitBadge: 'ALTA_RENTABILIDADE',
        reasonText: `Foco principal: Peso ${topAlloc1.subject.exam_weight}x no seu edital (${topAlloc1.studiedTopicsMastery}% de domínio atual).`,
      },
      {
        blockNumber: 2,
        subject: topAlloc2.subject,
        topic: topTopic2,
        durationMinutes: block2Min,
        costBenefitBadge: heat2 && heat2.heatScore >= 5 ? 'REVISAO_URGENTE' : 'BASE_ESTRATEGICA',
        reasonText: heat2 && heat2.heatScore >= 5
          ? `Alerta do Mapa de Calor: Tópico prioritário para revisão preventiva antes da prova.`
          : `Equilíbrio do ciclo: Avanço nos tópicos do edital da segunda disciplina com maior peso.`,
      },
    ];
  }, [allocations, topicHeatmapRanking, topicsBySubject, dailyMinutesBudget]);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Banner de Boas-Vindas sem sobrecarga */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
            <Calendar size={14} />
            <span>Roteiro de Hoje • Modo Essencial</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">
            {dailyMinutesBudget >= 60
              ? `${(dailyMinutesBudget / 60).toFixed(1).replace('.0', '')}h de estudo planejado para hoje`
              : `${dailyMinutesBudget} minutos de estudo para hoje`}
          </h2>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Nada de perder tempo escolhendo o que fazer: calculamos os blocos de maior retorno para o seu concurso{' '}
            <strong className="text-slate-200">[{plan.organ || 'Geral'}] {plan.title}</strong>.
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

      {/* Cartões dos Blocos de Estudo do Dia */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Zap size={14} className="text-orange-400" />
            Seu Plano Passo a Passo de Hoje ({blocks.length} blocos)
          </h3>
          <span className="text-xs text-slate-500">
            {daysUntilExam !== null ? `Faltam ${daysUntilExam} dias para a prova` : 'Pré-Edital Contínuo'}
          </span>
        </div>

        {blocks.map((block, idx) => {
          const alloc = allocations.find((a) => a.subject.id === block.subject.id) || allocations[0];
          const heatItem = topicHeatmapRanking.find((h) => h.topic.id === block.topic?.id);

          return (
            <div key={idx} className="space-y-3">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-orange-500/40 transition space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="h-7 w-7 rounded-lg bg-orange-500/20 text-orange-300 font-bold text-xs flex items-center justify-center">
                      #{block.blockNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: block.subject.color }}
                      />
                      <span className="text-xs font-bold text-white">{block.subject.name}</span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        block.costBenefitBadge === 'ALTA_RENTABILIDADE'
                          ? 'bg-red-500/15 text-red-300 border-red-500/30'
                          : block.costBenefitBadge === 'REVISAO_URGENTE'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {block.costBenefitBadge === 'ALTA_RENTABILIDADE'
                        ? '🔥 Alta Rentabilidade'
                        : block.costBenefitBadge === 'REVISAO_URGENTE'
                          ? '⚡ Revisão de Ponto Fraco'
                          : '🎯 Base Estratégica'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 flex items-center gap-1 font-mono">
                      <Clock size={12} className="text-slate-500" />
                      {block.durationMinutes} min sugeridos
                    </span>

                    {/* Explicabilidade sob Demanda (ⓘ) */}
                    <MetricExplainer
                      explanation={explainSubjectAllocation(alloc, plan.weekly_hours_target, daysUntilExam)}
                      buttonLabel="Por que hoje?"
                      className="bg-slate-950 border border-slate-800"
                    />
                  </div>
                </div>

                {/* Tópico sugerido */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400">
                      Tópico verticalizado selecionado para este bloco:
                    </div>
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
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-0.5">
                      <span>💡 {block.reasonText}</span>
                      {heatItem && (
                        <span className="text-orange-400 font-mono text-[10px]">
                          • Urgência: {heatItem.heatScore}/10
                        </span>
                      )}
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

              {/* Sugestão de Intervalo entre blocos */}
              {idx === 0 && blocks.length > 1 && (
                <div className="flex items-center justify-center gap-2 py-1 text-slate-500 text-xs">
                  <div className="h-px bg-slate-800 w-16" />
                  <span className="flex items-center gap-1.5">
                    <Coffee size={13} className="text-amber-500" />
                    Intervalo sugerido de 10 minutos para fixação de memória
                  </span>
                  <div className="h-px bg-slate-800 w-16" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cartão de Resumo Semanal da Meta */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>
            Meta da Semana: <strong className="text-white">{plan.weekly_hours_target}h</strong> (
            {totalWeeklyMinutesBudget} min distribuídos entre as matérias)
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
    </div>
  );
}

