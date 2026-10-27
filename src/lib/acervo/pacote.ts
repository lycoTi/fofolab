/**
 * Pacote do acervo da Cebraspe (spec 12c §5.2), gerado por `npm run minerar -- pacote` (`tools/minerador/pacote.ts`).
 * É entrada não confiável: tudo é validado aqui, e item ruim é contado e ignorado sem derrubar a importação.
 * Só os campos que o app usa saem daqui (o resto do pacote — opiniões, histórico, matéria de origem — fica de fora).
 */

/** Folga sobre os ~30 MB do pacote de hoje (27,5 mil itens). */
export const MAX_PACOTE_BYTES = 80 * 1024 * 1024;

export interface PacoteAssunto {
  id: string;
  caminho: string[];
  sinonimos: string[];
}

export interface PacoteProcedencia {
  banca: string;
  concurso: string;
  ano: number;
  numero: number;
}

export interface PacoteItem {
  id: string;
  formato: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
  textoBase: string | null;
  enunciado: string;
  alternativas: string[] | null;
  gabarito: string;
  anulado: boolean;
  dependeDeFigura: boolean;
  temSimboloIlegivel: boolean;
  procedencias: PacoteProcedencia[];
  assuntos: { id: string; confianca: number }[];
  incerto: boolean;
}

export interface PacoteValido {
  vocabVersion: number;
  assuntos: PacoteAssunto[];
  itens: PacoteItem[];
  invalidItems: number;
}

const NOT_A_PACOTE = 'Este arquivo não é um pacote do acervo.';
const OPTION_PREFIX = /^[A-E]\) /;
// Alternativa com código: o minerador abre a cerca antes da letra ("```\nA) { … }")
const FENCED_OPTION = /^```\n([A-E]\) )/;
const ANSWER = /^[A-E]$/;
/** Gabarito do item anulado (o pacote traz `null`): nenhuma letra é certa. */
export const ANNULLED_ANSWER = 'X';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

function readAssunto(value: unknown): PacoteAssunto | null {
  if (!isObject(value) || !isString(value.id) || !isStringArray(value.caminho) || value.caminho.length === 0) return null;
  return { id: value.id, caminho: value.caminho, sinonimos: isStringArray(value.sinonimos) ? value.sinonimos : [] };
}

function readProcedencia(value: unknown): PacoteProcedencia | null {
  if (!isObject(value)) return null;
  const { banca, concurso, ano, numero } = value;
  if (!isString(banca) || !isString(concurso) || !isNumber(ano) || !isNumber(numero)) return null;
  return { banca, concurso, ano, numero };
}

function readAlternativas(formato: PacoteItem['formato'], value: unknown): string[] | null | undefined {
  if (formato === 'CERTO_ERRADO') return value === null ? null : undefined;
  if (!isStringArray(value) || value.length < 2) return undefined;
  // A letra vai para a frente da cerca: o app lê a alternativa pelo prefixo "X) "
  const options = value.map((opt) => opt.replace(FENCED_OPTION, '$1```\n'));
  return options.every((opt) => OPTION_PREFIX.test(opt)) ? options : undefined;
}

function readGabarito(gabarito: unknown, anulado: unknown): string | null {
  if (anulado === true && gabarito === null) return ANNULLED_ANSWER;
  return isString(gabarito) && ANSWER.test(gabarito) ? gabarito : null;
}

/** Item válido ou `null` (contado como inválido). */
function readItem(value: unknown): PacoteItem | null {
  if (!isObject(value)) return null;
  const { id, formato, textoBase, enunciado, anulado, dependeDeFigura, temSimboloIlegivel, incerto } = value;
  const gabarito = readGabarito(value.gabarito, anulado);
  if (!isString(id) || !isString(enunciado) || gabarito === null) return null;
  if (formato !== 'CERTO_ERRADO' && formato !== 'MULTIPLA_ESCOLHA') return null;
  if (textoBase !== null && !isString(textoBase)) return null;
  if (![anulado, dependeDeFigura, temSimboloIlegivel, incerto].every(isBoolean)) return null;
  const alternativas = readAlternativas(formato, value.alternativas);
  if (alternativas === undefined) return null;

  if (!Array.isArray(value.procedencias) || value.procedencias.length === 0) return null;
  const procedencias = value.procedencias.map(readProcedencia);
  if (procedencias.some((p) => p === null)) return null;

  if (!Array.isArray(value.assuntos)) return null;
  const assuntos = value.assuntos.map((a) => (isObject(a) && isString(a.id) && isNumber(a.confianca) ? { id: a.id, confianca: a.confianca } : null));
  if (assuntos.some((a) => a === null)) return null;

  return {
    id,
    formato,
    textoBase,
    enunciado,
    alternativas,
    gabarito,
    anulado: anulado as boolean,
    dependeDeFigura: dependeDeFigura as boolean,
    temSimboloIlegivel: temSimboloIlegivel as boolean,
    procedencias: procedencias as PacoteProcedencia[],
    assuntos: assuntos as { id: string; confianca: number }[],
    incerto: incerto as boolean,
  };
}

export function parsePacote(text: string): { ok: true; pacote: PacoteValido } | { ok: false; message: string } {
  if (text.length > MAX_PACOTE_BYTES) return { ok: false, message: 'O arquivo passa de 80 MB.' };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_A_PACOTE };
  }
  if (!isObject(raw) || raw.formato !== 'fofolab-acervo' || !isNumber(raw.versao)) return { ok: false, message: NOT_A_PACOTE };
  if (raw.versao !== 1) return { ok: false, message: 'Este pacote é de uma versão mais nova do FofoLab.' };

  const vocab = raw.vocabulario;
  if (!isObject(vocab) || !isNumber(vocab.versao) || !Array.isArray(vocab.assuntos) || !Array.isArray(raw.itens)) {
    return { ok: false, message: NOT_A_PACOTE };
  }

  const assuntos = vocab.assuntos.map(readAssunto).filter((a): a is PacoteAssunto => a !== null);
  const itens: PacoteItem[] = [];
  let invalidItems = 0;
  for (const value of raw.itens) {
    const item = readItem(value);
    if (item) itens.push(item);
    else invalidItems += 1;
  }
  return { ok: true, pacote: { vocabVersion: vocab.versao, assuntos, itens, invalidItems } };
}

/** Nome do concurso com o ano inteiro: "ANATEL 24" de 2024 → "ANATEL 2024" (vira o órgão da questão). */
export function concursoComAno(p: PacoteProcedencia): string {
  const shortYear = String(p.ano % 100).padStart(2, '0');
  return p.concurso.replace(new RegExp(`(^|\\s)${shortYear}(?=\\s|$)`), `$1${p.ano}`);
}

/**
 * Procedência como aparece no cartão: "Cebraspe · ANATEL 2024 · item 40". O minerador nomeia o concurso com o ano em
 * 2 dígitos ("ANATEL 24"); só o número solto igual ao fim do ano vira o ano inteiro ("TRT10" continua "TRT10").
 */
export function formatProcedencia(p: PacoteProcedencia, others: number): string {
  const label = `${p.banca} · ${concursoComAno(p)} · item ${p.numero}`;
  if (others <= 0) return label;
  return `${label} (e em mais ${others} ${others === 1 ? 'prova' : 'provas'})`;
}
