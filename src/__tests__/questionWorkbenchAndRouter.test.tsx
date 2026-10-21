import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CycleDashboard } from '../components/CycleDashboard';
import { QuestionWorkbench } from '../components/QuestionWorkbench';
import { AiCopilotDockPanel } from '../features/ai-copilot/AiCopilotDockPanel';
import { NotebookDockPanel } from '../features/notebook-dock/NotebookDockPanel';
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
import type { Topic } from '../types/database';

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

  it('calcula o perfil de complexidade multidimensional da questão', () => {
    const profile = getQuestionComplexityProfile(
      sampleBundles[0].question,
      sampleBundles[0].dissection
    );
    expect(profile.stars).toBeGreaterThanOrEqual(1);
    expect(profile.stars).toBeLessThanOrEqual(5);
    expect(['Direta', 'Intermediária', 'Densa / Estudo de Caso']).toContain(profile.levelLabel);
  });

  it('responde às dúvidas de Estudo Reverso e do Copiloto Contextual usando os tópicos fortes do estudante', async () => {
    const { reply } = await askReverseStudyTutor({
      question: sampleBundles[0].question,
      dissection: sampleBundles[0].dissection,
      promptText: 'Por que as outras alternativas estão erradas?',
      context: sampleContext,
    });
    expect(reply).toContain('Análise das Alternativas');
    expect(reply).toContain(sampleBundles[0].question.final_answer);
    expect(reply).toContain('ISSAI 100');

    const copilotReply = await askContextualStudyCopilot({
      context: sampleContext,
      promptText: 'Relacione este tópico com o que já domino',
    });
    expect(copilotReply.reply).toContain('CGU');
    expect(copilotReply.reply).toContain('FGV');
    expect(copilotReply.reply).toContain('ISSAI 100');
  });

  it('protege contra descarga cognitiva (oculta gabarito até marcar opção ou clicar em 1º Contato) e filtra por banca', () => {
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
      />
    );

    // Antes de responder, mostra o botão de Recuperação Ativa / 1º Contato
    const revealBtn = screen.getByText(/Ver Explicação Base Antes de Responder/i);
    expect(revealBtn).toBeTruthy();
    fireEvent.click(revealBtn);

    // Filtra apenas Cebraspe
    const boardSelect = screen.getByLabelText('Filtrar por banca');
    fireEvent.change(boardSelect, { target: { value: 'Cebraspe' } });

    expect(screen.getAllByText(/Cebraspe/i).length).toBeGreaterThanOrEqual(2);

    // Clica no botão de diagnóstico de 1º Contato / Lacuna
    const gapBtn = screen.getByText(/1º Contato \/ Lacuna/i);
    fireEvent.click(gapBtn);
    expect(onDiagnosis).toHaveBeenCalledTimes(1);
  });

  it('AUDITORIA DE UX: garante que a interface e os novos Docks não contêm jargões técnicos internos ("SQLite", "0 tokens", "_score", "Elasticsearch", "Anti-Alucinação")', () => {
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

    const { container: qContainer } = render(
      <QuestionWorkbench
        questions={sampleBundles}
        scopeFilter="all"
        onChangeScopeFilter={vi.fn()}
        onDiagnosis={vi.fn()}
        lastDiagnosisFeedback={null}
        onSaveToNotebook={vi.fn()}
        studentContext={sampleContext}
      />
    );

    const { container: cContainer } = render(
      <CycleDashboard
        plan={cguPlan}
        cycleData={cycleData}
        onUpdateWeeklyHours={vi.fn()}
        onApplyRecommendedCycle={vi.fn()}
        onJumpToTopic={vi.fn()}
      />
    );

    const { container: nbContainer } = render(
      <NotebookDockPanel
        currentSubject={cguSubjects[0]}
        currentTopic={SEED_TOPICS[0]}
        notebook={SEED_NOTEBOOKS[0]}
        notebookDraft={SEED_NOTEBOOKS[0].content_markdown}
        onChangeNotebookDraft={vi.fn()}
        onSaveNotebook={vi.fn()}
        allNotebooks={SEED_NOTEBOOKS}
        pdfSource={SEED_PDF_SOURCES[0]}
        onSavePdfProgress={vi.fn()}
        onJumpToTopic={vi.fn()}
      />
    );

    const { container: aiContainer } = render(
      <AiCopilotDockPanel context={sampleContext} onSaveToNotebook={vi.fn()} />
    );

    const combinedText = [
      qContainer.textContent || '',
      cContainer.textContent || '',
      nbContainer.textContent || '',
      aiContainer.textContent || '',
    ].join(' ');

    const forbiddenJargon = [
      'SQLite',
      '0 tokens',
      '_score',
      'Elasticsearch',
      'Anti-Alucinação',
      'Restaurar Seed',
    ];

    for (const term of forbiddenJargon) {
      expect(combinedText).not.toContain(term);
    }
  });
});
