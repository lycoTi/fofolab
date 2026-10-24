import { parseQuestionOptions } from '../questionOptions';
import type { Question } from '../../types/database';

/**
 * Pista de questão Certo/Errado sem IA. No teste com a IA real (24/10/2026) qualquer modelo "explicava o conceito" e,
 * num item C/E, explicar o conceito já é julgar a afirmação. Aqui o texto é o mesmo para toda questão C/E — só o tópico
 * muda —, então não tem como carregar o gabarito; e não gasta o limite de uso.
 */
export function isTrueFalseQuestion(question: Question): boolean {
  const texts = parseQuestionOptions(question.options_json).map((o) => o.text.toLowerCase());
  return texts.length === 2 && texts.includes('certo') && texts.includes('errado');
}

const CLOSING = 'Marque sua resposta e a confiança, mesmo chutando: tentar antes fixa mais depois.';

/** `hintsGiven`: pistas já dadas nesta conversa (0 = a primeira). Da terceira em diante, a mesma devolução. */
export function trueFalseHint(topicLabel: string, hintsGiven: number): string {
  if (hintsGiven <= 0) {
    return `Esta questão testa **${topicLabel}**. Antes de julgar, lembre de cabeça: qual é a regra geral desse assunto e quais são as exceções que você conhece? Depois leia a afirmação inteira e diga para si, com suas palavras, o que ela afirma.\n\n${CLOSING}`;
  }
  if (hintsGiven === 1) {
    return `Julgue por partes: quem faz, o quê, em que condição e com que consequência. Confira cada pedaço contra o que você lembrou — basta um pedaço não bater para mudar o julgamento. Palavras que ampliam ou restringem ("sempre", "apenas", "em regra", "não admite") merecem uma segunda leitura.\n\n${CLOSING}`;
  }
  return `Agora é com você: as pistas param aqui para não estragar o treino. Errar depois de tentar ensina mais do que mais uma dica — a explicação completa aparece logo depois de você marcar.\n\n${CLOSING}`;
}
