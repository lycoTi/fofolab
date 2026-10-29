import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { RichCodeBlock, RichTableBlock } from './richTextBlocks';

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|~~[^~\n]+~~)/g;

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={index} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-orange-200">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return <del key={index} className="line-through text-slate-400">{part.slice(2, -2)}</del>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Intervalo entre um bloco e o seguinte ao surgir; resposta longa encurta o intervalo para caber no teto. */
export const REVEAL_STEP_MS = 260;
export const REVEAL_TOTAL_MS = 2400;

/** Atraso do bloco `index` (contando só os que têm conteúdo) de `count`. */
export function revealDelayMs(index: number, count: number): number {
  const step = count > 1 ? Math.min(REVEAL_STEP_MS, REVEAL_TOTAL_MS / (count - 1)) : 0;
  return Math.round(index * step);
}

type RichBlock =
  | { type: 'empty' }
  | { type: 'heading'; level: number; text: string }
  | { type: 'bullet'; indent: number; text: string }
  | { type: 'numbered'; number: string; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'paragraph'; text: string };

function parseBlocks(rawText: string): RichBlock[] {
  const lines = rawText.split('\n');
  const blocks: RichBlock[] = [];
  let i = 0;

  const isTableRow = (l: string) => /^\s*\|(.+)\|\s*$/.test(l);
  const isTableSeparator = (l: string) => /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(l);
  const parseCells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de código cercado (fenced code block)
    const codeMatch = line.match(/^```(\w*)/);
    if (codeMatch) {
      const language = codeMatch[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].startsWith('```')) {
        i++;
      }
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      continue;
    }

    // Tabela Markdown
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseCells(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Linha em branco
    if (!line.trim()) {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    // Cabeçalho Markdown (# a ####)
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    // Linha horizontal divisória
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Citação em bloco
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      const quoteLines: string[] = [quote[1]];
      i++;
      while (i < lines.length) {
        const nextQuote = lines[i].match(/^>\s?(.*)$/);
        if (nextQuote) {
          quoteLines.push(nextQuote[1]);
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    // Marcador com lista (bullets)
    const bullet = line.match(/^(\s*)[*-]\s+(.*)$/);
    if (bullet) {
      blocks.push({ type: 'bullet', indent: bullet[1].length, text: bullet[2] });
      i++;
      continue;
    }

    // Lista numerada
    const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({ type: 'numbered', number: numbered[2], text: numbered[3] });
      i++;
      continue;
    }

    // Parágrafo de texto normal
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-sm font-bold text-white pt-2 pb-0.5',
  2: 'text-xs font-bold text-white pt-1.5 pb-0.5',
  3: 'text-xs font-semibold text-orange-200 pt-1 pb-0.5',
  4: 'text-xs font-semibold text-slate-300 pt-0.5',
};

/**
 * Mostra o texto da IA e do caderno com negrito, itálico, código, tabelas, citações e listas, sem HTML cru
 * (o conteúdo vem de fora e não é confiável: nada de `dangerouslySetInnerHTML`). Com `reveal`, cada bloco entra
 * gradualmente depois do anterior.
 */
export function RichText({ text, className = '', reveal = false }: { text: string; className?: string; reveal?: boolean }) {
  const blocks = parseBlocks(text);
  const count = blocks.filter((b) => b.type !== 'empty').length;
  let shown = 0;

  const motion = (): { className: string; style?: CSSProperties } => {
    if (!reveal) return { className: '' };
    const delay = revealDelayMs(shown, count);
    shown += 1;
    return { className: 'fofolab-reveal', style: { animationDelay: `${delay}ms` } };
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === 'empty') {
          return <div key={index} className="h-1" />;
        }

        const m = motion();

        if (block.type === 'code') {
          return <RichCodeBlock key={index} language={block.language} code={block.code} className={m.className} style={m.style} />;
        }

        if (block.type === 'table') {
          return (
            <RichTableBlock
              key={index}
              headers={block.headers}
              rows={block.rows}
              renderInline={renderInline}
              className={m.className}
              style={m.style}
            />
          );
        }

        if (block.type === 'heading') {
          return (
            <p key={index} className={`${HEADING_CLASSES[block.level] || HEADING_CLASSES[4]} ${m.className}`} style={m.style}>
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={index}
              className={`my-1.5 rounded-r border-l-2 border-orange-500/60 bg-slate-900/50 py-1 pl-3 pr-2 italic text-slate-300 text-xs ${m.className}`}
              style={m.style}
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        if (block.type === 'bullet') {
          return (
            <p key={index} className={`flex gap-1.5 ${m.className}`} style={{ ...m.style, paddingLeft: `${Math.min(block.indent, 8) * 4}px` }}>
              <span aria-hidden="true">•</span>
              <span>{renderInline(block.text)}</span>
            </p>
          );
        }

        if (block.type === 'numbered') {
          return (
            <p key={index} className={`flex gap-1.5 items-baseline ${m.className}`} style={m.style}>
              <span className="font-mono text-[11px] font-semibold text-orange-400/80 shrink-0 select-none">{block.number}.</span>
              <span>{renderInline(block.text)}</span>
            </p>
          );
        }

        if (block.type === 'hr') {
          return <hr key={index} className={`my-2 border-slate-800 ${m.className}`} style={m.style} />;
        }

        return (
          <p key={index} className={m.className || undefined} style={m.style}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
