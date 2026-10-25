import type { AcervoItem, AnswerMark, ExamOutcome, ExtractedItem, Procedencia } from './types';

/**
 * Junta itens extraídos e gabarito definitivo (spec 12 §6.3, passos 3–4). Qualquer descompasso entre os dois — item
 * sem resposta, resposta sem item, resposta de outro formato — manda a prova INTEIRA para a quarentena: item casado
 * com a resposta errada é o pior defeito possível do acervo (spec 12 §2, anti-objetivos).
 */
const TRUE_FALSE_MARKS = new Set<AnswerMark>(['C', 'E']);
const CHOICE_MARKS = new Set<AnswerMark>(['A', 'B', 'C', 'D', 'E']);
const MIN_ALTERNATIVES = 4;

/** Cara de código: atribuição, fim em `;`/`{`/`}`, palavra-chave de linguagem no início, ou fechamento curto ("“))"). */
function looksLikeCode(line: string): boolean {
  const t = line.trim();
  if (t === '') return false;
  // Palavra-chave inteira: "definição", "importância", "classe" e "variação" são prosa
  if (/^(def|class|import|from|return|public|private|protected|function|const|let|var)\b/.test(t)) return true;
  if (/^(print\(|System\.|console\.)/.test(t)) return true;
  if (/[;{}]$/.test(t)) return true;
  if (/^[\w.[\]]+\s*(=|\+=|-=)\s*[^=]/.test(t)) return true;
  // Fechamento curto de código ("“))", "});"); pedaço de fórmula ("–2") não conta
  return t.length <= 6 && /^[)\]}'"“”;,.]+$/.test(t);
}

/** Dentro de um bloco já aberto: linha que só faz sentido como parte dele ("child: Text(", "'Olá',", "),"). */
function continuesCode(line: string): boolean {
  const t = line.trim();
  return /[(),;{}[\]]$/.test(t) || /^[)}\]'"“‘]/.test(t) || /^\w+:\s?\S/.test(t);
}

const straightQuotes =(s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

/** Prosa vira uma linha só; 2+ linhas seguidas com cara de código viram bloco cercado por ```, com aspas retas. */
export function detectCode(text: string): { temCodigo: boolean; texto: string } {
  const lines = text.split('\n');
  const parts: string[] = [];
  let prose: string[] = [];
  let temCodigo = false;
  const flushProse = () => {
    if (prose.length > 0) parts.push(prose.join(' ').replace(/\s+/g, ' ').trim());
    prose = [];
  };
  for (let i = 0; i < lines.length; ) {
    let end = i;
    while (end < lines.length && (looksLikeCode(lines[end]) || (end > i && continuesCode(lines[end])))) end += 1;
    if (end - i >= 2) {
      flushProse();
      parts.push(['```', ...lines.slice(i, end).map((l) => straightQuotes(l.trim())), '```'].join('\n'));
      temCodigo = true;
      i = end;
      continue;
    }
    prose.push(lines[i]);
    i += 1;
  }
  flushProse();
  return { temCodigo, texto: parts.filter(Boolean).join('\n') };
}

/**
 * "Imagem", "tabela" e "quadro" sozinhos são comuns (direito à imagem, "a tabela clientes" num item de SQL): só contam
 * com "a seguir", "acima", "precedente"…
 */
export function dependsOnFigure(text: string): boolean {
  if (/\b(figura|gr[aá]fico|ilustra[çc][ãa]o)\b/i.test(text)) return true;
  return /\b(imagem|tabela|quadro)\s+(a seguir|acima|abaixo|precedente|anterior|apresentad[oa]|mostrad[oa])\b/i.test(text);
}

/**
 * Símbolo de fórmula que o PDF não traduz (fonte própria da banca): sai como braile, mongol, CJK ou área de uso
 * privado ("ᡘ䙦ᡶ䙧"). O item fica marcado para o app avisar ou esconder — o texto não dá para ler.
 */
const ILLEGIBLE = /[᠀-᢯⠀-⣿぀-ヿ㐀-鿿가-힯-]/;
export const hasIllegibleSymbols = (text: string) => ILLEGIBLE.test(text);

function formatLabel(item: ExtractedItem): string {
  return item.formato === 'CERTO_ERRADO' ? 'Certo/Errado' : 'múltipla escolha';
}

export function assembleExam(
  items: ExtractedItem[],
  key: Map<number, AnswerMark>,
  origem: Omit<Procedencia, 'numero'>
): ExamOutcome {
  if (items.length === 0) return { kind: 'quarentena', motivo: 'nenhum item reconhecido na prova' };
  const numbers = new Set(items.map((i) => i.numero));
  const semResposta = [...numbers].filter((n) => !key.has(n)).sort((a, b) => a - b);
  if (semResposta.length > 0) return { kind: 'quarentena', motivo: `itens sem resposta: ${semResposta.join(', ')}` };
  const semItem = [...key.keys()].filter((n) => !numbers.has(n)).sort((a, b) => a - b);
  if (semItem.length > 0) return { kind: 'quarentena', motivo: `respostas sem item: ${semItem.join(', ')}` };

  const itens: AcervoItem[] = [];
  for (const item of items) {
    const mark = key.get(item.numero)!;
    const allowed = item.formato === 'CERTO_ERRADO' ? TRUE_FALSE_MARKS : CHOICE_MARKS;
    if (mark !== 'X' && !allowed.has(mark)) {
      return { kind: 'quarentena', motivo: `resposta "${mark}" incompatível com o item ${item.numero} (${formatLabel(item)})` };
    }
    const alternativesCount = item.alternativas?.length ?? 0;
    if (item.formato === 'MULTIPLA_ESCOLHA' && alternativesCount < MIN_ALTERNATIVES) {
      return { kind: 'quarentena', motivo: `questão ${item.numero} com ${alternativesCount} alternativas` };
    }

    const base = item.textoBase ? detectCode(item.textoBase) : null;
    const enunciado = detectCode(item.enunciado);
    const alternativas = item.alternativas?.map((a) => detectCode(a)) ?? null;
    const fullText = [base?.texto, enunciado.texto, ...(alternativas?.map((a) => a.texto) ?? [])].filter(Boolean).join(' ');
    itens.push({
      id: `${origem.identificador}:${origem.caderno}:${item.numero}`,
      formato: item.formato,
      textoBase: base?.texto ?? null,
      enunciado: enunciado.texto,
      alternativas: alternativas?.map((a) => a.texto) ?? null,
      gabarito: mark === 'X' ? null : (mark as Exclude<AnswerMark, 'X'>),
      anulado: mark === 'X',
      materiaOrigem: item.materiaOrigem,
      temCodigo: Boolean(base?.temCodigo || enunciado.temCodigo || alternativas?.some((a) => a.temCodigo)),
      dependeDeFigura: dependsOnFigure(fullText),
      temSimboloIlegivel: hasIllegibleSymbols(fullText),
      procedencias: [{ ...origem, numero: item.numero }],
    });
  }
  return { kind: 'ok', itens };
}
