import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { FofoMode } from '../../lib/fofoia/signals';
import type { FofoActiveQuestion } from './FofoIaPanel';
import { FofoShortcuts } from './FofoShortcuts';
import type { SendOptions } from './useFofoConversation';

export interface FofoInputAreaProps {
  unanswered: boolean;
  activeQuestion: FofoActiveQuestion | null;
  topicLabel: string;
  talked: boolean;
  draft: string;
  loading: boolean;
  onChangeDraft: (val: string) => void;
  onSubmit: () => void;
  onHint: () => void;
  onLesson: () => void;
  onSend: (message: string, mode?: FofoMode, options?: SendOptions) => void;
}

export function FofoInputArea({
  unanswered,
  activeQuestion,
  topicLabel,
  talked,
  draft,
  loading,
  onChangeDraft,
  onSubmit,
  onHint,
  onLesson,
  onSend,
}: FofoInputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = Math.round(window.innerHeight * 0.35);
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [draft]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="space-y-2 border-t border-slate-800/80 bg-slate-950/60 p-3">
      <FofoShortcuts
        unanswered={unanswered}
        activeQuestion={activeQuestion}
        topicLabel={topicLabel}
        talked={talked}
        onHint={onHint}
        onLesson={onLesson}
        onSend={onSend}
      />
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => onChangeDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre o tópico ou a questão…"
          aria-label="Pergunte à FofoIA"
          className="max-h-[35vh] flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white outline-none focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          aria-label="Enviar pergunta"
          className="rounded-xl bg-orange-500 p-2 text-white shadow-sm transition-transform duration-100 hover:bg-orange-600 active:scale-95 disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
      <p className="text-[10px] text-slate-500">Suas anotações deste tópico vão junto com a pergunta para a IA.</p>
    </div>
  );
}

