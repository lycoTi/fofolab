import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';

export interface FofoStudentAttempt {
  selectedOption: string;
  isCorrect: boolean;
  confidence: ReviewConfidence | null;
  diagnosis: SelfDiagnosisType | null;
  timeSpentSeconds?: number;
  falseCertainty: boolean;
}

export interface FofoActiveQuestion {
  question: Question;
  answered: boolean;
  dissection: AiDissection | null;
  diagnosis: SelfDiagnosisType | null;
  falseCertainty: boolean;
  attempt?: FofoStudentAttempt | null;
  onNextSameSubject?: () => void;
  nextSameSubjectLabel?: string | null;
}

