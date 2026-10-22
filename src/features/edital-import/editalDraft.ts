import { estimateSubjectWeights, subjectsForRole, type EditalSubject, type ParsedEdital } from '../../lib/editalParser';
import type { EditalPlanInput } from '../../types/database';

/** O que a prévia edita antes de gravar; os pesos são recalculados a partir das provas. */
export interface EditalDraft {
  title: string;
  examDate: string | null;
  registrationDeadline: string | null;
  weeklyHoursTarget: number;
  parts: EditalPlanInput['parts'];
  subjects: EditalSubject[];
  /** Peso digitado à mão na prévia (índice da matéria → peso). */
  weightOverrides: Record<number, number>;
}

export function roleNeedsChoice(edital: ParsedEdital): boolean {
  return edital.roles.length > 1;
}

export function createEditalDraft(edital: ParsedEdital, roleNumber: number | null, weeklyHoursTarget: number): EditalDraft {
  const role = edital.roles.find((r) => r.number === roleNumber);
  const year = edital.examDate?.slice(0, 4) ?? '';
  const title = [`${edital.organ ?? 'Concurso'} ${year}`.trim(), role?.label ?? edital.roleBaseTitle]
    .filter(Boolean)
    .join(' — ');

  return {
    title,
    examDate: edital.examDate,
    registrationDeadline: edital.registrationDeadline,
    weeklyHoursTarget,
    parts: edital.parts.map((p) => ({
      code: p.code,
      name: p.name,
      itemCount: p.itemCount,
      pointsPerItem: p.pointsPerItem ?? 1,
      minScore: p.minScore,
    })),
    subjects: subjectsForRole(edital, roleNumber),
    weightOverrides: {},
  };
}

/** Peso e pontos de cada matéria, respeitando o que foi digitado à mão. */
export function draftWeights(draft: EditalDraft): { points: number; weight: number }[] {
  return estimateSubjectWeights(draft.parts, draft.subjects).map((value, index) => ({
    points: value.points,
    weight: draft.weightOverrides[index] ?? value.weight,
  }));
}

export function draftToPlanInput(draft: EditalDraft, edital: ParsedEdital, roleNumber: number | null): EditalPlanInput {
  const weights = draftWeights(draft);
  return {
    title: draft.title.trim(),
    organ: edital.organ,
    examBoard: edital.board,
    roleTitle: edital.roles.find((r) => r.number === roleNumber)?.label ?? edital.roleBaseTitle,
    examDate: draft.examDate,
    registrationDeadline: draft.registrationDeadline,
    minTotalScore: edital.minTotalScore,
    weeklyHoursTarget: draft.weeklyHoursTarget,
    parts: draft.parts,
    subjects: draft.subjects.map((s, i) => ({
      name: s.name,
      partCode: s.partCode,
      examWeight: weights[i].weight,
      topics: s.topics,
    })),
  };
}
