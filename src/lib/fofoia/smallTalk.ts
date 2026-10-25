import { normalizeText } from './signals';

/**
 * Cumprimento, agradecimento e "ok" respondidos pelo próprio app (pedido do dono, 24/10/2026): mandar "oi" para a IA
 * gastava o limite de uso e voltava um despejo de conteúdo sobre o tópico. Só vale quando a mensagem inteira é isso —
 * "oi, o que é microsserviço?" segue para a IA.
 */
const GREETING = ['oi', 'oie', 'oii', 'ola', 'opa', 'eai', 'hey', 'bom dia', 'boa tarde', 'boa noite', 'fofo', 'fofoia'];
const HOW_ARE_YOU = ['tudo bem', 'tudo bom', 'como vai', 'como voce esta'];
const THANKS = ['obrigado', 'obrigada', 'brigado', 'brigada', 'valeu', 'vlw', 'obg', 'agradeco'];
const ACK = ['ok', 'okay', 'entendi', 'beleza', 'blz', 'show', 'perfeito', 'otimo'];
/** Palavras que acompanham sem mudar o sentido ("oi, Fofo, tudo bem com você?"). */
const FILLER = ['e', 'ai', 'com', 'voce', 'vc', 'muito', 'mto', 'ia', 'ate', 'agora', 'ta'];
const MAX_WORDS = 7;

/** Tira as expressões da frase (a mais longa primeiro: "bom dia" antes de "dia") e diz se achou alguma. */
function strip(text: string, phrases: string[]): { rest: string; found: boolean } {
  let rest = ` ${text} `;
  let found = false;
  for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
    while (rest.includes(` ${phrase} `)) {
      found = true;
      rest = rest.replace(` ${phrase} `, ' ');
    }
  }
  return { rest: rest.trim(), found };
}

export function smallTalkReply(message: string, opts: { topicLabel: string; questionOpen: boolean }): string | null {
  const text = normalizeText(message).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.split(' ').length > MAX_WORDS) return null;
  const greeting = strip(text, GREETING);
  const howAreYou = strip(greeting.rest, HOW_ARE_YOU);
  const thanks = strip(howAreYou.rest, THANKS);
  const ack = strip(thanks.rest, ACK);
  const rest = ack.rest.split(' ').filter((w) => w && !FILLER.includes(w));
  if (rest.length > 0) return null;

  if (thanks.found) return 'De nada! Quando quiser, é só mandar a próxima dúvida.';
  if (ack.found && !greeting.found && !howAreYou.found) return 'Que bom! Se aparecer outra dúvida, é só mandar.';
  if (!greeting.found && !howAreYou.found) return null;
  const opening = howAreYou.found ? 'Oi! Tudo bem por aqui.' : 'Oi!';
  const question = opts.questionOpen ? ' Se travar na questão aberta, peça uma pista: ajudo sem entregar a resposta.' : '';
  return `${opening} Estou aqui para estudar **${opts.topicLabel}** com você. Mande sua dúvida do jeito que vier — explico rápido, do zero ou numa aula completa.${question}`;
}
