import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, GraduationCap, HelpCircle, Flame, Layers, Link2, Network, PanelLeft, Sun, Wrench } from 'lucide-react';
import { formatDuration } from './lib/timeFormat';
import { useConfirmDialog } from './components/ConfirmDialog';
import { CurriculumManagerModal, type CurriculumSection } from './components/CurriculumManagerModal';
import { QuestionWorkbench, type AnswerSubmission } from './features/questions/QuestionWorkbench';
import { DIAGNOSIS_LABEL } from './lib/answerLabels';
import { useResizableWidth } from './components/ResizeHandle';
import { SaveStatusIndicator } from './components/SaveStatusIndicator';
import { AdminFactoryView } from './features/admin-factory/AdminFactoryView';
import { FofoIaPanel } from './features/fofoia/FofoIaPanel';
import { useFofoIaInputs } from './features/fofoia/useFofoIaInputs';
import { FofoSprite } from './features/mascot/FofoSprite';
import { FofoOutfitProvider, useFofoOutfit } from './features/mascot/FofoOutfitContext';
import { FofoWardrobeButton } from './features/mascot/FofoWardrobeButton';
import { ThematicPerimeter } from './features/mascot/ThematicPerimeter';
import { useFofoPrefs } from './features/mascot/useFofoPrefs';
import { StudyPlanView } from './features/study-plan/StudyPlanView';
import { useWeekAvailability } from './features/study-plan/useWeekAvailability';
import { useExamOutlook } from './features/study-plan/useExamOutlook';
import { forecastWeek } from './lib/weekForecast';
import { stretchStartKey } from './lib/examProjection';
import { weekReviewDuration } from './lib/availability';
import { TopicHeatGrid } from './features/heatmap/TopicHeatGrid';
import { FofoDoro } from './features/fofodoro/FofoDoro';
import { FofoDoroPreview } from './features/fofodoro/FofoDoroPreview';
import { Toast } from './features/fofodoro/Toast';
import { StudyBlockMini } from './features/study-block/StudyBlockMini';
import { focusedSegmentMs, type BlockTarget, type RecordedSession } from './features/study-block/studyBlockMachine';
import { useStudyBlock } from './features/study-block/useStudyBlock';
import { EditalImportModal } from './features/edital-import/EditalImportModal';
import { NotebookDockPanel } from './features/notebook-dock/NotebookDockPanel';
import { PdfReaderStage, type PdfProgressUpdate } from './features/pdf-reader/PdfReaderStage';
import { useNotebookDraft } from './features/notebook-dock/useNotebookDraft';
import {
  ONBOARDING_COMPLETED_KEY,
  OnboardingWizardModal,
  type OnboardingProfile,
} from './features/onboarding-wizard/OnboardingWizardModal';
import { QuestionImportModal } from './features/question-import/QuestionImportModal';
import { useTopicQuestionCount, useTopicQuestions } from './features/acervo/useTopicQuestions';
import { AcervoImportPanel } from './features/acervo/AcervoImportPanel';
import { useAcervoAutoSync } from './features/acervo/useAcervoAutoSync';
import { ACERVO_LINK_MAX_TOKENS, type LinkAi } from './lib/acervo/importAcervo';
import { excludeItemFromTopic, materializeQuestion, restoreItemToTopic } from './lib/acervo/studentAcervo';
import { disableLinkForTopic, type QuestionScope } from './lib/acervo/topicQuestions';
import { AppHeader } from './features/workbench-shell/AppHeader';
import { summarizeExamParts } from './features/workbench-shell/headerSummary';
import { RightDock, rightDockRail, useRightDockTab, type RightDockTab } from './features/workbench-shell/RightDock';
import { RailButton, SidePanel } from './features/workbench-shell/SidePanel';
import { useCollapsiblePanel } from './features/workbench-shell/useCollapsiblePanel';
import { GoodMorningView } from './features/good-morning/GoodMorningView';
import { RoutineColumn } from './features/routine/RoutineColumn';
import { useDailyRoutine } from './features/routine/useDailyRoutine';
import { usePeek } from './features/routine/usePeek';
import { routineGroup, type RoutineItem } from './lib/dailyRoutine';
import { describeRecalibrationHint, recalibrationHint } from './lib/recalibrationHint';
import { callAiProviders, generateQuestionDissection, getAiStatus, type StudentContextSnapshot } from './lib/aiRouter';
import { calculateDynamicStudyCycle, recommendedForStandardWeek, startOfWeek } from './lib/cycleEngine';
import {
  applyRecommendedCycleAllocations,
  countDependents,
  createSafetyBackup,
  createStudyPlan,
  createPlanFromEdital,
  createSubject,
  createTopic,
  deleteStudyPlan,
  deleteSubject,
  deleteTopic,
  exportDatabaseBinary,
  getAdminCatalogAndBlueprints,
  getExamPartsByPlan,
  getNotebooksByPlan,
  getPdfSourceForTopic,
  getQuestionLogs,
  recordQuestionLog,
  undoQuestionLog,
  getRecallChecks,
  getRecentAttempts,
  getStudyPlans,
  getStudySessionsSince,
  getStudyTotals,
  getSubjectsByPlan,
  getTopicLinks,
  getTopicsBySubject,
  importQuestions,
  importSyllabusTopics,
  initDatabase,
  listDatabaseBackups,
  recordQuestionDiagnosis,
  updateAttemptDiagnosis,
  recordStudySession,
  resetDatabaseToSeed,
  restoreDatabaseBackup,
  restoreDatabaseFromBytes,
  saveAiDissection,
  savePdfSourceProgress,
  saveSelfAssessment,
  setActiveStudyPlan,
  updateStudyPlan,
  updateWeekdayMinutes,
  updateSubject,
  updateTopic,
} from './lib/database';
import type { BackupEntry } from './lib/storage';
import type {
  AdminBoardBlueprint,
  AiDissection,
  CareerTrack,
  CreateStudyPlanInput,
  CreateSubjectInput,
  CreateTopicInput,
  EditalPlanInput,
  ExamPart,
  ImportQuestionItem,
  SelfAssessmentInput,
  ImportTopicItem,
  Notebook,
  PdfSource,
  Question,
  QuestionAttempt,
  QuestionLog,
  RecallCheck,
  SelfDiagnosisType,
  StudyPlan,
  StudySession,
  Subject,
  Topic,
  TopicLink,
} from './types/database';

type WorkbenchTab = 'today' | 'questions' | 'cycle' | 'heatmap' | 'graph' | 'reader';
type AppMode = 'student' | 'admin';
type DeletableKind = 'plan' | 'subject' | 'topic';

const DELETE_LABELS: Record<DeletableKind, { noun: string; backupLabel: string }> = {
  plan: { noun: 'o plano', backupLabel: 'antes-de-excluir-plano' },
  subject: { noun: 'a disciplina', backupLabel: 'antes-de-excluir-disciplina' },
  topic: { noun: 'o tópico', backupLabel: 'antes-de-excluir-topico' },
};

