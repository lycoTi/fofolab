import type { SunTimes } from '../mascot/sun';
import { sunOrDefault, timeOfDayOutfit, type OutfitId } from '../mascot/wardrobe';
import type { BlockPhase } from '../study-block/studyBlockMachine';

/**
 * O que aparece agora na janela do Fofo. Céu e paisagem seguem o relógio; a festa vem da roupa (a roupa muda o
 * ambiente); o momento vem do bloco. O canvas só é pintado de novo quando `sceneKey` muda.
 */
export type SkyPhase = 'dia' | 'dourado' | 'noite';
export type Landscape = 'fazenda' | 'trilha' | 'cidade';
export type Festival = 'natal' | null;
export type WindowMoment = 'ritual' | 'foco' | 'dormindo' | 'acordado';

export interface SceneInput {
  now: Date;
  /** Nascer e pôr do sol de hoje; null = fuso desconhecido (vale 06:00–18:00, como no guarda-roupa). */
  sun: SunTimes | null;
  /** Roupa do Fofo na janela. */
  outfit: OutfitId;
  phase: BlockPhase;
  running: boolean;
  /** Olhada em andamento: o relógio para sozinho, mas o Fofo continua acordado. */
  peeking: boolean;
  /** Existe bloco atual ou rodando. */
  hasBlock: boolean;
  /** Cor da matéria do bloco (livro do ritual). */
  subjectColor: string | null;
}

export interface SceneView {
  sky: SkyPhase;
  landscape: Landscape;
  festival: Festival;
  moment: WindowMoment;
  subjectColor: string | null;
}

/** Entardecer e amanhecer: 40 min antes até 40 min depois do nascer e do pôr do sol. */
const GOLDEN_MS = 40 * 60_000;

function isNear(now: Date, mark: Date): boolean {
  return Math.abs(now.getTime() - mark.getTime()) <= GOLDEN_MS;
}

function skyAt(now: Date, sun: SunTimes | null): SkyPhase {
  const { sunrise, sunset } = sunOrDefault(now, sun);
  if (isNear(now, sunrise) || isNear(now, sunset)) return 'dourado';
  if (now > sunrise && now < sunset) return 'dia';
  return 'noite';
}

const LANDSCAPE_BY_PERIOD: Partial<Record<OutfitId, Landscape>> = {
  fazendeiro: 'fazenda',
  explorador: 'trilha',
  madrugada: 'cidade',
};

/** Pelo período do relógio, nunca pela roupa vestida: roupa fixada não troca o lugar. */
function landscapeAt(now: Date, sun: SunTimes | null): Landscape {
  return LANDSCAPE_BY_PERIOD[timeOfDayOutfit(now, sun)] ?? 'fazenda';
}

/** Só o Natal tem camada própria; as outras festas ficam com céu e paisagem. */
function festivalOf(outfit: OutfitId): Festival {
  if (outfit === 'natal') return 'natal';
  return null;
}

/** O Fofo dorme em qualquer pausa (entre pomodoros ou apertada), menos na pausa automática da olhada. */
function momentOf(input: SceneInput): WindowMoment {
  if (!input.hasBlock) return 'acordado';
  if (input.phase === 'BREAK') return 'dormindo';
  if (input.phase !== 'FOCUS') return 'ritual';
  if (input.running || input.peeking) return 'foco';
  return 'dormindo';
}

export function sceneViewAt(input: SceneInput): SceneView {
  return {
    sky: skyAt(input.now, input.sun),
    landscape: landscapeAt(input.now, input.sun),
    festival: festivalOf(input.outfit),
    moment: momentOf(input),
    subjectColor: input.subjectColor,
  };
}

/** Muda só quando algo visível muda; a hora em si fica fora, para não repintar a cada minuto. */
export function sceneKey(view: SceneView): string {
  return [view.sky, view.landscape, view.festival ?? '-', view.moment, view.subjectColor ?? '-'].join('|');
}
