import type { CebraspeEvent, CebraspeEventDetail, CebraspeFile } from './types';

/**
 * Leitura da API pública que o próprio site da Cebraspe usa (spec 12 §4). Cada campo usado é conferido: se a banca mudar
 * o formato, a rodada para com o nome do campo em vez de gravar lixo no acervo.
 */
const API = 'https://apis.cebraspe.org.br/cebraspe/eventos';
const CDN = 'https://cdn.cebraspe.org.br';

export class FormatoCebraspeMudou extends Error {
  constructor(public readonly campo: string) {
    super(`A API da Cebraspe mudou de formato: o campo "${campo}" sumiu ou veio diferente. Nada foi gravado.`);
    this.name = 'FormatoCebraspeMudou';
  }
}

export const eventListUrl = (): string => `${API}/tipo/concursos/fase/encerrado`;
export const eventDetailUrl = (id: string): string => `${API}/${encodeURIComponent(id)}`;
export const fileUrl = (tipo: string, id: string, nomeArquivo: string): string =>
  `${CDN}/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}/arquivos/${encodeURIComponent(nomeArquivo)}`;

type Json = Record<string, unknown>;

function asObject(value: unknown, campo: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FormatoCebraspeMudou(campo);
  return value as Json;
}

function requireString(obj: Json, campo: string): string {
  const value = obj[campo];
  if (typeof value !== 'string' || !value.trim()) throw new FormatoCebraspeMudou(campo);
  return value.trim();
}

function requireNumber(obj: Json, campo: string): number {
  const value = Number(obj[campo]);
  if (obj[campo] === null || obj[campo] === undefined || !Number.isFinite(value)) throw new FormatoCebraspeMudou(campo);
  return value;
}

/** Lista que a API manda como `null` quando está vazia; ausente é mudança de formato. */
function nullableArray(obj: Json, campo: string): unknown[] {
  const value = obj[campo];
  if (value === null) return [];
  if (!Array.isArray(value)) throw new FormatoCebraspeMudou(campo);
  return value;
}

function parseEvent(raw: unknown): CebraspeEvent {
  const obj = asObject(raw, 'eventos');
  const identificador = requireString(obj, 'eventoURL');
  return {
    identificador,
    nome: typeof obj.eventoNomeAbreviado === 'string' ? obj.eventoNomeAbreviado.trim() : identificador,
    ano: requireNumber(obj, 'eventoAno'),
    tipo: requireString(obj, 'eventoTipo'),
    status: typeof obj.eventoStatus === 'string' ? obj.eventoStatus : '',
  };
}

function parseFile(raw: unknown, campo: string): CebraspeFile {
  const obj = asObject(raw, campo);
  return {
    descricao: requireString(obj, 'descricaoArquivo'),
    nomeArquivo: requireString(obj, 'nomeArquivo'),
    data: typeof obj.dataArquivoObj === 'string' ? obj.dataArquivoObj : '',
  };
}

/** A resposta vem embrulhada em grupos: `[{ faseEvento, ordem, eventos: [...] }]`. */
export function parseEventList(json: unknown): CebraspeEvent[] {
  if (!Array.isArray(json)) throw new FormatoCebraspeMudou('eventos');
  return json.flatMap((group) => {
    const obj = asObject(group, 'eventos');
    if (!Array.isArray(obj.eventos)) throw new FormatoCebraspeMudou('eventos');
    return obj.eventos.map(parseEvent);
  });
}

export function parseEventDetail(json: unknown): CebraspeEventDetail {
  const obj = asObject(json, 'evento');
  const event = parseEvent(obj);
  const gabaritos = nullableArray(obj, 'arquivosGabarito').map((f) => parseFile(f, 'arquivosGabarito'));
  const editais = nullableArray(obj, 'arquivosEdital').map((f) => parseFile(f, 'arquivosEdital'));
  const areas = nullableArray(obj, 'eventoCargos')
    .map((c) => asObject(c, 'eventoCargos').area)
    .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
    .map((a) => a.trim());
  return { ...event, areas, arquivos: [...gabaritos, ...editais] };
}
