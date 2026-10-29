import { Strikethrough } from 'lucide-react';
import { findCorrectOption, type QuestionOption } from '../../lib/questionOptions';

/** Certo/Errado mostra só a palavra; múltipla escolha mostra a letra com o texto. */
export function optionName(option: QuestionOption, isCertoErrado: boolean): string {
  return isCertoErrado ? option.text : option.label;
}

export function isCertoErradoOptions(options: QuestionOption[]): boolean {
  return options.length === 2 && options.every((o) => o.key === 'C' || o.key === 'E');
}

/**
 * Alternativas de uma questão. Depois de responder, a certa fica verde e a escolhida errada vermelha, e a resposta trava
 * (a primeira escolha vale: depois de ver o gabarito não dá para "corrigir").
 * Em múltipla escolha, permite riscar/descartar distratores antes de responder para aliviar a carga cognitiva.
 */
export function AnswerOptions({
  options,
  finalAnswer,
  picked,
  eliminated = [],
  onToggleEliminate,
  onPick,
}: {
  options: QuestionOption[];
  finalAnswer: string;
  picked: string | null;
  eliminated?: string[];
  onToggleEliminate?: (key: string) => void;
  onPick: (key: string) => void;
}) {
  const certoErrado = isCertoErradoOptions(options);
  const correct = findCorrectOption(options, finalAnswer);

  if (certoErrado) {
    return (
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {options.map((o) => {
          let tone =
            'border-slate-800/80 bg-slate-900/40 text-slate-200 hover:border-[var(--fofo-accent)]/50 hover:bg-slate-800/50';
          if (picked && o.key === correct?.key) {
            tone = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-100 font-semibold shadow-sm';
          } else if (picked === o.key) {
            tone = 'border-rose-500/60 bg-rose-500/15 text-rose-100 font-semibold shadow-sm';
          }
          return (
            <button
              key={o.key}
              type="button"
              disabled={picked !== null}
              onClick={() => onPick(o.key)}
              className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border px-5 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-default ${tone}`}
            >
              <span>{optionName(o, true)}</span>
              <kbd aria-hidden="true" className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs font-mono text-slate-400">
                {o.key}
              </kbd>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      {options.map((o) => {
        const isEliminated = eliminated.includes(o.key);
        let tone =
          'border-slate-800/80 bg-slate-900/30 text-slate-200 hover:border-[var(--fofo-accent)]/50 hover:bg-slate-800/50';
        if (picked && o.key === correct?.key) {
          tone = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-100 font-semibold shadow-sm';
        } else if (picked === o.key) {
          tone = 'border-rose-500/60 bg-rose-500/15 text-rose-100 font-semibold shadow-sm';
        } else if (isEliminated) {
          tone = 'line-through opacity-40 text-slate-500 border-slate-900/80 bg-slate-950/30';
        }

        return (
          <div key={o.key} className="group relative flex items-center">
            <button
              type="button"
              disabled={picked !== null}
              onClick={() => onPick(o.key)}
              className={`block w-full rounded-xl border p-3.5 pr-11 text-left text-xs sm:text-sm leading-relaxed transition-all duration-150 active:scale-[0.99] disabled:cursor-default ${tone}`}
            >
              {optionName(o, false)}
            </button>
            {!picked && onToggleEliminate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEliminate(o.key);
                }}
                title={
                  isEliminated
                    ? `Restaurar alternativa ${o.key} (Alt+${o.key})`
                    : `Descartar alternativa ${o.key} (Alt+${o.key})`
                }
                aria-label={
                  isEliminated
                    ? `Restaurar alternativa ${o.key}`
                    : `Descartar alternativa ${o.key}`
                }
                className={`absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-150 ${
                  isEliminated
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 opacity-100 hover:bg-rose-500/20'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 opacity-40 sm:opacity-0 sm:group-hover:opacity-100 hover:border-white/[0.2] hover:text-white'
                }`}
              >
                <Strikethrough size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
