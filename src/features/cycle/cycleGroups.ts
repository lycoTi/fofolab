import type { SubjectCycleAllocation } from '../../lib/cycleEngine';
import type { ExamPart, SubjectCategory } from '../../types/database';

export interface CycleGroup {
  key: string;
  title: string;
  /** Ex.: "90 itens • 2 pontos por acerto • mínimo 54". */
  details: string | null;
  /** Prova que vale mais por acerto que as outras. */
  highlight: string | null;
  weeklyMinutes: number;
  allocations: SubjectCycleAllocation[];
}

const CATEGORY_TITLES: Record<SubjectCategory, string> = {
  ESPECIFICO: 'Conhecimentos específicos',
  GERAL: 'Conhecimentos gerais',
  BASICO: 'Conhecimentos básicos',
};

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function byMinutes(a: SubjectCycleAllocation, b: SubjectCycleAllocation): number {
  return b.currentWeeklyMinutes - a.currentWeeklyMinutes;
}

/**
 * Matérias agrupadas pela prova em que caem (planos do edital) ou pela categoria (planos feitos à mão).
 * Grupos e matérias vão do maior para o menor tempo na semana.
 */
export function groupAllocations(allocations: SubjectCycleAllocation[], examParts: ExamPart[]): CycleGroup[] {
  const groups = new Map<string, CycleGroup>();
  const minPointsPerItem = examParts.length > 0 ? Math.min(...examParts.map((p) => p.points_per_item)) : 1;

  for (const allocation of allocations) {
    const part = examParts.find((p) => p.id === allocation.subject.exam_part_id);
    const key = part?.id ?? `cat-${allocation.subject.category}`;
    if (!groups.has(key)) {
      const ratio = part ? part.points_per_item / minPointsPerItem : 1;
      groups.set(key, {
        key,
        title: part ? `${part.code} • ${part.name}` : CATEGORY_TITLES[allocation.subject.category],
        details: part
          ? [
              `${part.item_count} itens`,
              `${formatPoints(part.points_per_item)} ${part.points_per_item === 1 ? 'ponto' : 'pontos'} por acerto`,
              part.min_score !== null ? `mínimo ${formatPoints(part.min_score)}` : null,
            ]
              .filter(Boolean)
              .join(' • ')
          : null,
        highlight: ratio >= 2 ? (ratio === 2 ? 'vale o dobro' : `vale ${formatPoints(ratio)}×`) : null,
        weeklyMinutes: 0,
        allocations: [],
      });
    }
    const group = groups.get(key)!;
    group.allocations.push(allocation);
    group.weeklyMinutes += allocation.currentWeeklyMinutes;
  }

  return [...groups.values()]
    .map((group) => ({ ...group, allocations: [...group.allocations].sort(byMinutes) }))
    .sort((a, b) => b.weeklyMinutes - a.weeklyMinutes);
}
