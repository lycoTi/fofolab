import { escapeXml, type StudentContextSnapshot } from '../aiRouter';
import { parseQuestionOptions } from '../questionOptions';
import type { AiDissection, Question } from '../../types/database';

/** Quanto do caderno do tópico vai junto com a pergunta (o começo das anotações; economiza o limite de uso). */
export const NOTEBOOK_CONTEXT_CHARS = 1500;

export interface FofoContext {
  student: StudentContextSnapshot;
  notebookExcerpt: string | null;
  activeQuestion: { question: Question; answered: boolean; dissection: AiDissection | null } | null;
  /** Pré-requisitos do tópico (ligações entre tópicos), para o jeito "Do zero" oferecer antes. */
  prerequisites: string[];
}

export function buildFofoContext(input: {
  context: StudentContextSnapshot;
  notebook: string | null;
  activeQuestion: FofoContext['activeQuestion'];
  prerequisites: string[];
}): FofoContext {
  const notes = input.notebook?.trim() ?? '';
  return {
    student: input.context,
    notebookExcerpt: notes ? notes.slice(0, NOTEBOOK_CONTEXT_CHARS) : null,
    activeQuestion: input.activeQuestion,
    prerequisites: input.prerequisites,
  };
}

/**
 * Questão ativa para o prompt. Antes de o estudante responder, só enunciado e alternativas — o gabarito e a explicação
 * guardada ficam de fora (a IA não tem o que entregar). Depois, o gabarito definitivo é a verdade imutável.
 */
export function activeQuestionXml(ctx: FofoContext): string {
  const active = ctx.activeQuestion;
  if (!active) return '<questao_ativa>nenhuma</questao_ativa>';
  const { question, answered, dissection } = active;
  const options = parseQuestionOptions(question.options_json).map((o) => o.label).join(' | ');
  const head = `<questao_ativa banca="${escapeXml(question.exam_board)}" ano="${escapeXml(question.exam_year)}" respondida="${answered ? 'sim' : 'nao'}">
  <enunciado>${escapeXml(question.statement)}</enunciado>
  <alternativas>${escapeXml(options)}</alternativas>`;
  if (!answered) return `${head}\n</questao_ativa>`;
  return `${head}
  <gabarito_definitivo>${escapeXml(question.final_answer)}</gabarito_definitivo>
  <explicacao_guardada>${escapeXml(dissection?.dissection_markdown ?? '')}</explicacao_guardada>
</questao_ativa>`;
}
