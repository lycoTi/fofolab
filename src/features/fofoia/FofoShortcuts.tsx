import type { FofoActiveQuestion } from './FofoIaPanel';
import type { FofoMode } from '../../lib/fofoia/signals';

const shortcut =
  'rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] font-medium text-slate-300 ' +
  'transition-all duration-100 hover:border-slate-700 hover:bg-slate-800/60 hover:text-white active:scale-[0.97]';

export interface FofoShortcutsProps {
  unanswered: boolean;
  activeQuestion: FofoActiveQuestion | null;
  topicLabel: string;
  talked: boolean;
  onHint: () => void;
  onLesson: () => void;
  onSend: (message: string, mode?: FofoMode) => void;
}

/**
 * Atalhos contextuais da FofoIA: adaptados ao momento pedagógico do estudante
 * (questão em aberto, questão errada, questão acertada, ou estudo livre do tópico).
 */
export function FofoShortcuts({
  unanswered,
  activeQuestion,
  topicLabel,
  talked,
  onHint,
  onLesson,
  onSend,
}: FofoShortcutsProps) {
  if (unanswered) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={onHint} className={shortcut}>
          Pedir pista
        </button>
        <button
          type="button"
          onClick={() => onSend(`Qual é o conceito-base que esta questão exige de ${topicLabel}?`, 'FROM_ZERO')}
          className={shortcut}
        >
          Conceito-base
        </button>
      </div>
    );
  }

  if (activeQuestion?.answered) {
    const isError = activeQuestion.attempt?.isCorrect === false;
    return (
      <div className="flex flex-wrap gap-1.5">
        {isError ? (
          <button
            type="button"
            onClick={() =>
              onSend(
                activeQuestion.attempt?.selectedOption
                  ? `Por que errei ao marcar a alternativa ${activeQuestion.attempt.selectedOption}? Por que o gabarito oficial é ${activeQuestion.question.final_answer}?`
                  : `Por que errei esta questão e por que o gabarito oficial é ${activeQuestion.question.final_answer}?`,
              )
            }
            className={`${shortcut} border-orange-500/40 text-orange-200`}
          >
            Por que errei?
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onSend(
                `Por que o gabarito oficial é ${activeQuestion.question.final_answer} e quais são os erros das outras alternativas?`,
              )
            }
            className={shortcut}
          >
            Destrinchar alternativas
          </button>
        )}
        <button type="button" onClick={onLesson} className={shortcut}>
          Aula completa
        </button>
        <button
          type="button"
          onClick={() =>
            onSend(
              talked
                ? `Resumo de revisão do que conversamos (tópico ${topicLabel}).`
                : `Resumo de revisão de ${topicLabel}`,
              'SUMMARY',
            )
          }
          className={shortcut}
        >
          Salvar resumo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={onLesson} className={shortcut}>
        Aula completa
      </button>
      <button
        type="button"
        onClick={() => onSend(`Me explica ${topicLabel} do zero com uma metáfora simples.`, 'FROM_ZERO')}
        className={shortcut}
      >
        Do zero
      </button>
      <button
        type="button"
        onClick={() => onSend(`Resumo de revisão de ${topicLabel}`, 'SUMMARY')}
        className={shortcut}
      >
        Salvar resumo
      </button>
    </div>
  );
}

