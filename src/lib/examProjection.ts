import { minutesForDay, weekBudgetMinutes, weekDateKeys, weeklyReviewDay, weekReviewDuration, type WeekdayMinutes } from './availability';
import { startOfWeek, type CycleCalculationResult } from './cycleEngine';
import { findBehindPart } from './goodMorning';
import { localDateKey } from './timeFormat';
import type { ExamPart, StudyPlan, StudySession, Subject, Topic } from '../types/database';

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

/**
 * Nível do tópico (1–4): o próprio; senão o do grupo (o Wizard avalia os tópicos de primeiro nível, que no edital são
 * os pais); senão o da matéria — a mesma herança do motor do ciclo.
 */
export function topicLevel(topic: Topic, subject: Subject, parentLevel: number | null = null): 1 | 2 | 3 | 4 {
  const level = topic.initial_knowledge_level ?? parentLevel ?? subject.initial_knowledge_level;
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
  /** Dias da semana (de hoje em diante) antes da reta final. */
  days: number;
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
  /** Já há tópico estudado: só então o roteiro desta semana faz a Revisão da semana (as próximas, sim). */
  studiedAny?: boolean;
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
    let days = 0;
    for (const key of keys) {
      if (key < todayKey || key >= stretchKey) continue;
      const day = minutesForDay(key, input.pattern, input.overrides);
      minutes += key === todayKey ? Math.max(0, day - input.todayStudiedMinutes) : day;
      days += 1;
    }
    const isThisWeek = keys.includes(todayKey);
    const reviewHappens = input.reviewEnabled && (!isThisWeek || input.studiedAny !== false);
    const reviewDay = reviewHappens ? weeklyReviewDay(weekStart, input.pattern, input.overrides) : null;
    if (reviewDay && reviewDay >= todayKey && reviewDay < stretchKey) {
      minutes = Math.max(0, minutes - weekReviewDuration(weekBudgetMinutes(weekStart, input.pattern, input.overrides)));
    }
    const before = keys.some((k) => k >= todayKey && k < stretchKey);
    const inside = keys.some((k) => k >= stretchKey);
    let phase: WeekPhase = 'TEORIA';
    if (inside) phase = before ? 'ULTIMOS' : 'RETA_FINAL';
    slots.push({ weekStart, weekStartKey: keys[0], newTopicMinutes: minutes, phase, days });
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

/**
 * Espalha os tópicos que faltam pelas semanas: cada matéria recebe a parte dela do tempo da semana e consome a própria
 * fila na ordem; o tópico fica visto quando o tempo dele fecha (a sobra passa para a semana seguinte). Matéria sem fila
 * devolve o tempo às que têm, na proporção delas; partes todas 0 = divisão igual. A cobertura e os tópicos novos contam
 * o avanço parcial do tópico em andamento — com muitas matérias e tópicos longos, senão, semanas cheias apareceriam com
 * 0 tópico novo. A cobertura é arredondada para baixo: com tópico ficando para depois, nunca mostra 100%.
 */
export function projectTopics(
  slots: WeekSlot[],
  subjects: SubjectQueue[]
): { weeks: ProjectedWeek[]; seenAtStretch: Map<string, number>; leftForLater: string[] } {
  const state = subjects.map((s) => ({ ...s, next: 0, progress: 0 }));
  const totalLeaf = subjects.reduce((acc, s) => acc + s.totalLeaf, 0);
  // Visto + a fração do tópico em andamento
  const seenOf = (s: (typeof state)[number]) => s.seen + (s.next < s.queue.length ? s.progress / s.queue[s.next].minutes : 0);
  const seenTotal = () => state.reduce((acc, s) => acc + seenOf(s), 0);
  const coverage = () => (totalLeaf === 0 ? 0 : Math.floor((seenTotal() / totalLeaf) * 100 + 1e-9));
  // Cada volta tira pelo menos uma matéria da fila ou zera a sobra: matérias + 1 voltas sempre bastam
  const maxRounds = subjects.length + 1;

  // Consome o tempo dado à matéria; devolve o que sobrou quando a fila acaba
  const consume = (s: (typeof state)[number], minutes: number): number => {
    s.progress += minutes;
    while (s.next < s.queue.length && s.progress >= s.queue[s.next].minutes) {
      s.progress -= s.queue[s.next].minutes;
      s.next += 1;
      s.seen += 1;
    }
    if (s.next < s.queue.length) return 0;
    const leftover = s.progress;
    s.progress = 0;
    return leftover;
  };

  let shownSeen = Math.round(seenTotal());
  const weeks = slots.map((slot) => {
    let pool = slot.newTopicMinutes;
    for (let round = 0; round < maxRounds && pool >= 1; round += 1) {
      const active = state.filter((s) => s.next < s.queue.length);
      if (active.length === 0) break;
      const shareSum = active.reduce((acc, s) => acc + s.share, 0);
      let leftover = 0;
      for (const s of active) {
        const part = shareSum > 0 ? s.share / shareSum : 1 / active.length;
        leftover += consume(s, pool * part);
      }
      pool = leftover;
    }
    // Arredondamento acumulado: os tópicos novos das semanas somam o total
    const nowSeen = Math.round(seenTotal());
    const newTopics = nowSeen - shownSeen;
    shownSeen = nowSeen;
    return { ...slot, newTopics, coveragePercent: coverage() };
  });

  return {
    weeks,
    seenAtStretch: new Map(state.map((s) => [s.subjectId, seenOf(s)])),
    leftForLater: state.flatMap((s) => s.queue.slice(s.next).map((t) => t.topicId)),
  };
}

export interface ExamOutlook {
  status: 'PROJETANDO' | 'RETA_FINAL' | 'PROVA_PASSOU';
  stretchStartKey: string;
  weeks: ProjectedWeek[];
  /** Tópicos folha do plano (0 = o conteúdo do edital ainda não foi importado). */
  totalTopics: number;
  /** % do edital visto até a véspera da reta final, pelo plano (arredondado para baixo). */
  coverageAtStretch: number;
  /** Ritmo real das últimas 2 semanas 10% ou mais abaixo do que estava planejado nelas, com 7+ dias de uso; senão nulo. */
  real: { weeklyMinutes: number; coverageAtStretch: number } | null;
  /** Horas da semana no padrão. */
  plannedWeeklyMinutes: number;
  /** Tempo a mais por semana que leva a projeção a 100% antes da reta final (0 quando já dá). */
  extraWeeklyMinutes: number;
  /** O acréscimo é realista: até o dobro do plano e até 08:00 por dia de estudo. */
  fits: boolean;
  /** O que fica para depois, do menos para o mais prioritário (de todas as matérias). */
  leftForLater: Topic[];
  parts: { code: string; name: string; coverageAtStretch: number }[];
  partWarning: string | null;
  topicMinutes: { estimate: number; source: 'AUTOAVALIACAO' | 'RITMO_REAL' | 'MISTO'; sample: number };
}

/** Ritmo real só aparece com uma semana de uso e quando fica 10% ou mais abaixo do planejado. */
const REAL_PACE_MIN_DAYS = 7;
const REAL_PACE_WINDOW_DAYS = 14;
const REAL_PACE_GAP = 0.9;
/** Amostra a partir da qual o ritmo real manda (C de 0,8 para cima). */
const REAL_PACE_TRUSTED = 20;
/** Busca do acréscimo: de 00:30 em 00:30, até 112:00 a mais por semana. */
const EXTRA_STEP = 30;
const EXTRA_MAX = 112 * 60;
/** Acréscimo realista: até o dobro do plano e até 08:00 por dia de estudo. */
const FIT_PLAN_FACTOR = 2;
const FIT_MAX_PER_DAY = 480;

/**
 * "Dá tempo?" (spec 13 §4.3): quanto do edital estará visto quando a reta final começar — pelo plano e, se ele estiver
 * bem abaixo do planejado, pelo ritmo real —, o que fazer se não der (horas a mais por semana; o que fica para depois) e
 * cada prova. Sem data da prova: nulo.
 */
export function examOutlook(input: {
  plan: StudyPlan;
  now: Date;
  pattern: WeekdayMinutes;
  /** Exceções de horas da janela do ritmo real até a prova (semanas atípicas passadas e futuras). */
  overrides: Record<string, number>;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  cycleData: CycleCalculationResult;
  examParts: ExamPart[];
  sessions: StudySession[];
  firstStudyDates: Record<string, string>;
  todayStudiedMinutes: number;
}): ExamOutlook | null {
  const { plan, now } = input;
  if (!plan.exam_date) return null;
  const finalStretchDays = plan.final_stretch_days ?? 14;
  const todayKey = localDateKey(now);
  const stretchKey = stretchStartKey(plan.exam_date, finalStretchDays);
  let status: ExamOutlook['status'] = 'PROJETANDO';
  if (plan.exam_date < todayKey) status = 'PROVA_PASSOU';
  else if (todayKey >= stretchKey) status = 'RETA_FINAL';

  // 1. Tópicos folha, vistos e por ver (o mesmo "visto" do Início); só as sessões deste plano contam
  const all = Object.values(input.topicsBySubject).flat();
  const topicsById = new Map(all.map((t) => [t.id, t]));
  const parents = new Set(all.map((t) => t.parent_id).filter(Boolean));
  const leafOf = (subjectId: string) => (input.topicsBySubject[subjectId] ?? []).filter((t) => !parents.has(t.id));
  const isSeen = (t: Topic) => t.last_studied_at !== null || input.firstStudyDates[t.id] !== undefined;
  const leafIds = new Set(all.filter((t) => !parents.has(t.id)).map((t) => t.id));
  const subjectIds = new Set(input.subjects.map((s) => s.id));
  const sessions = input.sessions.filter((s) => subjectIds.has(s.subject_id) && !s.was_skipped);
  const pace = realPace({ sessions, firstStudyDates: input.firstStudyDates, leafTopicIds: leafIds, now });

  // 2. Fila de cada matéria, na ordem de prioridade do motor, com o tempo estimado de cada tópico
  const rank = new Map(input.cycleData.topicHeatmapRanking.map((h, i) => [h.topic.id, i]));
  const rankOf = (t: Topic) => rank.get(t.id) ?? Number.MAX_SAFE_INTEGER;
  const byPriority = (a: Topic, b: Topic) => rankOf(a) - rankOf(b) || (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true });
  const totalCycle = input.cycleData.allocations.reduce((acc, a) => acc + a.currentWeeklyMinutes, 0);
  const levelOfParent = (t: Topic) => (t.parent_id ? (topicsById.get(t.parent_id)?.initial_knowledge_level ?? null) : null);
  const queues: SubjectQueue[] = input.subjects.map((subject) => {
    const leaf = leafOf(subject.id);
    const unseen = leaf.filter((t) => !isSeen(t)).sort(byPriority);
    const allocation = input.cycleData.allocations.find((a) => a.subject.id === subject.id);
    return {
      subjectId: subject.id,
      partCode: subject.exam_part_id ?? null,
      share: totalCycle > 0 ? (allocation?.currentWeeklyMinutes ?? 0) / totalCycle : 0,
      totalLeaf: leaf.length,
      seen: leaf.length - unseen.length,
      queue: unseen.map((t) => ({
        topicId: t.id,
        minutes: estimateTopicMinutes(TOPIC_MINUTES_BY_LEVEL[topicLevel(t, subject, levelOfParent(t))], pace),
      })),
    };
  });
  const totalTopics = queues.reduce((acc, q) => acc + q.totalLeaf, 0);

  // 3. Projeção pelo plano
  const slots = weekSlots({
    now,
    examDate: plan.exam_date,
    finalStretchDays,
    pattern: input.pattern,
    overrides: input.overrides,
    todayStudiedMinutes: input.todayStudiedMinutes,
    reviewEnabled: plan.daily_review_enabled !== 0,
    studiedAny: queues.some((q) => q.seen > 0),
  });
  const projected = projectTopics(slots, queues);
  const coverageAtStretch = projected.weeks.at(-1)?.coveragePercent ?? coverageNow(queues);

  // 4. Ritmo real: o que foi feito × o que estava planejado nos mesmos dias
  const real = realOutlook({ now, pattern: input.pattern, overrides: input.overrides, sessions, slots, queues });

  // 5. Se não dá: o menor acréscimo por semana que leva a projeção a 100%, e se ele é realista
  const plannedWeeklyMinutes = input.pattern.reduce((acc, m) => acc + m, 0);
  const extra = projected.leftForLater.length > 0 ? extraForFullCoverage(slots, queues) : 0;
  const studyDays = input.pattern.filter((m) => m > 0).length || 7;
  const neededWeekly = plannedWeeklyMinutes + (extra ?? EXTRA_MAX);
  const fits =
    extra !== null &&
    plannedWeeklyMinutes > 0 &&
    neededWeekly <= plannedWeeklyMinutes * FIT_PLAN_FACTOR &&
    neededWeekly / studyDays <= FIT_MAX_PER_DAY;
  const leftForLater = projected.leftForLater
    .flatMap((id) => {
      const topic = topicsById.get(id);
      return topic ? [topic] : [];
    })
    .sort((a, b) => byPriority(b, a));

  // 6. Cada prova: média das matérias dela (como o cabeçalho), com o aviso da que tem nota mínima e fica para trás
  const subjectCoverage = new Map(
    queues.map((q) => [q.subjectId, q.totalLeaf > 0 ? ((projected.seenAtStretch.get(q.subjectId) ?? q.seen) / q.totalLeaf) * 100 : null])
  );
  const parts = [...input.examParts]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((part) => {
      const values = input.subjects
        .filter((s) => s.exam_part_id === part.id)
        .map((s) => subjectCoverage.get(s.id))
        .filter((v): v is number => v !== null && v !== undefined);
      if (values.length === 0) return [];
      return [{ code: part.code, name: part.name, coverageAtStretch: Math.floor(values.reduce((acc, v) => acc + v, 0) / values.length) }];
    });
  const behind = findBehindPart(
    parts.map((p) => ({ code: p.code, coveragePercent: p.coverageAtStretch })),
    input.examParts
  );
  const partWarning = behind
    ? `${behind.code} deve chegar a ${behind.coverage}% até a reta final (as outras: ${behind.others}%). Ela tem nota mínima.`
    : null;

  // 7. De onde vem o tempo por tópico (o "ⓘ")
  const estimates = queues.flatMap((q) => q.queue.map((t) => t.minutes));
  const estimate = estimates.length > 0 ? roundTo5(estimates.reduce((acc, m) => acc + m, 0) / estimates.length) : TOPIC_MINUTES_BY_LEVEL[2];
  let source: ExamOutlook['topicMinutes']['source'] = 'MISTO';
  if (pace.sample === 0) source = 'AUTOAVALIACAO';
  else if (pace.sample >= REAL_PACE_TRUSTED) source = 'RITMO_REAL';

  return {
    status,
    stretchStartKey: stretchKey,
    weeks: projected.weeks,
    totalTopics,
    coverageAtStretch,
    real,
    plannedWeeklyMinutes,
    extraWeeklyMinutes: extra ?? 0,
    fits,
    leftForLater,
    parts,
    partWarning,
    topicMinutes: { estimate, source, sample: pace.sample },
  };
}

