import { Fragment, type CSSProperties, type ReactNode } from 'react';

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={index} className="px-1 rounded bg-slate-800 text-orange-200">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Intervalo entre um parágrafo e o seguinte ao surgir; resposta longa encurta o intervalo para caber no teto. */
export const REVEAL_STEP_MS = 260;
export const REVEAL_TOTAL_MS = 2400;

/** Atraso do bloco `index` (contando só os que têm texto) de `count`. */
export function revealDelayMs(index: number, count: number): number {
  const step = count > 1 ? Math.min(REVEAL_STEP_MS, REVEAL_TOTAL_MS / (count - 1)) : 0;
  return Math.round(index * step);
}

/**
 * Mostra o texto da IA e do caderno com negrito, itálico, títulos e listas, sem HTML cru
 * (o conteúdo vem de fora e não é confiável: nada de `dangerouslySetInnerHTML`). Com `reveal`, cada parágrafo entra
 * depois do anterior — a resposta nova não cai de uma vez na tela.
 */
export function RichText({ text, className = '', reveal = false }: { text: string; className?: string; reveal?: boolean }) {
  const lines = text.split('\n');
  const count = lines.filter((line) => line.trim()).length;
  let shown = 0;
  const motion = (): { className: string; style?: CSSProperties } => {
    if (!reveal) return { className: '' };
    const delay = revealDelayMs(shown, count);
    shown += 1;
    return { className: 'fofolab-reveal', style: { animationDelay: `${delay}ms` } };
  };
  return (
    <div className={`space-y-1 ${className}`}>
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        const m = motion();
        const heading = line.match(/^#{1,4}\s+(.*)$/);
        if (heading) {
          return <p key={index} className={`font-bold text-white pt-1 ${m.className}`} style={m.style}>{renderInline(heading[1])}</p>;
        }
        const bullet = line.match(/^(\s*)[*-]\s+(.*)$/);
        if (bullet) {
          return (
            <p key={index} className={`flex gap-1.5 ${m.className}`} style={{ ...m.style, paddingLeft: `${Math.min(bullet[1].length, 8) * 4}px` }}>
              <span aria-hidden="true">•</span>
              <span>{renderInline(bullet[2])}</span>
            </p>
          );
        }
        return <p key={index} className={m.className || undefined} style={m.style}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
