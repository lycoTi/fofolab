import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ParsedEdital } from '../../lib/editalParser';
import { draftWeights, type EditalDraft } from './editalDraft';

const inputClass =
  'px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-orange-500 outline-none';

function MissingHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="text-[10px] text-amber-300 flex items-center gap-1">
      <AlertTriangle size={11} />
      Não achei no edital — confira
    </span>
  );
}

function NumberCell({ value, onChange, label }: { value: number | null; onChange: (value: number | null) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`${inputClass} w-16 text-center`}
    />
  );
}

/** Prévia editável do que foi lido do edital: nada é gravado antes de o estudante conferir. */
export function EditalPreview({
  edital,
  draft,
  onChange,
}: {
  edital: ParsedEdital;
  draft: EditalDraft;
  onChange: (draft: EditalDraft) => void;
}) {
  const [openSubject, setOpenSubject] = useState<number | null>(null);
  const weights = draftWeights(draft);
  const set = (changes: Partial<EditalDraft>) => onChange({ ...draft, ...changes });
  const setPart = (index: number, changes: Partial<EditalDraft['parts'][number]>) =>
    set({ parts: draft.parts.map((p, i) => (i === index ? { ...p, ...changes } : p)) });

  return (
    <div className="space-y-5">
      <section aria-label="Concurso" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="sm:col-span-2 space-y-1">
          <span className="text-[11px] text-slate-400">Nome do plano</span>
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={`${inputClass} w-full`} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
            Data da prova <MissingHint show={!draft.examDate} />
          </span>
          <input
            type="date"
            value={draft.examDate ?? ''}
            onChange={(e) => set({ examDate: e.target.value || null })}
            className={`${inputClass} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
            Último dia de inscrição <MissingHint show={!draft.registrationDeadline} />
          </span>
          <input
            type="date"
            value={draft.registrationDeadline ?? ''}
            onChange={(e) => set({ registrationDeadline: e.target.value || null })}
            className={`${inputClass} w-full`}
          />
        </label>
        <p className="sm:col-span-2 text-[11px] text-slate-400">
          {[edital.organ, edital.board && `banca ${edital.board}`, edital.fee && `taxa R$ ${edital.fee.toFixed(2).replace('.', ',')}`]
            .filter(Boolean)
            .join(' • ')}
        </p>
      </section>

      <section aria-label="Provas" className="space-y-2">
        <h4 className="text-xs font-bold text-white">Provas objetivas</h4>
        <div className="space-y-1.5">
          {draft.parts.map((part, index) => (
            <div key={part.code} className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
              <span className="w-56 truncate">
                <strong className="text-orange-300">{part.code}</strong> {part.name}
              </span>
              <NumberCell label={`Itens da ${part.code}`} value={part.itemCount} onChange={(v) => setPart(index, { itemCount: v ?? 0 })} />
              <span className="text-slate-500">itens ×</span>
              <NumberCell label={`Pontos por acerto da ${part.code}`} value={part.pointsPerItem} onChange={(v) => setPart(index, { pointsPerItem: v ?? 1 })} />
              <span className="text-slate-500">pt • mínimo</span>
              <NumberCell label={`Nota mínima da ${part.code}`} value={part.minScore} onChange={(v) => setPart(index, { minScore: v })} />
            </div>
          ))}
          {draft.parts.length === 0 && <MissingHint show />}
          {edital.minTotalScore !== null && (
            <p className="text-[11px] text-slate-500">Mínimo somando as provas: {edital.minTotalScore} pontos.</p>
          )}
        </div>
      </section>

      <section aria-label="Matérias" className="space-y-2">
        <h4 className="text-xs font-bold text-white">
          Matérias ({draft.subjects.length}){' '}
          <span className="font-normal text-slate-500">
            — peso estimado: o edital diz os itens de cada prova, não de cada matéria
          </span>
        </h4>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {draft.subjects.map((subject, index) => {
            const open = openSubject === index;
            return (
              <div key={`${subject.partCode}-${subject.name}`} className="rounded-lg bg-slate-950/70 border border-slate-800">
                <div className="px-2.5 py-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setOpenSubject(open ? null : index)}
                    aria-expanded={open}
                    className="min-w-0 flex-1 flex items-center gap-1.5 text-left text-slate-200"
                  >
                    {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className="text-orange-300 shrink-0">{subject.partCode ?? '—'}</span>
                    <span className="truncate">{subject.name}</span>
                    <span className="text-slate-500 shrink-0">{subject.topics.length} tópicos</span>
                  </button>
                  <span className="text-slate-500">≈ {weights[index].points} pts • peso</span>
                  <NumberCell
                    label={`Peso de ${subject.name}`}
                    value={weights[index].weight}
                    onChange={(v) => set({ weightOverrides: { ...draft.weightOverrides, [index]: v ?? 1 } })}
                  />
                </div>
                {open && (
                  <ul className="px-8 pb-2 space-y-0.5 text-[11px] text-slate-400">
                    {subject.topics.map((topic) => (
                      <li key={`${topic.code}-${topic.title}`} className={topic.code?.includes('.') ? 'pl-4' : 'text-slate-300'}>
                        {topic.code} {topic.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
