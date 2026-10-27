import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupPanel } from '../components/BackupPanel';
import { QuestionWorkbench } from '../features/questions/QuestionWorkbench';
import { FofoIaPanel } from '../features/fofoia/FofoIaPanel';
import { CycleView } from '../features/cycle/CycleView';
import { WeekdayHoursEditor } from '../features/study-plan/WeekdayHoursEditor';
import { TopicHeatGrid } from '../features/heatmap/TopicHeatGrid';
import { FofoDoro } from '../features/fofodoro/FofoDoro';
import { FofoDoroPreview } from '../features/fofodoro/FofoDoroPreview';
import { StudyBlockMini } from '../features/study-block/StudyBlockMini';
import { useStudyBlock } from '../features/study-block/useStudyBlock';
import { NotebookDockPanel } from '../features/notebook-dock/NotebookDockPanel';
import { PdfReaderStage } from '../features/pdf-reader/PdfReaderStage';
import { QuestionImportModal } from '../features/question-import/QuestionImportModal';
import {
  SEED_AI_DISSECTIONS,
  SEED_NOTEBOOKS,
  SEED_PDF_SOURCES,
  SEED_QUESTIONS,
  SEED_STUDY_PLANS,
  SEED_SUBJECTS,
  SEED_TOPIC_LINKS,
  SEED_TOPICS,
} from '../data/initialSeed';
import {
  getQuestionComplexityProfile,
  type StudentContextSnapshot,
} from '../lib/aiRouter';
import { calculateDynamicStudyCycle } from '../lib/cycleEngine';
import type { Question, Topic } from '../types/database';

const FORBIDDEN_JARGON = [
  'SQLite',
  '0 tokens',
  '_score',
  'Elasticsearch',
  'Anti-Alucinação',
  'Restaurar Seed',
  'IndexedDB',
  'localStorage',
  'Cache',
];

/** FofoDoro antes do play (prévia) e depois (relógio), para a auditoria de jargão. */
function FofoDoroHarness() {
  const controller = useStudyBlock();
  return (
    <>
      <FofoDoroPreview controller={controller} targetMinutes={60} />
      <FofoDoro controller={controller} />
    </>
  );
}

