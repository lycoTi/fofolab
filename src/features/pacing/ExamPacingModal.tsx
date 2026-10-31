import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, ShieldAlert, X } from 'lucide-react';
import {
  calculatePacingProfile, formatPacingTime, simulateExamSession, type PacingAttemptRecord,
} from '../../lib/pacingEngine';
import { parseQuestionOptions } from '../../lib/questionOptions';
import type { Question, QuestionAttempt } from '../../types/database';
import { isCertoErradoOptions } from '../answer-flow/AnswerOptions';

export interface ExamPacingModalProps {
  open: boolean;
  onClose: () => void;
  attempts: QuestionAttempt[];
  questions?: { question: Question }[];
  subjects: { id: string; name: string }[];
}

type ExamPreset = 'CEBRASPE_120' | 'FGV_70' | 'FGV_80' | 'CUSTOM';

const PRESETS: Record<Exclude<ExamPreset, 'CUSTOM'>, { count: number; format: 'CE' | 'ME'; dur: number }> = {
  CEBRASPE_120: { count: 120, format: 'CE', dur: 210 },
  FGV_70: { count: 70, format: 'ME', dur: 240 },
  FGV_80: { count: 80, format: 'ME', dur: 270 },
};

const PRESET_LIST: { id: ExamPreset; label: string }[] = [
  { id: 'FGV_70', label: 'FGV 70 questões (4h)' },
  { id: 'FGV_80', label: 'FGV 80 questões (4h30)' },
  { id: 'CEBRASPE_120', label: 'Cebraspe 120 itens (3h30)' },
];

/**
 * Modal de Inteligência de Ritmo e Simulação de Prova Real (spec 15d).
 * Diagnostica gargalos de tempo por disciplina e simula a viabilidade de prova.
 */
