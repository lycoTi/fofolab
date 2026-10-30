import { Clock, Pause, Play } from 'lucide-react';
import { MetricExplainer } from '../../components/MetricExplainer';
import { useQuestionPacingTimer } from './useQuestionPacingTimer';

export interface QuestionPacingTimerProps {
  questionId: string;
  locked: boolean;
  frozenSeconds?: number | null;
  blockRunning?: boolean;
}

/**
 * Componente do Cronômetro Discreto de Ritmo de Prova (Time Pacing):
 * Exibe contagem progressiva em mm:ss, controle tátil play/pause,
 * detecção de presença (aba oculta e inatividade) e explicabilidade integrada.
 */
export function QuestionPacingTimer(props: QuestionPacingTimerProps) {
  const { questionId, locked, frozenSeconds, blockRunning } = props;
  const timer = useQuestionPacingTimer({
    questionId,
    locked,
    frozenSeconds,
    blockRunning,
  });

  const showWaitingBlock = !locked && timer.isWaitingBlock;
  const showIdle = !locked && timer.isIdle;
  const showTabHidden = !locked && timer.isTabHidden && !timer.isIdle;
  const showManualPause = !locked && timer.isPaused && !timer.isIdle && !timer.isTabHidden && !timer.isWaitingBlock;

  let buttonTitle = timer.tooltip;
  if (!locked) {
    buttonTitle = timer.isRunning
      ? 'Pausar cronômetro da questão'
      : showWaitingBlock
        ? 'Iniciar cronômetro para esta questão (ou inicie um bloco de foco)'
        : 'Retomar cronômetro da questão';
  }

  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums font-medium">
      <button
        type="button"
        disabled={locked}
        onClick={timer.togglePlayPause}
        aria-label={timer.ariaLabel}
        title={buttonTitle}
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-all duration-150 ${
          locked
            ? `${timer.toneClass} cursor-default`
            : timer.isRunning
              ? `${timer.toneClass} hover:bg-white/[0.08] active:scale-[0.96]`
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] active:scale-[0.96]'
        }`}
      >
        {locked ? (
          <Clock size={12} className="shrink-0 opacity-80" />
        ) : timer.isRunning ? (
          <Pause size={12} className="shrink-0 opacity-80" />
        ) : (
          <Play size={12} className="shrink-0 opacity-80" />
        )}
        <span>{timer.formatted}</span>
      </button>

      {/* Rótulo de status de pausa discreto */}
      {showIdle && (
        <span className="text-[10px] text-amber-400/90 font-sans font-normal" title="Pausado por ausência de interação">
          (ausente)
        </span>
      )}
      {showTabHidden && (
        <span className="text-[10px] text-slate-500 font-sans font-normal" title="Pausado em segundo plano">
          (em espera)
        </span>
      )}
      {showManualPause && (
        <span className="text-[10px] text-amber-400/90 font-sans font-normal" title="Pausado manualmente">
          (pausado)
        </span>
      )}
      {showWaitingBlock && (
        <span className="text-[10px] text-slate-500 font-sans font-normal" title="Aguardando bloco de foco ou play manual">
          (livre)
        </span>
      )}

      {/* Explicabilidade para o estudante leigo / novato */}
      <MetricExplainer
        explanation={{
          title: 'Ritmo de Prova (Time Pacing)',
          humanSummary:
            'Cronometra o tempo de resolução desta questão individual para você treinar velocidade e ritmo de prova sem pressão desnecessária.',
          bulletPoints: [
            'Meta recomendada para alto rendimento: ~2 a 3 minutos por item.',
            'Inicia automaticamente quando você começa um bloco de foco (ou manualmente pelo botão de play).',
            'Pausa automaticamente se você mudar de aba, suspender o computador ou ficar 60s ausente.',
            'Não consome horas do seu ciclo e não penaliza seu plano de estudos.',
          ],
        }}
      />
    </div>
  );
}
