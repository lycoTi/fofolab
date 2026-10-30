import { effectiveCyclePomodoros, planPreview, remainingBlockMs, type BlockState } from '../features/study-block/studyBlockMachine';
import type { RoutineItem } from './dailyRoutine';
import type { NowBlock } from './nowBlock';

/**
 * Trilho do dia (spec 14 §8): de "agora" até o fim do roteiro, com a hora estimada de cada parada. As horas partem
 * sempre de agora (atrasar só empurra as horas; nunca existe "atrasado") e já embutem as pausas do FofoDoro.
 */

/** Intervalo sugerido entre um bloco e o seguinte (o mesmo que o roteiro já usa). */
export const BETWEEN_BLOCKS_MINUTES = 10;

const MINUTE_MS = 60_000;

export interface TrackStop {
  item: RoutineItem;
  startsAt: Date;
  emphasis: 'next' | 'later';
}

export interface DayTrack {
  /** Blocos feitos, recolhidos numa linha; null quando nenhum foi feito. */
  done: { count: number; minutes: number } | null;
  /** Fim estimado do "agora"; null sem "agora" ou quando não dá para saber (bloco livre sem meta). */
  nowEndsAt: Date | null;
  upcoming: TrackStop[];
  /** Fim estimado da última parada; null quando nenhuma parada tem fim conhecido. */
  endsAt: Date | null;
}

const EMPTY_TRACK: DayTrack = { done: null, nowEndsAt: null, upcoming: [], endsAt: null };

function sameItem(a: RoutineItem, b: RoutineItem | null): boolean {
  if (!b) return false;
  return a === b || (a.block.blockNumber === b.block.blockNumber && a.subject.id === b.subject.id);
}

/** Minutos de relógio de um bloco: a meta mais as pausas do FofoDoro; no modo livre, só a meta. */
function plannedMinutes(item: RoutineItem, block: BlockState, cyclePomodoros: number): number {
  const minutes =
    block.mode === 'LIVRE'
      ? item.remainingMinutes
      : planPreview(item.remainingMinutes, block.focusMinutes, block.settings, cyclePomodoros).totalMinutes;
  // Número estranho no roteiro não pode virar "NaN:NaN" na tela
  if (!Number.isFinite(minutes) || minutes < 0) return 0;
  return minutes;
}

function doneSummary(items: RoutineItem[], nowItem: RoutineItem | null): DayTrack['done'] {
  // O bloco rodando com a meta cumprida aparece como "agora", não entre os feitos
  const done = items.filter((i) => i.status === 'done' && !sameItem(i, nowItem));
  if (done.length === 0) return null;
  return { count: done.length, minutes: done.reduce((acc, i) => acc + i.studiedMinutes, 0) };
}

/** Fim do "agora": rodando, o que falta do bloco; antes do play, o bloco inteiro começando agora. */
function nowEnd(nowBlock: NowBlock | null, block: BlockState, now: Date): Date | null {
  if (!nowBlock) return null;
  if (nowBlock.running) {
    const remaining = remainingBlockMs(block, now.getTime());
    if (remaining === null || !Number.isFinite(remaining)) return null;
    return new Date(now.getTime() + remaining);
  }
  if (!nowBlock.item) return null;
  const minutes = plannedMinutes(nowBlock.item, block, effectiveCyclePomodoros(block, now.getTime()));
  return new Date(now.getTime() + minutes * MINUTE_MS);
}

/** Blocos depois do "agora": os do roteiro que faltam; com o roteiro cumprido, o extra (se não for ele o "agora"). */
function upcomingItems(items: RoutineItem[], extra: RoutineItem | null, nowItem: RoutineItem | null): RoutineItem[] {
  const pending = items.filter((i) => i.status !== 'done' && !sameItem(i, nowItem));
  if (pending.length > 0 || !extra || sameItem(extra, nowItem)) return pending;
  return [extra];
}

export function buildDayTrack(input: {
  items: RoutineItem[];
  extra: RoutineItem | null;
  nowBlock: NowBlock | null;
  block: BlockState;
  now: Date;
}): DayTrack {
  const { items, extra, nowBlock, block, now } = input;
  if (Number.isNaN(now.getTime())) return EMPTY_TRACK;
  const nowItem = nowBlock?.item ?? null;

  // 1. Feitos e fim do "agora"; sem fim conhecido (bloco livre sem meta), o roteiro conta como se ele terminasse agora
  const done = doneSummary(items, nowItem);
  const nowEndsAt = nowEnd(nowBlock, block, now);
  let cursor = (nowEndsAt ?? now).getTime();

  // 2. Cada bloco seguinte começa depois do intervalo e dura a prévia da sua meta (ciclo do zero: não dá para prever)
  const upcoming: TrackStop[] = upcomingItems(items, extra, nowItem).map((item, index) => {
    cursor += BETWEEN_BLOCKS_MINUTES * MINUTE_MS;
    const startsAt = new Date(cursor);
    cursor += plannedMinutes(item, block, 0) * MINUTE_MS;
    return { item, startsAt, emphasis: index === 0 ? 'next' : 'later' };
  });

  // 3. Fim do roteiro: o fim da última parada
  const endsAt = upcoming.length > 0 ? new Date(cursor) : nowEndsAt;
  return { done, nowEndsAt, upcoming, endsAt };
}

/** Hora exibida no trilho: arredondada para os 5 min mais próximos (é estimativa, marcada com "≈"). */
export function roundToFiveMinutes(date: Date): Date {
  const rounded = new Date(date.getTime());
  if (Number.isNaN(rounded.getTime())) return rounded;
  const minutes = rounded.getMinutes() + rounded.getSeconds() / 60 + rounded.getMilliseconds() / MINUTE_MS;
  rounded.setMinutes(Math.round(minutes / 5) * 5, 0, 0);
  return rounded;
}

/**
 * Motivo do bloco em linguagem de gente: o texto do motor até o primeiro " • " (peso e domínio ficam no Ciclo, onde
 * são explicados) e sem o "(peso Xx)" do bloco extra. Revisão da semana e Reta final já são humanos e ficam inteiros.
 */
export function humanReason(reasonText: string): string | null {
  const [firstPart] = reasonText.split(' • ');
  const text = (firstPart ?? '').replace(/\s*\(peso [^)]*\)/gi, '').trim();
  if (!text) return null;
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}
