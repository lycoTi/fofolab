import { formatDuration, localDateKey } from './timeFormat';
import type { ExamPart, StudyPlan, StudySession, Topic } from '../types/database';

/**
 * Textos do "Bom dia" (spec 07 §5.5): só fatos do próprio estudante — nada de frase motivacional pronta.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Quantos pontos abaixo da média das outras provas uma prova com nota mínima precisa estar para o aviso aparecer. */
export const EXAM_BEHIND_GAP_POINTS = 20;
const MAX_STARTED_LISTED = 2;

export function greeting(now: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function topicLabel(topic: Topic): string {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

function dayMonth(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${d}/${m}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Ontem: 01:40 de estudo em 2 matérias. Você começou 2.1 Arquitetura…" — o último dia de estudo antes de hoje. */
export function moodLine(input: {
  sessions: StudySession[];
  firstStudyDates: Record<string, string>;
  topicsById: Record<string, Topic>;
  now: Date;
}): string | null {
  const today = localDateKey(input.now);
  // 1. Último dia antes de hoje com estudo registrado
  const previous = input.sessions.filter((s) => s.duration_minutes > 0 && localDateKey(new Date(s.started_at)) < today);
  if (previous.length === 0) return null;
  const lastDay = previous.map((s) => localDateKey(new Date(s.started_at))).reduce((a, b) => (a > b ? a : b));
  const ofDay = previous.filter((s) => localDateKey(new Date(s.started_at)) === lastDay);

  // 2. Tempo e matérias do dia
  const minutes = ofDay.reduce((acc, s) => acc + s.duration_minutes, 0);
  const subjectCount = new Set(ofDay.map((s) => s.subject_id)).size;
  // Meio-dia de ontem (meia-noite de hoje − 12 h): cai em ontem mesmo num dia de 23 ou 25 h (horário de verão)
  const yesterday = localDateKey(new Date(parseDateKey(today).getTime() - DAY_MS / 2));
  const label = lastDay === yesterday ? 'Ontem' : `Em ${dayMonth(lastDay)}`;
  const base = `${label}: ${formatDuration(minutes)} de estudo em ${subjectCount} ${subjectCount === 1 ? 'matéria' : 'matérias'}.`;

  // 3. Tópicos vistos pela primeira vez nesse dia
  const started = Object.entries(input.firstStudyDates)
    .filter(([id, first]) => input.topicsById[id] && localDateKey(new Date(first)) === lastDay)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id]) => topicLabel(input.topicsById[id]));
  if (started.length === 0) return base;
  return `${base} Você começou ${listStarted(started)}.`;
}

function listStarted(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === MAX_STARTED_LISTED) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, MAX_STARTED_LISTED).join(', ')} e mais ${labels.length - MAX_STARTED_LISTED}`;
}

export function examSituation(input: {
  plan: StudyPlan;
  parts: ExamPart[];
  /** Quanto de cada prova já foi visto (`summarizeExamParts`). */
  progress: { code: string; coveragePercent: number }[];
  now: Date;
}): { daysLine: string | null; parts: { code: string; name: string; coveragePercent: number }[]; warning: string | null } {
  const parts = input.progress.flatMap((p) => {
    const part = input.parts.find((x) => x.code === p.code);
    return part ? [{ code: p.code, name: part.name, coveragePercent: p.coveragePercent }] : [];
  });
  return { daysLine: daysLine(input.plan.exam_date, input.now), parts, warning: behindWarning(parts, input.parts) };
}

function daysLine(examDate: string | null, now: Date): string | null {
  if (!examDate) return null;
  const exam = parseDateKey(examDate);
  const days = Math.round((exam.getTime() - parseDateKey(localDateKey(now)).getTime()) / DAY_MS);
  const when = `${String(exam.getDate()).padStart(2, '0')}/${String(exam.getMonth() + 1).padStart(2, '0')}/${exam.getFullYear()}`;
  if (days < 0) return null;
  if (days === 0) return `A prova é hoje (${when}).`;
  if (days === 1) return `Falta 1 dia para a prova (${when}).`;
  return `Faltam ${days} dias para a prova (${when}).`;
}

/** Um aviso só, para a prova eliminatória mais atrasada em relação às outras (nunca uma lista de cobranças). */
function behindWarning(parts: { code: string; coveragePercent: number }[], examParts: ExamPart[]): string | null {
  let worst: { code: string; coverage: number; others: number; gap: number } | null = null;
  for (const p of parts) {
    const hasMinimum = examParts.find((x) => x.code === p.code)?.min_score != null;
    const others = parts.filter((o) => o.code !== p.code);
    if (!hasMinimum || others.length === 0) continue;
    const average = Math.round(others.reduce((acc, o) => acc + o.coveragePercent, 0) / others.length);
    const gap = average - p.coveragePercent;
    if (gap >= EXAM_BEHIND_GAP_POINTS && (!worst || gap > worst.gap)) {
      worst = { code: p.code, coverage: p.coveragePercent, others: average, gap };
    }
  }
  if (!worst) return null;
  return `${worst.code} está ficando para trás: ${worst.coverage}% visto (as outras: ${worst.others}%). Ela tem nota mínima.`;
}
