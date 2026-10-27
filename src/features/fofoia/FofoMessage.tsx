import { useState } from 'react';
import { BookPlus, CheckCircle2, RotateCcw } from 'lucide-react';
import { RichText, revealDelayMs } from '../../components/RichText';
import { MODE_BADGE } from '../../lib/fofoia/signals';
import { formatSummaryForNotebook } from '../../lib/fofoia/summary';
import type { FofoTurn } from './useFofoConversation';

const action = 'rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:border-orange-500/50 hover:text-white';

/** Uma fala da conversa: o selinho do jeito, o texto (sempre por RichText) e as ações que cabem naquele jeito. */
export function FofoMessage({
  turn,
  topicLabel,
  aiConfigured,
  onContinue,
  onResume,
  onAnotherHint,
  onLesson,
  onSummary,
  onSaveSummary,
  onRetry,
  reveal = false,
}: {
  turn: FofoTurn;
  /** Resposta que acabou de chegar: surge por parágrafo. */
  reveal?: boolean;
  topicLabel: string;
  aiConfigured: boolean;
  /** Próxima parte da aula e o total anunciado (vai no pedido, para a IA não renumerar). */
  onContinue: (part: number, total: number) => void;
  /** Resposta cortada no teto de tamanho: pede o resto. */
  onResume: () => void;
  onAnotherHint: () => void;
  onLesson: () => void;
  onSummary: () => void;
  onSaveSummary: (markdown: string) => void;
  onRetry: () => void;
}) {
  const [saved, setSaved] = useState(false);

  if (turn.role === 'notice') {
    return <p className="fofolab-enter text-center text-[11px] text-slate-500">{turn.content}</p>;
  }
  if (turn.role === 'student') {
    return <p className="fofolab-enter ml-8 rounded-xl bg-orange-500/15 px-3 py-2 text-xs text-orange-50">{turn.content}</p>;
  }
  if (turn.failed) {
    return (
      <div className="fofolab-enter space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
        <p>{turn.content}</p>
        <button type="button" onClick={onRetry} className={`${action} flex items-center gap-1`}>
          <RotateCcw size={11} />
          Tentar de novo
        </button>
      </div>
    );
  }

  const summaryText = turn.summary ? formatSummaryForNotebook(turn.summary) : null;
  const text = summaryText ?? turn.content;
  const part = turn.part;
  // Botões e o convite para a aula entram depois do último parágrafo
  const lineCount = text.split('\n').filter((l) => l.trim()).length;
  const after = reveal ? { className: 'fofolab-reveal', style: { animationDelay: `${revealDelayMs(lineCount, lineCount + 1)}ms` } } : { className: '', style: undefined };
  return (
    <div className="fofolab-enter space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {turn.mode && <span className="rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-200">{MODE_BADGE[turn.mode]}</span>}
        {turn.simulated && <span className="text-[10px] text-slate-500">Exemplo simulado — a IA ainda não está configurada</span>}
      </div>
      <RichText text={text} reveal={reveal} className="text-xs leading-relaxed text-slate-200" />
      {turn.mode === 'SUMMARY' && !turn.summary && (
        <p className="text-[11px] text-amber-300">Não consegui montar o resumo no formato de revisão. Tente de novo.</p>
      )}
      {turn.suggestLesson && (
        <p style={after.style} className={`${after.className} flex flex-wrap items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-[11px] text-blue-100`}>
          {`Parece que vale a aula completa sobre ${topicLabel}.`}
          <button type="button" onClick={onLesson} className="font-semibold text-blue-200 underline-offset-2 hover:underline">
            Ver a aula
          </button>
        </p>
      )}
      <div style={after.style} className={`${after.className} flex flex-wrap gap-1.5`}>
        {turn.cut && (
          <button type="button" onClick={onResume} className={action}>
            Continuar de onde parou
          </button>
        )}
        {!turn.cut && part && part.n < part.total && (
          <button type="button" onClick={() => onContinue(part.n + 1, part.total)} className={action}>
            {`Continuar (Parte ${part.n + 1} de ${part.total})`}
          </button>
        )}
        {turn.mode === 'HINT' && (
          <button type="button" onClick={onAnotherHint} className={action}>
            Outra pista
          </button>
        )}
        {turn.mode && turn.mode !== 'SUMMARY' && turn.mode !== 'HINT' && turn.mode !== 'EDITAL' && (
          <button type="button" onClick={onSummary} className={action}>
            Salvar resumo de revisão
          </button>
        )}
        {summaryText && (
          <button
            type="button"
            disabled={!aiConfigured || turn.simulated || saved}
            title={turn.simulated ? 'Resumo de exemplo não vai para o caderno' : undefined}
            onClick={() => {
              onSaveSummary(summaryText);
              setSaved(true);
            }}
            className={`${action} flex items-center gap-1 disabled:opacity-40`}
          >
            {saved ? <CheckCircle2 size={11} className="text-emerald-400" /> : <BookPlus size={11} />}
            {saved ? 'Salvo no caderno' : 'Salvar no caderno'}
          </button>
        )}
      </div>
    </div>
  );
}
