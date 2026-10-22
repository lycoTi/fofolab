import type { SubjectCycleAllocation, TopicHeatItem } from './cycleEngine';

/**
 * Aviso discreto de recalibrar (spec 09): quando o desempenho medido, com amostra suficiente,
 * contraria muito a autoavaliação da matéria. Só sugere — quem decide recalibrar é o estudante.
 */
export interface RecalibrationHint {
  subjectName: string;
  direction: 'harder' | 'easier';
}

/** Domínio esperado para cada nível da autoavaliação (1 "nunca vi" … 4 "avançado"). */
const EXPECTED_MASTERY: Record<number, number> = { 1: 0, 2: 40, 3: 70, 4: 85 };
const MIN_CONFIDENCE = 50;
const HARDER_GAP = 30;
const EASIER_MASTERY = 70;

export function recalibrationHint(
  allocations: SubjectCycleAllocation[],
  ranking: TopicHeatItem[]
): RecalibrationHint | null {
  const byWeight = [...allocations].sort((a, b) => b.subject.exam_weight - a.subject.exam_weight);
  for (const allocation of byWeight) {
    const { subject, studiedTopicsMastery } = allocation;
    const topics = ranking.filter((h) => h.topic.subject_id === subject.id);
    if (topics.length === 0) continue;
    const confidence = topics.reduce((acc, h) => acc + h.sampleConfidencePercent, 0) / topics.length;
    if (confidence < MIN_CONFIDENCE) continue;

    const level = subject.initial_knowledge_level;
    const expected = EXPECTED_MASTERY[level] ?? 0;
    if (level >= 2 && studiedTopicsMastery <= expected - HARDER_GAP) {
      return { subjectName: subject.name, direction: 'harder' };
    }
    if (level === 1 && studiedTopicsMastery >= EASIER_MASTERY) {
      return { subjectName: subject.name, direction: 'easier' };
    }
  }
  return null;
}

export function describeRecalibrationHint(hint: RecalibrationHint): string {
  if (hint.direction === 'harder') return `${hint.subjectName} está mais difícil do que você marcou. Quer recalibrar?`;
  return `${hint.subjectName} está indo melhor do que você marcou. Quer recalibrar?`;
}
