import { CheckCircle2, ClipboardList, RotateCcw } from 'lucide-react';
import type { RecallRating, ReviewItem } from '../../types/database';
import { ReviewOpenPrompt } from './ReviewOpenPrompt';
import { ReviewQuestion, type ReviewQuestionResult } from './ReviewQuestion';
import type { CurrentReview } from './useDailyReview';

export interface DailyReviewCardProps {
  enabled: boolean;
  items: ReviewItem[];
  doneCount: number;
  skipped: boolean;
  current: CurrentReview | null;
  onAnswer: (result: ReviewQuestionResult) => void;
  onRate: (rating: RecallRating, secondsSpent: number) => void;
  onSkip: () => void;
  /** "Fiz questões fora do app": abre o registro rápido da coluna com o tópico. */
  onOutside: (topicId: string) => void;
}

const REASON: Record<ReviewItem['reason'], string> = {
  LAST_DAY: 'Você estudou este tópico no último dia de estudo.',
  COOLING: 'Faz um tempo que você viu este tópico: boa hora de puxar da memória.',
};

const frame = 'space-y-3.5';

/** Revisão do dia no topo do "Início" (spec 09 §5.3): um item por vez, sem penalidade para pular. */
export function DailyReviewCard(props: DailyReviewCardProps) {
  const { enabled, items, doneCount, skipped, current } = props;
  if (!enabled || items.length === 0) return null;

  if (skipped) {
    return (
      <section aria-label="Revisão do dia" className="py-2">
        <p className="text-xs text-slate-400">Revisão de hoje pulada. Os tópicos voltam amanhã.</p>
      </section>
    );
  }

  if (!current) {
    return (
      <section aria-label="Revisão do dia" className="py-2">
        <p className="fofolab-enter flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
          <CheckCircle2 size={15} />
          {`Revisão de hoje feita: ${doneCount} ${doneCount === 1 ? 'tópico revisado' : 'tópicos revisados'}.`}
        </p>
      </section>
    );
  }

  const position = Math.min(items.length, doneCount + 1);
  return (
    <section aria-label="Revisão do dia" className={frame}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/60 pb-2.5">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <RotateCcw size={15} className="text-orange-400" />
            {`Revisão do dia · ${position} de ${items.length}`}
          </h2>
          <p className="text-xs text-slate-400">{REASON[current.item.reason]}</p>
        </div>
        <button type="button" onClick={props.onSkip} className="shrink-0 text-xs text-slate-400 hover:text-slate-200">
          Pular a revisão de hoje
        </button>
      </div>

      <p className="text-xs font-medium text-orange-200">{`${current.subjectName} · ${current.topicLabel}`}</p>

      {current.question ? (
        <ReviewQuestion key={current.item.topicId} question={current.question.question} dissection={current.question.dissection} onSubmit={props.onAnswer} />
      ) : (
        <ReviewOpenPrompt key={current.item.topicId} topicLabel={current.topicLabel} notebookExcerpt={current.notebookExcerpt} onRate={props.onRate} />
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={() => props.onOutside(current.item.topicId)}
          className="flex items-center gap-1.5 text-xs font-medium text-orange-400 transition-all duration-100 hover:text-orange-300 active:scale-[0.98]"
        >
          <ClipboardList size={13} />
          Fiz questões fora do app
        </button>
      </div>
    </section>
  );
}
