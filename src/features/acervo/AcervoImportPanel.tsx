import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { importAcervoPacote, type AcervoImportSummary, type LinkAi } from '../../lib/acervo/importAcervo';

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Linhas do resumo, em linguagem humana (spec 12c §5.2). */
export function summaryLines(s: AcervoImportSummary): string[] {
  const lines = [
    `${count(s.withSubject, 'questão com assunto', 'questões com assunto')} · ${count(s.topicsLinked, 'tópico do seu plano ligado', 'tópicos do seu plano ligados')} · ${s.topicsWithoutLink} sem ligação`,
  ];
  if (s.hidden > 0) lines.push(`${s.hidden} ficaram de fora (figura ou fórmula que não dá para ler).`);
  if (s.invalidItems > 0) lines.push(`${count(s.invalidItems, 'item com problema foi ignorado', 'itens com problema foram ignorados')}.`);
  if (s.copiesUpdated > 0) {
    lines.push(`${count(s.copiesUpdated, 'questão que você já usou foi atualizada', 'questões que você já usou foram atualizadas')}.`);
  }
  if (s.aiSkipped) lines.push('Sem IA configurada, os tópicos sem ligação ficam para a próxima importação.');
  return lines;
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: { done: number; total: number } | null }
  | { kind: 'done'; summary: AcervoImportSummary }
  | { kind: 'error'; message: string };

/**
 * Importar o pacote do minerador (spec 12c §5.2): troca o acervo deste computador e liga os tópicos do plano. A ligação
 * pela IA pode levar alguns minutos no plano grátis; cada ligação é gravada na hora, então fechar no meio não perde nada.
 */
export function AcervoImportPanel(props: { planId: string; ai: LinkAi | null; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<PanelState>({ kind: 'idle' });
  const running = state.kind === 'running';

  const start = async () => {
    if (!file) return;
    setState({ kind: 'running', progress: null });
    const result = await importAcervoPacote(await file.text(), {
      planId: props.planId,
      ai: props.ai,
      onProgress: (done, total) => setState({ kind: 'running', progress: { done, total } }),
    });
    if (!result.ok) {
      setState({ kind: 'error', message: result.message });
      return;
    }
    setState({ kind: 'done', summary: result.summary });
    props.onImported();
  };

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-slate-300">
        Escolha o arquivo do pacote gerado pelo minerador. As questões entram nos tópicos do seu plano pelo assunto; as que
        você já respondeu continuam com as suas respostas.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".json"
          aria-label="Escolher o arquivo do pacote"
          disabled={running}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setState({ kind: 'idle' });
          }}
          className="text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-950 file:px-3 file:py-1.5 file:text-slate-200"
        />
        <button
          type="button"
          disabled={!file || running}
          onClick={() => void start()}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-1.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-40"
        >
          <Database size={13} />
          Importar acervo
        </button>
      </div>

      {running && (
        <div role="status" className="space-y-1 text-slate-300">
          <p>{state.progress ? `Ligando tópicos: ${state.progress.done} de ${state.progress.total}` : 'Lendo o pacote…'}</p>
          {state.progress && <p className="text-slate-400">Pode fechar: o que faltar fica para a próxima importação.</p>}
        </div>
      )}

      {state.kind === 'done' && (
        <div role="status" className="space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
          {summaryLines(state.summary).map((line, i) => (
            <p key={line} className="flex items-center gap-2">
              {i === 0 && <CheckCircle2 size={14} className="shrink-0" />}
              {line}
            </p>
          ))}
        </div>
      )}

      {state.kind === 'error' && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
          <AlertTriangle size={14} className="shrink-0" />
          <p role="alert">{state.message}</p>
        </div>
      )}
    </div>
  );
}