export function ExamPacingModal({ open, onClose, attempts, questions = [], subjects }: ExamPacingModalProps) {
  const [preset, setPreset] = useState<ExamPreset>('FGV_70');
  const [questionCount, setQuestionCount] = useState(70);
  const [format, setFormat] = useState<'CE' | 'ME'>('ME');
  const [examDurationMinutes, setExamDurationMinutes] = useState(240); // 4h
  const [answerSheetMinutes, setAnswerSheetMinutes] = useState(20);
  const [breakMinutes, setBreakMinutes] = useState(10);

  const questionMap = useMemo(() => new Map(questions.map((q) => [q.question.id, q.question])), [questions]);

  const pacingRecords: PacingAttemptRecord[] = useMemo(() => {
    return attempts.map((a) => {
      const q = questionMap.get(a.question_id);
      const isCE = q ? isCertoErradoOptions(parseQuestionOptions(q.options_json)) : false;
      return {
        questionId: a.question_id,
        isCE,
        timeSpentSeconds: a.time_spent_seconds ?? 0,
        isCorrect: a.is_correct === 1,
        subjectId: q?.subject_id,
      };
    });
  }, [attempts, questionMap]);

  const profile = useMemo(() => calculatePacingProfile(pacingRecords, subjects), [pacingRecords, subjects]);

  const effectivePaceSeconds = useMemo(() => {
    if (format === 'CE' && profile.certoErradoAvgSeconds > 0) return profile.certoErradoAvgSeconds;
    if (format === 'ME' && profile.multiplaEscolhaAvgSeconds > 0) return profile.multiplaEscolhaAvgSeconds;
    if (profile.overallAvgSeconds > 0) return profile.overallAvgSeconds;
    return format === 'CE' ? 75 : 180; // Padrão se sem histórico
  }, [format, profile]);

  const applyPreset = (p: ExamPreset) => {
    setPreset(p);
    if (p !== 'CUSTOM') {
      const cfg = PRESETS[p];
      setQuestionCount(cfg.count);
      setFormat(cfg.format);
      setExamDurationMinutes(cfg.dur);
    }
  };

  const sim = useMemo(
    () =>
      simulateExamSession({
        questionCount,
        format,
        avgSecondsPerQuestion: effectivePaceSeconds,
        examDurationMinutes,
        answerSheetMinutes,
        breakMinutes,
      }),
    [questionCount, format, effectivePaceSeconds, examDurationMinutes, answerSheetMinutes, breakMinutes]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Simulação de Tempo de Prova Real"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-[var(--fofo-accent)]" />
            <h2 className="text-base font-semibold text-slate-100">Simulação de Prova Real & Ritmo Histórico</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Ritmo Histórico Medido */}
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 text-xs">
          <div>
            <span className="text-slate-400">Ritmo C/E (Cebraspe)</span>
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-400">
              {profile.certoErradoAvgSeconds > 0 ? `${formatPacingTime(profile.certoErradoAvgSeconds)}/q` : '01:15/q (ref)'}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Ritmo ME (FGV / FCC)</span>
            <p className="mt-1 font-mono text-sm font-semibold text-amber-400">
              {profile.multiplaEscolhaAvgSeconds > 0 ? `${formatPacingTime(profile.multiplaEscolhaAvgSeconds)}/q` : '03:00/q (ref)'}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Questões cronometradas</span>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-200">{profile.totalAttempts} itens</p>
          </div>
        </div>

        {/* Presets de Concursos */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300">Modelo de prova:</label>
          <div className="flex flex-wrap gap-2 text-xs">
            {PRESET_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-lg border px-3 py-1.5 transition-colors ${preset === p.id ? 'border-[var(--fofo-accent)] bg-[var(--fofo-accent)]/15 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Parâmetros da Simulação */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-400">Nº de questões</label>
            <input
              type="number"
              min={10}
              max={200}
              value={questionCount}
              onChange={(e) => {
                setPreset('CUSTOM');
                setQuestionCount(Number(e.target.value));
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="text-slate-400">Duração da prova</label>
            <input
              type="number"
              min={60}
              max={360}
              step={15}
              value={examDurationMinutes}
              onChange={(e) => {
                setPreset('CUSTOM');
                setExamDurationMinutes(Number(e.target.value));
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="text-slate-400">Folga gabarito (min)</label>
            <input
              type="number"
              min={5}
              max={60}
              value={answerSheetMinutes}
              onChange={(e) => setAnswerSheetMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="text-slate-400">Pausas/Banheiro (min)</label>
            <input
              type="number"
              min={0}
              max={30}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-100"
            />
          </div>
        </div>

        {/* Diagnóstico Projetado em Tempo Real */}
        <div
          className={`space-y-2.5 rounded-xl border p-4 text-xs ${sim.verdict === 'DEFICIT' ? 'border-rose-500/50 bg-rose-500/10' : sim.verdict === 'TIGHT' ? 'border-amber-500/50 bg-amber-500/10' : 'border-emerald-500/50 bg-emerald-500/10'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {sim.verdict === 'DEFICIT' ? (
                <ShieldAlert size={16} className="text-rose-400" />
              ) : sim.verdict === 'TIGHT' ? (
                <AlertTriangle size={16} className="text-amber-400" />
              ) : (
                <CheckCircle2 size={16} className="text-emerald-400" />
              )}
              <strong className="font-semibold text-slate-100">
                {sim.verdict === 'DEFICIT' ? 'Risco Crítico de Esgotamento de Tempo' : sim.verdict === 'TIGHT' ? 'Ritmo Justo — Pouca Margem de Erro' : 'Ritmo Seguro e Confortável'}
              </strong>
            </div>
            <span className="font-mono font-semibold">
              {formatPacingTime(sim.totalEstimatedMinutes * 60)} / {formatPacingTime(examDurationMinutes * 60)}
            </span>
          </div>
          <p className="leading-relaxed text-slate-300">{sim.advice}</p>
          <div className="flex items-center gap-4 pt-1 font-mono text-[11px] text-slate-400">
            <span>Resolução pura: {sim.pureResolutionMinutes} min</span>
            <span>·</span>
            <span>Margens de folga: {sim.buffersTotalMinutes} min</span>
            <span>·</span>
            <span className={sim.deltaMinutes >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {sim.deltaMinutes >= 0 ? `+${sim.deltaMinutes} min sobra` : `${sim.deltaMinutes} min déficit`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
