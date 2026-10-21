import { useState } from 'react';
import {
  BookOpen,
  Download,
  Edit3,
  Layers,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { getSampleSubtopicsForCalibration } from '../lib/cycleEngine';
import type {
  CreateStudyPlanInput,
  CreateSubjectInput,
  CreateTopicInput,
  StudyPlan,
  Subject,
  SubjectCategory,
  Topic,
  TopicStatus,
} from '../types/database';

interface CurriculumManagerModalProps {
  isOpen: boolean;
  initialSection?: 'plans' | 'subjects' | 'topics';
  plans: StudyPlan[];
  activePlan: StudyPlan;
  subjects: Subject[];
  selectedSubject: Subject | null;
  topics: Topic[];
  onClose: () => void;
  onSelectPlan: (planId: string) => void;
  onCreatePlan: (input: CreateStudyPlanInput) => void;
  onUpdatePlan: (id: string, input: Partial<CreateStudyPlanInput>) => void;
  onDeletePlan: (id: string) => void;
  onCreateSubject: (input: CreateSubjectInput) => void;
  onUpdateSubject: (id: string, input: Partial<CreateSubjectInput>) => void;
  onDeleteSubject: (id: string) => void;
  onCreateTopic: (input: CreateTopicInput) => void;
  onUpdateTopic: (id: string, input: Partial<CreateTopicInput>) => void;
  onDeleteTopic: (id: string) => void;
  onExportDatabase: () => void;
  onResetSeed: () => void;
}

export function CurriculumManagerModal({
  isOpen,
  initialSection = 'topics',
  plans,
  activePlan,
  subjects,
  selectedSubject,
  topics,
  onClose,
  onSelectPlan,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
  onCreateSubject,
  onUpdateSubject,
  onDeleteSubject,
  onCreateTopic,
  onUpdateTopic,
  onDeleteTopic,
  onExportDatabase,
  onResetSeed,
}: CurriculumManagerModalProps) {
  const [section, setSection] = useState<'plans' | 'subjects' | 'topics'>(initialSection);

  // Estado do formulário de Plano
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planOrgan, setPlanOrgan] = useState('');
  const [planBoard, setPlanBoard] = useState('FGV');
  const [planRole, setPlanRole] = useState('');
  const [planDate, setPlanDate] = useState('2027-03-15');
  const [planWeeklyHours, setPlanWeeklyHours] = useState(28);

  // Estado do formulário de Disciplina
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjName, setSubjName] = useState('');
  const [subjCategory, setSubjCategory] = useState<SubjectCategory>('ESPECIFICO');
  const [subjColor, setSubjColor] = useState('#f97316');
  const [subjWeight, setSubjWeight] = useState(2.0);
  const [subjKnowledge, setSubjKnowledge] = useState(2);
  const [subjAffinity, setSubjAffinity] = useState(2);
  const [subjMinutes, setSubjMinutes] = useState(90);

  // Estado do formulário de Tópico
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicCode, setTopicCode] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicStatus, setTopicStatus] = useState<TopicStatus>('PENDING');
  const [topicMastery, setTopicMastery] = useState(0);

  if (!isOpen) return null;

  const resetPlanForm = () => {
    setEditingPlanId(null);
    setPlanTitle('');
    setPlanOrgan('');
    setPlanBoard('FGV');
    setPlanRole('');
    setPlanDate('2027-03-15');
    setPlanWeeklyHours(28);
  };

  const resetSubjectForm = () => {
    setEditingSubjectId(null);
    setSubjName('');
    setSubjCategory('ESPECIFICO');
    setSubjColor('#f97316');
    setSubjWeight(2.0);
    setSubjKnowledge(2);
    setSubjAffinity(2);
    setSubjMinutes(90);
  };

  const resetTopicForm = () => {
    setEditingTopicId(null);
    setTopicCode('');
    setTopicTitle('');
    setTopicStatus('PENDING');
    setTopicMastery(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              🗂️ Gerenciador do Edital Verticalizado (SQLite Local)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Plano ativo: <strong className="text-orange-300">{activePlan.title}</strong>
              {selectedSubject && (
                <>
                  {' '}
                  • Disciplina: <strong className="text-slate-200">{selectedSubject.name}</strong>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportDatabase}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5"
              title="Exportar arquivo binário fofolab.sqlite"
            >
              <Download size={13} />
              Exportar .sqlite
            </button>
            <button
              onClick={onResetSeed}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 border border-slate-700 hover:border-red-500/40 text-xs text-slate-300 hover:text-red-300 flex items-center gap-1.5"
              title="Restaurar dados originais CGU + BACEN"
            >
              <RotateCcw size={13} />
              Restaurar Seed
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navegação de Abas do CRUD */}
        <div className="px-6 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/30">
          {[
            { id: 'plans', label: `1. Planos / Editais (${plans.length})`, icon: Target },
            { id: 'subjects', label: `2. Disciplinas de ${activePlan.organ || 'Plano'} (${subjects.length})`, icon: Layers },
            {
              id: 'topics',
              label: `3. Tópicos de ${selectedSubject?.name || 'Disciplina'} (${topics.length})`,
              icon: BookOpen,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSection(tab.id as 'plans' | 'subjects' | 'topics')}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 flex items-center gap-2 transition ${
                  active
                    ? 'border-orange-500 text-orange-300 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ================= ABA 1: PLANOS DE ESTUDO ================= */}
          {section === 'plans' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  {editingPlanId ? '✏️ Editar Plano de Estudo' : '➕ Novo Plano / Concurso'}
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Título do Plano</label>
                    <input
                      value={planTitle}
                      onChange={(e) => setPlanTitle(e.target.value)}
                      placeholder="Ex: TCU — Auditor Federal de Controle Externo"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Órgão (Sigla)</label>
                      <input
                        value={planOrgan}
                        onChange={(e) => setPlanOrgan(e.target.value)}
                        placeholder="Ex: CGU, BACEN, TCU"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Banca Examinadora</label>
                      <input
                        value={planBoard}
                        onChange={(e) => setPlanBoard(e.target.value)}
                        placeholder="Ex: FGV, Cebraspe, FCC"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Cargo Alvo</label>
                    <input
                      value={planRole}
                      onChange={(e) => setPlanRole(e.target.value)}
                      placeholder="Ex: Auditor Federal — Tecnologia da Informação"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Data Prevista da Prova</label>
                      <input
                        type="date"
                        value={planDate}
                        onChange={(e) => setPlanDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Meta Horas/Semana</label>
                      <input
                        type="number"
                        step="0.5"
                        min={4}
                        max={70}
                        value={planWeeklyHours}
                        onChange={(e) => setPlanWeeklyHours(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!planTitle.trim()) return;
                        if (editingPlanId) {
                          onUpdatePlan(editingPlanId, {
                            title: planTitle,
                            organ: planOrgan,
                            exam_board: planBoard,
                            role_title: planRole,
                            exam_date: planDate || null,
                            weekly_hours_target: planWeeklyHours,
                          });
                        } else {
                          onCreatePlan({
                            title: planTitle,
                            organ: planOrgan || 'CONCURSO',
                            exam_board: planBoard || 'FGV',
                            role_title: planRole || 'Analista / Auditor',
                            exam_date: planDate || null,
                            weekly_hours_target: planWeeklyHours,
                          });
                        }
                        resetPlanForm();
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      {editingPlanId ? 'Salvar Alterações' : 'Criar Plano SQLite'}
                    </button>
                    {editingPlanId && (
                      <button
                        onClick={resetPlanForm}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Planos Cadastrados no Banco Local
                </h3>
                {plans.map((p) => {
                  const isActive = p.id === activePlan.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                        isActive
                          ? 'bg-orange-500/10 border-orange-500/40'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-orange-300">
                            {p.organ || 'EDITAL'}
                          </span>
                          <span className="text-sm font-semibold text-white">{p.title}</span>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Ativo na Bancada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Banca: {p.exam_board || 'N/D'} • Meta: {p.weekly_hours_target}h/sem (
                          {(p.weekly_hours_target / 7).toFixed(1)}h/dia) • Prova:{' '}
                          {p.exam_date || 'Sem data'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isActive && (
                          <button
                            onClick={() => onSelectPlan(p.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs font-medium"
                          >
                            Ativar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingPlanId(p.id);
                            setPlanTitle(p.title);
                            setPlanOrgan(p.organ || '');
                            setPlanBoard(p.exam_board || '');
                            setPlanRole(p.role_title || '');
                            setPlanDate(p.exam_date || '');
                            setPlanWeeklyHours(p.weekly_hours_target);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Editar plano"
                        >
                          <Edit3 size={14} />
                        </button>
                        {plans.length > 1 && (
                          <button
                            onClick={() => onDeletePlan(p.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300"
                            title="Excluir plano"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= ABA 2: DISCIPLINAS ================= */}
          {section === 'subjects' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  {editingSubjectId
                    ? '✏️ Editar Disciplina'
                    : `➕ Nova Disciplina em ${activePlan.organ || activePlan.title}`}
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Nome da Disciplina</label>
                    <input
                      value={subjName}
                      onChange={(e) => setSubjName(e.target.value)}
                      placeholder="Ex: Direito Constitucional, Banco de Dados"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Bloco / Categoria</label>
                      <select
                        value={subjCategory}
                        onChange={(e) => setSubjCategory(e.target.value as SubjectCategory)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      >
                        <option value="ESPECIFICO">Específico</option>
                        <option value="GERAL">Geral</option>
                        <option value="BASICO">Básico</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Peso no Edital</label>
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        max={5}
                        value={subjWeight}
                        onChange={(e) => setSubjWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Preview de Subtópicos Reais para ajudar a calibrar Base e Afinidade */}
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold text-orange-300">
                      🔎 O que cai nesta matéria (use p/ calibrar Base e Afinidade):
                    </div>
                    <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
                      {getSampleSubtopicsForCalibration(subjName || selectedSubject?.name || '').map(
                        (sample, idx) => (
                          <li key={idx}>{sample}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Base Inicial (1 a 4)</label>
                      <select
                        value={subjKnowledge}
                        onChange={(e) => setSubjKnowledge(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      >
                        <option value={1}>1 — Nunca vi</option>
                        <option value={2}>2 — Iniciante</option>
                        <option value={3}>3 — Intermediário</option>
                        <option value={4}>4 — Avançado</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Afinidade (1 a 3)</label>
                      <select
                        value={subjAffinity}
                        onChange={(e) => setSubjAffinity(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      >
                        <option value={1}>1 — Pavor / Sono</option>
                        <option value={2}>2 — Neutro</option>
                        <option value={3}>3 — Gosto muito</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Minutos no Ciclo Atual</label>
                    <input
                      type="number"
                      step={15}
                      min={30}
                      max={240}
                      value={subjMinutes}
                      onChange={(e) => setSubjMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!subjName.trim()) return;
                        if (editingSubjectId) {
                          onUpdateSubject(editingSubjectId, {
                            name: subjName,
                            category: subjCategory,
                            color: subjColor,
                            exam_weight: subjWeight,
                            initial_knowledge_level: subjKnowledge,
                            initial_affinity_level: subjAffinity,
                            cycle_allocated_minutes: subjMinutes,
                          });
                        } else {
                          onCreateSubject({
                            plan_id: activePlan.id,
                            name: subjName,
                            category: subjCategory,
                            color: subjColor,
                            exam_weight: subjWeight,
                            initial_knowledge_level: subjKnowledge,
                            initial_affinity_level: subjAffinity,
                            cycle_allocated_minutes: subjMinutes,
                          });
                        }
                        resetSubjectForm();
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      {editingSubjectId ? 'Salvar Disciplina' : 'Adicionar Disciplina'}
                    </button>
                    {editingSubjectId && (
                      <button
                        onClick={resetSubjectForm}
                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Disciplinas do Plano Ativo ({activePlan.organ})
                </h3>
                {subjects.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {s.category}
                        </span>
                        <span className="text-sm font-semibold text-white">{s.name}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Peso: {s.exam_weight}x • Ciclo: {s.cycle_allocated_minutes} min • Base:{' '}
                        {s.initial_knowledge_level}/4 • Afinidade: {s.initial_affinity_level}/3 •
                        Domínio: <strong className="text-orange-300">{s.measured_mastery_score}%</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingSubjectId(s.id);
                          setSubjName(s.name);
                          setSubjCategory(s.category);
                          setSubjColor(s.color);
                          setSubjWeight(s.exam_weight);
                          setSubjKnowledge(s.initial_knowledge_level);
                          setSubjAffinity(s.initial_affinity_level);
                          setSubjMinutes(s.cycle_allocated_minutes);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Editar disciplina"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteSubject(s.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300"
                        title="Excluir disciplina"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= ABA 3: TÓPICOS VERTICALIZADOS ================= */}
          {section === 'topics' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  {editingTopicId
                    ? '✏️ Editar Tópico do Edital'
                    : `➕ Novo Tópico em ${selectedSubject?.name || 'Disciplina'}`}
                </h3>

                {!selectedSubject ? (
                  <p className="text-xs text-slate-400">
                    Crie ou selecione uma disciplina primeiro.
                  </p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">Código</label>
                        <input
                          value={topicCode}
                          onChange={(e) => setTopicCode(e.target.value)}
                          placeholder="Ex: 1.4"
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-slate-400 block mb-1">Status</label>
                        <select
                          value={topicStatus}
                          onChange={(e) => setTopicStatus(e.target.value as TopicStatus)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                        >
                          <option value="PENDING">⚪ Pendente (PENDING)</option>
                          <option value="STUDYING">🔵 Estudando (STUDYING)</option>
                          <option value="REVIEW">🟡 Em Revisão (REVIEW)</option>
                          <option value="MASTERED">🟢 Dominado (MASTERED)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Título do Tópico Verticalizado</label>
                      <input
                        value={topicTitle}
                        onChange={(e) => setTopicTitle(e.target.value)}
                        placeholder="Ex: Relatório de Auditoria e Monitoramento de Recomendações"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">
                        Domínio Medido ({topicMastery}%)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={topicMastery}
                        onChange={(e) => setTopicMastery(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!topicTitle.trim() || !selectedSubject) return;
                          if (editingTopicId) {
                            onUpdateTopic(editingTopicId, {
                              code: topicCode || '1.0',
                              title: topicTitle,
                              status: topicStatus,
                              mastery_score: topicMastery,
                            });
                          } else {
                            onCreateTopic({
                              subject_id: selectedSubject.id,
                              code: topicCode || `${topics.length + 1}.1`,
                              title: topicTitle,
                              status: topicStatus,
                              mastery_score: topicMastery,
                            });
                          }
                          resetTopicForm();
                        }}
                        className="flex-1 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Plus size={14} />
                        {editingTopicId ? 'Salvar Tópico' : 'Adicionar Tópico'}
                      </button>
                      {editingTopicId && (
                        <button
                          onClick={resetTopicForm}
                          className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-7 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tópicos Verticalizados de {selectedSubject?.name || 'Disciplina'}
                </h3>
                {topics.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhum tópico cadastrado nesta disciplina ainda. Adicione ao lado!
                  </div>
                ) : (
                  topics.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-300">
                            {t.code}
                          </span>
                          <span className="text-xs font-medium text-white">{t.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Status: <strong>{t.status}</strong> • Domínio:{' '}
                          <strong className="text-emerald-300">{t.mastery_score}%</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingTopicId(t.id);
                            setTopicCode(t.code || '');
                            setTopicTitle(t.title);
                            setTopicStatus(t.status);
                            setTopicMastery(t.mastery_score);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Editar tópico"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteTopic(t.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300"
                          title="Excluir tópico"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

