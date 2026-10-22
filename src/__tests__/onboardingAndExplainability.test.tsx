import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingWizardModal } from '../features/onboarding-wizard/OnboardingWizardModal';
import { MetricExplainer } from '../components/MetricExplainer';
import {
  explainQuestionComplexity,
  explainSampleConfidence,
  explainSubjectAllocation,
  explainTopicHeat,
} from '../lib/explainabilityEngine';
import {
  SEED_STUDY_PLANS,
  SEED_SUBJECTS,
  SEED_TOPIC_LINKS,
  SEED_TOPICS,
} from '../data/initialSeed';
import { calculateDynamicStudyCycle } from '../lib/cycleEngine';
import type { Topic } from '../types/database';

describe('Explicabilidade sob Demanda, Onboarding Wizard e Modo Meu Dia de Hoje', () => {
  const cguPlan = SEED_STUDY_PLANS[0];
  const cguSubjects = SEED_SUBJECTS.filter((s) => s.plan_id === cguPlan.id);
  const topicsBySubject: Record<string, Topic[]> = {};
  for (const s of cguSubjects) {
    topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
  }
  const getPlanContent = () =>
    cguSubjects.map((subject) => ({ subject, topics: topicsBySubject[subject.id].filter((t) => !t.parent_id) }));

  const cycleData = calculateDynamicStudyCycle({
    plan: cguPlan,
    subjects: cguSubjects,
    topicsBySubject,
    attempts: [],
    sessions: [],
    topicLinks: SEED_TOPIC_LINKS,
  });

  it('gera explicações em linguagem humana (Nível 1) e bastidores matemáticos (Nível 2)', () => {
    const alloc = cycleData.allocations[0];
    const explanation = explainSubjectAllocation(alloc, 31.5, 90);

    expect(explanation.humanSummary).toContain(alloc.subject.name);
    expect(explanation.humanSummary).toContain(`${alloc.sharePercent}%`);
    expect(explanation.formulaDetails?.variables.length).toBeGreaterThanOrEqual(2);

    const confExplanation = explainSampleConfidence(25, 2, 4);
    expect(confExplanation.humanSummary).toContain('calibração');

    const heatExplanation = explainTopicHeat(cycleData.topicHeatmapRanking[0]);
    expect(heatExplanation.humanSummary).toContain(cycleData.topicHeatmapRanking[0].topic.title);

    const compExplanation = explainQuestionComplexity(
      { stars: 4, levelLabel: 'Densa / Estudo de Caso', topicCount: 2, linguisticLoad: 'Alta', summaryTip: 'Dica' },
      'FGV'
    );
    expect(compExplanation.humanSummary).toContain('4/5 estrelas');
  });

  it('renderiza o MetricExplainer como ícone discreto e abre o modal ao ser clicado', () => {
    const alloc = cycleData.allocations[0];
    const explanation = explainSubjectAllocation(alloc, 31.5, 90);

    render(<MetricExplainer explanation={explanation} buttonLabel="Por que hoje?" />);

    const button = screen.getByText('Por que hoje?');
    expect(button).toBeTruthy();

    fireEvent.click(button);
    expect(screen.getByText(explanation.humanSummary)).toBeTruthy();

    // Expande os bastidores matemáticos
    const formulaBtn = screen.getByText(/Ver cálculo e bastidores matemáticos/i);
    fireEvent.click(formulaBtn);
    expect(screen.getByText(explanation.formulaDetails!.formulaLabel)).toBeTruthy();
  });

  it('permite avançar pelas 5 etapas do Onboarding Wizard, com autoavaliação, e concluir', () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();

    render(
      <OnboardingWizardModal
        isOpen={true}
        plans={SEED_STUDY_PLANS}
        activePlan={cguPlan}
        onClose={onClose}
        onComplete={onComplete}
        getPlanContent={getPlanContent}
      />
    );

    expect(screen.getByText(/Calibrar Meu Roteiro de Estudos/i)).toBeTruthy();

    // Passo 1 -> Passo 2
    fireEvent.click(screen.getByText(/Continuar/i));

    // Passo 2 -> Passo 3
    fireEvent.click(screen.getByText(/Continuar/i));

    // Passo 3 -> Passo 4
    fireEvent.click(screen.getByText(/Continuar/i));

    // Passo 4: autoavaliação — "Nunca vi" na primeira matéria
    expect(screen.getByText(/Quanto você já sabe de cada matéria/i)).toBeTruthy();
    const firstSubject = cguSubjects[0];
    const group = screen.getByRole('radiogroup', { name: `Quanto você sabe de ${firstSubject.name}` });
    fireEvent.click(within(group).getByRole('radio', { name: 'Nunca vi' }));
    fireEvent.click(screen.getByText(/Continuar/i));

    // Passo 5 -> Concluir
    const finishBtn = screen.getByText(/Gerar Meu Roteiro de Hoje 🚀/i);
    fireEvent.click(finishBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    const selfAssessment = onComplete.mock.calls[0][2];
    expect(selfAssessment.subjects).toContainEqual({ subjectId: firstSubject.id, level: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('AUDITORIA DE UX: garante que o Wizard não contém jargões técnicos proibidos', () => {
    const { container: wizardContainer } = render(
      <OnboardingWizardModal
        isOpen={true}
        plans={SEED_STUDY_PLANS}
        activePlan={cguPlan}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        getPlanContent={getPlanContent}
      />
    );

    const combined = wizardContainer.textContent || '';
    const forbidden = ['SQLite', '0 tokens', '_score', 'Elasticsearch', 'Anti-Alucinação', 'Restaurar Seed'];

    for (const term of forbidden) {
      expect(combined).not.toContain(term);
    }
  });
});