function describeDependents(deps: ReturnType<typeof countDependents>): string {
  const parts = [
    deps.subjects > 0 ? `${deps.subjects} disciplina(s)` : null,
    deps.topics > 0 ? `${deps.topics} tópico(s)` : null,
    deps.questions > 0 ? `${deps.questions} questão(ões)` : null,
    deps.notebooks > 0 ? `${deps.notebooks} caderno(s)` : null,
    deps.questionLogs > 0 ? `${deps.questionLogs} registro(s) de questões feitas fora do app` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'nada além do próprio item';
}

function localDateStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  /** Muda quando o banco inteiro é substituído (restaurar backup/exemplo). */
  const [dataVersion, setDataVersion] = useState(0);
  const [questionsVersion, setQuestionsVersion] = useState(0);
  const [mode, setMode] = useState<AppMode>('student');
  // O app abre no "Início" (Revisão do dia e Situação): o bloco em andamento não sobrevive a recarregar
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('today');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(1);
  const [editalImportOpen, setEditalImportOpen] = useState(false);
  const [examParts, setExamParts] = useState<ExamPart[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  // Painéis laterais: abrir/fechar + largura ajustável (arrastando a divisória)
  const leftPanel = useCollapsiblePanel('fofolab_layout_left_open_v1', true);
  const rightPanel = useCollapsiblePanel('fofolab_layout_right_open_v1', true);
  const rightTab = useRightDockTab();
  const syllabusWidth = useResizableWidth('fofolab_layout_syllabus_v1', 320, 240, 520);
  const rightWidth = useResizableWidth('fofolab_layout_right_v1', 384, 300, 960);

  // Estado sincronizado do banco local
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, Topic[]>>({});
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [questionLogs, setQuestionLogs] = useState<QuestionLog[]>([]);
  const [recallChecks, setRecallChecks] = useState<RecallCheck[]>([]);
  // Registro de questões feitas fora do app: convite ao terminar um bloco e o último registro (para desfazer)
  const [logInvite, setLogInvite] = useState<{ topicId: string | null } | null>(null);
  const [lastLog, setLastLog] = useState<{ logId: string; label: string } | null>(null);
  const [topicLinks, setTopicLinks] = useState<TopicLink[]>([]);
  const [allNotebooks, setAllNotebooks] = useState<Notebook[]>([]);

  // Entidades do tópico atual
  const [questionScope, setQuestionScope] = useState<QuestionScope>('topic');
  const [lastDiagnosisMsg, setLastDiagnosisMsg] = useState<string | null>(null);
  // Questão na tela da aba Questões (a FofoIA só recebe o gabarito depois de respondida)
  const [activeQuestion, setActiveQuestion] = useState<{ question: Question; answered: boolean } | null>(null);
  // Pedido da aba Questões para a FofoIA ("Aprofundar", "Pedir pista"); o id faz cada pedido ser atendido uma vez
  const [fofoRequest, setFofoRequest] = useState<{ id: number; kind: 'deepen' | 'hint' } | null>(null);
  const [pdfSource, setPdfSource] = useState<PdfSource | null>(null);
  const [pdfFile, setPdfFile] = useState<{ url: string; name: string; sourceId: string } | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const docksBeforeReaderRef = useRef<{ left: boolean; right: boolean; tab: RightDockTab } | null>(null);
  // Leitura ampliada: esconde cabeçalho, abas e painéis (o caderno abre por um botão do leitor)
  const [readerMaximized, setReaderMaximized] = useState(false);
  const [readerFullscreen, setReaderFullscreen] = useState(false);
  // Um só bloco de estudo para o app (cartão no Meu Dia/Ciclo e relógio no cabeçalho)
  const studyBlock = useStudyBlock({ ticking: dbReady });
  // Abriu com um bloco retomado (recarregou no meio do estudo): volta direto à bancada, não ao "Início"
  useEffect(() => {
    if (studyBlock.state.phase !== 'IDLE' && studyBlock.state.phase !== 'DONE') setActiveTab('questions');
    // Só na abertura: depois, quem troca de aba é o estudante
  }, []);

  const [adminData, setAdminData] = useState<{
    tracks: CareerTrack[];
    blueprints: AdminBoardBlueprint[];
    stats: { plans: number; subjects: number; topics: number; questions: number; attempts: number };
  } | null>(null);

  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudInitialSection, setCrudInitialSection] = useState<CurriculumSection>('topics');

  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const aiStatus = useMemo(() => getAiStatus(), []);

  const refreshData = useCallback(
    (preferredSubjectId?: string, preferredTopicId?: string) => {
      const allPlans = getStudyPlans();
      setPlans(allPlans);
      const currentPlan = allPlans.find((p) => p.is_active === 1) || allPlans[0] || null;
      setActivePlan(currentPlan);
      if (!currentPlan) return;

      const planSubjects = getSubjectsByPlan(currentPlan.id);
      setSubjects(planSubjects);
      setExamParts(getExamPartsByPlan(currentPlan.id));

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

      setAttempts(getRecentAttempts(500));
      setSessions(getStudySessionsSince(startOfWeek(new Date()).toISOString()));
      setTopicLinks(getTopicLinks());
      setQuestionLogs(getQuestionLogs());
      setRecallChecks(getRecallChecks());
      setAllNotebooks(getNotebooksByPlan(currentPlan.id));
      setAdminData(getAdminCatalogAndBlueprints());
    },
    [selectedSubjectId, selectedTopicId]
  );

  useEffect(() => {
    initDatabase()
      .then(() => {
        setDbReady(true);
        refreshData();

        // Checa se é o 1º acesso para abrir o Wizard gentilmente
        try {
          if (!localStorage.getItem(ONBOARDING_COMPLETED_KEY)) setWizardOpen(true);
        } catch {
          // Ignora em caso de restrição de storage
        }
      })
      .catch((err: unknown) => {
        console.error('[FofoLab] Falha ao iniciar:', err);
        setInitError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  // Questões do tópico: próprias + acervo da Cebraspe (spec 12c); recarrega ao trocar tópico, filtro ou após gravar
  const questionsView = useTopicQuestions({
    ready: dbReady,
    planId: activePlan?.id ?? '',
    subjectId: selectedSubjectId,
    topicId: selectedTopicId,
    scope: questionScope,
    version: questionsVersion + dataVersion,
  });
  const topicQuestions = questionsView.items;
  useEffect(() => setLastDiagnosisMsg(null), [selectedSubjectId, selectedTopicId, questionScope]);
  // "Ver as do grupo" vale para o tópico em que foi pedido: outro tópico volta às questões dele
  useEffect(() => setQuestionScope((scope) => (scope === 'group' ? 'topic' : scope)), [selectedTopicId]);
  const bumpQuestions = useCallback(() => setQuestionsVersion((v) => v + 1), []);
  const linkAi = useMemo<LinkAi | null>(
    () => (aiStatus.configured ? (prompt) => callAiProviders(prompt, { json: true, maxTokens: ACERVO_LINK_MAX_TOKENS }) : null),
    [aiStatus.configured]
  );
  const totalPlanTopics = useMemo(
    () => Object.values(topicsBySubject).reduce((acc, list) => acc + list.length, 0),
    [topicsBySubject]
  );
  const acervoSyncNotice = useAcervoAutoSync({
    ready: dbReady,
    planId: activePlan?.id ?? '',
    topicsCount: totalPlanTopics,
    ai: linkAi,
    onSynced: bumpQuestions,
  });
  const acervoActions = {
    view: questionsView,
    onDisableLink: (assuntoId: string) => {
      void disableLinkForTopic(selectedTopicId, assuntoId).then(bumpQuestions);
    },
    onExcludeItem: (question: Question) => {
      if (!question.acervo_item_id) return;
      excludeItemFromTopic(selectedTopicId, question.acervo_item_id);
      bumpQuestions();
    },
    onRestoreItem: (itemId: string) => {
      restoreItemToTopic(selectedTopicId, itemId);
      bumpQuestions();
    },
    onShowGroup: () => setQuestionScope('group'),
  };

  // PDF do tópico (não depende do filtro de questões)
  useEffect(() => {
    if (!dbReady || !selectedSubjectId) return;
    setPdfSource(getPdfSourceForTopic(selectedSubjectId, selectedTopicId));
  }, [dbReady, selectedSubjectId, selectedTopicId, dataVersion]);

  // Horas da semana (spec 13): padrão seg–dom + exceções; o orçamento do ciclo é a soma dos dias desta semana
  const refreshAfterHours = useCallback(() => refreshData(), [refreshData]);
  const availability = useWeekAvailability({ plan: activePlan, onChanged: refreshAfterHours });

  const cycleData = useMemo(() => {
    if (!activePlan) return null;
    return calculateDynamicStudyCycle({
      plan: activePlan,
      subjects,
      topicsBySubject,
      attempts,
      sessions,
      topicLinks,
      examParts,
      questionLogs,
      recallChecks,
      weeklyMinutesBudget: availability.weekBudget,
    });
  }, [activePlan, subjects, topicsBySubject, attempts, sessions, topicLinks, examParts, questionLogs, recallChecks, availability.weekBudget]);

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  const currentTopics = currentSubject ? topicsBySubject[currentSubject.id] || [] : [];
  const currentTopic = currentTopics.find((t) => t.id === selectedTopicId) || currentTopics[0] || null;
  const activePlanId = activePlan?.id ?? null;

  const handleNotebookSaved = useCallback(() => {
    if (activePlanId) setAllNotebooks(getNotebooksByPlan(activePlanId));
  }, [activePlanId]);

  const notebook = useNotebookDraft({
    subject: dbReady ? currentSubject : null,
    topic: dbReady ? currentTopic : null,
    reloadKey: dataVersion,
    onSaved: handleNotebookSaved,
  });

  const studentContext = useMemo<StudentContextSnapshot | undefined>(() => {
    if (!activePlan || !currentSubject || !currentTopic || !cycleData) return undefined;
    const subjAlloc = cycleData.allocations.find((a) => a.subject.id === currentSubject.id);
    const topicHeat = cycleData.topicHeatmapRanking.find((h) => h.topic.id === currentTopic.id);
    const strongTopics = cycleData.topicHeatmapRanking
      .filter((h) => h.topic.mastery_score >= 75 && h.sampleConfidencePercent >= 55)
      .map((h) => `${h.topic.code} ${h.topic.title}`);
    const priorityWeakTopics = cycleData.topicHeatmapRanking.slice(0, 3).map((h) => `${h.topic.code} ${h.topic.title}`);

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
      currentTopicCode: currentTopic.code || '1.0',
      currentTopicTitle: currentTopic.title,
      currentTopicMastery: currentTopic.mastery_score,
      currentTopicConfidence: topicHeat?.sampleConfidencePercent ?? 0,
      strongTopics,
      priorityWeakTopics,
      relatedPrerequisites: topicHeat?.relatedPrerequisiteTitles ?? [],
    };
  }, [activePlan, currentSubject, currentTopic, cycleData]);

  const readerExpanded = readerMaximized && mode === 'student' && activeTab === 'reader';

  // Totais de estudo (hoje/semana/ano/tudo): relidos só quando as sessões mudam (refreshData), não a cada tique
  const studyTotals = useMemo(() => {
    if (!dbReady) return null;
    void sessions;
    return getStudyTotals(new Date());
  }, [dbReady, sessions]);

  // Revisão da semana (spec 13): só no dia mais longo da semana e só com a Revisão do dia ligada
  let todayReviewMinutes = 0;
  if (availability.reviewDayKey === availability.todayKey && activePlan?.daily_review_enabled !== 0) {
    todayReviewMinutes = weekReviewDuration(availability.weekBudget);
  }

  // Reta final (spec 13 §4.3): nos últimos dias antes da prova, o roteiro é só de revisão
  const stretchKey = activePlan?.exam_date ? stretchStartKey(activePlan.exam_date, activePlan.final_stretch_days ?? 14) : null;
  const inFinalStretch =
    stretchKey !== null && activePlan?.exam_date != null && availability.todayKey >= stretchKey && availability.todayKey <= activePlan.exam_date;

  // Roteiro de hoje na coluna esquerda (spec 09): congelado no dia, classificado pelas sessões de hoje
  const routine = useDailyRoutine({
    dbReady,
    plan: activePlan,
    cycleData,
    subjects,
    topicsBySubject,
    weekSessions: sessions,
    dataVersion,
    dayMinutes: availability.todayMinutes,
    weekReviewMinutes: todayReviewMinutes,
    finalStretch: inFinalStretch,
  });
  const routineBlockTopic = routine.currentItem?.topic ?? null;

  // Caminho até a prova (spec 13 §4.3): "Dá tempo?" e a linha do tempo
  const outlook = useExamOutlook({
    dbReady,
    plan: activePlan,
    cycleData,
    subjects,
    topicsBySubject,
    examParts,
    pattern: availability.pattern,
    weekSessions: sessions,
    dataVersion,
  });

  // Sua semana: feito, hoje (o roteiro gravado) e previsão dos próximos dias
  const weekDays = useMemo(() => {
    if (!activePlan || !cycleData) return [];
    return forecastWeek({
      weekStart: availability.weekStart,
      now: new Date(),
      pattern: availability.pattern,
      overrides: availability.overrides,
      cycleData,
      topicsBySubject,
      weekSessions: sessions,
      todayBlocks: routine.items.map((i) => i.block),
      reviewEnabled: activePlan.daily_review_enabled !== 0,
      stretchStartKey: stretchKey,
      allowNewInFinalStretch: activePlan.final_stretch_allow_new === 1,
    });
    // O dia entra nas dependências: virar a meia-noite com o app aberto troca o "hoje" da semana
  }, [activePlan, cycleData, availability.weekStart, availability.todayKey, availability.pattern, availability.overrides, topicsBySubject, sessions, routine.items, stretchKey]);
  const peek = usePeek({ selectedTopic: currentTopic, blockTopic: routineBlockTopic, studyBlock });

  // Ao terminar um bloco, convida a registrar as questões feitas fora do app (uma vez por bloco)
  const blockPhase = studyBlock.state.phase;
  const finishedTopicId = studyBlock.state.block?.topicId ?? null;
  useEffect(() => {
    if (blockPhase === 'DONE') setLogInvite({ topicId: finishedTopicId });
    // Começou outro bloco: o convite do anterior não vale mais
    if (blockPhase === 'FOCUS') setLogInvite(null);
  }, [blockPhase, finishedTopicId]);

  // Quantas questões o tópico do bloco tem (só as dele: sem recuo para o grupo — spec 12c §5.4)
  const routineQuestionCount = useTopicQuestionCount({ ready: dbReady, topic: routineBlockTopic, version: questionsVersion + dataVersion });

  // O bloco atual mudou (abriu o app, terminou um bloco, recalibrou): a bancada vai para o tópico dele
  // dataVersion entra na chave: restaurar backup/exemplo leva a seleção ao primeiro tópico, e ela precisa voltar ao bloco
  const routineCurrentKey = routine.currentItem
    ? `${routine.currentItem.block.subjectId}:${routine.currentItem.block.topicId}:${dataVersion}`
    : '';
  useEffect(() => {
    const item = routine.currentItem;
    if (!item) return;
    setSelectedSubjectId(item.subject.id);
    if (item.topic) setSelectedTopicId(item.topic.id);
    // Só a troca de bloco dispara: escolher outro tópico à mão (olhada) não pode ser desfeito sozinho
  }, [routineCurrentKey]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement !== null;
      setReaderFullscreen(active);
      if (active) setReaderMaximized(true);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Esc restaura o tamanho normal (na tela cheia, o primeiro Esc é do navegador, para sair dela)
  useEffect(() => {
    if (!readerExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) setReaderMaximized(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readerExpanded]);

  const fofoInputs = useFofoIaInputs({
    studentContext,
    cycleData,
    subjects,
    topicsBySubject,
    examParts,
    activeQuestion,
    topicQuestions,
    attempts,
    questionLogs,
    currentTopic,
    currentNotebookDraft: notebook.draft,
    appendToCurrentNotebook: (markdown) => notebook.appendAndSave(markdown),
    notebooks: allNotebooks,
    onNotebookSaved: () => {
      if (activePlan) setAllNotebooks(getNotebooksByPlan(activePlan.id));
    },
  });

  // Roupa do Fofo pela hora do dia, festas, marcos e guarda-roupa (regra em .agents/rules/identidade-fofolab.md)
  const fofoPrefs = useFofoPrefs(activePlan);
  const fofo = useFofoOutfit({
    examDates: activePlan?.exam_date ? [activePlan.exam_date] : [],
    appointed: fofoPrefs.appointed,
    fixedOutfit: fofoPrefs.fixedOutfit,
  });
  const fofoFocus = studyBlock.state.phase === 'FOCUS' && studyBlock.state.running;
  // Pausa entre pomodoros ou apertada pelo estudante; a pausa automática da olhada (outro tópico aberto) não conta
  const fofoResting =
    studyBlock.state.phase === 'BREAK' || (studyBlock.state.phase === 'FOCUS' && !studyBlock.state.running && peek.kind === 'none');

  if (initError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200 p-6">
        <div className="max-w-md space-y-2 text-sm text-center">
          <FofoSprite outfit="fofodeck" scale={2} motion="still" decorative className="mx-auto" />
          <p className="font-semibold text-white">Não foi possível abrir sua bancada de estudos.</p>
          <p className="text-xs text-slate-400">{initError}</p>
          <p className="text-xs text-slate-500">Feche e abra o FofoLab de novo. Seus estudos salvos não foram alterados.</p>
        </div>
      </div>
    );
  }

  if (!dbReady || !activePlan || !cycleData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 text-sm">
          <FofoSprite outfit={fofo.app} motion="full" decorative />
          <span>Carregando sua bancada de estudos...</span>
        </div>
      </div>
    );
  }

  const openCrudModal = (section: CurriculumSection) => {
    setCrudInitialSection(section);
    setCrudModalOpen(true);
  };

  const closePdfFile = () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfFile(null);
  };

  const afterDatabaseReplaced = () => {
    closePdfFile();
    // Banco trocado: o último registro (e o convite) eram do banco antigo
    setLastLog(null);
    setLogInvite(null);
    setDataVersion((v) => v + 1);
    refreshData('', '');
  };

  const handleSelectPlan = (planId: string) => {
    setActiveStudyPlan(planId);
    setLastLog(null);
    setLogInvite(null);
    const nextSubjects = getSubjectsByPlan(planId);
    const firstSubj = nextSubjects[0]?.id || '';
    const firstTopic = firstSubj ? getTopicsBySubject(firstSubj)[0]?.id || '' : '';
    refreshData(firstSubj, firstTopic);
  };

  // Aba Questões (spec 11): a tentativa é gravada ao responder; trocar o diagnóstico corrige a mesma tentativa
  const handleAnswer = (submission: AnswerSubmission): { attemptId: string } | null => {
    const { question } = submission;
    const targetTopicId = question.topic_id || currentTopic?.id;
    if (!targetTopicId) return null;
    try {
      materializeQuestion(question);
      const { attemptId, updatedTopic, sampleConfidencePercent } = recordQuestionDiagnosis({
        questionId: question.id,
        topicId: targetTopicId,
        selectedOption: submission.selectedOptionLetter,
        isCorrect: submission.isCorrect,
        selfDiagnosis: submission.diagnosis,
        timeSpentSeconds: submission.timeSpentSeconds,
        usedAiReview: submission.usedAiReview,
        confidence: submission.confidence ?? undefined,
      });
      setLastDiagnosisMsg(
        `${DIAGNOSIS_LABEL[submission.diagnosis]} registrado. Domínio do tópico: ${updatedTopic?.mastery_score ?? 0}% • Confiança da amostra: ${sampleConfidencePercent}%`
      );
      refreshData(currentSubject?.id, currentTopic?.id);
      return { attemptId };
    } catch (err) {
      setLastDiagnosisMsg(err instanceof Error ? err.message : 'Não foi possível registrar a resposta.');
      return null;
    }
  };

  const handleChangeDiagnosis = (attemptId: string, diagnosis: SelfDiagnosisType) => {
    try {
      const { updatedTopic } = updateAttemptDiagnosis(attemptId, diagnosis);
      const mastery = updatedTopic ? ` Domínio do tópico: ${updatedTopic.mastery_score}%` : '';
      setLastDiagnosisMsg(`${DIAGNOSIS_LABEL[diagnosis]} registrado.${mastery}`);
      refreshData(currentSubject?.id, currentTopic?.id);
    } catch (err) {
      setLastDiagnosisMsg(err instanceof Error ? err.message : 'Não foi possível trocar o diagnóstico.');
    }
  };

  const handleGenerateDissection = async (question: Question) => {
    const result = await generateQuestionDissection(question);
    if (result.status === 'ok') {
      materializeQuestion(question);
      saveAiDissection({
        questionId: question.id,
        provider: result.provider,
        dissectionMarkdown: result.dissectionMarkdown,
        prerequisites: result.prerequisites,
      });
      setQuestionsVersion((v) => v + 1);
      return { ok: true };
    }
    if (result.status === 'not-configured') {
      return { ok: false, message: 'A IA ainda não está configurada neste computador.' };
    }
    return { ok: false, message: result.message };
  };

  const handleImportQuestions = (subjectId: string, items: ImportQuestionItem[]) => {
    const result = importQuestions(subjectId, items);
    refreshData(currentSubject?.id, currentTopic?.id);
    setQuestionsVersion((v) => v + 1);
    return result;
  };

  const handleImportTopics = (items: ImportTopicItem[]) => {
    if (!currentSubject) return { inserted: 0, skippedDuplicates: 0 };
    const result = importSyllabusTopics(currentSubject.id, items);
    refreshData(currentSubject.id, currentTopic?.id);
    return result;
  };

  const handleOpenPdfFile = (file: File) => {
    if (!currentSubject || !currentTopic) return;
    const sameFile = pdfSource?.file_path === file.name;
    // O total certo de páginas chega quando o leitor termina de abrir o arquivo
    const saved = savePdfSourceProgress({
      pdfSourceId: sameFile ? pdfSource?.id : null,
      subjectId: currentSubject.id,
      topicId: currentTopic.id,
      title: file.name,
      filePath: file.name,
      currentPage: sameFile && pdfSource ? pdfSource.current_page : 1,
      totalPages: sameFile && pdfSource ? pdfSource.total_pages : 1,
    });
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    const url = URL.createObjectURL(file);
    pdfUrlRef.current = url;
    setPdfFile({ url, name: file.name, sourceId: saved.id });
    setPdfSource(saved);
  };

  const handleSavePdfProgress = (update: PdfProgressUpdate) => {
    if (!currentSubject || !currentTopic) return;
    setPdfSource(savePdfSourceProgress({ ...update, subjectId: currentSubject.id, topicId: currentTopic.id }));
  };

  // O arquivo aberto só aparece no tópico a que pertence (ou em outro que use o mesmo arquivo)
  const visiblePdfUrl =
    pdfFile && pdfSource && (pdfFile.sourceId === pdfSource.id || pdfFile.name === pdfSource.file_path)
      ? pdfFile.url
      : null;

  /**
   * O assistente GERA a configuração inicial (docs/specs/05, passo "Geração Automática"):
   * grava horas/estratégia no plano e já aplica ao ciclo a distribuição recomendada por elas.
   * Fora do assistente, mudanças de prioridade continuam sendo só sugestão (botão "Aplicar").
   */
  const handleOnboardingComplete = (
    profile: OnboardingProfile,
    targetPlanId: string,
    selfAssessment: SelfAssessmentInput
  ) => {
    saveSelfAssessment(selfAssessment);
    // Dias de estudo e horas de cada dia (spec 13): as horas da semana passam a ser a soma deles
    updateWeekdayMinutes(targetPlanId, profile.weekdayMinutes);
    const updatedPlan = updateStudyPlan({
      id: targetPlanId,
      strategy_mode: profile.strategyMode,
      study_moment: profile.studyMoment,
      daily_review_enabled: profile.dailyReviewEnabled ? 1 : 0,
      productive_failure_hints: profile.productiveFailureHints ? 1 : 0,
    });
    if (updatedPlan) {
      const planSubjects = getSubjectsByPlan(targetPlanId);
      const planTopics: Record<string, Topic[]> = {};
      for (const s of planSubjects) planTopics[s.id] = getTopicsBySubject(s.id);
      // A divisão gravada vem da semana padrão (os dias escolhidos), nunca de uma semana de folga ou atípica
      const recommended = recommendedForStandardWeek({
        plan: updatedPlan,
        subjects: planSubjects,
        topicsBySubject: planTopics,
        attempts: getRecentAttempts(500),
        sessions: getStudySessionsSince(startOfWeek(new Date()).toISOString()),
        topicLinks: getTopicLinks(),
        examParts: getExamPartsByPlan(targetPlanId),
        questionLogs: getQuestionLogs(),
        recallChecks: getRecallChecks(),
      }, profile.weekdayMinutes.reduce((acc, m) => acc + m, 0));
      if (recommended) applyRecommendedCycleAllocations(recommended);
    }
    if (targetPlanId === activePlan.id) {
      refreshData(currentSubject?.id, currentTopic?.id);
    } else {
      handleSelectPlan(targetPlanId);
    }
    // Perfil novo: o roteiro de hoje é refeito com ele
    routine.refreeze(targetPlanId);
  };

  /** Matérias do plano com os tópicos de primeiro nível, para a autoavaliação do assistente. */
  const getPlanContentForWizard = (planId: string) =>
    getSubjectsByPlan(planId).map((subject) => ({
      subject,
      topics: getTopicsBySubject(subject.id).filter((t) => !t.parent_id),
    }));

  const openWizard = (initialStep = 1) => {
    setWizardInitialStep(initialStep);
    setWizardOpen(true);
  };

  /** Edital importado vira o plano ativo; o assistente abre direto nas horas, para seguir à autoavaliação. */
  const handleCreatePlanFromEdital = (input: EditalPlanInput) => {
    createPlanFromEdital(input);
    setEditalImportOpen(false);
    refreshData('', '');
    openWizard(2);
  };

  const confirmAndDelete = async (kind: DeletableKind, id: string, name: string): Promise<boolean> => {
    const labels = DELETE_LABELS[kind];
    const ok = await confirm({
      title: `Excluir ${labels.noun} "${name}"?`,
      message: (
        <>
          <p>Isso também apaga: {describeDependents(countDependents(kind, id))}.</p>
          <p className="text-slate-400">
            Antes de excluir, guardamos uma cópia automática — dá para desfazer em “Organizar Edital → Backup &
            Segurança”.
          </p>
        </>
      ),
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return false;

    try {
      await createSafetyBackup(labels.backupLabel);
    } catch (err) {
      console.error('[FofoLab] Falha ao criar cópia antes de excluir:', err);
      const proceed = await confirm({
        title: 'Não foi possível guardar a cópia de segurança',
        message: 'Excluir mesmo assim? Desta vez não haverá como desfazer.',
        confirmLabel: 'Excluir sem cópia',
        tone: 'danger',
      });
      if (!proceed) return false;
    }

    if (kind === 'plan') deleteStudyPlan(id);
    else if (kind === 'subject') deleteSubject(id);
    else deleteTopic(id);
    return true;
  };

  const handleResetSeed = async (): Promise<boolean> => {
    const ok = await confirm({
      title: 'Restaurar o exemplo inicial?',
      message: (
        <>
          <p>Seus planos, questões, cadernos e progresso atuais serão substituídos pelo exemplo (CGU + BACEN).</p>
          <p className="text-slate-400">Uma cópia automática é guardada antes — dá para voltar em “Cópias automáticas”.</p>
        </>
      ),
      confirmLabel: 'Restaurar exemplo',
      tone: 'danger',
    });
    if (!ok) return false;
    await resetDatabaseToSeed();
    afterDatabaseReplaced();
    return true;
  };

  const handleRestoreFromFile = async (file: File): Promise<boolean> => {
    const ok = await confirm({
      title: `Restaurar o backup "${file.name}"?`,
      message: (
        <>
          <p>Todos os estudos atuais serão substituídos pelo conteúdo deste arquivo.</p>
          <p className="text-slate-400">Os estudos atuais ficam guardados numa cópia automática antes da troca.</p>
        </>
      ),
      confirmLabel: 'Restaurar backup',
      tone: 'danger',
    });
    if (!ok) return false;
    await restoreDatabaseFromBytes(new Uint8Array(await file.arrayBuffer()), 'arquivo');
    afterDatabaseReplaced();
    return true;
  };

  const handleRestoreBackup = async (backup: BackupEntry): Promise<boolean> => {
    const when = new Date(backup.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const ok = await confirm({
      title: 'Restaurar esta cópia automática?',
      message: (
        <>
          <p>Seus estudos voltam a como estavam em {when}.</p>
          <p className="text-slate-400">O estado atual também é guardado numa cópia antes da troca.</p>
        </>
      ),
      confirmLabel: 'Restaurar cópia',
      tone: 'danger',
    });
    if (!ok) return false;
    await restoreDatabaseBackup(backup.id);
    afterDatabaseReplaced();
    return true;
  };

  const handleExportDatabase = () => {
    const bytes = exportDatabaseBinary();
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fofolab-backup-${localDateStamp()}.db`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePomodoroComplete = (result: RecordedSession) => {
    recordStudySession({
      subjectId: result.subjectId,
      topicId: result.topicId,
      durationMinutes: result.durationMinutes,
      sessionType: 'POMODORO',
      pausesCount: result.pausesCount,
      wasSkipped: result.wasSkipped,
    });
    refreshData(currentSubject?.id, currentTopic?.id);
  };
  studyBlock.onRecordedRef.current = handlePomodoroComplete;

  /** Tópico aberto agora, para começar um bloco sem meta pelo cabeçalho ou pelo cartão. */
  const currentBlockTarget: BlockTarget | null = currentSubject
    ? {
        subjectId: currentSubject.id,
        subjectName: currentSubject.name,
        topicId: currentTopic?.id ?? null,
        topicCode: currentTopic?.code ?? null,
        topicTitle: currentTopic?.title ?? null,
        targetMinutes: null,
      }
    : null;

  /**
   * Leitura em tela grande: o PDF precisa de espaço, então a árvore de tópicos e o copiloto se
   * recolhem ao entrar (o caderno fica ao lado) e voltam como estavam ao sair da aba.
   */
  const selectTab = (tab: WorkbenchTab) => {
    // Mudanças automáticas da leitura não viram preferência (persist: false): fechar o app lendo não deixa a coluna recolhida
    const auto = { persist: false };
    if (tab === 'reader' && activeTab !== 'reader') {
      docksBeforeReaderRef.current = { left: leftPanel.open, right: rightPanel.open, tab: rightTab.tab };
      leftPanel.setOpen(false, auto);
      rightPanel.setOpen(true, auto);
      rightTab.setTab('notebook', auto);
    } else if (tab !== 'reader' && activeTab === 'reader' && docksBeforeReaderRef.current) {
      // A volta grava: se o estudante mexeu nos painéis durante a leitura, a preferência volta a bater com a tela
      const before = docksBeforeReaderRef.current;
      leftPanel.setOpen(before.left);
      rightPanel.setOpen(before.right);
      rightTab.setTab(before.tab);
      docksBeforeReaderRef.current = null;
    }
    setActiveTab(tab);
  };

  const readerNotebookVisible = rightPanel.open && rightTab.tab === 'notebook';
  const toggleReaderNotebook = () => {
    if (readerNotebookVisible) {
      rightPanel.setOpen(false, { persist: false });
      return;
    }
    rightTab.setTab('notebook', { persist: false });
    rightPanel.setOpen(true, { persist: false });
  };

  const openReader = () => {
    selectTab('reader');
  };

  // Roteiro na coluna: voltar ao bloco, iniciar, atalhos de material, faixa da olhada e aviso de recalibrar
  const returnToBlock = () => {
    const item = routine.currentItem;
    if (!item) return;
    setSelectedSubjectId(item.subject.id);
    if (item.topic) setSelectedTopicId(item.topic.id);
  };

  const openQuestionLogFor = (topicId: string) => {
    setLogInvite({ topicId });
    leftPanel.setOpen(true);
  };

  /** Tópico aberto de fora do roteiro (Mapa de Calor, Ciclo, Edital): vira "olhada", o roteiro não muda. */
  const openTopicOnWorkbench = (subjId: string, topId: string | null) => {
    setSelectedSubjectId(subjId);
    if (topId) setSelectedTopicId(topId);
    selectTab('questions');
  };

  /** Matéria aberta pelo Ciclo: vai para o tópico mais urgente dela. */
  const openSubjectOnWorkbench = (subjId: string) => {
    const hottest = cycleData.topicHeatmapRanking.find((h) => h.topic.subject_id === subjId);
    openTopicOnWorkbench(subjId, hottest?.topic.id ?? topicsBySubject[subjId]?.[0]?.id ?? null);
  };

  const startRoutineBlock = (item: RoutineItem) => {
    studyBlock.start({
      subjectId: item.subject.id,
      subjectName: item.subject.name,
      topicId: item.topic?.id ?? null,
      topicCode: item.topic?.code ?? null,
      topicTitle: item.topic?.title ?? null,
      targetMinutes: item.remainingMinutes,
    });
    setSelectedSubjectId(item.subject.id);
    if (item.topic) setSelectedTopicId(item.topic.id);
    // Começou o estudo: o "Início" dá lugar à bancada
    if (activeTab === 'today') selectTab('questions');
  };

  const openRoutineMaterial = (kind: 'pdf' | 'questions' | 'notes') => {
    returnToBlock();
    if (kind === 'pdf') {
      selectTab('reader');
      return;
    }
    if (kind === 'questions') {
      selectTab('questions');
      return;
    }
    rightTab.setTab('notebook');
    rightPanel.setOpen(true);
  };

  const blockIsSelected = routineBlockTopic !== null && currentTopic?.id === routineBlockTopic.id;
  const routinePdfLabel = blockIsSelected && pdfSource ? `PDF p. ${pdfSource.current_page}/${pdfSource.total_pages}` : null;
  const routineMaterials = {
    pdfLabel: routinePdfLabel,
    questionCount: routineQuestionCount,
    hasNotes: allNotebooks.some((n) => n.topic_id === routineBlockTopic?.id && n.content_markdown.trim().length > 0),
  };

  const peekInfo =
    peek.kind !== 'none' && currentTopic && routine.currentItem
      ? {
          kind: peek.kind,
          topicLabel: currentTopic.code ? `${currentTopic.code} ${currentTopic.title}` : currentTopic.title,
          showNudge: peek.showNudge,
          nudgeText: `Seu bloco de ${routine.currentItem.subject.name} está esperando: faltam ${formatDuration(routine.currentItem.remainingMinutes)}`,
        }
      : null;

  // Trecho de foco em andamento no bloco do roteiro (ainda não gravado): a barra da coluna anda ao vivo
  const runningOnRoutineBlock =
    routine.currentItem !== null &&
    studyBlock.state.block?.subjectId === routine.currentItem.subject.id &&
    studyBlock.state.block?.topicId === (routine.currentItem.topic?.id ?? null);
  const routineLiveFocusMs = runningOnRoutineBlock ? focusedSegmentMs(studyBlock.state, studyBlock.now) : 0;
  // FofoDoro (spec 10): dentro do bloco atual quando é ele que roda; senão, num cartão de bloco livre no topo
  const blockActive = studyBlock.state.phase !== 'IDLE' && studyBlock.state.phase !== 'DONE';
  const fofodoroNode = <FofoDoro controller={studyBlock} />;
  // Bloco que roda mas já não é o atual (a meta foi cumprida no meio da pausa): continua sendo do roteiro, não "livre"
  const runningBlock = studyBlock.state.block;
  const runningRoutineItem = runningBlock
    ? [...routine.items, ...(routine.extraItem ? [routine.extraItem] : [])].find(
        (i) => i.subject.id === runningBlock.subjectId && (i.topic?.id ?? null) === runningBlock.topicId
      ) ?? null
    : null;
  const freeBlockTitle = runningRoutineItem ? `Bloco em andamento · ${runningRoutineItem.subject.name}` : undefined;

  /** Relógio do cabeçalho: abre a coluna (se recolhida) e leva até o FofoDoro. */
  const openFofoDoro = () => {
    leftPanel.setOpen(true);
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('[data-fofodoro]');
      target?.scrollIntoView({ block: 'nearest' });
      target?.focus();
    });
  };

  const logTopicOptions = (() => {
    const group = routineGroup(routineBlockTopic, topicsBySubject).members;
    const inviteTopic = logInvite?.topicId ? subjects.flatMap((s) => topicsBySubject[s.id] ?? []).find((t) => t.id === logInvite.topicId) : null;
    const allTopics = subjects.flatMap((subj) => topicsBySubject[subj.id] ?? []);
    // Tópico "pai" é só agrupador: o registro vai sempre num tópico do último nível
    const isLeaf = (t: Topic) => !allTopics.some((other) => other.parent_id === t.id);
    const candidates = [inviteTopic, routineBlockTopic, ...group, currentTopic].filter((t): t is Topic => Boolean(t) && isLeaf(t as Topic));
    return candidates.filter((t, i) => candidates.findIndex((c) => c.id === t.id) === i);
  })();

  const submitQuestionLog = (value: { topicId: string; total: number; correct: number; blank: number }) => {
    const topic = logTopicOptions.find((t) => t.id === value.topicId);
    if (!topic) return;
    const { log } = recordQuestionLog({ subjectId: topic.subject_id, ...value });
    const percent = Math.round((value.correct / value.total) * 100);
    setLastLog({ logId: log.id, label: `Registrado: ${value.correct} de ${value.total} (${percent}%)` });
    setLogInvite(null);
    refreshData(currentSubject?.id, currentTopic?.id);
  };

  const confirmUndoQuestionLog = async () => {
    if (!lastLog) return;
    const ok = await confirm({
      title: 'Desfazer o registro?',
      message: <p>O registro é apagado. Se nada mais mudou no tópico depois dele, o domínio volta ao valor de antes.</p>,
      confirmLabel: 'Desfazer',
    });
    if (!ok) return;
    undoQuestionLog(lastLog.logId);
    setLastLog(null);
    refreshData(currentSubject?.id, currentTopic?.id);
  };

  const recalibration = recalibrationHint(cycleData.allocations, cycleData.topicHeatmapRanking);

  const toggleReaderMaximized = () => {
    if (readerMaximized && document.fullscreenElement) void document.exitFullscreen();
    setReaderMaximized((v) => !v);
  };

  const toggleReaderFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const findName = (kind: DeletableKind, id: string): string => {
    if (kind === 'plan') return plans.find((p) => p.id === id)?.title ?? 'plano';
    if (kind === 'subject') return subjects.find((s) => s.id === id)?.name ?? 'disciplina';
    return currentTopics.find((t) => t.id === id)?.title ?? 'tópico';
  };

  return (
    <FofoOutfitProvider value={{ app: fofo.app, fofodoro: fofo.fofodoro, focus: fofoFocus, resting: fofoResting }}>
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--fofo-ground,#0B0E17)] text-slate-100 transition-colors duration-500">
      <ThematicPerimeter />
      {/* Cabeçalho de ponta a ponta (fora das colunas). Escondido com CSS na leitura ampliada para o Pomodoro continuar contando */}
      {mode === 'student' && (
        <AppHeader
          hidden={readerExpanded}
          mascot={
            <FofoWardrobeButton
              outfit={fofo.app}
              automatic={fofo.automatic}
              fixedOutfit={fofoPrefs.fixedOutfit}
              appointed={fofoPrefs.appointed}
              onChooseOutfit={fofoPrefs.setFixedOutfit}
              onAppointedChange={fofoPrefs.setAppointed}
            />
          }
          planLabel={`[${activePlan.organ || 'Geral'}] ${activePlan.title}`}
          daysUntilExam={cycleData.daysUntilExam}
          examParts={summarizeExamParts(cycleData.allocations, examParts)}
          saveStatus={<SaveStatusIndicator onOpenBackup={() => openCrudModal('backup')} />}
          onRecalibrate={() => openWizard()}
          blockClock={<StudyBlockMini controller={studyBlock} startTarget={currentBlockTarget} onOpen={openFofoDoro} />}
        />
      )}

      <div className="flex min-h-0 flex-1">
      {/* Coluna esquerda: o roteiro de hoje (spec 09); recolhe para um trilho */}
      <SidePanel
        side="left"
        label="Coluna do roteiro"
        open={leftPanel.open}
        width={syllabusWidth.width}
        onOpenChange={(open) => leftPanel.setOpen(open)}
        collapseLabel="Recolher roteiro"
        hidden={readerExpanded}
        rail={<RailButton label="Abrir roteiro" icon={<PanelLeft size={15} />} onClick={() => leftPanel.setOpen(true)} />}
        resize={{
          label: 'Largura do roteiro',
          min: syllabusWidth.min,
          max: syllabusWidth.max,
          onResize: syllabusWidth.setWidth,
          onReset: syllabusWidth.reset,
        }}
      >
        <RoutineColumn
          items={routine.items}
          dayTotalMinutes={routine.dayTotalMinutes}
          weekStudiedMinutes={routine.weekStudiedMinutes}
          weekTargetMinutes={availability.weekBudget}
          extraBlock={routine.extraItem}
          blockRunning={studyBlock.state.phase !== 'IDLE' && studyBlock.state.phase !== 'DONE'}
          group={routineGroup(routineBlockTopic, topicsBySubject)}
          selectedTopicId={currentTopic?.id ?? null}
          liveFocusMs={routineLiveFocusMs}
          todayStudiedMinutes={studyTotals?.todayMinutes ?? 0}
          todayTime={{
            minutes: availability.todayMinutes,
            overridden: availability.todayOverridden,
            onChange: availability.setTodayMinutes,
          }}
          fofodoro={blockActive && runningOnRoutineBlock ? fofodoroNode : null}
          freeBlock={blockActive && !runningOnRoutineBlock ? fofodoroNode : null}
          freeBlockTitle={freeBlockTitle}
          preview={<FofoDoroPreview controller={studyBlock} targetMinutes={routine.currentItem?.remainingMinutes ?? null} />}
          questionLog={{
            topics: logTopicOptions,
            defaultTopicId: logInvite?.topicId ?? routineBlockTopic?.id ?? currentTopic?.id ?? null,
            invite: logInvite !== null,
            lastLogLabel: lastLog?.label ?? null,
            onSubmit: submitQuestionLog,
            onUndo: () => void confirmUndoQuestionLog(),
            onDismissInvite: () => setLogInvite(null),
          }}
          materials={routineMaterials}
          peek={peekInfo}
          hint={recalibration ? describeRecalibrationHint(recalibration) : null}
          onStartBlock={startRoutineBlock}
          onSelectTopic={(subjId, topId) => {
            setSelectedSubjectId(subjId);
            setSelectedTopicId(topId);
          }}
          onReturnToBlock={returnToBlock}
          onOpenMaterial={openRoutineMaterial}
          onOpenCycle={() => selectTab('cycle')}
          onOpenEdital={() => openCrudModal('topics')}
          onRecalibrate={() => openWizard()}
          adminToggle={
            <button
              type="button"
              onClick={() => setMode(mode === 'student' ? 'admin' : 'student')}
              title="Alternar entre Bancada de Estudos e Painel de Trilhas"
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
            >
              {mode === 'admin' ? <GraduationCap size={13} /> : <Wrench size={13} />}
              {mode === 'admin' ? 'Voltar ao estudo' : 'Admin'}
            </button>
          }
        />
      </SidePanel>

      {/* Slot 2: Palco Central */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {mode === 'student' ? (
          <>
            {(
              <>
                <div
                  className={`fofolab-tabs px-6 pt-2.5 border-b border-white/[0.08] items-center gap-1.5 bg-white/[0.01] overflow-x-auto ${
                    readerExpanded ? 'hidden' : 'flex'
                  }`}
                >
                  {(
                    [
                      { id: 'today', label: 'Início', icon: Sun },
                      { id: 'questions', label: 'Questões', icon: HelpCircle },
                      { id: 'cycle', label: 'Plano de estudo', icon: Layers },
                      { id: 'heatmap', label: 'Mapa de Calor', icon: Flame },
                      { id: 'reader', label: 'Leitura de PDF', icon: FileText },
                      { id: 'graph', label: 'Mapa de Conceitos', icon: Network },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={() => selectTab(tab.id)}
                        className={`px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 flex shrink-0 items-center gap-2 whitespace-nowrap transition-colors ${
                          active
                            ? 'border-[var(--fofo-accent)] text-[var(--fofo-accent-text)] bg-white/[0.04]'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.015]'
                        }`}
                      >
                        <Icon size={14} className={active ? 'text-[var(--fofo-accent)]' : undefined} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 flex overflow-hidden min-h-0">
                  <div
                    className={
                      activeTab === 'reader'
                        ? `flex-1 min-w-0 flex flex-col min-h-0 ${readerExpanded ? 'p-2' : 'p-4'}`
                        : 'flex-1 overflow-y-auto p-6 min-w-0'
                    }
                  >
                    {activeTab === 'today' && (
                      <GoodMorningView
                        dbReady={dbReady}
                        plan={activePlan}
                        subjects={subjects}
                        topicsBySubject={topicsBySubject}
                        heat={cycleData?.topicHeatmapRanking ?? []}
                        allocations={cycleData?.allocations ?? []}
                        examParts={examParts}
                        attempts={attempts}
                        questionLogs={questionLogs}
                        recallChecks={recallChecks}
                        weekSessions={sessions}
                        dataVersion={dataVersion}
                        // Com um bloco rodando não há "começar": recomeçaria do zero e o tempo focado se perderia
                        nextBlock={routine.currentItem && !blockActive ? { subjectName: routine.currentItem.subject.name } : null}
                        onStartNextBlock={() => {
                          if (routine.currentItem) startRoutineBlock(routine.currentItem);
                        }}
                        onRecorded={() => refreshData(currentSubject?.id, currentTopic?.id)}
                        onLogOutside={openQuestionLogFor}
                        notebooks={allNotebooks}
                        onOpenPdf={(subjectId, topicId) => {
                          setSelectedSubjectId(subjectId);
                          setSelectedTopicId(topicId);
                          selectTab('reader');
                        }}
                        onOpenNotes={(subjectId, topicId) => {
                          setSelectedSubjectId(subjectId);
                          setSelectedTopicId(topicId);
                          rightTab.setTab('notebook');
                          rightPanel.setOpen(true);
                          selectTab('questions');
                        }}
                      />
                    )}

                    {activeTab === 'questions' && (
                      <QuestionWorkbench
                        questions={topicQuestions}
                        scopeFilter={questionScope}
                        onChangeScopeFilter={setQuestionScope}
                        acervo={acervoActions}
                        loading={questionsView.loading}
                        onAnswer={handleAnswer}
                        onChangeDiagnosis={handleChangeDiagnosis}
                        lastDiagnosisFeedback={lastDiagnosisMsg}
                        onActiveQuestionChange={setActiveQuestion}
                        onAskFofoIa={(request) => {
                          rightTab.setTab('copilot');
                          rightPanel.setOpen(true);
                          setFofoRequest({ id: Date.now(), kind: request.kind });
                        }}
                        onGenerateDissection={handleGenerateDissection}
                        onOpenImport={() => setImportOpen(true)}
                        aiConfigured={aiStatus.configured}
                      />
                    )}

                    {activeTab === 'cycle' && (
                      <StudyPlanView
                        plan={activePlan}
                        cycleData={cycleData}
                        examParts={examParts}
                        days={weekDays}
                        weekBudget={availability.weekBudget}
                        weekStart={availability.weekStart}
                        pattern={availability.pattern}
                        thisWeek={availability.thisWeek}
                        outlook={outlook}
                        subjects={subjects}
                        topicsBySubject={topicsBySubject}
                        onChangePattern={availability.setPattern}
                        onChangeThisWeek={availability.setThisWeek}
                        onApplyRecommendedCycle={() => {
                          const recommended = recommendedForStandardWeek(
                            { plan: activePlan, subjects, topicsBySubject, attempts, sessions, topicLinks, examParts, questionLogs, recallChecks },
                            availability.pattern.reduce((acc, m) => acc + m, 0)
                          );
                          if (recommended) applyRecommendedCycleAllocations(recommended);
                          refreshData(currentSubject?.id, currentTopic?.id);
                        }}
                        onChangeFinalStretch={(days) => {
                          updateStudyPlan({ id: activePlan.id, final_stretch_days: days });
                          refreshData(currentSubject?.id, currentTopic?.id);
                        }}
                        onChangeAllowNewInFinalStretch={(allow) => {
                          updateStudyPlan({ id: activePlan.id, final_stretch_allow_new: allow ? 1 : 0 });
                          refreshData(currentSubject?.id, currentTopic?.id);
                        }}
                        onOpenSubject={openSubjectOnWorkbench}
                      />
                    )}

                    {activeTab === 'heatmap' && (
                      <TopicHeatGrid
                        cycleData={cycleData}
                        examParts={examParts}
                        onJumpToTopic={openTopicOnWorkbench}
                      />
                    )}

                    {activeTab === 'reader' && (
                      <PdfReaderStage
                        currentTopic={currentTopic}
                        pdfSource={pdfSource}
                        pdfFileUrl={visiblePdfUrl}
                        pdfFileName={pdfFile?.name ?? null}
                        onOpenFile={handleOpenPdfFile}
                        onSaveProgress={handleSavePdfProgress}
                        maximized={readerExpanded}
                        onToggleMaximized={toggleReaderMaximized}
                        fullscreen={readerFullscreen}
                        onToggleFullscreen={toggleReaderFullscreen}
                        notebookVisible={readerNotebookVisible}
                        onToggleNotebook={toggleReaderNotebook}
                      />
                    )}

                    {activeTab === 'graph' && (
                      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">
                          Conexões entre Tópicos e Pré-requisitos ({topicLinks.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                          O mapa interativo, com criação de vínculos pela tela, ainda está em construção. Por enquanto,
                          a lista abaixo mostra as conexões que já influenciam o Mapa de Calor.
                        </p>
                        <div className="space-y-2 text-xs text-slate-300">
                          {topicLinks.map((lnk) => (
                            <div key={lnk.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                              <Link2 size={12} aria-hidden="true" className="mr-1.5 inline align-[-2px] text-slate-500" />
                              <strong>{lnk.relation_type}:</strong> {lnk.notes}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}
          </>
        ) : (
          <AdminFactoryView adminData={adminData} />
        )}
      </main>

      {/* Coluna direita: Copiloto e Caderno em abas, sempre montados; recolhe para um trilho */}
      {mode === 'student' && (
        <SidePanel
          side="right"
          label="FofoIA e Caderno"
          open={rightPanel.open}
          width={rightWidth.width}
          onOpenChange={(open) => rightPanel.setOpen(open)}
          collapseLabel="Recolher FofoIA e Caderno"
          hidden={readerExpanded && !rightPanel.open}
          rail={rightDockRail({
            tab: rightTab.tab,
            onOpenTab: (tab) => {
              rightTab.setTab(tab);
              rightPanel.setOpen(true);
            },
          })}
          resize={{
            label: 'Largura do painel direito',
            min: rightWidth.min,
            max: rightWidth.max,
            onResize: rightWidth.setWidth,
            onReset: rightWidth.reset,
          }}
        >
          <RightDock
            tab={rightTab.tab}
            onTabChange={(tab) => rightTab.setTab(tab)}
            copilot={
              fofoInputs ? (
                <FofoIaPanel
                  {...fofoInputs}
                  aiConfigured={aiStatus.configured}
                  request={fofoRequest}
                  onRequestHandled={() => setFofoRequest(null)}
                  warmupEnabled={activePlan.productive_failure_hints !== 0}
                  topicHasQuestions={topicQuestions.some((q) => q.question.topic_id === fofoInputs.topicKey)}
                  onTryQuestions={() => {
                    setQuestionScope('topic');
                    selectTab('questions');
                  }}
                  onWiden={(minWidth) => {
                    if (rightWidth.width < minWidth) rightWidth.setWidth(minWidth);
                  }}
                />
              ) : (
                <p className="p-4 text-xs text-slate-400">Escolha um tópico para conversar com a FofoIA.</p>
              )
            }
            notebook={
              <NotebookDockPanel
                currentSubject={currentSubject}
                currentTopic={currentTopic}
                notebook={notebook.notebook}
                notebookDraft={notebook.draft}
                onChangeNotebookDraft={notebook.setDraft}
                onSaveNotebook={() => {
                  notebook.saveNow();
                }}
                draftStatus={notebook.status}
                allNotebooks={allNotebooks}
                pdfSource={pdfSource}
                onOpenReader={activeTab === 'reader' ? undefined : openReader}
                onJumpToTopic={(subjId, topId) => {
                  setSelectedSubjectId(subjId);
                  setSelectedTopicId(topId);
                }}
                onCloseDock={() => rightPanel.setOpen(false)}
              />
            }
          />
        </SidePanel>
      )}
      </div>

      <OnboardingWizardModal
        isOpen={wizardOpen}
        plans={plans}
        activePlan={activePlan}
        onClose={() => setWizardOpen(false)}
        onComplete={handleOnboardingComplete}
        getPlanContent={getPlanContentForWizard}
        initialStep={wizardInitialStep}
        onImportEdital={() => {
          setWizardOpen(false);
          setEditalImportOpen(true);
        }}
      />

      <EditalImportModal
        isOpen={editalImportOpen}
        weeklyHoursTarget={activePlan.weekly_hours_target}
        onClose={() => setEditalImportOpen(false)}
        onCreatePlan={handleCreatePlanFromEdital}
      />

      <QuestionImportModal
        isOpen={importOpen}
        plan={activePlan}
        subjects={subjects}
        topicsBySubject={topicsBySubject}
        defaultSubjectId={currentSubject?.id ?? null}
        defaultTopicId={currentTopic?.id ?? null}
        onClose={() => setImportOpen(false)}
        onImport={handleImportQuestions}
        acervoPanel={
          <AcervoImportPanel
            planId={activePlan.id}
            ai={linkAi}
            onImported={bumpQuestions}
          />
        }
      />

      <CurriculumManagerModal
        isOpen={crudModalOpen}
        onImportEdital={() => {
          setCrudModalOpen(false);
          setEditalImportOpen(true);
        }}
        onImportQuestions={() => {
          setCrudModalOpen(false);
          setImportOpen(true);
        }}
        initialSection={crudInitialSection}
        plans={plans}
        activePlan={activePlan}
        subjects={subjects}
        selectedSubject={currentSubject}
        topics={currentTopics}
        onClose={() => setCrudModalOpen(false)}
        onSelectPlan={handleSelectPlan}
        onOpenTopic={(subjId, topId) => {
          setCrudModalOpen(false);
          openTopicOnWorkbench(subjId, topId);
        }}
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
          void confirmAndDelete('plan', id, findName('plan', id)).then((done) => done && refreshData('', ''));
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
          void confirmAndDelete('subject', id, findName('subject', id)).then((done) => done && refreshData('', ''));
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
          void confirmAndDelete('topic', id, findName('topic', id)).then(
            (done) => done && refreshData(currentSubject?.id, '')
          );
        }}
        onImportTopics={handleImportTopics}
        onExportDatabase={handleExportDatabase}
        onRestoreFromFile={handleRestoreFromFile}
        onLoadBackups={listDatabaseBackups}
        onRestoreBackup={handleRestoreBackup}
        onResetSeed={handleResetSeed}
      />

      {confirmDialog}
      {acervoSyncNotice && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-40 rounded-xl border border-emerald-500/30 bg-slate-900/95 px-3.5 py-2 text-xs text-emerald-200 shadow-lg"
        >
          {acervoSyncNotice}
        </div>
      )}
      <Toast
        message={studyBlock.message}
        messageId={studyBlock.messageId}
        onClose={studyBlock.dismissMessage}
        pose={studyBlock.state.phase === 'BREAK' ? 'dormindo' : undefined}
      />
    </div>
    </FofoOutfitProvider>
  );
}
