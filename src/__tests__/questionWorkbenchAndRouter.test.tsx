import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CycleDashboard } from '../components/CycleDashboard';
import { QuestionWorkbench } from '../components/QuestionWorkbench';
import {
  SEED_AI_DISSECTIONS,
  SEED_QUESTIONS,
  SEED_STUDY_PLANS,
  SEED_SUBJECTS,
  SEED_TOPIC_LINKS,
  SEED_TOPICS,
} from '../data/initialSeed';
import { askReverseStudyTutor, getQuestionComplexityProfile } from '../lib/aiRouter';
import { calculateDynamicStudyCycle } from '../lib/cycleEngine';
import type { Topic } from '../types/database';

describe('Bancada de Questões, Roteador Estudo Reverso & Auditoria de UI Limpa', () => {
  const sampleBundles = SEED_QUESTIONS.map((q) => ({
    question: q,
    dissection: SEED_AI_DISSECTIONS.find((d) => d.question_id === q.id) || null,
  }));

  it('calcula o perfil de complexidade multidimensional da questão', () => {
    const profile = getQuestionComplexityProfile(
      sampleBundles[0].question,
      sampleBundles[0].dissection
    );
    expect(profile.stars).toBeGreaterThanOrEqual(1);
    expect(profile.stars).toBeLessThanOrEqual(5);
    expect(['Direta', 'Intermediária', 'Densa / Estudo de Caso']).toContain(profile.levelLabel);
  });

  it('responde às dúvidas de Estudo Reverso fundamentadas no gabarito oficial', async () => {
    const { reply } = await askReverseStudyTutor({
      question: sampleBundles[0].question,
      dissection: sampleBundles[0].dissection,
      promptText: 'Por que as outras alternativas estão erradas?',
    });
    expect(reply).toContain('Análise das Alternativas');
    expect(reply).toContain(sampleBundles[0].question.final_answer);
  });

  it('filtra questões por banca (FGV vs Cebraspe) e dispara diagnóstico de 1 clique', () => {
    const onDiagnosis = vi.fn();
    render(
      <QuestionWorkbench
        questions={sampleBundles}
        scopeFilter="all"
        onChangeScopeFilter={vi.fn()}
        onDiagnosis={onDiagnosis}
        lastDiagnosisFeedback={null}
        onSaveToNotebook={vi.fn()}
      />
    );

    // Filtra apenas Cebraspe
    const boardSelect = screen.getByLabelText('Filtrar por banca');
    fireEvent.change(boardSelect, { target: { value: 'Cebraspe' } });

    expect(screen.getAllByText(/Cebraspe/i).length).toBeGreaterThanOrEqual(2);

    // Clica no botão de diagnóstico de 1º Contato / Lacuna
    const gapBtn = screen.getByText(/1º Contato \/ Lacuna/i);
    fireEvent.click(gapBtn);
    expect(onDiagnosis).toHaveBeenCalledTimes(1);
  });

  it('AUDITORIA DE UX: garante que a interface não contém jargões técnicos internos ("SQLite", "0 tokens", "_score", "Anti-Alucinação")', () => {
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

    const combinedText = `${qContainer.textContent || ''} ${cContainer.textContent || ''}`;

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
