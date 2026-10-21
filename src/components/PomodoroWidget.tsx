import { useEffect, useState } from 'react';
import { Check, Clock, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

interface PomodoroWidgetProps {
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicCode: string | null;
  onSessionComplete: (params: {
    durationMinutes: number;
    pausesCount: number;
    wasSkipped: boolean;
  }) => void;
}

export function PomodoroWidget({
  subjectId,
  subjectName,
  topicId,
  topicCode,
  onSessionComplete,
}: PomodoroWidgetProps) {
  const [presetMinutes, setPresetMinutes] = useState<number>(50);
  const [secondsLeft, setSecondsLeft] = useState<number>(50 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [pausesCount, setPausesCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Reseta o contador se trocar o preset quando parado
  useEffect(() => {
    if (!isRunning) {
      setSecondsLeft(presetMinutes * 60);
    }
  }, [presetMinutes]);

  // Loop de 1 segundo
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsRunning(false);
          onSessionComplete({
            durationMinutes: presetMinutes,
            pausesCount,
            wasSkipped: false,
          });
          setFeedback(`+${presetMinutes} min gravados em ${subjectName}!`);
          setPausesCount(0);
          return presetMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, pausesCount, presetMinutes, subjectName, onSessionComplete]);

  // Limpa feedback após 4s
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const handleTogglePlay = () => {
    if (isRunning) {
      setIsRunning(false);
      setPausesCount((c) => c + 1);
    } else {
      setIsRunning(true);
    }
  };

  const handleFinishNow = () => {
    const elapsedMinutes = Math.max(1, Math.round((presetMinutes * 60 - secondsLeft) / 60));
    setIsRunning(false);
    onSessionComplete({
      durationMinutes: elapsedMinutes < 5 ? presetMinutes : elapsedMinutes,
      pausesCount,
      wasSkipped: false,
    });
    setFeedback(
      `Sessão concluída (${elapsedMinutes < 5 ? presetMinutes : elapsedMinutes}m) em Tópico ${topicCode || ''}!`
    );
    setSecondsLeft(presetMinutes * 60);
    setPausesCount(0);
  };

  const handleSkipBlock = () => {
    setIsRunning(false);
    onSessionComplete({
      durationMinutes: 0,
      pausesCount: pausesCount + 1,
      wasSkipped: true,
    });
    setFeedback('Bloco pulado (fricção registrada p/ ajuste futuro)');
    setSecondsLeft(presetMinutes * 60);
    setPausesCount(0);
  };

  // Mantém referência limpa se mudar subjectId/topicId
  void subjectId;
  void topicId;

  return (
    <div className="flex items-center gap-2">
      {feedback && (
        <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 animate-fade-in">
          ⏱️ {feedback}
        </span>
      )}

      <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
        <Clock size={14} className={isRunning ? 'text-orange-400 animate-pulse' : 'text-slate-400'} />

        <select
          value={presetMinutes}
          disabled={isRunning}
          onChange={(e) => setPresetMinutes(Number(e.target.value))}
          className="bg-transparent text-[11px] text-slate-400 hover:text-slate-200 outline-none cursor-pointer"
          title="Duração do bloco Pomodoro"
        >
          <option value={25} className="bg-slate-900">
            25m
          </option>
          <option value={45} className="bg-slate-900">
            45m
          </option>
          <option value={50} className="bg-slate-900">
            50m
          </option>
        </select>

        <span className="font-mono text-sm font-bold text-white tracking-wider">{formatted}</span>

        {pausesCount > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300"
            title="Pausas registradas nesta sessão (Medidor de Fricção Comportamental)"
          >
            {pausesCount}p
          </span>
        )}

        <button
          onClick={handleTogglePlay}
          className={`p-1.5 rounded-lg text-white transition ${
            isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-orange-500 hover:bg-orange-600'
          }`}
          title={isRunning ? 'Pausar Pomodoro' : 'Iniciar Pomodoro neste Tópico'}
        >
          {isRunning ? <Pause size={12} /> : <Play size={12} />}
        </button>

        <button
          onClick={handleFinishNow}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 transition"
          title="Concluir e gravar sessão de estudo no SQLite"
        >
          <Check size={12} />
        </button>

        <button
          onClick={handleSkipBlock}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition"
          title="Pular matéria agora (registra fricção leve)"
        >
          <SkipForward size={12} />
        </button>

        <button
          onClick={() => {
            setIsRunning(false);
            setSecondsLeft(presetMinutes * 60);
            setPausesCount(0);
          }}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Reiniciar relógio"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
}
