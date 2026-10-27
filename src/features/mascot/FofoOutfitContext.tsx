import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FofoSprite, type FofoMotion } from './FofoSprite';
import { pickOutfit, type OutfitId } from './wardrobe';

const OutfitContext = createContext<OutfitId>('fofodeck');

/** O App escolhe a roupa uma vez; cabeçalho, FofoIA e avisos leem daqui sem receber a roupa por props. */
export function FofoOutfitProvider({ outfit, children }: { outfit: OutfitId; children: ReactNode }) {
  return <OutfitContext.Provider value={outfit}>{children}</OutfitContext.Provider>;
}

/** O Fofo com a roupa de agora. */
export function CurrentFofo(props: { scale?: 1 | 2 | 4; motion?: FofoMotion; decorative?: boolean; className?: string }) {
  const outfit = useContext(OutfitContext);
  return <FofoSprite outfit={outfit} {...props} />;
}

const REFRESH_MS = 60_000;

/** Roupa para a aba aberta, refeita a cada minuto: passar das 22:00 ou virar o mês troca sem mudar de aba. */
export function useFofoOutfit(tab: string, examDates: string[]): OutfitId {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  return pickOutfit({ now, tab, examDates });
}
