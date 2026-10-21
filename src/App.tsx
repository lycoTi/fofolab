import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  FolderGit2,
  GraduationCap,
  HelpCircle,
  Layers,
  Network,
  Plus,
  Save,
  Settings2,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { CurriculumManagerModal } from './components/CurriculumManagerModal';
import { CycleDashboard } from './components/CycleDashboard';
import { PomodoroWidget } from './components/PomodoroWidget';
import { calculateDynamicStudyCycle } from './lib/cycleEngine';
import {
  applyRecommendedCycleAllocations,
  createStudyPlan,
  createSubject,
  createTopic,
  deleteStudyPlan,
  deleteSubject,
  deleteTopic,
  exportDatabaseBinary,
  getAdminCatalogAndBlueprints,
  getNotebookForTopic,
  getPdfSourceForTopic,
  getQuestionsForTopicOrSubject,
  getRecentAttempts,
  getStudyPlans,
  getStudySessions,
  getSubjectsByPlan,
  getTopicLinks,
  getTopicsBySubject,
  initDatabase,
  recordQuestionDiagnosis,
  recordStudySession,
  resetDatabaseToSeed,
  saveTopicNotebook,
  setActiveStudyPlan,
  updateStudyPlan,
  updateSubject,
  updateTopic,
} from './lib/database';
import type {
  AdminBoardBlueprint,
  AiDissection,
  CareerTrack,
  CreateStudyPlanInput,
  CreateSubjectInput,
  CreateTopicInput,
  Notebook,
  PdfSource,
  Question,
  QuestionAttempt,
  SelfDiagnosisType,
  StudyPlan,
  StudySession,
  Subject,
  Topic,
  TopicLink,
} from './types/database';

