import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { QuestionScope } from '../../lib/acervo/topicQuestions';

export type { QuestionScope };
export type QuestionStatusFilter = 'UNSOLVED' | 'RETRY' | 'ALL';
export type QuestionFormatFilter = 'ALL' | 'CE' | 'ME';

const selectPrimary =
  'h-8 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs font-medium text-slate-200 outline-none transition-colors focus:border-orange-500';
const selectSecondary =
  'h-7 rounded-md border border-slate-800/90 bg-slate-950/80 px-2 text-[11px] text-slate-300 outline-none transition-colors focus:border-orange-500';

function groupLabel(groupCode: string | null): string {
  return groupCode ? `Tópico ${groupCode}` : 'Do mesmo tópico-pai';
}

/** Barra técnica de filtros (escopo, situação da fila, formato, busca, banca, complexidade) e paginação da questão ativa. */
export function QuestionFilters(props: {
  scope: QuestionScope;
  onScope: (scope: QuestionScope) => void;
  statusFilter: QuestionStatusFilter;
  onStatusFilter: (status: QuestionStatusFilter) => void;
  counts: { unsolved: number; retry: number; all: number };
  formatFilter: QuestionFormatFilter;
  onFormatFilter: (format: QuestionFormatFilter) => void;
  board: string;
  boards: string[];
  onBoard: (board: string) => void;
  complexity: string;
  onComplexity: (complexity: string) => void;
  search: string;
  onSearch: (search: string) => void;
  position: { index: number; total: number };
  /** Tópico-pai do subtópico atual; `null` = tópico sem pai. */
  groupCode: string | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { index, total } = props.position;
  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={props.scope}
            onChange={(e) => props.onScope(e.target.value as QuestionScope)}
            aria-label="Escopo das questões"
            className={selectPrimary}
          >
            <option value="topic">Deste tópico</option>
            {(props.groupCode || props.scope === 'group') && <option value="group">{groupLabel(props.groupCode)}</option>}
            <option value="subject">Toda a matéria</option>
            <option value="all">Todo o plano</option>
          </select>
          <select
            value={props.statusFilter}
            onChange={(e) => props.onStatusFilter(e.target.value as QuestionStatusFilter)}
            aria-label="Filtrar por situação"
            className={selectPrimary}
          >
            <option value="UNSOLVED">{`Inéditas (${props.counts.unsolved})`}</option>
            <option value="RETRY">{`Errei ou chutei (${props.counts.retry})`}</option>
            <option value="ALL">{`Todas (${props.counts.all})`}</option>
          </select>
          <select
            value={props.formatFilter}
            onChange={(e) => props.onFormatFilter(e.target.value as QuestionFormatFilter)}
            aria-label="Filtrar por formato"
            className={selectPrimary}
          >
            <option value="ALL">Todos os formatos</option>
            <option value="CE">Certo/Errado</option>
            <option value="ME">Múltipla escolha</option>
          </select>
        </div>

        {total > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="pr-1 tabular-nums text-slate-400">
              Questão <strong className="font-semibold text-white">{index + 1}</strong> de{' '}
              <strong className="font-semibold text-white">{total}</strong>
            </span>
            <button
              type="button"
              disabled={index === 0}
              onClick={props.onPrev}
              aria-label="Questão anterior"
              title="Questão anterior"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-300 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={props.onNext}
              aria-label="Próxima questão"
              title="Próxima questão"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-300 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/70 pt-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder="Buscar termo no enunciado..."
            aria-label="Buscar termo no enunciado"
            className={`${selectSecondary} w-full pl-7 pr-2.5`}
          />
        </div>
        <select value={props.board} onChange={(e) => props.onBoard(e.target.value)} aria-label="Filtrar por banca" className={selectSecondary}>
          <option value="ALL">Todas as Bancas</option>
          {props.boards.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={props.complexity}
          onChange={(e) => props.onComplexity(e.target.value)}
          aria-label="Filtrar por complexidade"
          className={selectSecondary}
        >
          <option value="ALL">Qualquer Complexidade</option>
          <option value="Direta">Direta</option>
          <option value="Intermediária">Intermediária</option>
          <option value="Densa / Estudo de Caso">Densa / Estudo de Caso</option>
        </select>
      </div>
    </div>
  );
}
