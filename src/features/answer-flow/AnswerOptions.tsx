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
  return (
    <div className={certoErrado ? 'flex gap-2' : 'space-y-1.5'}>
      {options.map((o) => {
        let tone = 'border-slate-700 bg-slate-950/60 text-slate-200 hover:border-orange-500/50';
        if (picked && o.key === correct?.key) tone = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100';
        else if (picked === o.key) tone = 'border-rose-500/60 bg-rose-500/10 text-rose-100';
        return (
          <button
            key={o.key}
            type="button"
            disabled={picked !== null}
            onClick={() => onPick(o.key)}
            className={`block w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors duration-150 disabled:cursor-default ${tone}`}
          >
            {optionName(o, certoErrado)}
          </button>
        );
      })}
    </div>
  );
}
