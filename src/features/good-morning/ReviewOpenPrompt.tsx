import { useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { RichText } from '../../components/RichText';
import type { RecallRating } from '../../types/database';

const RATINGS: { id: RecallRating; label: string }[] = [
  { id: 'GOOD', label: 'Lembrei bem' },
  { id: 'PARTIAL', label: 'Lembrei em parte' },
  { id: 'FORGOT', label: 'Não lembrei' },
];

/**
 * Tópico sem questão no app: tentar lembrar antes de reler (recordação ativa fixa mais que só reler), depois conferir
 * nas próprias anotações e se avaliar. O que o estudante escreve fica só na tela — não há correção para guardar.
 */
export function ReviewOpenPrompt({
  topicLabel,
  notebookExcerpt,
  onRate,
}: {
  topicLabel: string;
  notebookExcerpt: string | null;
  onRate: (rating: RecallRating, secondsSpent: number) => void;
}) {
  const shownAt = useRef(Date.now());
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-100">{`O que você lembra de ${topicLabel}?`}</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        aria-label="Escreva o que você lembra (fica só na tela)"
        placeholder="Escreva do seu jeito, sem consultar nada."
        className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-orange-500"
      />
      {!revealed && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-orange-500/60"
        >
          <BookOpen size={13} />
          Ver minhas anotações
        </button>
      )}
      {revealed && (
        <div className="space-y-3">
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            {notebookExcerpt ? (
              <RichText text={notebookExcerpt} className="text-xs leading-relaxed text-slate-200" />
            ) : (
              <p className="text-xs text-slate-400">Você ainda não tem anotações deste tópico.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-400">Comparando com as anotações:</p>
            <div className="flex flex-wrap gap-1.5">
              {RATINGS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onRate(r.id, Math.round((Date.now() - shownAt.current) / 1000))}
                  className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors duration-150 hover:border-orange-500/60"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