describe('Bancada de Questões, Copiloto IA Contextual, Docks & Auditoria de UI Limpa', () => {
  const sampleBundles = SEED_QUESTIONS.map((q) => ({
    question: q,
    dissection: SEED_AI_DISSECTIONS.find((d) => d.question_id === q.id) || null,
  }));

  const sampleContext: StudentContextSnapshot = {
    planTitle: 'CGU — Auditor Federal de Finanças e Controle',
    organ: 'CGU',
    examBoard: 'FGV',
    roleTitle: 'Auditor Federal de Finanças e Controle',
    daysUntilExam: 90,
    weeklyHoursTarget: 31.5,
    currentSubjectName: 'Contabilidade Pública (CASP)',
    currentSubjectWeight: 2,
    currentSubjectMastery: 45,
    currentSubjectCoverage: 50,
    currentTopicCode: '3.1',
    currentTopicTitle: 'PCASP: Natureza da Informação (Orçamentária, Patrimonial e Controle)',
    currentTopicMastery: 35,
    currentTopicConfidence: 26,
    strongTopics: ['1.1 Normas Internacionais de Auditoria (ISSAI 100 e 200)'],
    priorityWeakTopics: ['3.1 PCASP: Natureza da Informação'],
    relatedPrerequisites: ['1.1 Normas Internacionais de Auditoria'],
  };

  // Sem chave configurada = modo demonstração (independe do .env de quem roda os testes)
  beforeEach(() => {
    vi.stubEnv('VITE_FOFOLAB_AI_GATEWAY_URL', '');
    vi.stubEnv('VITE_GROQ_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_DEEPSEEK_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calcula o perfil de complexidade multidimensional da questão', () => {
    const profile = getQuestionComplexityProfile(sampleBundles[0].question, sampleBundles[0].dissection);
    expect(profile.stars).toBeGreaterThanOrEqual(1);
    expect(profile.stars).toBeLessThanOrEqual(5);
    expect(['Fácil', 'Média', 'Difícil']).toContain(profile.levelLabel);
    expect(profile.statementLength).toBe(sampleBundles[0].question.statement.length);
  });

  it('AUDITORIA DE UX: interface, docks, backup, importação e leitor sem jargão técnico interno', () => {
    const cguPlan = SEED_STUDY_PLANS[0];
    const cguSubjects = SEED_SUBJECTS.filter((s) => s.plan_id === cguPlan.id);
    const topicsBySubject: Record<string, Topic[]> = {};
    for (const s of cguSubjects) {
      topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
    }

    const cycleData = calculateDynamicStudyCycle({
      plan: cguPlan,
      subjects: cguSubjects,
      topicsBySubject,
      attempts: [],
      sessions: [],
      topicLinks: SEED_TOPIC_LINKS,
    });

    const containers = [
      render(
        <QuestionWorkbench
          questions={sampleBundles}
          scopeFilter="all"
          onChangeScopeFilter={vi.fn()}
          onAnswer={vi.fn(() => null)}
          onChangeDiagnosis={vi.fn()}
          lastDiagnosisFeedback={null}
          onAskFofoIa={vi.fn()}
          onOpenImport={vi.fn()}
        />
      ).container,
      render(
        <CycleView
          plan={cguPlan}
          cycleData={cycleData}
          examParts={[]}
          onApplyRecommendedCycle={vi.fn()}
        />
      ).container,
      render(<WeekdayHoursEditor value={[150, 150, 150, 150, 150, 300, 0]} onChange={vi.fn()} />).container,
      render(<FofoDoroHarness />).container,
      render(<TopicHeatGrid cycleData={cycleData} examParts={[]} onJumpToTopic={vi.fn()} />).container,
      render(
        <NotebookDockPanel
          currentSubject={cguSubjects[0]}
          currentTopic={SEED_TOPICS[0]}
          notebook={SEED_NOTEBOOKS[0]}
          notebookDraft={SEED_NOTEBOOKS[0].content_markdown}
          onChangeNotebookDraft={vi.fn()}
          onSaveNotebook={vi.fn()}
          allNotebooks={SEED_NOTEBOOKS}
          pdfSource={SEED_PDF_SOURCES[0]}
          onOpenReader={vi.fn()}
          onJumpToTopic={vi.fn()}
        />
      ).container,
      render(
        <FofoIaPanel
          context={sampleContext}
          topicKey="t"
          topicLabel="3.1 PCASP"
          notebook={null}
          activeQuestion={null}
          prerequisites={[]}
          editalTopics={[]}
          firstContact={false}
          aiConfigured={false}
          request={null}
          onWiden={vi.fn()}
          onSaveSummary={vi.fn()}
          warmupEnabled
          topicHasQuestions={false}
          onTryQuestions={vi.fn()}
          onRequestHandled={vi.fn()}
        />
      ).container,
      render(
        <BackupPanel
          onExportDatabase={vi.fn()}
          onRestoreFromFile={vi.fn(async () => true)}
          onLoadBackups={vi.fn(async () => [])}
          onRestoreBackup={vi.fn(async () => true)}
          onResetSeed={vi.fn(async () => true)}
        />
      ).container,
      render(
        <QuestionImportModal
          isOpen
          plan={cguPlan}
          subjects={cguSubjects}
          topicsBySubject={topicsBySubject}
          defaultSubjectId={cguSubjects[0].id}
          defaultTopicId={null}
          onClose={vi.fn()}
          onImport={vi.fn(() => ({ inserted: 0, skippedDuplicates: 0 }))}
        />
      ).container,
      render(
        <PdfReaderStage
          currentTopic={SEED_TOPICS[0]}
          pdfSource={SEED_PDF_SOURCES[0]}
          pdfFileUrl={null}
          pdfFileName={null}
          onOpenFile={vi.fn()}
          onSaveProgress={vi.fn()}
        />
      ).container,
    ];

    const combinedText = containers.map((c) => c.textContent || '').join(' ');
    for (const term of FORBIDDEN_JARGON) {
      expect(combinedText).not.toContain(term);
    }
  });

});

describe('relógio do cabeçalho', () => {
  function MiniHarness({ onOpen }: { onOpen: () => void }) {
    const controller = useStudyBlock();
    return (
      <StudyBlockMini
        controller={controller}
        startTarget={{ subjectId: 's', subjectName: 'Matéria', topicId: null, topicCode: null, topicTitle: null, targetMinutes: 60 }}
        onOpen={onOpen}
      />
    );
  }

  it('com bloco rodando, clicar no relógio leva ao Ciclo e há uma barrinha de progresso', () => {
    const onOpen = vi.fn();
    render(<MiniHarness onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar bloco de estudo' }));
    expect(screen.getByRole('progressbar', { name: 'Progresso do pomodoro' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver o bloco na coluna Hoje' }));
    expect(onOpen).toHaveBeenCalled();
  });
});
