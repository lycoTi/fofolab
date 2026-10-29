import { escapeXml, type StudentContextSnapshot } from '../aiRouter';
import { parseQuestionOptions } from '../questionOptions';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';

/** Quanto do caderno do tópico vai junto com a pergunta (o começo das anotações; economiza o limite de uso). */
export const NOTEBOOK_CONTEXT_CHARS = 1500;

export interface FofoStudentAttemptContext {
  selectedOption: string;
  isCorrect: boolean;
  confidence: ReviewConfidence | null;
  diagnosis: SelfDiagnosisType | null;
  timeSpentSeconds?: number;
  falseCertainty?: boolean;
}

export interface FofoActiveQuestionContext {
  question: Question;
  answered: boolean;
  dissection: AiDissection | null;
  attempt?: FofoStudentAttemptContext | null;
}

export interface LawExcerpt {
  /** Nome ou identificador da norma (ex.: "CF/88", "Lei nº 8.112/1990"). */
  lawName: string;
  /** Dispositivo específico (ex.: "Art. 37, § 6º", "Art. 5º, inc. X"). */
  article: string;
  /** Redação literal exata do dispositivo compilado oficial. */
  text: string;
  /** Link oficial para a fonte (ex.: Planalto ou Senado). */
  sourceUrl?: string;
}

export interface FofoContext {
  student: StudentContextSnapshot;
  notebookExcerpt: string | null;
  activeQuestion: FofoActiveQuestionContext | null;
  /** Pré-requisitos do tópico (ligações entre tópicos), para o jeito "Do zero" oferecer antes. */
  prerequisites: string[];
  /** Fragmentos de legislação relevante (CF/88, leis do edital) para ancorar a explicação na letra da lei. */
  lawExcerpts?: LawExcerpt[];
}

export function buildFofoContext(input: {
  context: StudentContextSnapshot;
  notebook: string | null;
  activeQuestion: FofoContext['activeQuestion'];
  prerequisites: string[];
  lawExcerpts?: LawExcerpt[];
}): FofoContext {
  const notes = input.notebook?.trim() ?? '';
  return {
    student: input.context,
    notebookExcerpt: notes ? notes.slice(0, NOTEBOOK_CONTEXT_CHARS) : null,
    activeQuestion: input.activeQuestion,
    prerequisites: input.prerequisites,
    lawExcerpts: input.lawExcerpts && input.lawExcerpts.length > 0 ? input.lawExcerpts : undefined,
  };
}

const DIAGNOSIS_HUMAN: Record<SelfDiagnosisType, string> = {
  MASTERED: 'Dominei (sabia com clareza)',
  STUDYING: 'Estou pegando o jeito (em processo de estudo)',
  DOUBT: 'Acertei na dúvida entre duas',
  LUCKY_GUESS: 'Acertei no chute',
  BOARD_TRAP: 'Pegadinha da banca ou desatenção na leitura',
  BASE_GAP: 'Lacuna de base (não sabia o conceito)',
  MISCONCEPTION: 'Confundi com outro conceito',
};

const CONFIDENCE_HUMAN: Record<ReviewConfidence, string> = {
  SURE: 'Sei (100% de convicção)',
  RECENT: 'Estou estudando',
  THINK: 'Acho que sei (dúvida)',
  GUESS: 'Chutei',
};

function studentAttemptXml(attempt: FofoStudentAttemptContext | null | undefined): string {
  if (!attempt) return '';
  const result = attempt.isCorrect ? 'Acertou' : 'Errou';
  const conf = attempt.confidence ? (CONFIDENCE_HUMAN[attempt.confidence] ?? attempt.confidence) : 'não informada';
  const diag = attempt.diagnosis ? (DIAGNOSIS_HUMAN[attempt.diagnosis] ?? attempt.diagnosis) : 'não informado';
  const falseCert = attempt.falseCertainty ? 'sim (alta certeza com erro)' : 'nao';
  const time = typeof attempt.timeSpentSeconds === 'number' ? ` tempo_segundos="${attempt.timeSpentSeconds}"` : '';

  return `  <tentativa_do_estudante resultado="${result}" alternativa_marcada="${escapeXml(attempt.selectedOption)}" confianca="${escapeXml(conf)}" autodiagnostico="${escapeXml(diag)}" falsa_certeza="${falseCert}"${time}/>`;
}

/**
 * Questão ativa para o prompt. Antes de o estudante responder, só enunciado e alternativas — o gabarito, a explicação
 * guardada e a tentativa ficam de fora (a IA não tem o que entregar). Depois, o gabarito definitivo e a tentativa real
 * do estudante guiam a explicação sem enrolação.
 */
export function activeQuestionXml(ctx: FofoContext): string {
  const active = ctx.activeQuestion;
  if (!active) return '<questao_ativa>nenhuma</questao_ativa>';
  const { question, answered, dissection, attempt } = active;
  const options = parseQuestionOptions(question.options_json).map((o) => o.label).join(' | ');
  const head = `<questao_ativa banca="${escapeXml(question.exam_board)}" ano="${escapeXml(question.exam_year)}" respondida="${answered ? 'sim' : 'nao'}">
  <enunciado>${escapeXml(question.statement)}</enunciado>
  <alternativas>${escapeXml(options)}</alternativas>`;
  if (!answered) return `${head}\n</questao_ativa>`;

  const attemptTag = studentAttemptXml(attempt);
  const attemptLine = attemptTag ? `\n${attemptTag}` : '';

  return `${head}
  <gabarito_definitivo>${escapeXml(question.final_answer)}</gabarito_definitivo>${attemptLine}
  <explicacao_guardada>${escapeXml(dissection?.dissection_markdown ?? '')}</explicacao_guardada>
</questao_ativa>`;
}

/**
 * Trechos de legislação oficial (CF/88, leis do edital) para ancoragem normativa no prompt.
 * Entrega redação literal exata de 1 a 3 artigos e link oficial para o Planalto/Senado.
 */
export function lawExcerptsXml(excerpts?: LawExcerpt[]): string {
  if (!excerpts || excerpts.length === 0) return '';
  const rows = excerpts.map((e) => {
    const urlAttr = e.sourceUrl ? ` fonte_oficial="${escapeXml(e.sourceUrl)}"` : '';
    return `  <dispositivo norma="${escapeXml(e.lawName)}" artigo="${escapeXml(e.article)}"${urlAttr}>\n    ${escapeXml(e.text)}\n  </dispositivo>`;
  });
  return `<legislacao_relevante>\n${rows.join('\n')}\n</legislacao_relevante>`;
}
