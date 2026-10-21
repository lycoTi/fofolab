import { GraduationCap, Plus, Settings2, Wrench } from 'lucide-react';
import type { SubjectCycleAllocation } from '../../lib/cycleEngine';
import type { StudyPlan, Subject, Topic } from '../../types/database';

interface SyllabusTreeDockProps {
  mode: 'student' | 'admin';
  onToggleMode: () => void;
  plans: StudyPlan[];
  activePlan: StudyPlan;
  subjects: Subject[];
  currentSubject: Subject | null;
  topicsBySubject: Record<string, Topic[]>;
  currentTopic: Topic | null;
  allocations: SubjectCycleAllocation[];
  onSelectPlan: (planId: string) => void;
  onSelectSubjectAndTopic: (subjectId: string, topicId: string) => void;
  onOpenCrudModal: (section: 'plans' | 'subjects' | 'topics') => void;
}

export function SyllabusTreeDock({
  mode,
  onToggleMode,
  plans,
  activePlan,
  subjects,
  currentSubject,
  topicsBySubject,
  currentTopic,
  allocations,
  onSelectPlan,
  onSelectSubjectAndTopic,
  onOpenCrudModal,
}: SyllabusTreeDockProps) {
  return (
    <aside
      aria-label="Painel de Tópicos e Edital"
      className="w-80 border-r border-slate-800 bg-slate-900/70 flex flex-col shrink-0 h-full"
    >
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
            🐹
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight flex items-center gap-1.5">
              FofoLab
            </h1>
            <p className="text-xs text-slate-400">Bancada Inteligente de Estudos</p>
          </div>
        </div>

        <button
          onClick={onToggleMode}
          className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition ${
            mode === 'admin'
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
          title="Alternar entre Bancada de Estudos e Painel de Trilhas"
        >
          {mode === 'admin' ? <Wrench size={14} /> : <GraduationCap size={14} />}
          {mode === 'admin' ? 'Admin' : 'Estudo'}
        </button>
      </div>

      {/* Plano Ativo (CGU / BACEN) com troca em 1 clique */}
      <div className="p-3 mx-3 mt-3 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 font-medium text-slate-300">
            🎯 Edital Ativo
          </span>
          <button
            onClick={() => onOpenCrudModal('plans')}
            className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold"
          >
            <Settings2 size={12} />
            Organizar Edital
          </button>
        </div>

        <select
          value={activePlan.id}
          onChange={(e) => onSelectPlan(e.target.value)}
          aria-label="Selecionar plano de estudo"
          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:border-orange-500 outline-none"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.organ ? `[${p.organ}] ` : ''}
              {p.title}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
          <span>
            Meta: {activePlan.weekly_hours_target}h/sem (
            {(activePlan.weekly_hours_target / 7).toFixed(1)}h/dia)
          </span>
          <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
            Banca {activePlan.exam_board || 'FGV'}
          </span>
        </div>
      </div>

      {/* Lista de Disciplinas e Tópicos Verticalizados */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Disciplinas ({subjects.length})
          </span>
          <button
            onClick={() => onOpenCrudModal('subjects')}
            className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5 font-medium"
          >
            <Plus size={12} />
            Disciplina
          </button>
        </div>

        {subjects.map((subj) => {
          const isSelected = currentSubject?.id === subj.id;
          const subjTopics = topicsBySubject[subj.id] || [];
          const alloc = allocations.find((a) => a.subject.id === subj.id);
          return (
            <div
              key={subj.id}
              className={`rounded-xl border transition ${
                isSelected
                  ? 'bg-slate-800/90 border-orange-500/40'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <button
                onClick={() => {
                  const firstT = (topicsBySubject[subj.id] || [])[0];
                  onSelectSubjectAndTopic(subj.id, firstT?.id || '');
                }}
                className="w-full text-left p-3 flex items-center justify-between"
              >
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: subj.color }}
                    />
                    <p className="text-sm font-medium text-slate-100 leading-snug">{subj.name}</p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ciclo: {alloc?.sharePercent ?? 25}% • Cobertura: {alloc?.coveragePercent ?? 0}%
                  </p>
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 text-orange-300 shrink-0">
                  {alloc?.studiedTopicsMastery ?? subj.measured_mastery_score}%
                </div>
              </button>

              {isSelected && (
                <div className="px-2 pb-2 space-y-1 border-t border-slate-700/50 pt-2">
                  {subjTopics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => onSelectSubjectAndTopic(subj.id, topic.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                        topic.id === currentTopic?.id
                          ? 'bg-orange-500/20 text-orange-200 font-medium'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate pr-2">
                        <span className="font-mono text-[11px] text-orange-300/90 mr-1">
                          {topic.code}
                        </span>
                        {topic.title}
                      </span>
                      <span className="text-[10px] opacity-80 shrink-0">
                        {topic.mastery_score}%
                      </span>
                    </button>
                  ))}

                  <button
                    onClick={() => onOpenCrudModal('topics')}
                    className="w-full mt-1 py-1.5 px-2.5 rounded-lg border border-dashed border-slate-700 hover:border-orange-500/50 text-[11px] text-slate-400 hover:text-orange-300 flex items-center justify-center gap-1 transition"
                  >
                    <Plus size={12} />
                    Adicionar / Editar Tópicos ({subjTopics.length})
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

