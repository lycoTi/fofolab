import { useEffect, useState } from 'react';
import { formatDuration } from '../lib/timeFormat';
import {
  BookOpen,
  ClipboardList,
  DatabaseBackup,
  Download,
  Edit3,
  FileUp,
  Layers,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { BackupPanel } from './BackupPanel';
import { getSampleSubtopicsForCalibration } from '../lib/cycleEngine';
import type { BackupEntry } from '../lib/storage';
import { parseSyllabusTopics } from '../lib/syllabusImport';
import type {
  CreateStudyPlanInput,
  CreateSubjectInput,
  CreateTopicInput,
  ImportTopicItem,
  StudyPlan,
  Subject,
  SubjectCategory,
  Topic,
  TopicStatus,
} from '../types/database';

export type CurriculumSection = 'plans' | 'subjects' | 'topics' | 'backup';

interface CurriculumManagerModalProps {
  isOpen: boolean;
  initialSection?: CurriculumSection;
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
  onImportTopics: (items: ImportTopicItem[]) => { inserted: number; skippedDuplicates: number };
  onExportDatabase: () => void;
  /** Ações confirmadas pelo App: devolvem `false` quando o estudante cancela. */
  onRestoreFromFile: (file: File) => Promise<boolean>;
  onLoadBackups: () => Promise<BackupEntry[]>;
  onRestoreBackup: (backup: BackupEntry) => Promise<boolean>;
  onResetSeed: () => Promise<boolean>;
  /** Abre a importação do edital em PDF (cria um plano novo). */
  onImportEdital?: () => void;
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
  onImportTopics,
  onExportDatabase,
  onRestoreFromFile,
  onLoadBackups,
  onRestoreBackup,
  onResetSeed,
  onImportEdital,
}: CurriculumManagerModalProps) {
  const [section, setSection] = useState<CurriculumSection>(initialSection);

  // Colar conteúdo programático do edital (vários tópicos de uma vez)
  const [showSyllabusPaste, setShowSyllabusPaste] = useState(false);
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusPreview, setSyllabusPreview] = useState<(ImportTopicItem & { include: boolean })[] | null>(null);
  const [syllabusResult, setSyllabusResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setSection(initialSection);
  }, [isOpen, initialSection]);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Organizar edital"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              🗂️ Organizar Edital, Disciplinas e Tópicos
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
            {onImportEdital && (
              <button
                type="button"
                onClick={onImportEdital}
                className="px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-xs text-orange-200 flex items-center gap-1.5"
                title="Ler um edital em PDF e montar um plano novo com as matérias, os tópicos e os pesos"
              >
                <FileUp size={13} />
                Importar edital (PDF)
              </button>
            )}
            <button
              type="button"
              onClick={onExportDatabase}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5"
              title="Baixar uma cópia de backup dos seus estudos"
            >
              <Download size={13} />
              Fazer Backup
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar organização do edital"
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
            { id: 'backup', label: '4. Backup & Segurança', icon: DatabaseBackup },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setSection(tab.id as CurriculumSection)}
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
                      {editingPlanId ? 'Salvar Alterações' : 'Criar Plano de Estudo'}
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
                  Meus Planos de Estudo
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
                          Banca: {p.exam_board || 'N/D'} • Meta: {formatDuration(p.weekly_hours_target * 60)} por semana (
                          {formatDuration((p.weekly_hours_target * 60) / 7)} por dia) • Prova:{' '}
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
                        Peso: {s.exam_weight}x • Ciclo: {formatDuration(s.cycle_allocated_minutes)} por semana • Base:{' '}
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
                          <option value="PENDING">⚪ Pendente</option>
                          <option value="STUDYING">🔵 Em Estudo</option>
                          <option value="REVIEW">🟡 Em Revisão</option>
                          <option value="MASTERED">🟢 Dominado</option>
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
                {selectedSubject && (
                  <SyllabusPasteBox
                    open={showSyllabusPaste}
                    onToggle={() => setShowSyllabusPaste((v) => !v)}
                    text={syllabusText}
                    onChangeText={(value) => {
                      setSyllabusText(value);
                      setSyllabusPreview(null);
                      setSyllabusResult(null);
                    }}
                    preview={syllabusPreview}
                    onAnalyze={() =>
                      setSyllabusPreview(parseSyllabusTopics(syllabusText).map((t) => ({ ...t, include: true })))
                    }
                    onToggleItem={(idx, include) =>
                      setSyllabusPreview((prev) => prev?.map((p, i) => (i === idx ? { ...p, include } : p)) ?? null)
                    }
                    onConfirm={() => {
                      if (!syllabusPreview) return;
                      const result = onImportTopics(
                        syllabusPreview.filter((t) => t.include).map(({ code, title }) => ({ code, title }))
                      );
                      const skipped = result.skippedDuplicates > 0 ? ` • ${result.skippedDuplicates} já existiam` : '';
                      setSyllabusResult(`${result.inserted} tópico(s) adicionado(s)${skipped}.`);
                      setSyllabusPreview(null);
                      setSyllabusText('');
                    }}
                    result={syllabusResult}
                  />
                )}

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

          {/* ================= ABA 4: BACKUP & SEGURANÇA ================= */}
          {section === 'backup' && (
            <BackupPanel
              onExportDatabase={onExportDatabase}
              onRestoreFromFile={onRestoreFromFile}
              onLoadBackups={onLoadBackups}
              onRestoreBackup={onRestoreBackup}
              onResetSeed={onResetSeed}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const SYLLABUS_PLACEHOLDER =
  '1 Conceitos de auditoria. 2 Normas de auditoria. 2.1 ISSAI 100. 2.2 NBC TA 200.\n' +
  'ou um tópico por linha:\n3 Controle interno\n3.1 COSO';

function SyllabusPasteBox({
  open,
  onToggle,
  text,
  onChangeText,
  preview,
  onAnalyze,
  onToggleItem,
  onConfirm,
  result,
}: {
  open: boolean;
  onToggle: () => void;
  text: string;
  onChangeText: (value: string) => void;
  preview: (ImportTopicItem & { include: boolean })[] | null;
  onAnalyze: () => void;
  onToggleItem: (index: number, include: boolean) => void;
  onConfirm: () => void;
  result: string | null;
}) {
  const selectedCount = preview?.filter((t) => t.include).length ?? 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 text-xs">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-slate-200 font-semibold"
      >
        <span className="flex items-center gap-1.5">
          <ClipboardList size={14} className="text-orange-400" />
          Colar o conteúdo programático do edital (vários tópicos de uma vez)
        </span>
        <span className="text-slate-500">{open ? 'Fechar' : 'Abrir'}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          <textarea
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            aria-label="Conteúdo programático do edital"
            placeholder={SYLLABUS_PLACEHOLDER}
            className="w-full h-28 p-2.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-200 focus:border-orange-500 outline-none resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!text.trim()}
              onClick={onAnalyze}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold disabled:opacity-40"
            >
              Analisar
            </button>
            {preview && (
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={onConfirm}
                className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-40"
              >
                Adicionar {selectedCount} tópico(s)
              </button>
            )}
          </div>
          {result && <p className="text-emerald-300">✅ {result}</p>}
          {preview && (
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {preview.length === 0 && (
                <p className="text-amber-300">Não reconhecemos nenhum tópico. Confira a numeração.</p>
              )}
              {preview.map((item, idx) => (
                <label
                  key={`${idx}-${item.code ?? ''}`}
                  className="flex items-start gap-2 px-2 py-1 rounded hover:bg-slate-900 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.include}
                    onChange={(e) => onToggleItem(idx, e.target.checked)}
                    className="mt-0.5 accent-orange-500"
                  />
                  <span className="font-mono text-orange-300 shrink-0">{item.code ?? '—'}</span>
                  <span className="text-slate-300">{item.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

