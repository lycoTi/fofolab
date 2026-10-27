/** Fim de frase completa (ponto, exclamação, interrogação, reticências; parêntese ou aspas fechando). */
const COMPLETE_END = /[.!?…)"»”]$/;

/**
 * Resposta que bateu no teto de tamanho: tira a linha cortada no meio e os títulos que ficaram sem conteúdo depois
 * dela, para o estudante nunca ler "Qual estratégia (ou" e achar que acabou. Sem quebra de linha, corta na última frase.
 */
export function trimCutReply(text: string): string {
  const lines = text.trimEnd().split('\n');
  lines.pop();
  while (lines.length > 0 && !COMPLETE_END.test(lines[lines.length - 1].trim())) lines.pop();
  if (lines.length > 0) return lines.join('\n').trimEnd();

  const single = text.trim();
  const end = Math.max(single.lastIndexOf('. '), single.lastIndexOf('! '), single.lastIndexOf('? '));
  return end > 0 ? single.slice(0, end + 1) : single;
}

/** Final do texto já mostrado, para a IA continuar dali sem repetir. */
export function replyTail(text: string, chars = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= chars ? flat : `…${flat.slice(-chars)}`;
}
