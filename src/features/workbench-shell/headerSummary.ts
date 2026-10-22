import type { SubjectCycleAllocation } from '../../lib/cycleEngine';
import type { ExamPart } from '../../types/database';

export interface ExamPartProgress {
  code: string;
  coveragePercent: number;
}

/**
 * Quanto de cada prova do edital já foi visto: média da cobertura das matérias que caem nela.
 * Planos feitos à mão (sem provas) não têm resumo.
 */
export function summarizeExamParts(allocations: SubjectCycleAllocation[], examParts: ExamPart[]): ExamPartProgress[] {
  return [...examParts]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((part) => {
      const inPart = allocations.filter((a) => a.subject.exam_part_id === part.id);
      if (inPart.length === 0) return [];
      const mean = inPart.reduce((acc, a) => acc + a.coveragePercent, 0) / inPart.length;
      return [{ code: part.code, coveragePercent: Math.round(mean) }];
    });
}
