import { minutesForDay, weekBudgetMinutes, weekDateKeys, weeklyReviewDay, weekReviewDuration, type WeekdayMinutes } from './availability';
import { startOfWeek } from './cycleEngine';
import { localDateKey } from './timeFormat';
import type { StudySession, Subject, Topic } from '../types/database';

/**
 * Caminho até a prova (spec 13 §4.3): quanto tempo leva um tópico, quanto tempo há em cada semana até a reta final, e
 * como os tópicos que faltam se espalham por elas. Puro: o App só entrega os dados.
 */

/** Tempo de um tópico pela autoavaliação: Nunca vi · Já vi por cima · Sei bem · Domino. */
export const TOPIC_MINUTES_BY_LEVEL: Record<1 | 2 | 3 | 4, number> = { 1: 120, 2: 90, 3: 60, 4: 30 };
/** Janela do ritmo real: tópicos vistos pela primeira vez nas últimas 4 semanas. */
const PACE_WINDOW_DAYS = 28;
/** Confiança do ritmo real, C = n ÷ (n + K): amostra pequena não decide sozinha (regra do projeto). */
const PACE_K = 5;
const DAY_MS = 86_400_000;

const roundTo5 = (minutes: number) => Math.round(minutes / 5) * 5;

/** Nível do tópico (1–4); sem nível próprio, o da matéria. */
export function topicLevel(topic: Topic, subject: Subject): 1 | 2 | 3 | 4 {
  const level = topic.initial_knowledge_level ?? subject.initial_knowledge_level;
  return Math.min(4, Math.max(1, Math.round(level))) as 1 | 2 | 3 | 4;
}

/**
 * Ritmo real: para cada tópico folha visto pela primeira vez na janela, os minutos das sessões nele dentro dela; a
 * média deles. Tópico que só tem registro de questões de fora (sem minutos) não entra; sessão pulada não conta.
 */
export function realPace(input: {
  sessions: StudySession[];
  firstStudyDates: Record<string, string>;
  leafTopicIds: ReadonlySet<string>;
  now: Date;
}): { minutesPerTopic: number | null; sample: number } {
  const since = input.now.getTime() - PACE_WINDOW_DAYS * DAY_MS;
  const fresh = new Set(
    Object.entries(input.firstStudyDates)
      .filter(([id, first]) => input.leafTopicIds.has(id) && new Date(first).getTime() >= since)
      .map(([id]) => id)
  );
  const minutesByTopic = new Map<string, number>();
  for (const s of input.sessions) {
    if (s.was_skipped || !s.topic_id || !fresh.has(s.topic_id)) continue;
    if (new Date(s.started_at).getTime() < since) continue;
    minutesByTopic.set(s.topic_id, (minutesByTopic.get(s.topic_id) ?? 0) + s.duration_minutes);
  }
  const measured = [...minutesByTopic.values()].filter((m) => m > 0);
  if (measured.length === 0) return { minutesPerTopic: null, sample: 0 };
  const mean = measured.reduce((acc, m) => acc + m, 0) / measured.length;
  return { minutesPerTopic: Math.round(mean), sample: measured.length };
}

/** Tempo estimado do tópico: a autoavaliação, puxada para o ritmo real conforme a amostra cresce. */
export function estimateTopicMinutes(levelMinutes: number, pace: { minutesPerTopic: number | null; sample: number }): number {
  if (pace.minutesPerTopic === null || pace.sample === 0) return levelMinutes;
  const confidence = pace.sample / (pace.sample + PACE_K);
  return roundTo5(confidence * pace.minutesPerTopic + (1 - confidence) * levelMinutes);
}

/** Data local 'YYYY-MM-DD' de N dias antes da prova: o primeiro dia da reta final. */
export function stretchStartKey(examDate: string, finalStretchDays: number): string {
  const [year, month, day] = examDate.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day - finalStretchDays));
}

export type WeekPhase = 'TEORIA' | 'ULTIMOS' | 'RETA_FINAL';

export interface WeekSlot {
  weekStart: Date;
  weekStartKey: string;
  /** Tempo para tópico novo: os dias de hoje em diante e antes da reta final, menos a Revisão da semana. */
  newTopicMinutes: number;
  phase: WeekPhase;
}

/**
 * Semanas de hoje até a da prova. Teoria: a semana inteira antes da reta final; Últimos tópicos: a que tem dias antes e
 * dentro dela; Reta final: nenhum tópico novo. Hoje vale o que sobra do dia; dia que passou não conta.
 */
