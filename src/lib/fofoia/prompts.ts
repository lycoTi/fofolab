import { buildStudentContextXml, escapeXml, type ChatTurn } from '../aiRouter';
import { activeQuestionXml, type FofoContext } from './context';
import type { EditalCandidate } from './editalMatch';
import type { FofoMode } from './signals';

/** Últimas falas da conversa que vão junto (a conversa é curta e começa do zero; isso segura o gasto). */
export const CONVERSATION_TURNS_SENT = 6;

/**
 * Regras de todos os jeitos (regra autoral de prompts): fonte imutável declarada, abstenção, sem invenção sobre a banca,
 * sem gabarito antes da tentativa, estilo para a coluna estreita.
 */
const FOFO_RULES = `<regras>
1. Verdade imutável: o enunciado oficial e o gabarito definitivo da questão ativa (quando presentes) e a lista de tópicos do edital (quando presente). Nunca os contradiga.
2. Separe o que é texto da fonte, o que é interpretação e o que é seu raciocínio.
3. Abstenção: só cite número de lei, artigo, inciso, súmula ou norma se tiver certeza; senão escreva "não consigo confirmar o dispositivo exato" e explique o conceito. Nunca invente.
4. Não atribua pegadinhas nem "pontos mais cobrados" a uma banca específica, nem que ela prefere um autor: você não tem dados das provas. Fale em "cuidados comuns em provas".
5. Se a questão ativa ainda não foi respondida, nunca diga qual alternativa é a certa nem dê o gabarito.
6. Fundamente na definição formal e na doutrina majoritária; use só classificações e nomes consagrados (se não tiver certeza do nome de uma classificação, descreva sem nomear); se houver divergência ou mudança recente na lei, diga.
7. Não contradiga as anotações do estudante sem ter certeza; se discordar, diga que há divergência e qual é a visão majoritária.
8. Estilo: português do Brasil (nenhuma palavra em outro idioma, salvo latim jurídico consagrado), Markdown simples, listas em vez de tabelas (nunca use tabelas), emojis só em rótulos, siglas de TI escritas por extenso na primeira vez. Respeite o tamanho pedido no jeito e termine a resposta com uma frase completa.
9. Voz: a FofoIA, um hamster professor acolhedor e direto, que trata o estudante por "você", sem infantilizar e sem cumprimentos longos.
10. Se o estudante disser que vai mandar algo (uma questão, um trecho, um print) e ainda não mandou, peça o conteúdo em uma frase e pare: nunca responda nem invente o que ele ainda não mandou.
</regras>`;

/** Aula e resumo partem do que foi conversado: o estudante pede depois de discutir uma questão, não para ouvir o tópico de novo. */
const ABOUT_CONVERSATION =
  'Assunto: se a conversa tiver uma questão ou dúvida específica do estudante, trate dela — o que ela cobra, os conceitos que a resolvem e, se houver alternativas, por que cada uma está certa ou errada —, ligada ao tópico do plano; sem conversa, trate do tópico.';

const MODE_INSTRUCTIONS: Record<FofoMode, string> = {
  QUICK: `<jeito nome="Rápida">Resposta curta e direta, até ~120 palavras, com uma analogia ou exemplo prático. Termine com "Palavras-chave:" e no máximo 5 termos.</jeito>`,
  FROM_ZERO: `<jeito nome="Do zero">O estudante está começando ou se perdeu. Até ~250 palavras: só a ideia central, não o assunto inteiro. Comece com uma metáfora do cotidiano e com o porquê de aquilo importar. Linguagem simples. Se um dos &lt;pre_requisitos&gt; for necessário para entender, pergunte primeiro se ele quer vê-lo antes. Termine oferecendo um assunto relacionado ou perguntando se ficou claro.</jeito>`,
  LESSON: `<jeito nome="Aula completa">${ABOUT_CONVERSATION} Aula na ordem: 1) O essencial (2–3 linhas); 2) Explicação com exemplo concreto, ligado a um tópico que o estudante já domina quando possível; 3) Camadas — em Direito: letra da lei/normativo → jurisprudência dominante (STF/STJ/TCU) → como costuma ser cobrado; nas demais áreas: conceito → exemplo → como costuma ser cobrado; 4) Cuidados comuns em provas (se a questão ativa respondida tiver explicação guardada, use os padrões dela); 5) Uma ou duas perguntas para o estudante responder de cabeça. Comece pelo conceito básico. A aula vem sempre em partes, cada parte com até ~300 palavras (a aula inteira em 3 a 5 partes, até ~1.500 palavras). Escreva só uma parte por resposta: "Parte N de M" no topo e pare no fim dela, numa frase completa; o estudante pede a próxima.</jeito>`,
  SUMMARY: `<jeito nome="Resumo">${ABOUT_CONVERSATION} Responda SOMENTE com estas 6 linhas, nada antes ou depois:
**‹emoji› ‹Título›**
· **Palavras-chave:** até 5 termos separados por vírgula
· **Conceito curto:** no máximo 2 frases
· **Uso funcional:** para que serve / onde aparece
· **Analogia:** uma comparação do cotidiano
· **Cuidado em prova:** um cuidado comum (sem atribuir à banca)</jeito>`,
  EDITAL: `<jeito nome="Cai no meu edital?">Até ~150 palavras. Diga se o assunto descrito está no edital do estudante usando SOMENTE a lista &lt;topicos_candidatos&gt;. Se estiver, diga qual tópico (código e título), a matéria, a prova e o peso, e se vale estudar agora. Se nenhum candidato servir, diga "não encontrei isso no seu edital" e, se for o caso, qual matéria chega mais perto. Nunca invente tópico.</jeito>`,
  HINT: `<jeito nome="Pista">O estudante ainda não respondeu a questão ativa. Até ~80 palavras. Não revele a alternativa certa nem o gabarito, nem por eliminação. Nunca diga se a afirmação do enunciado (ou de uma alternativa) é verdadeira ou falsa, nem qual é a regra certa sobre o ponto testado: explicar a regra já resolve a questão. Se ainda não houve pista nesta conversa, diga só qual conceito a questão testa e faça uma pergunta para ele pensar; se já houve, aponte a palavra ou o trecho do enunciado que merece atenção e faça outra pergunta para ele pensar, sem respondê-la. Se ele pedir a resposta, diga com gentileza que ela aparece logo depois de ele marcar. Termine com uma linha incentivando-o a marcar a resposta e a confiança, mesmo chutando.</jeito>`,
};