function coverageNow(queues: SubjectQueue[]): number {
  const total = queues.reduce((acc, q) => acc + q.totalLeaf, 0);
  return total === 0 ? 0 : Math.floor((queues.reduce((acc, q) => acc + q.seen, 0) / total) * 100);
}

/**
 * Menor acréscimo por semana (de 00:30 em 00:30) que leva a projeção a ver tudo antes da reta final — calculado pela
 * própria projeção, então é coerente com ela. Cada semana ganha a parte dos dias dela. Nem com 112:00 a mais: nulo.
 */
function extraForFullCoverage(slots: WeekSlot[], queues: SubjectQueue[]): number | null {
  const fullWith = (extra: number) =>
    projectTopics(
      slots.map((s) => ({ ...s, newTopicMinutes: s.newTopicMinutes + (extra * s.days) / 7 })),
      queues
    ).leftForLater.length === 0;
  if (!fullWith(EXTRA_MAX)) return null;
  let low = 0;
  let high = EXTRA_MAX / EXTRA_STEP;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (fullWith(mid * EXTRA_STEP)) high = mid;
    else low = mid + 1;
  }
  return low * EXTRA_STEP;
}

/**
 * A mesma projeção com cada semana na proporção do ritmo real — só quando ele está bem abaixo do que estava planejado
 * nos mesmos dias (folga planejada e semana atípica não contam como atraso). Janela: os 14 dias antes de hoje (ou desde a
 * primeira sessão, com 7+ dias de uso).
 */
