import { ChevronLeft, ChevronRight, FileUp, Filter, Search } from 'lucide-react';
import type { QuestionScope } from '../../lib/acervo/topicQuestions';

export type { QuestionScope };

const select = 'px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:border-orange-500 outline-none';

/** Filtros (escopo, banca, complexidade, busca) e a navegação entre as questões filtradas. */
export function QuestionFilters(props: {
  scope: QuestionScope;
  onScope: (scope: QuestionScope) => void;
  board: string;
  boards: string[];
  onBoard: (board: string) => void;
  complexity: string;
  onComplexity: (complexity: string) => void;
  search: string;
  onSearch: (search: string) => void;
  onOpenImport?: () => void;
  position: { index: number; total: number };
  sourceLabel?: string | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { index, total } = props.position;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 pr-1 font-medium text-slate-400">
          <Filter size={14} className="text-orange-400" />
          Filtrar:
        </span>
        <select value={props.scope} onChange={(e) => props.onScope(e.target.value as QuestionScope)} aria-label="Escopo das questões" className={select}>
          <option value="topic">Deste Tópico</option>
          <option value="subject">Toda a Disciplina</option>
          <option value="all">Todo o Acervo</option>
        </select>
        <select value={props.board} onChange={(e) => props.onBoard(e.target.value)} aria-label="Filtrar por banca" className={select}>
          <option value="ALL">Todas as Bancas</option>
          {props.boards.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={props.complexity} onChange={(e) => props.onComplexity(e.target.value)} aria-label="Filtrar por complexidade" className={select}>
          <option value="ALL">Qualquer Complexidade</option>
          <option value="Direta">Direta</option>
          <option value="Intermediária">Intermediária</option>
          <option value="Densa / Estudo de Caso">Densa / Estudo de Caso</option>
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2 text-slate-500" />
          <input
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder="Buscar termo no enunciado..."
            aria-label="Buscar termo no enunciado"
            className={`${select} w-48 pl-8 pr-3`}
          />
        </div>
        {props.onOpenImport && (
          <button
            type="button"
            onClick={props.onOpenImport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-300 hover:border-orange-500/40 hover:text-orange-200"
          >
            <FileUp size={13} className="text-orange-400" />
            Importar Questões
          </button>
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            Questão <strong className="text-white">{index + 1}</strong> de <strong className="text-white">{total}</strong>
          </span>
          {props.sourceLabel && <span className="text-slate-400">· {props.sourceLabel}</span>}
          <button type="button" disabled={index === 0} onClick={props.onPrev} aria-label="Questão anterior" title="Questão anterior" className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-300 hover:border-slate-700 disabled:opacity-40">
            <ChevronLeft size={14} />
          </button>
          <button type="button" disabled={index >= total - 1} onClick={props.onNext} aria-label="Próxima questão" title="Próxima questão" className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-300 hover:border-slate-700 disabled:opacity-40">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
