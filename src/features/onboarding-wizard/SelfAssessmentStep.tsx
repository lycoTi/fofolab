import { useState } from 'react';
import { ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import type { Subject, Topic } from '../../types/database';

/** Matéria do plano com os tópicos de primeiro nível ("1", "2"…) que podem ser ajustados. */
export interface SelfAssessmentSubject {
  subject: Subject;
  topics: Topic[];
}

export interface SelfAssessmentState {
  subjectLevels: Record<string, number>;
  /** Só os tópicos ajustados; ausente = herda da matéria. */
  topicLevels: Record<string, number>;
}

export const KNOWLEDGE_LEVELS = [
  { level: 1, label: 'Nunca vi' },
  { level: 2, label: 'Já vi por cima' },
  { level: 3, label: 'Sei bem' },
  { level: 4, label: 'Domino' },
] as const;

export function initialSelfAssessment(items: SelfAssessmentSubject[]): SelfAssessmentState {
  const subjectLevels: Record<string, number> = {};
  const topicLevels: Record<string, number> = {};
  for (const { subject, topics } of items) {
    subjectLevels[subject.id] = subject.initial_knowledge_level;
    for (const topic of topics) {
      if (topic.initial_knowledge_level) topicLevels[topic.id] = topic.initial_knowledge_level;
    }
  }
  return { subjectLevels, topicLevels };
}

function LevelButtons({
  value,
  inherited,
  onChange,
  name,
}: {
  value: number;
  /** Tópico sem ajuste: mostra o nível da matéria mais apagado. */
  inherited?: boolean;
  onChange: (level: number) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={`Quanto você sabe de ${name}`} className="flex shrink-0 gap-1">
      {KNOWLEDGE_LEVELS.map(({ level, label }) => {
        const selected = value === level;
        let colors = 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600';
        if (selected) colors = inherited ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-orange-500/20 border-orange-500 text-orange-200';
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(level)}
            className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition ${colors}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Passo do Wizard: o ciclo não começa cego — nota rápida por matéria e, se quiser, por tópico. */
export function SelfAssessmentStep({
  items,
  state,
  onChange,
}: {
  items: SelfAssessmentSubject[];
  state: SelfAssessmentState;
  onChange: (next: SelfAssessmentState) => void;
}) {
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);

  const setSubjectLevel = (subjectId: string, level: number) =>
    onChange({ ...state, subjectLevels: { ...state.subjectLevels, [subjectId]: level } });
  const setTopicLevel = (topicId: string, level: number) =>
    onChange({ ...state, topicLevels: { ...state.topicLevels, [topicId]: level } });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <GraduationCap size={16} className="text-orange-400" />
          Quanto você já sabe de cada matéria?
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Uma resposta rápida por matéria basta. Se uma matéria mistura o que você domina com o que nunca viu, abra e ajuste
          os tópicos. Dá para mudar depois em “Recalibrar Perfil”.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500">Este edital ainda não tem matérias cadastradas.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {items.map(({ subject, topics }) => {
            const subjectLevel = state.subjectLevels[subject.id] ?? subject.initial_knowledge_level;
            const open = openSubjectId === subject.id;
            const adjusted = topics.filter((t) => state.topicLevels[t.id] !== undefined).length;
            return (
              <div key={subject.id} className="rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="p-2.5 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenSubjectId(open ? null : subject.id)}
                    disabled={topics.length === 0}
                    aria-expanded={open}
                    className="min-w-0 flex-1 flex items-center gap-1.5 text-left text-xs font-semibold text-slate-200 disabled:cursor-default"
                    title={topics.length > 0 ? 'Ajustar por tópico' : undefined}
                  >
                    {topics.length > 0 && (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                    <span className="truncate" title={subject.name}>{subject.name}</span>
                    {adjusted > 0 && <span className="text-[10px] font-normal text-orange-300 shrink-0">{adjusted} ajustado(s)</span>}
                  </button>
                  <LevelButtons name={subject.name} value={subjectLevel} onChange={(level) => setSubjectLevel(subject.id, level)} />
                </div>

                {open && (
                  <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-slate-800 pt-2">
                    {topics.map((topic) => {
                      const own = state.topicLevels[topic.id];
                      return (
                        <div key={topic.id} className="flex flex-wrap items-center justify-between gap-2 pl-5">
                          <span className="min-w-0 flex-1 text-[11px] text-slate-400 truncate" title={topic.title}>
                            {topic.code} {topic.title}
                          </span>
                          <LevelButtons
                            name={topic.title}
                            value={own ?? subjectLevel}
                            inherited={own === undefined}
                            onChange={(level) => setTopicLevel(topic.id, level)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
