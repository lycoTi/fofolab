import { useEffect, useState } from 'react';
import { BookOpen, FileText, FolderOpen } from 'lucide-react';
import type { PdfSource, Topic } from '../../types/database';

/**
 * Estimativa do total de páginas lendo a estrutura do PDF (sem bibliotecas).
 * Funciona na maioria dos PDFs; quando a estrutura é compactada devolve `null` e o estudante
 * ajusta o total à mão no campo "de N".
 */
export async function estimatePdfPageCount(file: Blob): Promise<number | null> {
  try {
    const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
    const pageObjects = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
    if (pageObjects > 0) return pageObjects;
    let maxCount = 0;
    for (const match of text.matchAll(/\/Count\s+(\d+)/g)) maxCount = Math.max(maxCount, Number(match[1]));
    return maxCount > 0 ? maxCount : null;
  } catch {
    return null;
  }
}

export interface PdfProgressUpdate {
  /** Registro exibido que deve ser atualizado (omitido ao abrir outro arquivo). */
  pdfSourceId?: string | null;
  title: string;
  filePath: string;
  currentPage: number;
  totalPages: number;
}

/**
 * Leitor de PDF local. O arquivo é aberto do computador do estudante e NUNCA copiado para o banco
 * (política de direitos autorais, docs/specs/02): guardamos só o nome, a página e o total.
 * O navegador não informa o caminho completo, então após reiniciar é preciso abrir o arquivo de novo.
 */
export function PdfFilePicker({
  onOpenFile,
  compact = false,
}: {
  onOpenFile: (file: File) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={`rounded-lg bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition ${
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'w-full py-2 px-3 text-xs'
      }`}
    >
      <FolderOpen size={13} className="text-orange-400" />
      <span>{compact ? 'Abrir outro PDF' : 'Abrir arquivo .PDF do computador'}</span>
      <input
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="Escolher arquivo PDF"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onOpenFile(file);
        }}
      />
    </label>
  );
}

export function PdfPageControls({
  pdfSource,
  onChange,
}: {
  pdfSource: PdfSource;
  onChange: (update: PdfProgressUpdate) => void;
}) {
  const [pageInput, setPageInput] = useState(String(pdfSource.current_page));
  const [totalInput, setTotalInput] = useState(String(pdfSource.total_pages));

  useEffect(() => {
    setPageInput(String(pdfSource.current_page));
    setTotalInput(String(pdfSource.total_pages));
  }, [pdfSource.id, pdfSource.current_page, pdfSource.total_pages]);

  const save = (currentPage: number, totalPages: number) =>
    onChange({
      pdfSourceId: pdfSource.id,
      title: pdfSource.title,
      filePath: pdfSource.file_path,
      currentPage,
      totalPages,
    });

  const commitInputs = () => {
    const total = Math.max(1, Number(totalInput) || pdfSource.total_pages);
    const page = Math.max(1, Math.min(total, Number(pageInput) || pdfSource.current_page));
    if (page !== pdfSource.current_page || total !== pdfSource.total_pages) save(page, total);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-slate-400">Página</span>
      <input
        value={pageInput}
        onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
        onBlur={commitInputs}
        onKeyDown={(e) => e.key === 'Enter' && commitInputs()}
        inputMode="numeric"
        aria-label="Página atual"
        className="w-12 px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-white text-center focus:border-orange-500 outline-none"
      />
      <span className="text-slate-400">de</span>
      <input
        value={totalInput}
        onChange={(e) => setTotalInput(e.target.value.replace(/\D/g, ''))}
        onBlur={commitInputs}
        onKeyDown={(e) => e.key === 'Enter' && commitInputs()}
        inputMode="numeric"
        aria-label="Total de páginas"
        title="Ajuste para o total de páginas do seu PDF"
        className="w-12 px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-white text-center focus:border-orange-500 outline-none"
      />
      <button
        type="button"
        onClick={() => save(Math.max(1, pdfSource.current_page - 1), pdfSource.total_pages)}
        className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200 hover:border-slate-700"
      >
        -1 pág
      </button>
      <button
        type="button"
        onClick={() => save(Math.min(pdfSource.total_pages, pdfSource.current_page + 1), pdfSource.total_pages)}
        className="px-2 py-1 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300 font-semibold"
      >
        +1 pág lida
      </button>
    </div>
  );
}

export function PdfFrame({ fileUrl, page, title }: { fileUrl: string; page: number; title: string }) {
  return (
    <iframe
      key={`${fileUrl}#${page}`}
      src={`${fileUrl}#page=${page}`}
      title={title}
      className="flex-1 w-full min-h-0 rounded-xl border border-slate-800 bg-slate-950"
    />
  );
}

/** Leitura em tela grande no palco central (o caderno continua ao lado, com largura ajustável). */
export function PdfReaderStage({
  currentTopic,
  pdfSource,
  pdfFileUrl,
  pdfFileName,
  onOpenFile,
  onSaveProgress,
}: {
  currentTopic: Topic | null;
  pdfSource: PdfSource | null;
  pdfFileUrl: string | null;
  pdfFileName: string | null;
  onOpenFile: (file: File) => void;
  onSaveProgress: (update: PdfProgressUpdate) => void;
}) {
  const showingFile = pdfFileUrl !== null;

  return (
    <section aria-label="Leitura de PDF em tela grande" className="h-full flex flex-col gap-3 min-h-0">
      <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
            <BookOpen size={14} className="text-orange-400 shrink-0" />
            {pdfSource?.title ?? pdfFileName ?? `PDF — ${currentTopic?.title ?? 'Tópico'}`}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {currentTopic ? `Tópico ${currentTopic.code ?? ''} ${currentTopic.title}` : 'Selecione um tópico'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pdfSource && <PdfPageControls pdfSource={pdfSource} onChange={onSaveProgress} />}
          {showingFile && <PdfFilePicker onOpenFile={onOpenFile} compact />}
        </div>
      </div>

      {showingFile ? (
        <PdfFrame fileUrl={pdfFileUrl} page={pdfSource?.current_page ?? 1} title="Leitor de PDF em tela grande" />
      ) : (
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-8 flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-3">
          <FileText size={28} className="text-slate-600" />
          {pdfSource ? (
            <p>
              Seu marcador está na página <strong>{pdfSource.current_page}</strong> de{' '}
              <strong>{pdfSource.total_pages}</strong> de <strong>{pdfSource.title}</strong>. Abra o arquivo para continuar
              lendo aqui, em tela grande.
            </p>
          ) : (
            <p>Abra o PDF do seu material para ler em tela grande, com o caderno ao lado.</p>
          )}
          <div className="w-72">
            <PdfFilePicker onOpenFile={onOpenFile} />
          </div>
        </div>
      )}
    </section>
  );
}
