import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FofoSprite, type FofoMotion } from './FofoSprite';
import { applyFofoThemeToDom, getFofoTheme, type FofoThemeTokens } from './fofoThemes';
import type { PoseId } from './poses';
import { coordsForTimeZone, sunTimes } from './sun';
import { pickOutfit, type OutfitId } from './wardrobe';

export interface FofoOutfits {
  /** Roupa no app (cabeçalho, FofoIA, Wizard). */
  app: OutfitId;
  /** Roupa no FofoDoro (o Fofo do relógio, salvo festa, marco ou roupa fixa). */
  fofodoro: OutfitId;
  /** Bloco de foco correndo: o Fofo só pisca, para não puxar o olho do estudo. */
  focus: boolean;
  /** Pausa do FofoDoro (entre pomodoros ou apertada pelo estudante): o Fofo do cabeçalho cochila. */
  resting?: boolean;
}

const OutfitContext = createContext<FofoOutfits>({ app: 'fofodeck', fofodoro: 'fofodeck', focus: false });

/** O App escolhe as roupas uma vez; cabeçalho, FofoIA e avisos leem daqui sem receber a roupa por props. */
export function FofoOutfitProvider({ value, children }: { value: FofoOutfits; children: ReactNode }) {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const theme = getFofoTheme(value.app);
      applyFofoThemeToDom(theme, document.documentElement);
    }
  }, [value.app]);

  return <OutfitContext.Provider value={value}>{children}</OutfitContext.Provider>;
}

/** Tema visual adaptativo baseado na roupa/profissão ativa do Fofo. */
export function useCurrentFofoTheme(): FofoThemeTokens {
  const outfits = useContext(OutfitContext);
  return getFofoTheme(outfits.app);
}

/** O Fofo com a roupa de agora (ou numa pose de momento). `auto` (padrão): se mexe, mas durante o foco só pisca. */
export function CurrentFofo({
  place = 'app',
  motion = 'auto',
  sleepWhenResting = false,
  pose,
  ...props
}: {
  place?: 'app' | 'fofodoro';
  pose?: PoseId;
  /** Só o do cabeçalho: na pausa, dorme (os outros continuam com a roupa). */
  sleepWhenResting?: boolean;
  motion?: FofoMotion | 'auto';
  scale?: 1 | 2 | 4;
  decorative?: boolean;
  className?: string;
}) {
  const outfits = useContext(OutfitContext);
  let resolved: FofoMotion = motion === 'auto' ? 'full' : motion;
  if (motion === 'auto' && outfits.focus) resolved = 'blink';
  const resolvedPose = pose ?? (sleepWhenResting && outfits.resting ? 'dormindo' : undefined);
  return <FofoSprite outfit={outfits[place]} pose={resolvedPose} motion={resolved} {...props} />;
}

const REFRESH_MS = 60_000;

/** Nascer e pôr do sol de hoje pelo fuso do computador (sem pedir localização). */
function todaysSun(now: Date) {
  const coords = coordsForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (!coords) return null;
  return sunTimes(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12), coords.lat, coords.lon);
}

/**
 * Roupas de agora, refeitas a cada minuto: passar do pôr do sol, das 22:00 ou virar o mês troca sozinho.
 * `automatic` é a que valeria sem roupa fixa (mostrada no guarda-roupa como "Automática").
 * `now` e `sun` saem do mesmo relógio, para a janela do Fofo trocar o céu junto com a roupa, sem outro timer.
 */
export function useFofoOutfit(input: { examDates: string[]; appointed?: boolean; fixedOutfit?: OutfitId | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  const sun = todaysSun(now);
  const base = { now, examDates: input.examDates, appointed: input.appointed, sun };
  return {
    app: pickOutfit({ ...base, fixedOutfit: input.fixedOutfit }),
    fofodoro: pickOutfit({ ...base, fixedOutfit: input.fixedOutfit, place: 'fofodoro' }),
    automatic: pickOutfit(base),
    now,
    sun,
  };
}
