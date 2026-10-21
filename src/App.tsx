import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  FileText,
  HelpCircle,
  Layers,
  Network,
  PanelLeft,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useConfirmDialog } from './components/ConfirmDialog';
import { CurriculumManagerModal, type CurriculumSection } from './components/CurriculumManagerModal';
import { CycleDashboard } from './components/CycleDashboard';
import { PomodoroWidget, type PomodoroSessionResult } from './components/PomodoroWidget';
import { QuestionWorkbench, type DiagnosisSubmission } from './components/QuestionWorkbench';
import { ResizeHandle, useResizableWidth } from './components/ResizeHandle';
import { SaveStatusIndicator } from './components/SaveStatusIndicator';
import { AdminFactoryView } from './features/admin-factory/AdminFactoryView';
import { AiCopilotDockPanel } from './features/ai-copilot/AiCopilotDockPanel';
import { DailyFocusView } from './features/daily-focus/DailyFocusView';
import { NotebookDockPanel } from './features/notebook-dock/NotebookDockPanel';
import { estimatePdfPageCount, PdfReaderStage, type PdfProgressUpdate } from './features/notebook-dock/PdfReader';
import { useNotebookDraft } from './features/notebook-dock/useNotebookDraft';
import {
  ONBOARDING_COMPLETED_KEY,
  OnboardingWizardModal,
  type OnboardingProfile,
} from './features/onboarding-wizard/OnboardingWizardModal';
import { QuestionImportModal } from './features/question-import/QuestionImportModal';
import { SyllabusTreeDock } from './features/syllabus-dock/SyllabusTreeDock';
import { generateQuestionDissection, getAiStatus, type StudentContextSnapshot } from './lib/aiRouter';
import { calculateDynamicStudyCycle, startOfWeek } from './lib/cycleEngine';
import {
  applyRecommendedCycleAllocations,
  countDependents,
  createSafetyBackup,
  createStudyPlan,
  createSubject,
  createTopic,
  deleteStudyPlan,
  deleteSubject,
  deleteTopic,
  exportDatabaseBinary,
  getAdminCatalogAndBlueprints,
  getNotebooksByPlan,
  getPdfSourceForTopic,
  getQuestionsForTopicOrSubject,
  getRecentAttempts,
  getStudyPlans,
  getStudySessionsSince,
  getSubjectsByPlan,
  getTopicLinks,
  getTopicsBySubject,
  importQuestions,
  importSyllabusTopics,
  initDatabase,
  listDatabaseBackups,
  recordQuestionDiagnosis,
  recordStudySession,
  resetDatabaseToSeed,
  restoreDatabaseBackup,
  restoreDatabaseFromBytes,
  saveAiDissection,
  savePdfSourceProgress,
  saveQuestionChatHistory,
  setActiveStudyPlan,
  updateStudyPlan,
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
  ImportQuestionItem,
  ImportTopicItem,
  Notebook,
  PdfSource,
  Question,
  QuestionAttempt,
  StudyPlan,
  StudySession,
  Subject,
  Topic,
  TopicLink,
} from './types/database';

