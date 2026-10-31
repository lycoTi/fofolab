import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Layers, X } from 'lucide-react';

export interface CreateFlashcardModalProps {
  open: boolean;
  onClose: () => void;
  topicLabel: string;
  initialStatement?: string;
  initialExplanation?: string;
  onSave: (params: {
    statement: string;
    finalAnswer: string;
    dissectionMarkdown: string;
    options?: string[];
  }) => void;
}

type CardFormat = 'CERTO_ERRADO' | 'OPEN';

export function CreateFlashcardModal({
  open,
  onClose,
  topicLabel,
  initialStatement = '',
  initialExplanation = '',
  onSave,
}: CreateFlashcardModalProps) {
  const [format, setFormat] = useState<CardFormat>('CERTO_ERRADO');
  const [statement, setStatement] = useState(initialStatement);
  const [finalAnswer, setFinalAnswer] = useState<'C' | 'E'>('C');
  const [explanation, setExplanation] = useState(initialExplanation);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setStatement(initialStatement);
      setExplanation(initialExplanation);
      setFinalAnswer('C');
      setSaved(false);
    }
  }, [open, initialStatement, initialExplanation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && statement.trim()) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, statement, finalAnswer, explanation, format]);

  if (!open) return null;

  const handleSave = () => {
    if (!statement.trim()) return;
    onSave({
      statement: statement.trim(),
      finalAnswer: format === 'CERTO_ERRADO' ? finalAnswer : 'C',
      dissectionMarkdown: explanation.trim(),
      options: format === 'CERTO_ERRADO' ? ['C) Certo', 'E) Errado'] : ['C) Entendi e lembrei', 'E) Preciso revisar mais'],
    });
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Criar flashcard de revisão"
        className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Layers size={16} className="text-amber-400" />
              <span>Criar Flashcard de Revisão</span>
            </h2>
            <p className="text-xs text-slate-400">
              {`Adiciona este item ao ciclo de Revisão do Dia em ${topicLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tipo de formato */}
        <div className="flex rounded-lg border border-slate-800 bg-slate-950/60 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setFormat('CERTO_ERRADO')}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              format === 'CERTO_ERRADO'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Certo / Errado (Afirmação)
          </button>
          <button
            type="button"
            onClick={() => setFormat('OPEN')}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              format === 'OPEN'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Conceito Aberto (Pergunta direta)
          </button>
        </div>

        {/* Frente */}
        <div className="space-y-1.5">
          <label htmlFor="flashcard-front" className="block text-xs font-medium text-slate-300">
            Frente (o que você vai julgar ou responder de cabeça na revisão)
          </label>
          <textarea
            id="flashcard-front"
            rows={3}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            aria-label="Afirmação ou pergunta do flashcard"
            placeholder="Ex.: Em contratos administrativos de TI, a repactuação só pode ser solicitada após 12 meses..."
            className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500/70"
          />
        </div>

        {/* Seletor de Gabarito para C/E */}
        {format === 'CERTO_ERRADO' && (
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-300">Gabarito correto:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFinalAnswer('C')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-all ${
                  finalAnswer === 'C'
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                {finalAnswer === 'C' && <Check size={13} className="text-emerald-400" />}
                <span>Certo</span>
              </button>
              <button
                type="button"
                onClick={() => setFinalAnswer('E')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-all ${
                  finalAnswer === 'E'
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-200'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                {finalAnswer === 'E' && <Check size={13} className="text-rose-400" />}
                <span>Errado</span>
              </button>
            </div>
          </div>
        )}

        {/* Verso / Explicação */}
        <div className="space-y-1.5">
          <label htmlFor="flashcard-back" className="block text-xs font-medium text-slate-300">
            Verso (explicação ou distinção chave pós-resposta)
          </label>
          <textarea
            id="flashcard-back"
            rows={3}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="A explicação da FofoIA ou a justificativa jurídica/técnica..."
            className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500/70"
          />
        </div>

        {/* Ações inferiores */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
          <span className="text-[10px] text-slate-500">Dica: use Ctrl+Enter para salvar</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!statement.trim() || saved}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-all hover:bg-amber-500/25 active:scale-[0.97] disabled:opacity-40"
            >
              {saved ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span className="text-emerald-300">Salvo!</span>
                </>
              ) : (
                <>
                  <Layers size={13} />
                  <span>Salvar na Revisão</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

