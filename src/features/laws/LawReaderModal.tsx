import { useEffect, useState } from 'react';
import { BookPlus, Check, Copy, ExternalLink, Scale, X } from 'lucide-react';
import type { LawExcerpt } from '../../lib/fofoia/context';

export interface LawReaderModalProps {
  excerpt: LawExcerpt;
  onClose: () => void;
  onSaveToNotebook?: (markdown: string) => void;
}

/**
 * Modal tátil de leitura da norma na íntegra ("Mesa de Estudos").
 * Permite ler o artigo oficial compilado, abrir a fonte no Planalto e salvar no caderno.
 */
export function LawReaderModal({ excerpt, onClose, onSaveToNotebook }: LawReaderModalProps) {
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
      // Fallback gracioso
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-amber-400" />
            <span className="text-xs font-semibold text-slate-100">
              {excerpt.lawName} · {excerpt.article}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {excerpt.sourceUrl && (
              <a
                href={excerpt.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-sky-400 transition-colors hover:bg-slate-800 hover:text-sky-300"
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
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Texto do Artigo */}
        <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap selection:bg-orange-500/30">
          <p className="font-serif text-[13px] leading-relaxed tracking-wide text-slate-100">
            {excerpt.text}
          </p>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-4 py-2.5">
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
    </div>
  );
}

