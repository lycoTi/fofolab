import { useEffect, useState } from 'react';
import { ArrowLeft, BookPlus, Check, Copy, ExternalLink, Scale, X } from 'lucide-react';
import type { LawExcerpt } from '../../lib/fofoia/context';
import { LawArticleFormatter } from './LawArticleFormatter';

export interface LawReaderModalProps {
  excerpt: LawExcerpt;
  allExcerpts?: LawExcerpt[];
  onSelectExcerpt?: (excerpt: LawExcerpt) => void;
  onClose: () => void;
  onSaveToNotebook?: (markdown: string) => void;
}

/**
 * Slide-over tátil de leitura da norma ("Mesa de Estudos" - Opção B).
 * Ocupa a coluna lateral direita suavemente, permitindo ao estudante consultar
 * o dispositivo oficial na íntegra enquanto mantém a questão visível na coluna central.
 */
export function LawReaderModal({
  excerpt,
  allExcerpts = [],
  onSelectExcerpt,
  onClose,
  onSaveToNotebook,
}: LawReaderModalProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${excerpt.lawName} - ${excerpt.article}\n\n${excerpt.text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  const handleSave = () => {
    if (!onSaveToNotebook) return;
    const note = `**${excerpt.lawName} - ${excerpt.article}**\n\n> ${excerpt.text}`;
    onSaveToNotebook(note);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${excerpt.lawName} ${excerpt.article}`}
      className="absolute inset-0 z-40 flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-250 ease-out"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Voltar à conversa"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 shrink-0"
            title="Voltar à conversa"
          >
            <ArrowLeft size={16} />
          </button>
          <Scale size={15} className="text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-100 truncate">
            {excerpt.lawName} · {excerpt.article}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {excerpt.sourceUrl && (
            <a
              href={excerpt.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-sky-400 transition-colors hover:bg-slate-800 hover:text-sky-300 active:scale-[0.97]"
              title="Abrir no site do Planalto"
            >
              <span>Planalto</span>
              <ExternalLink size={11} />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white active:scale-95"
            title="Fechar (Esc)"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Subcabeçalho de Abas de Artigos se houver múltiplos */}
      {allExcerpts.length > 1 && (
        <div className="flex items-center gap-1.5 border-b border-slate-800/80 bg-slate-950/40 px-4 py-1.5 overflow-x-auto shrink-0">
          <span className="text-[10px] font-medium text-slate-400 select-none uppercase tracking-wider shrink-0">
            Artigos:
          </span>
          {allExcerpts.map((item) => {
            const isCurrent = item.lawName === excerpt.lawName && item.article === excerpt.article;
            return (
              <button
                key={`${item.lawName}-${item.article}`}
                type="button"
                onClick={() => onSelectExcerpt?.(item)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all active:scale-[0.97] ${
                  isCurrent
                    ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                {item.lawName} {item.article}
              </button>
            );
          })}
        </div>
      )}

      {/* Corpo com Formatação Vade Mecum Editorial */}
      <div className="flex-1 overflow-y-auto p-4.5 space-y-3">
        <LawArticleFormatter articleLabel={excerpt.article} fullText={excerpt.text} />
      </div>

      {/* Rodapé Tátil de Ações */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-4 py-2.5 shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all hover:bg-slate-800 hover:text-white active:scale-[0.97]"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copiado!' : 'Copiar texto'}</span>
        </button>

        <div className="flex items-center gap-2">
          {onSaveToNotebook && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saved}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all hover:bg-slate-800 hover:text-white active:scale-[0.97] disabled:opacity-50"
            >
              {saved ? <Check size={12} className="text-emerald-400" /> : <BookPlus size={12} />}
              <span>{saved ? 'Salvo no caderno' : '+ Caderno'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/[0.08] px-3 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.14] hover:text-white active:scale-[0.97]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
