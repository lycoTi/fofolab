import { localDateKey } from './timeFormat';
import type { QuestionAttempt, ReviewConfidence, StudySession, Topic } from '../types/database';

/**
 * Números do "Início" além da revisão: cobertura × proficiência e ritmo, calibração da confiança e as últimas 4
 * semanas. Regras puras; os textos são só fatos (sem sequência de dias, sem cobrança).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PACE_WINDOW_DAYS = 14;

function dayStart(dateKey: string): number {
  const [y, m, d] = dateKey.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Cobertura (tópicos vistos ÷ todos) e proficiência (domínio médio só dos vistos) ficam separadas — misturar um tópico
 * nunca visto (0%) com um estudado (85%) numa média só esconde as duas coisas. O ritmo diz se dá para ver tudo até a prova.
 */
export function editalProgress(input: {
  leafTopics: Topic[];
  /** Primeira vez que cada tópico foi estudado (sessão, questão ou registro de fora). */
  firstStudyDates: Record<string, string>;
  examDate: string | null;
  now: Date;
}): {
  totalTopics: number;
  seenTopics: number;
  coveragePercent: number;
  proficiencyPercent: number | null;
  paceLine: string | null;
  onPace: boolean | null;
} {
  const seen = input.leafTopics.filter((t) => t.last_studied_at !== null || input.firstStudyDates[t.id] !== undefined);
  const total = input.leafTopics.length;
  const coveragePercent = total === 0 ? 0 : Math.round((seen.length / total) * 100);
  const proficiencyPercent =
    seen.length === 0 ? null : Math.round(seen.reduce((acc, t) => acc + t.mastery_score, 0) / seen.length);
  return { totalTopics: total, seenTopics: seen.length, coveragePercent, proficiencyPercent, ...pace(input, total - seen.length) };
}

function pace(
  input: { leafTopics: Topic[]; firstStudyDates: Record<string, string>; examDate: string | null; now: Date },
  remaining: number
): { paceLine: string | null; onPace: boolean | null } {
  if (input.leafTopics.length > 0 && remaining === 0) {
    return { paceLine: 'Você já viu todos os tópicos do edital. Agora é revisar e treinar.', onPace: true };
  }
  if (!input.examDate) return { paceLine: null, onPace: null };
  const daysLeft = Math.round((dayStart(input.examDate) - dayStart(localDateKey(input.now))) / DAY_MS);
  if (daysLeft <= 0) return { paceLine: null, onPace: null };

  const needed = Math.ceil(remaining / Math.max(1, daysLeft / 7));
  const leafIds = new Set(input.leafTopics.map((t) => t.id));
  const windowStart = input.now.getTime() - PACE_WINDOW_DAYS * DAY_MS;
  const startedRecently = Object.entries(input.firstStudyDates).filter(
    ([id, first]) => leafIds.has(id) && new Date(first).getTime() >= windowStart
  ).length;
  const recent = Math.round(startedRecently / (PACE_WINDOW_DAYS / 7));
  return {
    paceLine:
      `Faltam ${remaining} ${plural(remaining, 'tópico', 'tópicos')} para ver o edital inteiro até a prova: ` +
      `cerca de ${needed} por semana. Seu ritmo nas últimas 2 semanas: ${recent} por semana.`,
    onPace: recent >= needed,
  };
}

const CONFIDENCE_LABEL: Record<ReviewConfidence, string> = { SURE: 'Tenho certeza', THINK: 'Acho que sei', GUESS: 'Chutei' };
/** Abaixo disso a porcentagem engana (amostra pequena não decide nada). */
const CALIBRATION_MIN_TOTAL = 8;
const CALIBRATION_MIN_PER_LEVEL = 3;

/** "Quando você diz 'tenho certeza', acerta 80%": só com respostas marcadas na revisão e amostra mínima. */
export function confidenceCalibration(
  attempts: QuestionAttempt[]
): { confidence: ReviewConfidence; label: string; answered: number; accuracyPercent: number }[] {
  const marked = attempts.filter((a) => a.confidence);
  if (marked.length < CALIBRATION_MIN_TOTAL) return [];
  return (['SURE', 'THINK', 'GUESS'] as const).flatMap((confidence) => {
    const level = marked.filter((a) => a.confidence === confidence);
    if (level.length < CALIBRATION_MIN_PER_LEVEL) return [];
    const correct = level.filter((a) => a.is_correct === 1).length;
    return [{ confidence, label: CONFIDENCE_LABEL[confidence], answered: level.length, accuracyPercent: Math.round((correct / level.length) * 100) }];
  });
}

const CALENDAR_DAYS = 28;

/** Nível de cor de um dia: 0 sem estudo; 1 até 00:29; 2 até 00:59; 3 até 01:59; 4 a partir de 02:00. */
function dayLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

/** Os últimos 28 dias (o mais antigo primeiro, hoje por último) com o tempo estudado em cada um. */
export function studyCalendar(sessions: StudySession[], now: Date): { dateKey: string; minutes: number; level: 0 | 1 | 2 | 3 | 4 }[] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const key = localDateKey(new Date(s.started_at));
    byDay.set(key, (byDay.get(key) ?? 0) + s.duration_minutes);
  }
  const todayStart = dayStart(localDateKey(now));
  return Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    // Meio-dia de cada dia: imune aos dias de 23 ou 25 h do horário de verão
    const key = localDateKey(new Date(todayStart - (CALENDAR_DAYS - 1 - i) * DAY_MS + DAY_MS / 2));
    const minutes = byDay.get(key) ?? 0;
    return { dateKey: key, minutes, level: dayLevel(minutes) };
  });
}
