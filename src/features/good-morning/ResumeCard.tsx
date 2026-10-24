import { FileText, NotebookPen } from 'lucide-react';

export interface ResumeTarget {
  topicLabel: string;
  subjectId: string;
  topicId: string;
}

interface ResumeCardProps {
  pdf: (ResumeTarget & { title: string; page: number; totalPages: number }) | null;
  note: ResumeTarget | null;
  onOpenPdf: (subjectId: string, topicId: string) => void;
  onOpenNotes: (subjectId: string, topicId: string) => void;
}

const row =
  'flex w-full items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition-colors duration-150 hover:border-orange-500/50';

/** "Continuar de onde parou": o último PDF (na página em que parou) e a última anotação, a um clique. */
export function ResumeCard({ pdf, note, onOpenPdf, onOpenNotes }: ResumeCardProps) {
  if (!pdf && !note) return null;
  return (
    <section aria-label="Continuar de onde parou" className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-semibold text-white">Continuar de onde parou</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {pdf && (
          <button type="button" onClick={() => onOpenPdf(pdf.subjectId, pdf.topicId)} className={row}>
            <FileText size={16} className="mt-0.5 shrink-0 text-orange-400" />
            <span className="min-w-0 space-y-0.5">
              <span className="block truncate text-xs font-medium text-slate-100">{`${pdf.title} · página ${pdf.page} de ${pdf.totalPages}`}</span>
              <span className="block truncate text-[11px] text-slate-400">{pdf.topicLabel}</span>
            </span>
          </button>
        )}
        {note && (
          <button type="button" onClick={() => onOpenNotes(note.subjectId, note.topicId)} className={row}>
            <NotebookPen size={16} className="mt-0.5 shrink-0 text-orange-400" />
            <span className="min-w-0 space-y-0.5">
              <span className="block truncate text-xs font-medium text-slate-100">Última anotação</span>
              <span className="block truncate text-[11px] text-slate-400">{note.topicLabel}</span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
