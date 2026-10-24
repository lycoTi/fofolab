import { useState } from 'react';

/**
 * Antes da aula num tópico nunca tentado: um palpite rápido (prever antes de ler fixa mais — efeito do pré-teste) e, se o
 * tópico tem questões, o convite a tentar 3 antes. Nunca bloqueia: "Ver a aula agora" segue na hora.
 */
export function WarmupInvite({
  topicLabel,
  hasQuestions,
  onTryQuestions,
  onLesson,
}: {
  topicLabel: string;
  hasQuestions: boolean;
  onTryQuestions: () => void;
  onLesson: (guess: string) => void;
}) {
  const [guess, setGuess] = useState('');
  return (
    <div className="fofolab-enter space-y-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-50">
      <p className="font-semibold">Antes da aula: um palpite rápido</p>
      <p className="text-blue-100">{`Em uma frase, o que você acha que é ${topicLabel}? Errar o palpite também ajuda a fixar.`}</p>
      <input
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        aria-label="Seu palpite (fica só na conversa)"
        placeholder="Pode chutar"
        className="w-full rounded-lg border border-blue-500/30 bg-slate-950/60 px-2.5 py-1.5 text-xs text-white outline-none focus:border-orange-500"
      />
      <div className="flex flex-wrap gap-1.5">
        {hasQuestions && (
          <button type="button" onClick={onTryQuestions} className="rounded-lg border border-blue-400/50 px-2.5 py-1 font-semibold text-blue-100 hover:bg-blue-500/20">
            Tentar 3 questões antes da aula
          </button>
        )}
        <button type="button" onClick={() => onLesson(guess)} className="rounded-lg bg-orange-500 px-2.5 py-1 font-semibold text-white hover:bg-orange-400">
          Ver a aula agora
        </button>
      </div>
    </div>
  );
}
