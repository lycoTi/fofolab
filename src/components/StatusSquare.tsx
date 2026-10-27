/**
 * Status como quadradinho de pixel (8 px, canto reto) ao lado do texto, no lugar de 🟢🟡🔴: a cor nunca fala sozinha.
 * Cores de status do FofoLab: emerald dominado/correto · amber dúvida/atenção · blue mapeamento inicial · rose lacuna.
 */
export type StatusTone = 'emerald' | 'amber' | 'blue' | 'rose' | 'orange' | 'slate';

const TONE_BG: Record<StatusTone, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  blue: 'bg-blue-400',
  rose: 'bg-rose-400',
  orange: 'bg-orange-400',
  slate: 'bg-slate-500',
};

export function StatusSquare({ tone, className }: { tone: StatusTone; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 ${TONE_BG[tone]} ${className ?? ''}`} />;
}
