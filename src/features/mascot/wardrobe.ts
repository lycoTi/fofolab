import { localDateKey } from '../../lib/timeFormat';

/**
 * Guarda-roupa do Fofo (regra em `.agents/rules/identidade-fofolab.md`): qual roupa ele veste agora.
 * Ordem: roupa fixa > dia da prova > nomeado > data especial > madrugada > aba > base.
 */
export type OutfitId =
  | 'fofodeck'
  | 'fazendeiro'
  | 'explorador'
  | 'madrugada'
  | 'halloween'
  | 'natal'
  | 'anonovo'
  | 'carnaval'
  | 'junina'
  | 'prova'
  | 'nomeado';

/** Nome lido por leitor de tela e mostrado ao passar o mouse. */
export const OUTFIT_LABELS: Record<OutfitId, string> = {
  fofodeck: 'Fofo',
  fazendeiro: 'Fofo de fazendeiro',
  explorador: 'Fofo de explorador',
  madrugada: 'Fofo estudando de madrugada',
  halloween: 'Fofo fantasiado de fantasma',
  natal: 'Fofo de Natal',
  anonovo: 'Fofo de ano-novo',
  carnaval: 'Fofo de Carnaval',
  junina: 'Fofo de festa junina',
  prova: 'Fofo no dia da prova',
  nomeado: 'Fofo nomeado',
};

export interface OutfitInput {
  now: Date;
  /** Aba aberta na bancada ('today', 'questions', 'cycle'...). */
  tab: string;
  /** Datas das provas cadastradas, 'YYYY-MM-DD'. */
  examDates: string[];
  /** Marcado pelo estudante; fica até ele desligar ou cadastrar uma prova nova. */
  appointed?: boolean;
  /** Roupa escolhida nas configurações; null ou ausente = automática. */
  fixedOutfit?: OutfitId | null;
}

/** Plano de estudo planta e rega; Questões explora o mapa da prova. As outras abas usam a base. */
const TAB_OUTFITS: Record<string, OutfitId> = {
  cycle: 'fazendeiro',
  questions: 'explorador',
};

function addDays(year: number, monthIndex: number, day: number, delta: number): string {
  return localDateKey(new Date(year, monthIndex, day + delta));
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
function easterSunday(year: number): { monthIndex: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { monthIndex: Math.floor(n / 31) - 1, day: (n % 31) + 1 };
}

/**
 * Período da roupa de Carnaval: das 2 semanas antes do sábado de Carnaval (Páscoa − 50) até a Quarta-feira de
 * Cinzas (Páscoa − 46). A data muda todo ano, e o período nunca atravessa a virada do ano.
 */
export function carnivalWindow(year: number): { start: string; end: string } {
  const easter = easterSunday(year);
  return {
    start: addDays(year, easter.monthIndex, easter.day, -64),
    end: addDays(year, easter.monthIndex, easter.day, -46),
  };
}

/** Festas de cerca de um mês, para as roupas de momento aparecerem no resto do ano. */
function specialDateOutfit(now: Date): OutfitId | null {
  const today = localDateKey(now);
  const monthDay = today.slice(5);
  const carnival = carnivalWindow(now.getFullYear());
  // Carnaval antes do Ano-novo: quando a Páscoa é cedo, as 2 semanas antes caem ainda em janeiro
  if (today >= carnival.start && today <= carnival.end) return 'carnaval';
  if (monthDay >= '10-01' && monthDay <= '10-31') return 'halloween';
  if (monthDay >= '12-01' && monthDay <= '12-30') return 'natal';
  if (monthDay === '12-31' || monthDay.startsWith('01-')) return 'anonovo';
  if (monthDay.startsWith('06-')) return 'junina';
  return null;
}

function isLateNight(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 22 || hour < 5;
}

export function pickOutfit(input: OutfitInput): OutfitId {
  if (input.fixedOutfit) return input.fixedOutfit;
  const today = localDateKey(input.now);
  if (input.examDates.some((date) => date.slice(0, 10) === today)) return 'prova';
  if (input.appointed) return 'nomeado';
  const special = specialDateOutfit(input.now);
  if (special) return special;
  if (isLateNight(input.now)) return 'madrugada';
  return TAB_OUTFITS[input.tab] ?? 'fofodeck';
}
