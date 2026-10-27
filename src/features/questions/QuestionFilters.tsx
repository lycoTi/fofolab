import { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
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

function scopeLabel(scope: QuestionScope, groupCode: string | null): string {
  switch (scope) {
    case 'topic':
      return 'Deste tópico';
    case 'group':
      return groupLabel(groupCode);
    case 'subject':
      return 'Toda a matéria';
    case 'all':
      return 'Todo o plano';
  }
}

function statusLabel(status: QuestionStatusFilter, counts: { unsolved: number; retry: number; all: number }): string {
  switch (status) {
    case 'UNSOLVED':
      return `Inéditas (${counts.unsolved})`;
    case 'RETRY':
      return `Errei ou chutei (${counts.retry})`;
    case 'ALL':
      return `Todas (${counts.all})`;
  }
}

function formatLabel(format: QuestionFormatFilter): string {
  switch (format) {
    case 'ALL':
      return 'Todos os formatos';
    case 'CE':
      return 'Certo/Errado';
    case 'ME':
      return 'Múltipla escolha';
  }
}

/** Barra de filtros em acordeão para manter o foco na resolução das questões. */
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
  groupCode: string | null;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 text-xs transition-all">
      {/* Cabeçalho colapsável com resumo visual */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label="Filtros e busca"
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-800/30 transition-colors rounded-xl"
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="flex items-center gap-1 font-medium text-slate-400">
            <SlidersHorizontal size={13} className="text-orange-400 shrink-0" />
            <span>Filtros:</span>
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-200">
            {scopeLabel(props.scope, props.groupCode)}
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-200">
            {statusLabel(props.statusFilter, props.counts)}
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-200">
            {formatLabel(props.formatFilter)}
          </span>
          {props.board !== 'ALL' && (
            <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-300">
              {props.board}
            </span>
          )}
          {props.complexity !== 'ALL' && (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
              {props.complexity}
            </span>
          )}
          {props.search.trim() && (
            <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[11px] font-mono text-orange-200 truncate max-w-[120px]">
              "{props.search.trim()}"
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
          <span>{expanded ? 'Recolher' : 'Personalizar'}</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 text-slate-400 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Painel com todos os controles (visível na tela quando expandido; no DOM para acessibilidade e testes) */}
      <div className={expanded ? 'space-y-2 border-t border-slate-800/70 p-3 pt-2.5' : 'hidden'}>
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

          <div className="flex flex-wrap items-center gap-1.5">
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
            <select
              value={props.board}
              onChange={(e) => props.onBoard(e.target.value)}
              aria-label="Filtrar por banca"
              className={selectSecondary}
            >
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
              <option value="Fácil">Fácil</option>
              <option value="Média">Média</option>
              <option value="Difícil">Difícil</option>
            </select>
          </div>
        </div>
      </div>
    );
  }