export function weekSlots(input: {
  now: Date;
  examDate: string;
  finalStretchDays: number;
  pattern: WeekdayMinutes;
  overrides: Record<string, number>;
  todayStudiedMinutes: number;
  reviewEnabled: boolean;
}): WeekSlot[] {
  const todayKey = localDateKey(input.now);
  if (input.examDate < todayKey) return [];
  const stretchKey = stretchStartKey(input.examDate, input.finalStretchDays);
  const [ey, em, ed] = input.examDate.split('-').map(Number);
  const lastWeek = startOfWeek(new Date(ey, em - 1, ed)).getTime();

  const slots: WeekSlot[] = [];
  for (let weekStart = startOfWeek(input.now); weekStart.getTime() <= lastWeek; ) {
    const keys = weekDateKeys(weekStart);
    let minutes = 0;
    for (const key of keys) {
      if (key < todayKey || key >= stretchKey) continue;
      const day = minutesForDay(key, input.pattern, input.overrides);
      minutes += key === todayKey ? Math.max(0, day - input.todayStudiedMinutes) : day;
    }
    const reviewDay = input.reviewEnabled ? weeklyReviewDay(weekStart, input.pattern, input.overrides) : null;
    if (reviewDay && reviewDay >= todayKey && reviewDay < stretchKey) {
      minutes = Math.max(0, minutes - weekReviewDuration(weekBudgetMinutes(weekStart, input.pattern, input.overrides)));
    }
    const before = keys.some((k) => k >= todayKey && k < stretchKey);
    const inside = keys.some((k) => k >= stretchKey);
    let phase: WeekPhase = 'TEORIA';
    if (inside) phase = before ? 'ULTIMOS' : 'RETA_FINAL';
    slots.push({ weekStart, weekStartKey: keys[0], newTopicMinutes: minutes, phase });
    weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  }
  return slots;
}

export interface SubjectQueue {
  subjectId: string;
  partCode: string | null;
  /** Parte da matéria no ciclo (0..1). */
  share: number;
  totalLeaf: number;
  seen: number;
  /** Tópicos ainda não vistos, na ordem de prioridade, com o tempo estimado de cada um. */
  queue: { topicId: string; minutes: number }[];
}

export interface ProjectedWeek extends WeekSlot {
  newTopics: number;
  /** % do edital visto ao fim da semana. */
  coveragePercent: number;
}

/** Voltas de redistribuição por semana: a sobra de quem fechou vai para quem tem fila (sempre termina). */
const MAX_ROUNDS = 12;

/**
 * Espalha os tópicos que faltam pelas semanas: cada matéria recebe a parte dela do tempo da semana e consome a própria
 * fila na ordem; o tópico fica visto quando o tempo dele fecha (a sobra passa para a semana seguinte). Matéria sem fila
 * devolve o tempo às que têm, na proporção delas; partes todas 0 = divisão igual.
 */
export function projectTopics(
  slots: WeekSlot[],
  subjects: SubjectQueue[]
): { weeks: ProjectedWeek[]; seenAtStretch: Map<string, number>; leftForLater: string[] } {
  const state = subjects.map((s) => ({ ...s, next: 0, progress: 0 }));
  const totalLeaf = subjects.reduce((acc, s) => acc + s.totalLeaf, 0);
  const coverage = () => (totalLeaf === 0 ? 0 : Math.round((state.reduce((acc, s) => acc + s.seen, 0) / totalLeaf) * 100));

  // Consome o tempo dado à matéria; devolve o que sobrou quando a fila acaba
  const consume = (s: (typeof state)[number], minutes: number): { leftover: number; done: number } => {
    let done = 0;
    s.progress += minutes;
    while (s.next < s.queue.length && s.progress >= s.queue[s.next].minutes) {
      s.progress -= s.queue[s.next].minutes;
      s.next += 1;
      s.seen += 1;
      done += 1;
    }
    if (s.next < s.queue.length) return { leftover: 0, done };
    const leftover = s.progress;
    s.progress = 0;
    return { leftover, done };
  };

  const weeks = slots.map((slot) => {
    let pool = slot.newTopicMinutes;
    let newTopics = 0;
    for (let round = 0; round < MAX_ROUNDS && pool >= 1; round += 1) {
      const active = state.filter((s) => s.next < s.queue.length);
      if (active.length === 0) break;
      const shareSum = active.reduce((acc, s) => acc + s.share, 0);
      let leftover = 0;
      for (const s of active) {
        const part = shareSum > 0 ? s.share / shareSum : 1 / active.length;
        const result = consume(s, pool * part);
        leftover += result.leftover;
        newTopics += result.done;
      }
      pool = leftover;
    }
    return { ...slot, newTopics, coveragePercent: coverage() };
  });

  return {
    weeks,
    seenAtStretch: new Map(state.map((s) => [s.subjectId, s.seen])),
    leftForLater: state.flatMap((s) => s.queue.slice(s.next).map((t) => t.topicId)),
  };
}
