import { useState } from 'react';
import { ArrowRight, Flame } from 'lucide-react';
import { MetricExplainer } from '../../components/MetricExplainer';
import type { CycleCalculationResult, TopicHeatItem } from '../../lib/cycleEngine';
import { explainTopicHeat } from '../../lib/explainabilityEngine';
import type { ExamPart } from '../../types/database';
import { groupAllocations } from '../cycle/cycleGroups';

/** Escala do calor (0,5 a 10) em 5 faixas, do frio ao muito quente. */
export const HEAT_LEVELS = [
  { max: 2, label: 'Frio', className: 'bg-slate-700' },
  { max: 3.5, label: 'Morno', className: 'bg-amber-900' },
  { max: 5, label: 'Atenção', className: 'bg-amber-600' },
  { max: 6.5, label: 'Quente', className: 'bg-orange-500' },
  { max: Infinity, label: 'Muito quente', className: 'bg-red-500' },
] as const;

export function heatLevel(heatScore: number) {
  return HEAT_LEVELS.find((level) => heatScore < level.max) ?? HEAT_LEVELS[HEAT_LEVELS.length - 1];
}

/** "2.10" depois de "2.9": compara o código do tópico parte a parte. */
function compareCodes(a: string | null, b: string | null): number {
  const pa = (a ?? '').split('.').map(Number);
  const pb = (b ?? '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

function describeLastStudy(days: number | null): string {
  if (days === null) return 'ainda não estudado';
  if (days === 0) return 'visto hoje';
  return days === 1 ? 'visto ontem' : `visto há ${days} dias`;
}

function TopicDetail({ item, onJump }: { item: TopicHeatItem; onJump: () => void }) {
  const level = heatLevel(item.heatScore);
  return (
    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <div className="text-[11px]" style={{ color: item.subjectColor }}>
          {item.subjectName}
        </div>
        <div className="text-sm font-semibold text-white">
          {item.topic.code} {item.topic.title}
        </div>
        <div className="text-[11px] text-slate-400">
          <span className={`inline-block h-2 w-2 rounded-sm mr-1 ${level.className}`} />
          {level.label} ({item.heatScore}) • Domínio {item.topic.mastery_score}% • {item.attemptsCount}{' '}
          {item.attemptsCount === 1 ? 'questão' : 'questões'}
          {` • ${describeLastStudy(item.daysSinceLastStudy)}`}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <MetricExplainer explanation={explainTopicHeat(item)} />
        <button
          type="button"
          onClick={onJump}
          className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          Estudar este tópico
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

/**
 * Mapa de Calor de verdade: uma linha por matéria (na ordem da prova), um quadradinho por tópico.
 * Passar o mouse ou focar mostra o tópico; clicar fixa o detalhe com o botão de estudar.
 */
export function TopicHeatGrid({
  cycleData,
  examParts,
  onJumpToTopic,
}: {
  cycleData: CycleCalculationResult;
  examParts: ExamPart[];
  onJumpToTopic: (subjectId: string, topicId: string) => void;
}) {
  const ranking = cycleData.topicHeatmapRanking;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const shown = ranking.find((t) => t.topic.id === (previewId ?? selectedId)) ?? ranking[0] ?? null;
  const groups = groupAllocations(cycleData.allocations, examParts);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Flame size={16} className="text-orange-400" />
          Mapa de Calor dos tópicos
        </h2>
        <p className="text-xs text-slate-400">
          Quanto mais quente, mais o tópico precisa de você agora: pouco domínio, erros recentes, risco de esquecer e peso
          da matéria na prova.
        </p>
      </div>

      {shown && <TopicDetail item={shown} onJump={() => onJumpToTopic(shown.topic.subject_id, shown.topic.id)} />}

      {groups.map((group) => (
        <section key={group.key} aria-label={group.title} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
          <h3 className="text-xs font-bold text-slate-300">{group.title}</h3>
          {group.allocations.map(({ subject }) => {
            const topics = ranking
              .filter((t) => t.topic.subject_id === subject.id)
              .sort((a, b) => compareCodes(a.topic.code, b.topic.code));
            return (
              <div key={subject.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,16rem)_1fr] gap-x-4 gap-y-1 items-center">
                <span className="text-[11px] text-slate-300 leading-tight" title={subject.name}>
                  {subject.name}
                </span>
                <div className="flex flex-wrap gap-1" onMouseLeave={() => setPreviewId(null)}>
                  {topics.map((item) => {
                    const level = heatLevel(item.heatScore);
                    const selected = item.topic.id === (selectedId ?? shown?.topic.id);
                    return (
                      <button
                        key={item.topic.id}
                        type="button"
                        aria-label={`${item.topic.code} ${item.topic.title}: ${level.label}`}
                        aria-pressed={selected}
                        title={`${item.topic.code} ${item.topic.title}`}
                        onMouseEnter={() => setPreviewId(item.topic.id)}
                        onFocus={() => setPreviewId(item.topic.id)}
                        onBlur={() => setPreviewId(null)}
                        onClick={() => setSelectedId(item.topic.id)}
                        className={`h-5 w-5 rounded-[4px] transition hover:scale-125 ${level.className} ${
                          selected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''
                        }`}
                      />
                    );
                  })}
                  {topics.length === 0 && <span className="text-[11px] text-slate-500">sem tópicos</span>}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400" aria-label="Legenda do calor">
        {HEAT_LEVELS.map((level) => (
          <span key={level.label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-[3px] ${level.className}`} />
            {level.label}
          </span>
        ))}
      </div>
    </div>
  );
}