type WorkbenchTab = 'notebooks' | 'questions' | 'pdf' | 'cycle' | 'graph';
type AppMode = 'student' | 'admin';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [mode, setMode] = useState<AppMode>('student');
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('questions');

  // Estado sincronizado com SQLite
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, Topic[]>>({});
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [topicLinks, setTopicLinks] = useState<TopicLink[]>([]);

  // Entidades da Bancada do Tópico atual
  const [topicQuestions, setTopicQuestions] = useState<
    { question: Question; dissection: AiDissection | null }[]
  >([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number>(2);
  const [lastDiagnosisMsg, setLastDiagnosisMsg] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notebookDraft, setNotebookDraft] = useState<string>('');
  const [pdfSource, setPdfSource] = useState<PdfSource | null>(null);

  // Admin state
  const [adminData, setAdminData] = useState<{
    tracks: CareerTrack[];
    blueprints: AdminBoardBlueprint[];
    stats: { plans: number; subjects: number; topics: number; questions: number; attempts: number };
  } | null>(null);

  // Modal de CRUD do Edital Verticalizado
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudInitialSection, setCrudInitialSection] = useState<'plans' | 'subjects' | 'topics'>(
    'topics'
  );

  const refreshFromSqlite = useCallback(
    (preferredSubjectId?: string, preferredTopicId?: string) => {
      const allPlans = getStudyPlans();
      setPlans(allPlans);
      const currentPlan = allPlans.find((p) => p.is_active === 1) || allPlans[0] || null;
      setActivePlan(currentPlan);

      if (!currentPlan) {
        setSubjects([]);
        setTopicsBySubject({});
        return;
      }

      const planSubjects = getSubjectsByPlan(currentPlan.id);
      setSubjects(planSubjects);

      const topicsMap: Record<string, Topic[]> = {};
      for (const s of planSubjects) {
        topicsMap[s.id] = getTopicsBySubject(s.id);
      }
      setTopicsBySubject(topicsMap);

      const targetSubjId =
        preferredSubjectId && planSubjects.some((s) => s.id === preferredSubjectId)
          ? preferredSubjectId
          : planSubjects.some((s) => s.id === selectedSubjectId)
            ? selectedSubjectId
            : planSubjects[0]?.id || '';

      setSelectedSubjectId(targetSubjId);

      const subjTopics = topicsMap[targetSubjId] || [];
      const targetTopicId =
        preferredTopicId && subjTopics.some((t) => t.id === preferredTopicId)
          ? preferredTopicId
          : subjTopics.some((t) => t.id === selectedTopicId)
            ? selectedTopicId
            : subjTopics[0]?.id || '';

      setSelectedTopicId(targetTopicId);
      setAttempts(getRecentAttempts(200));
      setSessions(getStudySessions(100));
      setTopicLinks(getTopicLinks());
      setAdminData(getAdminCatalogAndBlueprints());
    },
    [selectedSubjectId, selectedTopicId]
  );

  useEffect(() => {
    initDatabase().then(() => {
      setDbReady(true);
      refreshFromSqlite();
    });
  }, []);

  // Carrega Questões, Caderno e PDF quando muda a disciplina ou tópico
  useEffect(() => {
    if (!dbReady || !selectedSubjectId) return;
    const qs = getQuestionsForTopicOrSubject(selectedTopicId, selectedSubjectId);
    setTopicQuestions(qs);
    setLastDiagnosisMsg(null);

    const nb = getNotebookForTopic(selectedSubjectId, selectedTopicId);
    setNotebook(nb);
    setNotebookDraft(
      nb?.content_markdown ||
        `# Caderno do Tópico\n\nAnote seus resumos, mnemônicos e jurisprudências aqui...`
    );

    const pdf = getPdfSourceForTopic(selectedSubjectId, selectedTopicId);
    setPdfSource(pdf);
  }, [dbReady, selectedSubjectId, selectedTopicId]);

  // Motor Matemático do Ciclo (Estilo Elasticsearch _score + Orçamento Fixo Semanal)
  const cycleData = useMemo(() => {
    if (!activePlan) return null;
    return calculateDynamicStudyCycle({
      plan: activePlan,
      subjects,
      topicsBySubject,
      attempts,
      sessions,
      topicLinks,
    });
  }, [activePlan, subjects, topicsBySubject, attempts, sessions, topicLinks]);

  if (!dbReady || !activePlan || !cycleData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 text-sm">
          <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center animate-pulse">
            🐹
          </div>
          <span>Inicializando motor SQLite local (01-database-schema.sql)...</span>
        </div>
      </div>
    );
  }

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  const currentTopics = currentSubject ? topicsBySubject[currentSubject.id] || [] : [];
  const currentTopic =
    currentTopics.find((t) => t.id === selectedTopicId) || currentTopics[0] || null;

  const activeQuestionBundle = topicQuestions[0] || null;
  const parsedOptions: string[] = activeQuestionBundle
    ? (() => {
        try {
          return JSON.parse(activeQuestionBundle.question.options_json);
        } catch {
          return [];
        }
      })()
    : [];

  const handleSelectPlan = (planId: string) => {
    setActiveStudyPlan(planId);
    const nextSubjects = getSubjectsByPlan(planId);
    const firstSubj = nextSubjects[0]?.id || '';
    const firstTopic = firstSubj ? getTopicsBySubject(firstSubj)[0]?.id || '' : '';
    refreshFromSqlite(firstSubj, firstTopic);
  };

  const handleDiagnosisClick = (diagnosis: SelfDiagnosisType, label: string) => {
    if (!currentTopic || !activeQuestionBundle) return;
    const optionLetter = ['A', 'B', 'C', 'D', 'E'][selectedOptionIdx] || 'C';
    const isCorrect = optionLetter === activeQuestionBundle.question.final_answer;

    const { updatedTopic, deltaMastery, isColdStartDiscovery } = recordQuestionDiagnosis({
      questionId: activeQuestionBundle.question.id,
      topicId: currentTopic.id,
      selectedOption: optionLetter,
      isCorrect,
      selfDiagnosis: diagnosis,
    });

    const sign = deltaMastery > 0 ? `+${deltaMastery}%` : `${deltaMastery}%`;
    const coldStartNote =
      diagnosis === 'BASE_GAP' && isColdStartDiscovery
        ? ' • 🛡️ Proteção de 1º Contato (Estudo Reverso): registrado no Mapa de Calor sem estourar suas horas semanais!'
        : ' • Mapa de Calor atualizado p/ sugestão do próximo ciclo!';
    setLastDiagnosisMsg(
      `${label} gravado! Domínio do tópico: ${updatedTopic?.mastery_score ?? currentTopic.mastery_score}% (${sign})${coldStartNote}`
    );
    refreshFromSqlite(currentSubject?.id, currentTopic.id);
  };

  const handleAppendDissectionToNotebook = () => {
    if (!currentSubject || !currentTopic || !activeQuestionBundle?.dissection) return;
    const appended = `${notebookDraft}\n\n---\n### 🤖 Destrinchamento Anexado (${activeQuestionBundle.question.exam_board} ${activeQuestionBundle.question.exam_year})\n${activeQuestionBundle.dissection.dissection_markdown}`;
    const saved = saveTopicNotebook({
      subjectId: currentSubject.id,
      topicId: currentTopic.id,
      title: `Caderno ${currentTopic.code} — ${currentTopic.title}`,
      contentMarkdown: appended,
    });
    setNotebook(saved);
    setNotebookDraft(saved.content_markdown);
    setActiveTab('notebooks');
  };

  const handleExportDatabase = () => {
    const bytes = exportDatabaseBinary();
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fofolab-${activePlan.organ?.toLowerCase() || 'backup'}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar Esquerda: Identidade FofoLab + Seletor de Plano + Árvore do Edital */}
      <aside className="w-84 border-r border-slate-800 bg-slate-900/70 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
              🐹
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight flex items-center gap-1.5">
                FofoLab{' '}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-semibold">
                  v0.3 Ciclo
                </span>
              </h1>
              <p className="text-xs text-slate-400">Bancada de Estudos Local</p>
            </div>
          </div>

          <button
            onClick={() => setMode(mode === 'student' ? 'admin' : 'student')}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition ${
              mode === 'admin'
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Alternar entre Visão Estudante e Fábrica Admin"
          >
            {mode === 'admin' ? <Wrench size={14} /> : <GraduationCap size={14} />}
            {mode === 'admin' ? 'Admin' : 'Estudo'}
          </button>
        </div>

        {/* Plano Ativo (CGU / BACEN) com troca em 1 clique + botão CRUD */}
        <div className="p-3 mx-3 mt-3 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 font-medium text-slate-300">
              🎯 Edital Ativo
            </span>
            <button
              onClick={() => {
                setCrudInitialSection('plans');
                setCrudModalOpen(true);
              }}
              className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold"
            >
              <Settings2 size={12} />
              Gerenciar Edital
            </button>
          </div>

          <select
            value={activePlan.id}
            onChange={(e) => handleSelectPlan(e.target.value)}
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
              Teto: {activePlan.weekly_hours_target}h/sem (
              {(activePlan.weekly_hours_target / 7).toFixed(1)}h/dia)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Database size={10} />
              SQLite Ativo
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
              onClick={() => {
                setCrudInitialSection('subjects');
                setCrudModalOpen(true);
              }}
              className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5 font-medium"
            >
              <Plus size={12} />
              Disciplina
            </button>
          </div>

          {subjects.map((subj) => {
            const isSelected = currentSubject?.id === subj.id;
            const subjTopics = topicsBySubject[subj.id] || [];
            const alloc = cycleData.allocations.find((a) => a.subject.id === subj.id);
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
                    setSelectedSubjectId(subj.id);
                    const firstT = (topicsBySubject[subj.id] || [])[0];
                    if (firstT) setSelectedTopicId(firstT.id);
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
                      Pizza: {alloc?.sharePercent ?? 25}% • _score: {alloc?.elasticScore ?? 1.0}
                    </p>
                  </div>
                  <div className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 text-orange-300 shrink-0">
                    {subj.measured_mastery_score}%
                  </div>
                </button>

                {isSelected && (
                  <div className="px-2 pb-2 space-y-1 border-t border-slate-700/50 pt-2">
                    {subjTopics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopicId(topic.id)}
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
                      onClick={() => {
                        setCrudInitialSection('topics');
                        setCrudModalOpen(true);
                      }}
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

      {/* Área Principal: Bancada do Tópico ou Fábrica Admin */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {mode === 'student' ? (
          <>
            {/* Header da Bancada do Tópico + Pomodoro Integrado */}
            <header className="border-b border-slate-800 bg-slate-900/40 px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-orange-400 font-medium">
                  <span>{activePlan.organ}</span>
                  <span>•</span>
                  <span>{currentSubject?.name || 'Sem disciplina'}</span>
                  {currentTopic && (
                    <>
                      <span>•</span>
                      <span>Tópico {currentTopic.code}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {currentTopic.status} • {currentTopic.mastery_score}% domínio
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {currentTopic?.title || 'Adicione um tópico ao edital para iniciar a bancada'}
                </h2>
              </div>

              {/* Cronômetro Pomodoro Real + Atalho CRUD */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    setCrudInitialSection('topics');
                    setCrudModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5"
                >
                  <Settings2 size={14} className="text-orange-400" />
                  Edital Verticalizado
                </button>

                {currentSubject && (
                  <PomodoroWidget
                    subjectId={currentSubject.id}
                    subjectName={currentSubject.name}
                    topicId={currentTopic?.id || null}
                    topicCode={currentTopic?.code || null}
                    onSessionComplete={({ durationMinutes, pausesCount, wasSkipped }) => {
                      recordStudySession({
                        subjectId: currentSubject.id,
                        topicId: currentTopic?.id || null,
                        durationMinutes,
                        sessionType: 'POMODORO',
                        pausesCount,
                        wasSkipped,
                      });
                      refreshFromSqlite(currentSubject.id, currentTopic?.id);
                    }}
                  />
                )}
              </div>
            </header>

            {/* Abas da Bancada (Tudo conectado ao mesmo Tópico no SQLite) */}
            <div className="px-6 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/20">
              {[
                { id: 'questions', label: 'Questões & Estudo Reverso IA', icon: HelpCircle },
                { id: 'cycle', label: 'Pizza do Ciclo & Mapa de Calor', icon: Layers },
                { id: 'notebooks', label: 'Cadernos do Tópico', icon: BookOpen },
                {
                  id: 'pdf',
                  label: `PDF Local Ancorado (${pdfSource ? `${pdfSource.current_page}/${pdfSource.total_pages}` : '1/1'})`,
                  icon: FileText,
                },
                { id: 'graph', label: 'Grafo de Micro-tópicos', icon: Network },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as WorkbenchTab)}
                    className={`px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 flex items-center gap-2 transition ${
                      active
                        ? 'border-orange-500 text-orange-300 bg-slate-900/70'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Conteúdo Dinâmico da Bancada */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'questions' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Coluna Esquerda: Questão Oficial da Banca vinda do SQLite */}
                  <div className="lg:col-span-7 space-y-4">
                    {activeQuestionBundle ? (
                      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                            {activeQuestionBundle.question.exam_board} (
                            {activeQuestionBundle.question.exam_year}) •{' '}
                            {activeQuestionBundle.question.organ}
                          </span>
                          <span className="text-slate-400">
                            Gabarito Pós-Recurso:{' '}
                            <strong className="text-emerald-300">
                              Letra {activeQuestionBundle.question.final_answer}
                            </strong>
                          </span>
                        </div>

                        <p className="text-sm leading-relaxed text-slate-200">
                          {activeQuestionBundle.question.statement}
                        </p>

                        <div className="space-y-2 text-xs">
                          {parsedOptions.map((opt, idx) => {
                            const letter = ['A', 'B', 'C', 'D', 'E'][idx];
                            const isAnswer = letter === activeQuestionBundle.question.final_answer;
                            const isSelected = selectedOptionIdx === idx;
                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedOptionIdx(idx)}
                                className={`w-full text-left p-3 rounded-xl border transition ${
                                  isSelected && isAnswer
                                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-medium'
                                    : isSelected
                                      ? 'bg-orange-500/15 border-orange-500/50 text-orange-200'
                                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {/* Diagnóstico Pós-Questão de 1 Clique (Estudo Reverso + Mapa de Calor) */}
                        <div className="pt-3 border-t border-slate-800">
                          <p className="text-xs text-slate-400 mb-2">
                            🏷️ <strong>Auto-Diagnóstico Rápido (Estudo Reverso):</strong> Consultar
                            a IA nunca reduz sua nota, e errar nunca infla suas horas semanais!
                            Calibre apenas o <strong>Mapa de Calor</strong> do próximo ciclo:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              {
                                id: 'MASTERED' as SelfDiagnosisType,
                                label: '🟢 Dominei / Só revisei',
                                desc: 'Esfria tópico no Mapa',
                              },
                              {
                                id: 'DOUBT' as SelfDiagnosisType,
                                label: '🟡 Acertei na dúvida',
                                desc: '+0.30 Score • Revisar',
                              },
                              {
                                id: 'BOARD_TRAP' as SelfDiagnosisType,
                                label: '🟠 Pegadinha da Banca',
                                desc: '0% perda • Alerta banca',
                              },
                              {
                                id: 'BASE_GAP' as SelfDiagnosisType,
                                label: '🔴 Lacuna / 1º Contato',
                                desc: '+Calor p/ Próximo Ciclo',
                              },
                            ].map((btn) => (
                              <button
                                key={btn.id}
                                onClick={() => handleDiagnosisClick(btn.id, btn.label)}
                                className="p-2 rounded-xl border bg-slate-950 border-slate-800 hover:border-orange-500/50 text-slate-300 text-left transition"
                              >
                                <div className="text-xs font-semibold">{btn.label}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{btn.desc}</div>
                              </button>
                            ))}
                          </div>

                          {lastDiagnosisMsg && (
                            <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                              ✅ {lastDiagnosisMsg}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs text-slate-400">
                        Nenhuma questão cadastrada para esta disciplina ainda.
                      </div>
                    )}
                  </div>

                  {/* Coluna Direita: Destrinchador IA (Grounding Anti-Alucinação) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col h-full space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-orange-400" />
                          <h3 className="text-sm font-bold">Destrinchador IA (Estudo Reverso)</h3>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          ⚡ Cache SQLite ({activeQuestionBundle?.dissection?.provider_used || '0 tokens'})
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 whitespace-pre-line">
                        {activeQuestionBundle?.dissection?.dissection_markdown ||
                          'Destrinchamento pronto para ser consultado no roteador IA.'}
                      </div>

                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200">
                        🛡️ <strong>Grounding Anti-Alucinação Ativo:</strong> Explicações ancoradas
                        estritamente na letra da norma/lei e no gabarito definitivo pós-recurso da
                        banca ({activeQuestionBundle?.question.exam_board}).
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleAppendDissectionToNotebook}
                          className="flex-1 py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 size={14} />
                          Anexar Síntese ao Caderno do Tópico
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'cycle' && (
                <CycleDashboard
                  plan={activePlan}
                  cycleData={cycleData}
                  onUpdateWeeklyHours={(newWeeklyHours) => {
                    updateStudyPlan({
                      id: activePlan.id,
                      weekly_hours_target: newWeeklyHours,
                    });
                    refreshFromSqlite(currentSubject?.id, currentTopic?.id);
                  }}
                  onApplyRecommendedCycle={(newAllocations) => {
                    applyRecommendedCycleAllocations(newAllocations);
                    refreshFromSqlite(currentSubject?.id, currentTopic?.id);
                  }}
                  onJumpToTopic={(subjId, topId) => {
                    setSelectedSubjectId(subjId);
                    setSelectedTopicId(topId);
                    setActiveTab('questions');
                  }}
                />
              )}

              {activeTab === 'notebooks' && currentSubject && currentTopic && (
                <div className="max-w-4xl space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          📓 {notebook?.title || `Caderno ${currentTopic.code} — ${currentTopic.title}`}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Persistido na tabela <code>notebooks</code> do SQLite local
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const saved = saveTopicNotebook({
                            subjectId: currentSubject.id,
                            topicId: currentTopic.id,
                            title: `Caderno ${currentTopic.code} — ${currentTopic.title}`,
                            contentMarkdown: notebookDraft,
                          });
                          setNotebook(saved);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Save size={14} />
                        Salvar no SQLite
                      </button>
                    </div>

                    <textarea
                      value={notebookDraft}
                      onChange={(e) => setNotebookDraft(e.target.value)}
                      rows={14}
                      className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-orange-500 outline-none leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'pdf' && (
                <div className="max-w-4xl p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-white">
                    📄 Fonte PDF Local Ancorada: {pdfSource?.title || 'Nenhum PDF vinculado a este tópico'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Progresso salvo no SQLite (<code>pdf_sources</code>): Página{' '}
                    <strong>{pdfSource?.current_page || 1}</strong> de{' '}
                    <strong>{pdfSource?.total_pages || 1}</strong> • Caminho Local:{' '}
                    <code>{pdfSource?.file_path || 'N/D'}</code>
                  </p>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-orange-300">
                      🔒 Política de Direitos Autorais (Estratégia / Gran Cursos):
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Seus PDFs pessoais nunca são copiados para a nuvem nem incluídos nos pacotes{' '}
                      <code>.fofopack</code>. Cada estudante aponta seus próprios PDFs no disco local
                      e o FofoLab salva apenas a página de parada, grifos e vínculo com os tópicos do
                      edital.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'graph' && (
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <h3 className="text-sm font-bold text-white">
                    🕸️ Grafo de Micro-tópicos (Tabela <code>topic_links</code>)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Os vínculos de pré-requisito entre os tópicos ({topicLinks.length} conexões
                    ativas) já alimentam o Mapa de Calor na aba do Ciclo e serão renderizados em
                    grafo visual na Fatia 6.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Visão Fábrica Admin: Trilhas Prontas, Dossiês & Blueprint das Bancas */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Wrench className="text-purple-400" size={20} />
                  Modo Administrador ("A Fábrica" do FofoLab)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Dados lidos em tempo real das tabelas <code>career_tracks</code> e{' '}
                  <code>admin_board_blueprints</code> do SQLite local.
                </p>
              </div>
              {adminData && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
                    Planos: <strong>{adminData.stats.plans}</strong> • Disciplinas:{' '}
                    <strong>{adminData.stats.subjects}</strong> • Tópicos:{' '}
                    <strong>{adminData.stats.topics}</strong> • Resoluções:{' '}
                    <strong>{adminData.stats.attempts}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FolderGit2 size={16} className="text-orange-400" />
                  Catálogo de Trilhas Prontas (SQLite)
                </h3>
                <div className="space-y-2 text-xs">
                  {adminData?.tracks.map((track) => (
                    <div
                      key={track.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between"
                    >
                      <span>{track.name}</span>
                      <span
                        className={
                          track.catalog_status === 'CATALOGED'
                            ? 'text-emerald-400 font-semibold'
                            : track.catalog_status === 'PARTIAL'
                              ? 'text-amber-400 font-semibold'
                              : 'text-slate-400'
                        }
                      >
                        {track.catalog_status === 'CATALOGED'
                          ? '🟢 Catalogada'
                          : track.catalog_status === 'PARTIAL'
                            ? '🟡 Parcial / Em Dossiê'
                            : '⚪ No Radar'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert size={16} className="text-purple-400" />
                  Blueprint de Layout das Bancas (DOM Drift Check)
                </h3>
                <div className="space-y-2 text-xs">
                  {adminData?.blueprints.map((bp) => (
                    <div
                      key={bp.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between"
                    >
                      <span>
                        {bp.board_name} ({bp.last_dom_hash})
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {bp.health_status === 'OK' ? '🟢 Layout Intacto' : '🔴 Drift Detectado'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal CRUD Completo (Planos, Disciplinas e Tópicos Verticalizados) */}
      <CurriculumManagerModal
        isOpen={crudModalOpen}
        initialSection={crudInitialSection}
        plans={plans}
        activePlan={activePlan}
        subjects={subjects}
        selectedSubject={currentSubject}
        topics={currentTopics}
        onClose={() => setCrudModalOpen(false)}
        onSelectPlan={handleSelectPlan}
        onCreatePlan={(input: CreateStudyPlanInput) => {
          const created = createStudyPlan(input);
          refreshFromSqlite('', '');
          handleSelectPlan(created.id);
        }}
        onUpdatePlan={(id, input) => {
          updateStudyPlan({ id, ...input });
          refreshFromSqlite(currentSubject?.id, currentTopic?.id);
        }}
        onDeletePlan={(id) => {
          deleteStudyPlan(id);
          refreshFromSqlite('', '');
        }}
        onCreateSubject={(input: CreateSubjectInput) => {
          const created = createSubject(input);
          refreshFromSqlite(created.id, '');
        }}
        onUpdateSubject={(id, input) => {
          updateSubject({ id, ...input });
          refreshFromSqlite(id, currentTopic?.id);
        }}
        onDeleteSubject={(id) => {
          deleteSubject(id);
          refreshFromSqlite('', '');
        }}
        onCreateTopic={(input: CreateTopicInput) => {
          const created = createTopic(input);
          refreshFromSqlite(currentSubject?.id, created.id);
        }}
        onUpdateTopic={(id, input) => {
          updateTopic({ id, ...input });
          refreshFromSqlite(currentSubject?.id, id);
        }}
        onDeleteTopic={(id) => {
          deleteTopic(id);
          refreshFromSqlite(currentSubject?.id, '');
        }}
        onExportDatabase={handleExportDatabase}
        onResetSeed={async () => {
          await resetDatabaseToSeed();
          refreshFromSqlite('', '');
        }}
      />
    </div>
  );
}