function realOutlook(input: {
  now: Date;
  pattern: WeekdayMinutes;
  overrides: Record<string, number>;
  sessions: StudySession[];
  slots: WeekSlot[];
  queues: SubjectQueue[];
}): ExamOutlook['real'] {
  if (input.sessions.length === 0) return null;
  const today = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate());
  const first = Math.min(...input.sessions.map((s) => new Date(s.started_at).getTime()));
  const firstDay = new Date(first);
  const daysOfUse = Math.round((today.getTime() - new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()).getTime()) / DAY_MS);
  if (daysOfUse < REAL_PACE_MIN_DAYS) return null;
  const window = Math.min(REAL_PACE_WINDOW_DAYS, daysOfUse);
  const since = today.getTime() - window * DAY_MS;
  const done = input.sessions
    .filter((s) => {
      const at = new Date(s.started_at).getTime();
      return at >= since && at < today.getTime();
    })
    .reduce((acc, s) => acc + s.duration_minutes, 0);
  let planned = 0;
  for (let i = 1; i <= window; i += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    planned += minutesForDay(localDateKey(day), input.pattern, input.overrides);
  }
  if (planned === 0) return null;
  const ratio = done / planned;
  if (ratio > REAL_PACE_GAP) return null;
  const weeklyMinutes = Math.round((done / window) * 7);
  const scaled = input.slots.map((s) => ({ ...s, newTopicMinutes: s.newTopicMinutes * ratio }));
  const projected = projectTopics(scaled, input.queues);
  return { weeklyMinutes, coverageAtStretch: projected.weeks.at(-1)?.coveragePercent ?? coverageNow(input.queues) };
}
