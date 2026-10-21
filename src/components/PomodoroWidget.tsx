import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

export interface PomodoroSessionResult {
  subjectId: string;
  topicId: string | null;
  durationMinutes: number;
  pausesCount: number;
  wasSkipped: boolean;
}

interface PomodoroWidgetProps {
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicCode: string | null;
  onSessionComplete: (result: PomodoroSessionResult) => void;
  /** Pedido para ajustar a duração (ex: bloco do "Meu Dia"); só vale com o relógio parado. */
  presetRequest?: { minutes: number; nonce: number } | null;
}

type TimerMode = 'idle' | 'running' | 'paused';

interface SessionContext {
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicCode: string | null;
}

const TICK_MS = 500;
const MINUTE_MS = 60_000;

/**
 * Pomodoro baseado no relógio real (horário de término), não em contagem de "ticks":
 * - não para quando o restante da tela re-renderiza (ex: digitar no caderno);
 * - não atrasa com a janela minimizada (o navegador desacelera timers em segundo plano);
 * - a sessão fica com a matéria/tópico em que foi INICIADA, mesmo se você navegar.
 */
export function PomodoroWidget({
  subjectId,
  subjectName,
  topicId,
  topicCode,
  onSessionComplete,
  presetRequest = null,
}: PomodoroWidgetProps) {
  const [presetMinutes, setPresetMinutes] = useState<number>(50);
  const [mode, setMode] = useState<TimerMode>('idle');
  const [remainingMs, setRemainingMs] = useState<number>(50 * MINUTE_MS);
  const [pausesCount, setPausesCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const endsAtRef = useRef<number | null>(null);
  const focusedMsRef = useRef<number>(0);
  const resumedAtRef = useRef<number | null>(null);
  const sessionRef = useRef<SessionContext | null>(null);
  const onCompleteRef = useRef(onSessionComplete);

  useEffect(() => {
    onCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  useEffect(() => {
    if (!presetRequest || mode !== 'idle') return;
    const minutes = Math.max(5, Math.min(180, Math.round(presetRequest.minutes)));
    setPresetMinutes(minutes);
    setRemainingMs(minutes * MINUTE_MS);
    // Só reage a um NOVO pedido (nonce), não a cada mudança de modo
  }, [presetRequest?.nonce]);

  const resetTimer = useCallback(
    (minutes: number) => {
      setMode('idle');
      setRemainingMs(minutes * MINUTE_MS);
      setPausesCount(0);
      endsAtRef.current = null;
      resumedAtRef.current = null;
      focusedMsRef.current = 0;
      sessionRef.current = null;
    },
    []
  );

  /** Tempo efetivamente focado (pausas não contam). */
  const takeFocusedMs = useCallback((now: number) => {
    if (resumedAtRef.current !== null) {
      focusedMsRef.current += now - resumedAtRef.current;
      resumedAtRef.current = null;
    }
    return focusedMsRef.current;
  }, []);

  const finishSession = useCallback(
    (params: { durationMinutes: number; wasSkipped: boolean; message: string }) => {
      const session = sessionRef.current;
      if (session) {
        onCompleteRef.current({
          subjectId: session.subjectId,
          topicId: session.topicId,
          durationMinutes: params.durationMinutes,
          pausesCount: pausesCount + (params.wasSkipped ? 1 : 0),
          wasSkipped: params.wasSkipped,
        });
      }
      setFeedback(params.message);
      resetTimer(presetMinutes);
    },
    [pausesCount, presetMinutes, resetTimer]
  );

  // Contagem: recalcula pelo horário de término a cada meio segundo
  useEffect(() => {
    if (mode !== 'running') return;
    const timer = window.setInterval(() => {
      if (endsAtRef.current === null) return;
      setRemainingMs(Math.max(0, endsAtRef.current - Date.now()));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [mode]);

  // Fim natural do bloco (fora do setState: sem efeitos colaterais duplicados no StrictMode)
  useEffect(() => {
    if (mode !== 'running' || remainingMs > 0) return;
    takeFocusedMs(Date.now());
    const session = sessionRef.current;
    finishSession({
      durationMinutes: presetMinutes,
      wasSkipped: false,
      message: `+${presetMinutes} min gravados em ${session?.subjectName ?? subjectName}!`,
    });
  }, [mode, remainingMs, presetMinutes, subjectName, finishSession, takeFocusedMs]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const handleChangePreset = (minutes: number) => {
    setPresetMinutes(minutes);
    if (mode === 'idle') setRemainingMs(minutes * MINUTE_MS);
  };

  const handleTogglePlay = () => {
    const now = Date.now();
    if (mode === 'running') {
      takeFocusedMs(now);
      setRemainingMs(Math.max(0, (endsAtRef.current ?? now) - now));
      endsAtRef.current = null;
      setPausesCount((c) => c + 1);
      setMode('paused');
      return;
    }
    if (mode === 'idle') {
      sessionRef.current = { subjectId, subjectName, topicId, topicCode };
      focusedMsRef.current = 0;
    }
    endsAtRef.current = now + remainingMs;
    resumedAtRef.current = now;
    setMode('running');
  };

  const handleFinishNow = () => {
    if (mode === 'idle') return;
    const focusedMinutes = Math.floor(takeFocusedMs(Date.now()) / MINUTE_MS);
    if (focusedMinutes < 1) {
      setFeedback('Sessão com menos de 1 minuto — não foi registrada.');
      resetTimer(presetMinutes);
      return;
    }
    const code = sessionRef.current?.topicCode;
    finishSession({
      durationMinutes: focusedMinutes,
      wasSkipped: false,
      message: `Sessão concluída (${focusedMinutes} min)${code ? ` no tópico ${code}` : ''}!`,
    });
  };

  const handleSkipBlock = () => {
    if (mode === 'idle') {
      sessionRef.current = { subjectId, subjectName, topicId, topicCode };
    }
    const focusedMinutes = Math.floor(takeFocusedMs(Date.now()) / MINUTE_MS);
    finishSession({
      durationMinutes: focusedMinutes,
      wasSkipped: true,
      message: 'Bloco pulado (atrito registrado para ajustar o próximo ciclo)',
    });
  };

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const formatted = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
  const activeTopicCode = mode === 'idle' ? null : sessionRef.current?.topicCode;

  return (
    <div className="flex items-center gap-2">
      {feedback && (
        <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 animate-fade-in">
          ⏱️ {feedback}
        </span>
      )}

      <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
        <Clock size={14} className={mode === 'running' ? 'text-orange-400 animate-pulse' : 'text-slate-400'} />

        <select
          value={presetMinutes}
          disabled={mode !== 'idle'}
          onChange={(e) => handleChangePreset(Number(e.target.value))}
          aria-label="Duração do bloco Pomodoro"
          className="bg-transparent text-[11px] text-slate-400 hover:text-slate-200 outline-none cursor-pointer"
          title="Duração do bloco Pomodoro"
        >
          {[...new Set([25, 45, 50, presetMinutes])].sort((a, b) => a - b).map((minutes) => (
            <option key={minutes} value={minutes} className="bg-slate-900">
              {minutes}m
            </option>
          ))}
        </select>

        <span className="font-mono text-sm font-bold text-white tracking-wider" aria-label="Tempo restante">
          {formatted}
        </span>

        {activeTopicCode && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300" title="Tópico desta sessão">
            {activeTopicCode}
          </span>
        )}

        {pausesCount > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300"
            title="Pausas registradas nesta sessão (medidor de atrito)"
          >
            {pausesCount}p
          </span>
        )}

        <button
          type="button"
          onClick={handleTogglePlay}
          className={`p-1.5 rounded-lg text-white transition ${
            mode === 'running' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-orange-500 hover:bg-orange-600'
          }`}
          title={mode === 'running' ? 'Pausar Pomodoro' : 'Iniciar Pomodoro neste Tópico'}
          aria-label={mode === 'running' ? 'Pausar Pomodoro' : 'Iniciar Pomodoro'}
        >
          {mode === 'running' ? <Pause size={12} /> : <Play size={12} />}
        </button>

        <button
          type="button"
          onClick={handleFinishNow}
          disabled={mode === 'idle'}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 disabled:opacity-40 transition"
          title="Concluir agora e registrar o tempo estudado"
          aria-label="Concluir sessão"
        >
          <Check size={12} />
        </button>

        <button
          type="button"
          onClick={handleSkipBlock}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition"
          title="Pular matéria agora (registra atrito leve)"
          aria-label="Pular bloco"
        >
          <SkipForward size={12} />
        </button>

        <button
          type="button"
          onClick={() => resetTimer(presetMinutes)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Reiniciar relógio (não registra nada)"
          aria-label="Reiniciar relógio"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
}
