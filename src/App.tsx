import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Layers,
  Network,
  PanelLeft,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { CurriculumManagerModal } from './components/CurriculumManagerModal';
import { CycleDashboard } from './components/CycleDashboard';
import { PomodoroWidget } from './components/PomodoroWidget';
import { QuestionWorkbench } from './components/QuestionWorkbench';
import { AdminFactoryView } from './features/admin-factory/AdminFactoryView';
import { AiCopilotDockPanel } from './features/ai-copilot/AiCopilotDockPanel';
import { NotebookDockPanel } from './features/notebook-dock/NotebookDockPanel';
import { SyllabusTreeDock } from './features/syllabus-dock/SyllabusTreeDock';
import type { StudentContextSnapshot } from './lib/aiRouter';
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
  getNotebooksByPlan,
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
  savePdfSourceProgress,
  saveQuestionChatHistory,
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

type WorkbenchTab = 'questions' | 'cycle' | 'graph';
type AppMode = 'student' | 'admin';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [mode, setMode] = useState<AppMode>('student');
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('questions');

  // Controles de Painéis Expansíveis (Microfrontends / Dock Slots)
  const [showSyllabusDock, setShowSyllabusDock] = useState(true);
  const [showNotebookDock, setShowNotebookDock] = useState(false);
  const [showAiCopilotDock, setShowAiCopilotDock] = useState(true);

  // Estado sincronizado do banco local
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, Topic[]>>({});
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [topicLinks, setTopicLinks] = useState<TopicLink[]>([]);
  const [allNotebooks, setAllNotebooks] = useState<Notebook[]>([]);

  // Entidades do Tópico atual
  const [questionScope, setQuestionScope] = useState<'topic' | 'subject' | 'all'>('topic');
  const [topicQuestions, setTopicQuestions] = useState<
    { question: Question; dissection: AiDissection | null }[]
  >([]);
  const [lastDiagnosisMsg, setLastDiagnosisMsg] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notebookDraft, setNotebookDraft] = useState<string>('');
  const [pdfSource, setPdfSource] = useState<PdfSource | null>(null);

  const [adminData, setAdminData] = useState<{
    tracks: CareerTrack[];
    blueprints: AdminBoardBlueprint[];
    stats: { plans: number; subjects: number; topics: number; questions: number; attempts: number };
  } | null>(null);

  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudInitialSection, setCrudInitialSection] = useState<'plans' | 'subjects' | 'topics'>(
    'topics'
  );

  const refreshData = useCallback(
    (preferredSubjectId?: string, preferredTopicId?: string) => {
      const allPlans = getStudyPlans();
      setPlans(allPlans);
      const currentPlan = allPlans.find((p) => p.is_active === 1) || allPlans[0] || null;
      setActivePlan(currentPlan);
      if (!currentPlan) return;

      const planSubjects = getSubjectsByPlan(currentPlan.id);
      setSubjects(planSubjects);

      const topicsMap: Record<string, Topic[]> = {};
      for (const s of planSubjects) {
        topicsMap[s.id] = getTopicsBySubject(s.id);
      }
      setTopicsBySubject(topicsMap);

      let targetSubjId = planSubjects[0]?.id || '';
      if (preferredSubjectId && planSubjects.some((s) => s.id === preferredSubjectId)) {
        targetSubjId = preferredSubjectId;
      } else if (planSubjects.some((s) => s.id === selectedSubjectId)) {
        targetSubjId = selectedSubjectId;
      }
      setSelectedSubjectId(targetSubjId);

      const subjTopics = topicsMap[targetSubjId] || [];
      let targetTopicId = subjTopics[0]?.id || '';
      if (preferredTopicId && subjTopics.some((t) => t.id === preferredTopicId)) {
        targetTopicId = preferredTopicId;
      } else if (subjTopics.some((t) => t.id === selectedTopicId)) {
        targetTopicId = selectedTopicId;
      }
      setSelectedTopicId(targetTopicId);

      setAttempts(getRecentAttempts(200));
      setSessions(getStudySessions(100));
      setTopicLinks(getTopicLinks());
      setAllNotebooks(getNotebooksByPlan(currentPlan.id));
      setAdminData(getAdminCatalogAndBlueprints());
    },
    [selectedSubjectId, selectedTopicId]
  );

  useEffect(() => {
    initDatabase().then(() => {
      setDbReady(true);
      refreshData();
    });
  }, []);

  useEffect(() => {
    if (!dbReady || !selectedSubjectId) return;
    setTopicQuestions(
      getQuestionsForTopicOrSubject(selectedTopicId, selectedSubjectId, questionScope)
    );
    setLastDiagnosisMsg(null);

    const nb = getNotebookForTopic(selectedSubjectId, selectedTopicId);
    setNotebook(nb);
    setNotebookDraft(
      nb?.content_markdown ||
        '# Caderno do Tópico\n\nAnote seus resumos, mnemônicos e jurisprudências aqui...'
    );
    setPdfSource(getPdfSourceForTopic(selectedSubjectId, selectedTopicId));
  }, [dbReady, selectedSubjectId, selectedTopicId, questionScope]);

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

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  const currentTopics = currentSubject ? topicsBySubject[currentSubject.id] || [] : [];
  const currentTopic =
    currentTopics.find((t) => t.id === selectedTopicId) || currentTopics[0] || null;

  const studentContext = useMemo<StudentContextSnapshot | undefined>(() => {
    if (!activePlan || !currentSubject || !currentTopic || !cycleData) return undefined;
    const subjAlloc = cycleData.allocations.find((a) => a.subject.id === currentSubject.id);
    const topicHeat = cycleData.topicHeatmapRanking.find((h) => h.topic.id === currentTopic.id);
    const strongTopics = cycleData.topicHeatmapRanking
      .filter((h) => h.topic.mastery_score >= 70)
      .map((h) => `${h.topic.code} ${h.topic.title}`);
    const priorityWeakTopics = cycleData.topicHeatmapRanking
      .slice(0, 3)
      .map((h) => `${h.topic.code} ${h.topic.title}`);

    return {
      planTitle: activePlan.title,
      organ: activePlan.organ || 'Concurso',
      examBoard: activePlan.exam_board || 'FGV',
      roleTitle: activePlan.role_title || 'Auditor',
      daysUntilExam: cycleData.daysUntilExam,
      weeklyHoursTarget: activePlan.weekly_hours_target,
      currentSubjectName: currentSubject.name,
      currentSubjectWeight: currentSubject.exam_weight,
      currentSubjectMastery: subjAlloc?.studiedTopicsMastery ?? currentSubject.measured_mastery_score,
      currentSubjectCoverage: subjAlloc?.coveragePercent ?? 0,
      currentTopicCode: currentTopic.code,
      currentTopicTitle: currentTopic.title,
      currentTopicMastery: currentTopic.mastery_score,
      currentTopicConfidence: topicHeat?.sampleConfidencePercent ?? 0,
      strongTopics,
      priorityWeakTopics,
      relatedPrerequisites: topicHeat?.relatedPrerequisiteTitles ?? [],
    };
  }, [activePlan, currentSubject, currentTopic, cycleData]);

  if (!dbReady || !activePlan || !cycleData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 text-sm">
          <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center animate-pulse">
            🐹
          </div>
          <span>Carregando sua bancada de estudos...</span>
        </div>
      </div>
    );
  }

  const handleSelectPlan = (planId: string) => {
    setActiveStudyPlan(planId);
    const nextSubjects = getSubjectsByPlan(planId);
    const firstSubj = nextSubjects[0]?.id || '';
    const firstTopic = firstSubj ? getTopicsBySubject(firstSubj)[0]?.id || '' : '';
    refreshData(firstSubj, firstTopic);
  };

  const handleDiagnosis = (
    question: Question,
    selectedOptionLetter: string,
    isCorrect: boolean,
    diagnosis: SelfDiagnosisType,
    label: string
  ) => {
    const targetTopicId = question.topic_id || currentTopic?.id;
    if (!targetTopicId) return;

    const { updatedTopic, deltaMastery, sampleConfidencePercent } = recordQuestionDiagnosis({
      questionId: question.id,
      topicId: targetTopicId,
      selectedOption: selectedOptionLetter,
      isCorrect,
      selfDiagnosis: diagnosis,
    });

    const sign = deltaMastery > 0 ? `+${deltaMastery}%` : `${deltaMastery}%`;
    setLastDiagnosisMsg(
      `${label} registrado! Domínio: ${updatedTopic?.mastery_score ?? 0}% (${sign}) • Confiança da Amostra: ${sampleConfidencePercent}%`
    );
    refreshData(currentSubject?.id, currentTopic?.id);
  };

  const handleAppendNotesToNotebook = (markdownToAppend: string) => {
    if (!currentSubject || !currentTopic) return;
    const appended = `${notebookDraft}\n\n---\n### 📌 Anotação de Estudo Reverso\n${markdownToAppend}`;
    const saved = saveTopicNotebook({
      subjectId: currentSubject.id,
      topicId: currentTopic.id,
      title: `Caderno ${currentTopic.code} — ${currentTopic.title}`,
      contentMarkdown: appended,
    });
    setNotebook(saved);
    setNotebookDraft(saved.content_markdown);
    setAllNotebooks(getNotebooksByPlan(activePlan.id));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Slot 1: Dock Esquerdo (Árvore de Tópicos e Edital) */}
      {showSyllabusDock && (
        <SyllabusTreeDock
          mode={mode}
          onToggleMode={() => setMode(mode === 'student' ? 'admin' : 'student')}
          plans={plans}
          activePlan={activePlan}
          subjects={subjects}
          currentSubject={currentSubject}
          topicsBySubject={topicsBySubject}
          currentTopic={currentTopic}
          allocations={cycleData.allocations}
          onSelectPlan={handleSelectPlan}
          onSelectSubjectAndTopic={(subjId, topId) => {
            setSelectedSubjectId(subjId);
            setSelectedTopicId(topId);
          }}
          onOpenCrudModal={(section) => {
            setCrudInitialSection(section);
            setCrudModalOpen(true);
          }}
        />
      )}

      {/* Slot 2: Bancada Central + Controles de Painéis Expansíveis */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {mode === 'student' ? (
          <>
            <header className="border-b border-slate-800 bg-slate-900/40 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-orange-400 font-medium truncate">
                  <span>{activePlan.organ}</span>
                  <span>•</span>
                  <span>{currentSubject?.name || 'Sem disciplina'}</span>
                  {currentTopic && (
                    <>
                      <span>•</span>
                      <span>Tópico {currentTopic.code}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {currentTopic.mastery_score}% domínio
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-base font-bold text-white mt-0.5 truncate">
                  {currentTopic?.title || 'Selecione um tópico'}
                </h2>
              </div>

              {/* Barra de Controle dos Painéis Expansíveis (Dock Layout) */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSyllabusDock((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
                    showSyllabusDock
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Expandir ou recolher lista de tópicos"
                >
                  <PanelLeft size={13} />
                  Tópicos
                </button>

                <button
                  type="button"
                  onClick={() => setShowNotebookDock((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
                    showNotebookDock
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Expandir ou recolher Caderno Lateral e PDF"
                >
                  <BookOpen size={13} />
                  Caderno & PDF
                </button>

                <button
                  type="button"
                  onClick={() => setShowAiCopilotDock((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
                    showAiCopilotDock
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Expandir ou recolher Copiloto IA Contextual"
                >
                  <Sparkles size={13} />
                  Copiloto IA
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCrudInitialSection('topics');
                    setCrudModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5"
                >
                  <Settings2 size={13} className="text-orange-400" />
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
                      refreshData(currentSubject.id, currentTopic?.id);
                    }}
                  />
                )}
              </div>
            </header>

            {/* Abas do Palco Central */}
            <div className="px-6 pt-2.5 border-b border-slate-800 flex items-center gap-2 bg-slate-900/20">
              {[
                { id: 'questions', label: 'Questões & Estudo Reverso', icon: HelpCircle },
                { id: 'cycle', label: 'Ciclo & Mapa de Calor', icon: Layers },
                { id: 'graph', label: 'Mapa de Conceitos', icon: Network },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as WorkbenchTab)}
                    className={`px-4 py-2 text-xs font-medium rounded-t-lg border-b-2 flex items-center gap-2 transition ${
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

            {/* Palco Central + Docks Laterais Lado a Lado */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-6 min-w-0">
                {activeTab === 'questions' && (
                  <QuestionWorkbench
                    questions={topicQuestions}
                    scopeFilter={questionScope}
                    onChangeScopeFilter={setQuestionScope}
                    onDiagnosis={handleDiagnosis}
                    lastDiagnosisFeedback={lastDiagnosisMsg}
                    onSaveToNotebook={handleAppendNotesToNotebook}
                    onSaveChatHistory={(qId, chatJson) => saveQuestionChatHistory(qId, chatJson)}
                    studentContext={studentContext}
                  />
                )}

                {activeTab === 'cycle' && (
                  <CycleDashboard
                    plan={activePlan}
                    cycleData={cycleData}
                    onUpdateWeeklyHours={(newWeeklyHours) => {
                      updateStudyPlan({ id: activePlan.id, weekly_hours_target: newWeeklyHours });
                      refreshData(currentSubject?.id, currentTopic?.id);
                    }}
                    onApplyRecommendedCycle={(newAllocations) => {
                      applyRecommendedCycleAllocations(newAllocations);
                      refreshData(currentSubject?.id, currentTopic?.id);
                    }}
                    onJumpToTopic={(subjId, topId) => {
                      setSelectedSubjectId(subjId);
                      setSelectedTopicId(topId);
                      setActiveTab('questions');
                    }}
                  />
                )}

                {activeTab === 'graph' && (
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <h3 className="text-sm font-bold text-white">
                      🕸️ Conexões entre Tópicos e Pré-requisitos ({topicLinks.length})
                    </h3>
                    <div className="space-y-2 text-xs text-slate-300">
                      {topicLinks.map((lnk) => (
                        <div
                          key={lnk.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          🔗 <strong>{lnk.relation_type}:</strong> {lnk.notes}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Slot 3: Dock Lateral de Caderno, Busca e Leitor PDF */}
              {showNotebookDock && (
                <NotebookDockPanel
                  currentSubject={currentSubject}
                  currentTopic={currentTopic}
                  notebook={notebook}
                  notebookDraft={notebookDraft}
                  onChangeNotebookDraft={setNotebookDraft}
                  onSaveNotebook={() => {
                    if (!currentSubject || !currentTopic) return;
                    const saved = saveTopicNotebook({
                      subjectId: currentSubject.id,
                      topicId: currentTopic.id,
                      title: `Caderno ${currentTopic.code} — ${currentTopic.title}`,
                      contentMarkdown: notebookDraft,
                    });
                    setNotebook(saved);
                    setAllNotebooks(getNotebooksByPlan(activePlan.id));
                  }}
                  allNotebooks={allNotebooks}
                  pdfSource={pdfSource}
                  onSavePdfProgress={(params) => {
                    if (!currentSubject || !currentTopic) return;
                    const updatedPdf = savePdfSourceProgress({
                      subjectId: currentSubject.id,
                      topicId: currentTopic.id,
                      ...params,
                    });
                    setPdfSource(updatedPdf);
                  }}
                  onJumpToTopic={(subjId, topId) => {
                    setSelectedSubjectId(subjId);
                    setSelectedTopicId(topId);
                  }}
                  onCloseDock={() => setShowNotebookDock(false)}
                />
              )}

              {/* Slot 4: Dock Lateral do Copiloto IA Contextual */}
              {showAiCopilotDock && studentContext && (
                <AiCopilotDockPanel
                  context={studentContext}
                  activeQuestion={topicQuestions[0]?.question || null}
                  notebookExcerpt={notebookDraft}
                  onSaveToNotebook={handleAppendNotesToNotebook}
                  onCloseDock={() => setShowAiCopilotDock(false)}
                />
              )}
            </div>
          </>
        ) : (
          <AdminFactoryView adminData={adminData} />
        )}
      </main>

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
          refreshData('', '');
          handleSelectPlan(created.id);
        }}
        onUpdatePlan={(id, input) => {
          updateStudyPlan({ id, ...input });
          refreshData(currentSubject?.id, currentTopic?.id);
        }}
        onDeletePlan={(id) => {
          deleteStudyPlan(id);
          refreshData('', '');
        }}
        onCreateSubject={(input: CreateSubjectInput) => {
          const created = createSubject(input);
          refreshData(created.id, '');
        }}
        onUpdateSubject={(id, input) => {
          updateSubject({ id, ...input });
          refreshData(id, currentTopic?.id);
        }}
        onDeleteSubject={(id) => {
          deleteSubject(id);
          refreshData('', '');
        }}
        onCreateTopic={(input: CreateTopicInput) => {
          const created = createTopic(input);
          refreshData(currentSubject?.id, created.id);
        }}
        onUpdateTopic={(id, input) => {
          updateTopic({ id, ...input });
          refreshData(currentSubject?.id, id);
        }}
        onDeleteTopic={(id) => {
          deleteTopic(id);
          refreshData(currentSubject?.id, '');
        }}
        onExportDatabase={() => {
          const bytes = exportDatabaseBinary();
          const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `fofolab-${activePlan.organ?.toLowerCase() || 'estudos'}.fofopack`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onResetSeed={async () => {
          await resetDatabaseToSeed();
          refreshData('', '');
        }}
      />
    </div>
  );
}
