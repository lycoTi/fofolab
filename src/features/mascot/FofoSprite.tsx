import { useMemo } from 'react';
import { FOFO_SPRITES } from './fofoSprites.generated';
import { OUTFIT_LABELS, type OutfitId } from './wardrobe';

/**
 * - still: parado (tela de erro, lugares onde nada deve se mexer);
 * - blink: só pisca de vez em quando (cabeçalho e painéis que ficam ao lado do estudo);
 * - full: alterna os quadros da roupa e pisca (momentos: aviso do FofoDoro, carregando).
 * Quem pediu menos movimento no sistema vê o Fofo parado em todos (CSS em index.css).
 */
export type FofoMotion = 'still' | 'blink' | 'full';

interface FofoSpriteProps {
  outfit: OutfitId;
  /** Escala inteira: 1 = 32 px, 2 = 64 px, 4 = 128 px. Escala quebrada borra o pixel. */
  scale?: 1 | 2 | 4;
  motion?: FofoMotion;
  /** Ao lado de um texto que já nomeia o Fofo: escondido do leitor de tela. */
  decorative?: boolean;
  className?: string;
}

/** Ritmo da troca de quadros de cada roupa: chama de vela tremula rápido, muda balança devagar. */
const FRAME_SECONDS: Record<OutfitId, number> = {
  fofodeck: 1.2,
  fazendeiro: 1.6,
  explorador: 0.9,
  madrugada: 0.7,
  halloween: 0.8,
  natal: 1,
  anonovo: 0.6,
  carnaval: 0.5,
  junina: 1.2,
  prova: 1.4,
  nomeado: 0.9,
};

interface Run {
  x: number;
  y: number;
  width: number;
  fill: string;
}

/** Junta pixels vizinhos da mesma cor numa linha só: bem menos retângulos no SVG. */
function toRuns(grid: string[], palette: Record<string, string>): Run[] {
  const runs: Run[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let width = 1;
      while (row[x + width] === c) width += 1;
      if (c !== '.') runs.push({ x, y, width, fill: palette[c] });
      x += width;
    }
  });
  return runs;
}

function Layer({ runs, className }: { runs: Run[]; className?: string }) {
  return (
    <g className={className}>
      {runs.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
    </g>
  );
}

export function FofoSprite({ outfit, scale = 1, motion = 'blink', decorative = false, className }: FofoSpriteProps) {
  const layers = useMemo(() => {
    const sprite = FOFO_SPRITES[outfit];
    return { a: toRuns(sprite.A, sprite.palette), b: toRuns(sprite.B, sprite.palette), closed: toRuns(sprite.closed, sprite.palette) };
  }, [outfit]);
  const size = 32 * scale;
  const label = OUTFIT_LABELS[outfit];
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };

  return (
    <svg
      {...a11y}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      className={`fofo-sprite shrink-0 ${className ?? ''}`}
      style={{ ['--fofo-frame' as string]: `${FRAME_SECONDS[outfit]}s` }}
    >
      {!decorative && <title>{label}</title>}
      <Layer runs={layers.a} className={motion === 'full' ? 'fofo-fa' : undefined} />
      {motion === 'full' && <Layer runs={layers.b} className="fofo-fb" />}
      {motion !== 'still' && <Layer runs={layers.closed} className="fofo-blink" />}
    </svg>
  );
}
