import { Fragment, type ReactNode } from 'react';

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

/**
 * Mostra o texto da IA e do caderno com negrito, itálico, títulos e listas, sem HTML cru
 * (o conteúdo vem de fora e não é confiável: nada de `dangerouslySetInnerHTML`).
 */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <div className={`space-y-1 ${className}`}>
      {lines.map((line, index) => {
        const heading = line.match(/^#{1,4}\s+(.*)$/);
        if (heading) {
          return <p key={index} className="font-bold text-white pt-1">{renderInline(heading[1])}</p>;
        }
        const bullet = line.match(/^(\s*)[*-]\s+(.*)$/);
        if (bullet) {
          return (
            <p key={index} className="flex gap-1.5" style={{ paddingLeft: `${Math.min(bullet[1].length, 8) * 4}px` }}>
              <span aria-hidden="true">•</span>
              <span>{renderInline(bullet[2])}</span>
            </p>
          );
        }
        if (!line.trim()) return <div key={index} className="h-1" />;
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