type WorkbenchTab = 'questions' | 'cycle' | 'graph' | 'reader';
type AppMode = 'student' | 'admin';
type ExperienceMode = 'daily' | 'pro';
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
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('daily');
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('questions');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Painéis laterais: abrir/fechar + largura ajustável (arrastando a divisória)
  const [showSyllabusDock, setShowSyllabusDock] = useState(true);
  const [showNotebookDock, setShowNotebookDock] = useState(false);
  const [showAiCopilotDock, setShowAiCopilotDock] = useState(true);
  const syllabusWidth = useResizableWidth('fofolab_layout_syllabus_v1', 320, 240, 520);
  const notebookWidth = useResizableWidth('fofolab_layout_notebook_v1', 384, 300, 960);
  const copilotWidth = useResizableWidth('fofolab_layout_copilot_v1', 384, 300, 640);

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

  // Entidades do tópico atual
  const [questionScope, setQuestionScope] = useState<'topic' | 'subject' | 'all'>('topic');
  const [topicQuestions, setTopicQuestions] = useState<{ question: Question; dissection: AiDissection | null }[]>([]);
  const [lastDiagnosisMsg, setLastDiagnosisMsg] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<PdfSource | null>(null);
  const [pdfFile, setPdfFile] = useState<{ url: string; name: string; sourceId: string } | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const docksBeforeReaderRef = useRef<{ syllabus: boolean; copilot: boolean } | null>(null);
  const [pomodoroPreset, setPomodoroPreset] = useState<{ minutes: number; nonce: number } | null>(null);

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

  // Questões do tópico (recarrega ao trocar tópico, filtro ou após importar/gerar explicação)
  useEffect(() => {
    if (!dbReady || !selectedSubjectId) return;
    setTopicQuestions(getQuestionsForTopicOrSubject(selectedTopicId, selectedSubjectId, questionScope));
    setLastDiagnosisMsg(null);
  }, [dbReady, selectedSubjectId, selectedTopicId, questionScope, questionsVersion, dataVersion]);

  // PDF do tópico (não depende do filtro de questões)
  useEffect(() => {
    if (!dbReady || !selectedSubjectId) return;
    setPdfSource(getPdfSourceForTopic(selectedSubjectId, selectedTopicId));
  }, [dbReady, selectedSubjectId, selectedTopicId, dataVersion]);

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
      .filter((h) => h.topic.mastery_score >= 70)
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

  if (initError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200 p-6">
        <div className="max-w-md space-y-2 text-sm text-center">
          <div className="text-2xl">🐹</div>
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
          <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center animate-pulse">
            🐹
          </div>
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
    setDataVersion((v) => v + 1);
    refreshData('', '');
  };

  const handleSelectPlan = (planId: string) => {
    setActiveStudyPlan(planId);
    const nextSubjects = getSubjectsByPlan(planId);
    const firstSubj = nextSubjects[0]?.id || '';
    const firstTopic = firstSubj ? getTopicsBySubject(firstSubj)[0]?.id || '' : '';
    refreshData(firstSubj, firstTopic);
  };

  const handleDiagnosis = (submission: DiagnosisSubmission) => {
    const { question } = submission;
    const targetTopicId = question.topic_id || currentTopic?.id;
    if (!targetTopicId) return;

    try {
      const { updatedTopic, deltaMastery, sampleConfidencePercent } = recordQuestionDiagnosis({
        questionId: question.id,
        topicId: targetTopicId,
        selectedOption: submission.selectedOptionLetter,
        isCorrect: submission.isCorrect,
        selfDiagnosis: submission.diagnosis,
        timeSpentSeconds: submission.timeSpentSeconds,
        usedAiReview: submission.usedAiReview,
      });
      const sign = deltaMastery > 0 ? `+${deltaMastery}%` : `${deltaMastery}%`;
      setLastDiagnosisMsg(
        `${submission.label} registrado! Domínio: ${updatedTopic?.mastery_score ?? 0}% (${sign}) • Confiança da Amostra: ${sampleConfidencePercent}%`
      );
      refreshData(currentSubject?.id, currentTopic?.id);
    } catch (err) {
      setLastDiagnosisMsg(err instanceof Error ? err.message : 'Não foi possível registrar o diagnóstico.');
    }
  };

  const handleAppendNotesToNotebook = (markdownToAppend: string) => {
    notebook.appendAndSave(markdownToAppend);
  };

  const handleGenerateDissection = async (question: Question) => {
    const result = await generateQuestionDissection(question);
    if (result.status === 'ok') {
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

  const handleOpenPdfFile = async (file: File) => {
    if (!currentSubject || !currentTopic) return;
    const sameFile = pdfSource?.file_path === file.name;
    const estimatedPages = sameFile ? null : await estimatePdfPageCount(file);
    const saved = savePdfSourceProgress({
      pdfSourceId: sameFile ? pdfSource?.id : null,
      subjectId: currentSubject.id,
      topicId: currentTopic.id,
      title: file.name,
      filePath: file.name,
      currentPage: sameFile && pdfSource ? pdfSource.current_page : 1,
      totalPages: sameFile && pdfSource ? pdfSource.total_pages : (estimatedPages ?? 1),
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
  const handleOnboardingComplete = (profile: OnboardingProfile, targetPlanId: string) => {
    const updatedPlan = updateStudyPlan({
      id: targetPlanId,
      weekly_hours_target: profile.weeklyHours,
      strategy_mode: profile.strategyMode,
      study_moment: profile.studyMoment,
    });
    if (updatedPlan) {
      const planSubjects = getSubjectsByPlan(targetPlanId);
      const planTopics: Record<string, Topic[]> = {};
      for (const s of planSubjects) planTopics[s.id] = getTopicsBySubject(s.id);
      const recommended = calculateDynamicStudyCycle({
        plan: updatedPlan,
        subjects: planSubjects,
        topicsBySubject: planTopics,
        attempts: getRecentAttempts(500),
        sessions: getStudySessionsSince(startOfWeek(new Date()).toISOString()),
        topicLinks: getTopicLinks(),
      });
      applyRecommendedCycleAllocations(
        recommended.allocations.map((a) => ({ subjectId: a.subject.id, minutes: a.recommendedWeeklyMinutes }))
      );
    }
    if (targetPlanId === activePlan.id) {
      refreshData(currentSubject?.id, currentTopic?.id);
    } else {
      handleSelectPlan(targetPlanId);
    }
    setExperienceMode('daily');
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

  const handlePomodoroComplete = (result: PomodoroSessionResult) => {
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

  /**
   * Leitura em tela grande: o PDF precisa de espaço, então a árvore de tópicos e o copiloto se
   * recolhem ao entrar (o caderno fica ao lado) e voltam como estavam ao sair da aba.
   */
  const selectTab = (tab: WorkbenchTab) => {
    if (tab === 'reader' && activeTab !== 'reader') {
      docksBeforeReaderRef.current = { syllabus: showSyllabusDock, copilot: showAiCopilotDock };
      setShowSyllabusDock(false);
      setShowAiCopilotDock(false);
      setShowNotebookDock(true);
    } else if (tab !== 'reader' && activeTab === 'reader' && docksBeforeReaderRef.current) {
      setShowSyllabusDock(docksBeforeReaderRef.current.syllabus);
      setShowAiCopilotDock(docksBeforeReaderRef.current.copilot);
      docksBeforeReaderRef.current = null;
    }
    setActiveTab(tab);
  };

  const openReader = () => {
    setExperienceMode('pro');
    selectTab('reader');
  };

  const dockToggleClass = (active: boolean) =>
    `px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
      active
        ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
    }`;

  const findName = (kind: DeletableKind, id: string): string => {
    if (kind === 'plan') return plans.find((p) => p.id === id)?.title ?? 'plano';
    if (kind === 'subject') return subjects.find((s) => s.id === id)?.name ?? 'disciplina';
    return currentTopics.find((t) => t.id === id)?.title ?? 'tópico';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Slot 1: Dock Esquerdo (Árvore de Tópicos e Edital) — Apenas no Modo Pro */}
      {experienceMode === 'pro' && showSyllabusDock && (
        <>
          <SyllabusTreeDock
            width={syllabusWidth.width}
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
            onOpenCrudModal={openCrudModal}
          />
          <ResizeHandle
            label="Largura da lista de tópicos"
            direction="grow-right"
            width={syllabusWidth.width}
            min={syllabusWidth.min}
            max={syllabusWidth.max}
            onResize={syllabusWidth.setWidth}
            onReset={syllabusWidth.reset}
          />
        </>
      )}

      {/* Slot 2: Palco Central */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {mode === 'student' ? (
          <>
            <header className="border-b border-slate-800 bg-slate-900/40 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setExperienceMode('daily')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      experienceMode === 'daily' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar size={13} />
                    <span>Meu Dia de Hoje</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExperienceMode('pro')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      experienceMode === 'pro' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Bancada Pro</span>
                  </button>
                </div>

                <div className="hidden sm:block text-xs text-slate-400 truncate">
                  🎯 Concurso: <strong className="text-slate-200">[{activePlan.organ || 'Geral'}] {activePlan.title}</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <SaveStatusIndicator onOpenBackup={() => openCrudModal('backup')} />

                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 transition"
                  title="Recalibrar momento, horas ou estratégia"
                >
                  <Compass size={13} className="text-orange-400" />
                  <span className="hidden md:inline">Recalibrar Perfil</span>
                </button>

                {experienceMode === 'pro' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSyllabusDock((v) => !v)}
                      className={dockToggleClass(showSyllabusDock)}
                      title="Expandir ou recolher lista de tópicos"
                    >
                      <PanelLeft size={13} />
                      Tópicos
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNotebookDock((v) => !v)}
                      className={dockToggleClass(showNotebookDock)}
                      title="Expandir ou recolher Caderno Lateral e PDF"
                    >
                      <BookOpen size={13} />
                      Caderno & PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAiCopilotDock((v) => !v)}
                      className={dockToggleClass(showAiCopilotDock)}
                      title="Expandir ou recolher Copiloto IA Contextual"
                    >
                      <Sparkles size={13} />
                      Copiloto IA
                    </button>
                    <button
                      type="button"
                      onClick={() => openCrudModal('topics')}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5"
                    >
                      <Settings2 size={13} className="text-orange-400" />
                      Edital Verticalizado
                    </button>
                  </>
                )}

                {currentSubject && (
                  <PomodoroWidget
                    subjectId={currentSubject.id}
                    subjectName={currentSubject.name}
                    topicId={currentTopic?.id || null}
                    topicCode={currentTopic?.code || null}
                    presetRequest={pomodoroPreset}
                    onSessionComplete={handlePomodoroComplete}
                  />
                )}
              </div>
            </header>

            {experienceMode === 'daily' && (
              <DailyFocusView
                plan={activePlan}
                cycleData={cycleData}
                subjects={subjects}
                topicsBySubject={topicsBySubject}
                onStartBlock={(subjId, topId, durationMinutes) => {
                  setSelectedSubjectId(subjId);
                  if (topId) setSelectedTopicId(topId);
                  setExperienceMode('pro');
                  selectTab('questions');
                  setPomodoroPreset({ minutes: durationMinutes, nonce: Date.now() });
                }}
                onSwitchToProWorkbench={() => setExperienceMode('pro')}
                onOpenWizard={() => setWizardOpen(true)}
              />
            )}

            {experienceMode === 'pro' && (
              <>
                <div className="px-6 pt-2.5 border-b border-slate-800 flex items-center gap-2 bg-slate-900/20">
                  {(
                    [
                      { id: 'questions', label: 'Questões & Estudo Reverso', icon: HelpCircle },
                      { id: 'cycle', label: 'Ciclo & Mapa de Calor', icon: Layers },
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

                <div className="flex-1 flex overflow-hidden min-h-0">
                  <div
                    className={
                      activeTab === 'reader'
                        ? 'flex-1 p-4 min-w-0 flex flex-col min-h-0'
                        : 'flex-1 overflow-y-auto p-6 min-w-0'
                    }
                  >
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
                        onGenerateDissection={handleGenerateDissection}
                        onOpenImport={() => setImportOpen(true)}
                        aiConfigured={aiStatus.configured}
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
                          selectTab('questions');
                        }}
                      />
                    )}

                    {activeTab === 'reader' && (
                      <PdfReaderStage
                        currentTopic={currentTopic}
                        pdfSource={pdfSource}
                        pdfFileUrl={visiblePdfUrl}
                        pdfFileName={pdfFile?.name ?? null}
                        onOpenFile={(file) => void handleOpenPdfFile(file)}
                        onSaveProgress={handleSavePdfProgress}
                      />
                    )}

                    {activeTab === 'graph' && (
                      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                        <h3 className="text-sm font-bold text-white">
                          🕸️ Conexões entre Tópicos e Pré-requisitos ({topicLinks.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                          O mapa interativo, com criação de vínculos pela tela, ainda está em construção. Por enquanto,
                          a lista abaixo mostra as conexões que já influenciam o Mapa de Calor.
                        </p>
                        <div className="space-y-2 text-xs text-slate-300">
                          {topicLinks.map((lnk) => (
                            <div key={lnk.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                              🔗 <strong>{lnk.relation_type}:</strong> {lnk.notes}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Slot 3: Dock Lateral de Caderno, Busca e Leitor PDF */}
                  {showNotebookDock && (
                    <>
                      <ResizeHandle
                        label="Largura do caderno e PDF"
                        direction="grow-left"
                        width={notebookWidth.width}
                        min={notebookWidth.min}
                        max={notebookWidth.max}
                        onResize={notebookWidth.setWidth}
                        onReset={notebookWidth.reset}
                      />
                      <NotebookDockPanel
                        width={notebookWidth.width}
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
                        pdfFileUrl={visiblePdfUrl}
                        onOpenPdfFile={(file) => void handleOpenPdfFile(file)}
                        onSavePdfProgress={handleSavePdfProgress}
                        onOpenReader={activeTab === 'reader' ? undefined : openReader}
                        onJumpToTopic={(subjId, topId) => {
                          setSelectedSubjectId(subjId);
                          setSelectedTopicId(topId);
                        }}
                        onCloseDock={() => setShowNotebookDock(false)}
                      />
                    </>
                  )}

                  {/* Slot 4: Dock Lateral do Copiloto IA Contextual */}
                  {showAiCopilotDock && studentContext && (
                    <>
                      <ResizeHandle
                        label="Largura do copiloto"
                        direction="grow-left"
                        width={copilotWidth.width}
                        min={copilotWidth.min}
                        max={copilotWidth.max}
                        onResize={copilotWidth.setWidth}
                        onReset={copilotWidth.reset}
                      />
                      <AiCopilotDockPanel
                        width={copilotWidth.width}
                        context={studentContext}
                        activeQuestion={topicQuestions[0]?.question || null}
                        notebookExcerpt={notebook.draft}
                        onSaveToNotebook={handleAppendNotesToNotebook}
                        onCloseDock={() => setShowAiCopilotDock(false)}
                        aiConfigured={aiStatus.configured}
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <AdminFactoryView adminData={adminData} />
        )}
      </main>

      <OnboardingWizardModal
        isOpen={wizardOpen}
        plans={plans}
        activePlan={activePlan}
        onClose={() => setWizardOpen(false)}
        onComplete={handleOnboardingComplete}
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
      />

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
    </div>
  );
}
