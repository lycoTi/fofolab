import { useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

/** Bloco de código com cabeçalho de linguagem, botão de cópia e rolagem horizontal. */
export function RichCodeBlock({
  code,
  language,
  className = '',
  style,
}: {
  code: string;
  language: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = language.trim().toUpperCase() || 'CÓDIGO';

  return (
    <div
      className={`my-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/90 text-left ${className}`}
      style={style}
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-3 py-1 text-[10px] text-slate-400">
        <span className="font-mono tracking-wider text-slate-300">{displayLang}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar código"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-400" />
              <span className="text-emerald-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Tabela Markdown com cabeçalho, linhas alternadas sutis e rolagem horizontal para não quebrar a coluna. */
export function RichTableBlock({
  headers,
  rows,
  renderInline,
  className = '',
  style,
}: {
  headers: string[];
  rows: string[][];
  renderInline: (text: string) => ReactNode[];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40 text-left ${className}`}
      style={style}
    >
      <table className="min-w-full border-collapse text-left text-xs">
        {headers.length > 0 && (
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-300">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-1.5 font-semibold text-[11px]">
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="border-b border-slate-800/40 last:border-b-0 odd:bg-slate-950/20 even:bg-slate-900/30">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-1.5 text-slate-200">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

