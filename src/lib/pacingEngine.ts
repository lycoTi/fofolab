export interface PacingAttemptRecord {
  questionId: string;
  isCE: boolean;
  timeSpentSeconds: number;
  isCorrect: boolean;
  subjectId?: string;
}

export interface SubjectPacing {
  subjectId: string;
  subjectName: string;
  avgSeconds: number;
  count: number;
  accuracy: number;
  isBottleneck: boolean;
}

export interface PacingProfile {
  totalAttempts: number;
  overallAvgSeconds: number;
  certoErradoAvgSeconds: number;
  multiplaEscolhaAvgSeconds: number;
  bySubject: SubjectPacing[];
}

export interface ExamSimulationParams {
  questionCount: number;
  format: 'CE' | 'ME' | 'MIXED';
  avgSecondsPerQuestion: number;
  examDurationMinutes: number;
  answerSheetMinutes: number;
  breakMinutes: number;
}

export interface ExamSimulationResult {
  pureResolutionMinutes: number;
  buffersTotalMinutes: number;
  totalEstimatedMinutes: number;
  deltaMinutes: number;
  verdict: 'SAFE' | 'TIGHT' | 'DEFICIT';
  advice: string;
}

/**
 * Formata segundos no padrão mm:ss (ex.: 90s -> 01:30).
 */
export function formatPacingTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Calcula o perfil histórico de ritmo de resolução do estudante,
 * separando questões Certo/Errado (ágeis) e Múltipla Escolha (densas).
 */
export function calculatePacingProfile(
  attempts: PacingAttemptRecord[],
  subjects: { id: string; name: string }[] = []
): PacingProfile {
  // Filtra anomalias (ex.: estudante esqueceu o PC ligado > 15 min ou tempo zerado)
  const valid = attempts.filter((a) => a.timeSpentSeconds > 0 && a.timeSpentSeconds <= 900);

  if (valid.length === 0) {
    return {
      totalAttempts: 0,
      overallAvgSeconds: 0,
      certoErradoAvgSeconds: 0,
      multiplaEscolhaAvgSeconds: 0,
      bySubject: [],
    };
  }

  const ceList = valid.filter((a) => a.isCE);
  const meList = valid.filter((a) => !a.isCE);

  const sumTime = (list: PacingAttemptRecord[]) => list.reduce((acc, a) => acc + a.timeSpentSeconds, 0);

  const overallAvg = Math.round(sumTime(valid) / valid.length);
  const ceAvg = ceList.length > 0 ? Math.round(sumTime(ceList) / ceList.length) : 0;
  const meAvg = meList.length > 0 ? Math.round(sumTime(meList) / meList.length) : 0;

  // Agrupamento por matéria
  const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));
  const bySubId = new Map<string, PacingAttemptRecord[]>();

  for (const a of valid) {
    if (!a.subjectId) continue;
    const list = bySubId.get(a.subjectId) ?? [];
    list.push(a);
    bySubId.set(a.subjectId, list);
  }

  const bySubject: SubjectPacing[] = Array.from(bySubId.entries()).map(([subId, list]) => {
    const avg = Math.round(sumTime(list) / list.length);
    const correct = list.filter((a) => a.isCorrect).length;
    const accuracy = Math.round((correct / list.length) * 100);
    // É gargalo se demorar mais que 180s (3 min) na média geral da matéria
    const isBottleneck = avg >= 180;

    return {
      subjectId: subId,
      subjectName: subjectNameMap.get(subId) ?? 'Geral',
      avgSeconds: avg,
      count: list.length,
      accuracy,
      isBottleneck,
    };
  });

  return {
    totalAttempts: valid.length,
    overallAvgSeconds: overallAvg,
    certoErradoAvgSeconds: ceAvg,
    multiplaEscolhaAvgSeconds: meAvg,
    bySubject,
  };
}

/**
 * Simula o tempo total necessário para uma prova real e emite o veredito de viabilidade.
 */
export function simulateExamSession(params: ExamSimulationParams): ExamSimulationResult {
  const totalResolutionSeconds = params.questionCount * params.avgSecondsPerQuestion;
  const pureResolutionMinutes = Math.round(totalResolutionSeconds / 60);
  const buffersTotalMinutes = params.answerSheetMinutes + params.breakMinutes;
  const totalEstimatedMinutes = pureResolutionMinutes + buffersTotalMinutes;
  const deltaMinutes = params.examDurationMinutes - totalEstimatedMinutes;

  let verdict: 'SAFE' | 'TIGHT' | 'DEFICIT';
  let advice: string;

  if (deltaMinutes < 0) {
    verdict = 'DEFICIT';
    const deficitAbs = Math.abs(deltaMinutes);
    advice = `Atenção: Faltariam aproximadamente ${deficitAbs} minutos para concluir a prova no seu ritmo atual. Treine leitura dinâmica de enunciados longos e reduza tempo nas matérias gargalo.`;
  } else if (deltaMinutes <= 15) {
    verdict = 'TIGHT';
    advice = `Ritmo justo: sobram apenas ${deltaMinutes} minutos de folga. Recomenda-se manter ritmo constante e não travar mais de 3 minutos em questões dúbias.`;
  } else {
    verdict = 'SAFE';
    advice = `Ritmo seguro: sobram ${deltaMinutes} minutos de folga com margem confortável para revisão das questões marcadas com dúvida.`;
  }

  return {
    pureResolutionMinutes,
    buffersTotalMinutes,
    totalEstimatedMinutes,
    deltaMinutes,
    verdict,
    advice,
  };
}