/** Texto longo que o estudante colou (uma questão, um trecho): curto demais é pergunta solta, não âncora. */
const PASTED_MIN_CHARS = 200;
const PASTED_MAX_CHARS = 2000;

/**
 * A questão que o estudante colou sai das últimas falas depois de uma aula em partes; sem ela, aula e resumo voltavam
 * ao tópico genérico. Ela vai sempre junto, cortada num tamanho que não pesa no limite de uso.
 */
function pastedAnchorXml(conversation: ChatTurn[], recent: ChatTurn[]): string {
  const anchor = conversation
    .filter((t) => t.role === 'student' && t.content.length >= PASTED_MIN_CHARS && !recent.includes(t))
    .reduce<ChatTurn | null>((longest, t) => (longest && longest.content.length >= t.content.length ? longest : t), null);
  if (!anchor) return '';
  return `<texto_que_o_estudante_mandou>${escapeXml(anchor.content.slice(0, PASTED_MAX_CHARS))}</texto_que_o_estudante_mandou>\n`;
}

function conversationXml(conversation: ChatTurn[]): string {
  const recent = conversation.slice(-CONVERSATION_TURNS_SENT);
  if (recent.length === 0) return '<conversa_ate_aqui>início da conversa</conversa_ate_aqui>';
  const lines = recent.map((t) => `<${t.role === 'student' ? 'estudante' : 'fofoia'}>${escapeXml(t.content)}</${t.role === 'student' ? 'estudante' : 'fofoia'}>`);
  return `<conversa_ate_aqui>\n${pastedAnchorXml(conversation, recent)}${lines.join('\n')}\n</conversa_ate_aqui>`;
}

function editalXml(candidates: EditalCandidate[] | undefined): string {
  if (!candidates) return '';
  if (candidates.length === 0) return '<topicos_candidatos>nenhum tópico do edital tem palavras em comum com a pergunta</topicos_candidatos>';
  const rows = candidates.map(
    (c) => `<topico codigo="${escapeXml(c.topic.code)}" materia="${escapeXml(c.subjectName)}" prova="${escapeXml(c.examPartCode ?? '—')}" peso="${escapeXml(c.weight)}">${escapeXml(c.topic.title)}</topico>`
  );
  return `<topicos_candidatos>\n${rows.join('\n')}\n</topicos_candidatos>`;
}

export interface FofoPromptExtra {
  editalCandidates?: EditalCandidate[];
  /** Próxima parte da aula pedida e o total que a Parte 1 anunciou (o modelo tendia a renumerar e repetir). */
  part?: number;
  partTotal?: number;
  /** Final do que já foi mostrado de uma resposta cortada no teto de tamanho. */
  resumeAfter?: string;
}

function continuationXml(extra: FofoPromptExtra): string {
  if (extra.resumeAfter) {
    return `<continuacao>Sua resposta anterior passou do tamanho e foi cortada logo depois de: "${escapeXml(extra.resumeAfter)}". Continue exatamente dali, sem repetir nada do que já foi mostrado e sem título de parte novo.</continuacao>`;
  }
  if (!extra.part) return '';
  const total = extra.partTotal ? ` de ${extra.partTotal}` : '';
  return `<continuacao>Escreva só a Parte ${extra.part}${total} da aula, mantendo esse total. Não repita o que as partes anteriores, no histórico, já explicaram.</continuacao>`;
}

export function buildFofoPrompt(
  mode: FofoMode,
  ctx: FofoContext,
  conversation: ChatTurn[],
  message: string,
  extra: FofoPromptExtra = {}
): string {
  const partLine = continuationXml(extra);
  return `${buildStudentContextXml(ctx.student)}
<caderno_do_topico>${escapeXml(ctx.notebookExcerpt ?? 'sem anotações ainda')}</caderno_do_topico>
<pre_requisitos>${escapeXml(ctx.prerequisites.join(' | ') || 'nenhum cadastrado')}</pre_requisitos>
${activeQuestionXml(ctx)}
${editalXml(extra.editalCandidates)}
${conversationXml(conversation)}
${FOFO_RULES}
${MODE_INSTRUCTIONS[mode]}
${partLine}
<mensagem_do_estudante>${escapeXml(message)}</mensagem_do_estudante>`;
}
