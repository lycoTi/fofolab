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
 */
export function AnswerOptions({
  options,
  finalAnswer,
  picked,
  onPick,
}: {
  options: QuestionOption[];
  finalAnswer: string;
  picked: string | null;
  onPick: (key: string) => void;
}) {
  const certoErrado = isCertoErradoOptions(options);
  const correct = findCorrectOption(options, finalAnswer);

  if (certoErrado) {
    return (
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {options.map((o) => {
          let tone =
            'border-white/[0.08] bg-white/[0.02] text-slate-200 hover:border-[var(--fofo-accent)]/50 hover:bg-white/[0.04]';
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
              className={`flex-1 flex items-center justify-center h-11 rounded-xl border px-5 text-sm font-medium transition-all duration-150 disabled:cursor-default ${tone}`}
            >
              {optionName(o, true)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      {options.map((o) => {
        let tone =
          'border-white/[0.08] bg-white/[0.02] text-slate-200 hover:border-[var(--fofo-accent)]/50 hover:bg-white/[0.04]';
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
            className={`block w-full rounded-xl border p-3.5 text-left text-xs sm:text-sm leading-relaxed transition-all duration-150 disabled:cursor-default ${tone}`}
          >
            {optionName(o, false)}
          </button>
        );
      })}
    </div>
  );
}
