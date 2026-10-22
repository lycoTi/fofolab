import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupPanel } from '../components/BackupPanel';
import { QuestionWorkbench } from '../components/QuestionWorkbench';
import { AiCopilotDockPanel } from '../features/ai-copilot/AiCopilotDockPanel';
import { CycleView } from '../features/cycle/CycleView';
import { TopicHeatGrid } from '../features/heatmap/TopicHeatGrid';
import { StudyBlockCard } from '../features/study-block/StudyBlockCard';
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
  askContextualStudyCopilot,
  askReverseStudyTutor,
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

function BlockCardHarness() {
  const controller = useStudyBlock();
  return (
    <StudyBlockCard
      controller={controller}
      startTarget={{ subjectId: 's', subjectName: 'Matéria', topicId: null, topicCode: null, topicTitle: null, targetMinutes: 60 }}
    />
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

  const renderWorkbench = (overrides: Partial<Parameters<typeof QuestionWorkbench>[0]> = {}) => {
    const onDiagnosis = vi.fn();
    render(
      <QuestionWorkbench
        questions={sampleBundles}
        scopeFilter="all"
        onChangeScopeFilter={vi.fn()}
        onDiagnosis={onDiagnosis}
        lastDiagnosisFeedback={null}
        onSaveToNotebook={vi.fn()}
        studentContext={sampleContext}
        {...overrides}
      />
    );
    return { onDiagnosis };
  };

  const diagnosisButton = (label: RegExp) => screen.getByText(label).closest('button') as HTMLButtonElement;

  it('calcula o perfil de complexidade multidimensional da questão', () => {
    const profile = getQuestionComplexityProfile(sampleBundles[0].question, sampleBundles[0].dissection);
    expect(profile.stars).toBeGreaterThanOrEqual(1);
    expect(profile.stars).toBeLessThanOrEqual(5);
    expect(['Direta', 'Intermediária', 'Densa / Estudo de Caso']).toContain(profile.levelLabel);
    expect(profile.statementLength).toBe(sampleBundles[0].question.statement.length);
  });

  it('sem IA configurada, tutor e copiloto respondem com exemplos MARCADOS como simulação', async () => {
    const tutor = await askReverseStudyTutor({
      question: sampleBundles[0].question,
      dissection: sampleBundles[0].dissection,
      promptText: 'Por que as outras alternativas estão erradas?',
      context: sampleContext,
    });
    expect(tutor.simulated).toBe(true);
    expect(tutor.provider).toBe('OFFLINE_DEMO');
    expect(tutor.reply).toContain('Análise das Alternativas');
    expect(tutor.reply).toContain(sampleBundles[0].question.final_answer);
    expect(tutor.reply).toContain('ISSAI 100');

    const copilot = await askContextualStudyCopilot({
      context: sampleContext,
      promptText: 'Relacione este tópico com o que já domino',
    });
    expect(copilot.simulated).toBe(true);
    expect(copilot.reply).toContain('CGU');
    expect(copilot.reply).toContain('FGV');
    expect(copilot.reply).toContain('ISSAI 100');
  });

  it('esconde a explicação até responder (contra descarga cognitiva) e só libera diagnóstico coerente', () => {
    const { onDiagnosis } = renderWorkbench();

    fireEvent.change(screen.getByLabelText('Filtrar por banca'), { target: { value: 'Cebraspe' } });
    expect(screen.getAllByText(/Cebraspe/i).length).toBeGreaterThanOrEqual(2);

    // Antes de responder: nenhum diagnóstico disponível e explicação protegida
    for (const label of [/Dominei/, /Acertei na dúvida/, /Pegadinha da Banca/, /1º Contato \/ Lacuna/]) {
      expect(diagnosisButton(label).disabled).toBe(true);
    }

    // 1º contato: abre a explicação e só permite "Lacuna"
    fireEvent.click(screen.getByText(/Ver Explicação Base Antes de Responder/i));
    expect(diagnosisButton(/Dominei/).disabled).toBe(true);
    expect(diagnosisButton(/1º Contato \/ Lacuna/).disabled).toBe(false);

    fireEvent.click(diagnosisButton(/1º Contato \/ Lacuna/));
    fireEvent.click(diagnosisButton(/1º Contato \/ Lacuna/));
    expect(onDiagnosis).toHaveBeenCalledTimes(1);
    expect(onDiagnosis.mock.calls[0][0]).toMatchObject({
      diagnosis: 'BASE_GAP',
      selectedOptionLetter: null,
      isCorrect: false,
      usedAiReview: true,
    });
  });

  it('a 1ª resposta vale (não dá para trocar depois de ver o gabarito) e o diagnóstico acompanha o erro', () => {
    const { onDiagnosis } = renderWorkbench({ questions: [sampleBundles[0]] }); // gabarito C

    fireEvent.click(screen.getByText(/^A\) Risco de Controle/));
    fireEvent.click(screen.getByText(/^C\) Risco Inerente, Risco de Controle/)); // tentativa de "corrigir"

    expect(screen.getByText(/^A\) Risco de Controle/).closest('button')?.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/^C\) Risco Inerente, Risco de Controle/).closest('button')?.getAttribute('aria-pressed')).toBe('false');
    expect(diagnosisButton(/Dominei/).disabled).toBe(true);
    expect(diagnosisButton(/Acertei na dúvida/).disabled).toBe(true);
    expect(diagnosisButton(/Pegadinha da Banca/).disabled).toBe(false);

    fireEvent.click(diagnosisButton(/Pegadinha da Banca/));
    expect(onDiagnosis).toHaveBeenCalledTimes(1);
    expect(onDiagnosis.mock.calls[0][0]).toMatchObject({
      diagnosis: 'BOARD_TRAP',
      selectedOptionLetter: 'A',
      isCorrect: false,
      usedAiReview: false,
    });
    expect(onDiagnosis.mock.calls[0][0].timeSpentSeconds).toBeGreaterThanOrEqual(0);
  });

  it('itens Certo/Errado usam a letra real (C/E) para conferir o gabarito', () => {
    const certoErrado: Question = {
      ...SEED_QUESTIONS[2],
      id: 'q-ce-1',
      statement: 'O DICT é operado diretamente pelo Banco Central do Brasil.',
      options_json: JSON.stringify(['C) Certo', 'E) Errado']),
      final_answer: 'C',
    };
    renderWorkbench({ questions: [{ question: certoErrado, dissection: null }] });

    fireEvent.click(screen.getByText('C) Certo'));
    expect(screen.getByText(/Você acertou!/)).toBeTruthy();
    expect(diagnosisButton(/Dominei/).disabled).toBe(false);
  });

  it('questão sem explicação: sem IA mostra aviso honesto; com IA oferece gerar', () => {
    const semExplicacao = { question: SEED_QUESTIONS[0], dissection: null };
    const { unmount } = render(
      <QuestionWorkbench
        questions={[semExplicacao]}
        scopeFilter="all"
        onChangeScopeFilter={vi.fn()}
        onDiagnosis={vi.fn()}
        lastDiagnosisFeedback={null}
        onSaveToNotebook={vi.fn()}
        aiConfigured={false}
        onGenerateDissection={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText(/Ver Explicação Base Antes de Responder/i));
    expect(screen.getByText(/ainda não tem explicação/)).toBeTruthy();
    expect(screen.queryByText('Gerar explicação com IA')).toBeNull();
    unmount();

    const onGenerate = vi.fn(async () => ({ ok: true }));
    render(
      <QuestionWorkbench
        questions={[semExplicacao]}
        scopeFilter="all"
        onChangeScopeFilter={vi.fn()}
        onDiagnosis={vi.fn()}
        lastDiagnosisFeedback={null}
        onSaveToNotebook={vi.fn()}
        aiConfigured
        onGenerateDissection={onGenerate}
      />
    );
    fireEvent.click(screen.getByText(/Ver Explicação Base Antes de Responder/i));
    fireEvent.click(screen.getByText('Gerar explicação com IA'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
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
          onDiagnosis={vi.fn()}
          lastDiagnosisFeedback={null}
          onSaveToNotebook={vi.fn()}
          studentContext={sampleContext}
          onOpenImport={vi.fn()}
        />
      ).container,
      render(
        <CycleView
          plan={cguPlan}
          cycleData={cycleData}
          examParts={[]}
          blockCard={<BlockCardHarness />}
          onUpdateWeeklyHours={vi.fn()}
          onApplyRecommendedCycle={vi.fn()}
        />
      ).container,
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
      render(<AiCopilotDockPanel context={sampleContext} onSaveToNotebook={vi.fn()} />).container,
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

  it('o copiloto sinaliza o modo demonstração e não oferece salvar exemplo no caderno', async () => {
    render(<AiCopilotDockPanel context={sampleContext} onSaveToNotebook={vi.fn()} aiConfigured={false} />);
    expect(screen.getByText(/Modo demonstração — respostas de exemplo/)).toBeTruthy();

    fireEvent.click(screen.getByText('O que priorizar hoje para meu edital?'));
    const badge = await screen.findByText('Exemplo simulado — a IA ainda não está configurada');
    const bubble = badge.parentElement as HTMLElement;
    expect(within(bubble).queryByText('Enviar para o Caderno')).toBeNull();
  });
});
