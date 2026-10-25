import type { AcervoItem } from './types';
import type { Assunto, PropostaAssunto } from './vocab';

/**
 * Prompt de um lote de classificação e validação da resposta (spec 12 §6.4; regra autoral de prompts): o texto do item
 * é a fonte; a matéria de origem é só pista; a IA escolhe só entre os candidatos daquele item ou propõe um assunto
 * novo de forma explícita; a resposta é só JSON e é conferida — o que não bate com o lote é descartado.
 */
export interface BatchEntry {
  item: AcervoItem;
  candidatos: Assunto[];
}

export interface AssuntoDoItem {
  id: string;
  confianca: number;
}

export interface BatchResult {
  assuntos: AssuntoDoItem[];
  proposta: PropostaAssunto | null;
}

const BASE_LIMIT = 700;
const MAX_ASSUNTOS = 3;

/** Esquema da resposta, também usado como `--json-schema` do Antigravity CLI. */
export const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    resultados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          assuntos: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' }, confianca: { type: 'number' } }, required: ['id', 'confianca'] },
          },
          proposta: {
            type: 'object',
            properties: { caminho: { type: 'array', items: { type: 'string' } }, confianca: { type: 'number' } },
            required: ['caminho', 'confianca'],
          },
        },
        required: ['id', 'assuntos'],
      },
    },
  },
  required: ['resultados'],
} as const;

const RULES = `Você classifica itens de provas de concurso (banca Cebraspe) por ASSUNTO. Regras:
1. A fonte é o texto do item (texto-base, enunciado e alternativas). Classifique pelo que o item PERGUNTA.
2. A matéria de origem é só uma pista e pode estar errada ou ser genérica ("CONHECIMENTOS ESPECÍFICOS").
3. Para cada item, escolha de 1 a 3 assuntos SOMENTE da lista de candidatos daquele item, pelo id, com confiança de 0 a 1.
4. Se nenhum candidato serve, deixe "assuntos" vazio e proponha um assunto novo em "proposta": {"caminho": ["Matéria", "Assunto"], "confianca": 0 a 1}. Nunca invente id.
5. Responda SOMENTE com o JSON {"resultados":[{"id":"…","assuntos":[{"id":"…","confianca":0.0}],"proposta":null}]}, um resultado por item, sem texto antes ou depois.`;

function itemBlock({ item, candidatos }: BatchEntry): string {
  const base = item.textoBase ? item.textoBase.slice(0, BASE_LIMIT) : '(sem texto-base)';
  const alternativas = item.alternativas ? `\nAlternativas: ${item.alternativas.join(' | ')}` : '';
  const lista = candidatos.map((c) => `  - ${c.id} — ${c.caminho.join(' › ')}`).join('\n');
  return `### Item ${item.id}
Matéria de origem (pista): ${item.materiaOrigem ?? '—'}
Texto-base: ${base}
Enunciado: ${item.enunciado}${alternativas}
Candidatos:
${lista || '  (nenhum — proponha um assunto novo)'}`;
}

export function buildBatchPrompt(batch: BatchEntry[]): string {
  return `${RULES}\n\n${batch.map(itemBlock).join('\n\n')}`;
}

/** Estimativa grosseira (≈ 3,5 caracteres por token em português) para não estourar o limite por minuto. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 3.5);

const clamp = (n: number) => Math.min(1, Math.max(0, n));

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseProposta(raw: unknown): PropostaAssunto | null {
  if (!raw || typeof raw !== 'object') return null;
  const { caminho, confianca } = raw as { caminho?: unknown; confianca?: unknown };
  if (!Array.isArray(caminho) || caminho.length === 0 || !caminho.every((p) => typeof p === 'string' && p.trim())) return null;
  return { caminho: caminho as string[], confianca: clamp(Number(confianca) || 0) };
}

export function parseBatchResponse(text: string, batch: BatchEntry[]): Map<string, BatchResult> {
  const results = new Map<string, BatchResult>();
  const data = extractJson(text) as { resultados?: unknown } | null;
  if (!data || !Array.isArray(data.resultados)) return results;
  const byId = new Map(batch.map((entry) => [entry.item.id, new Set(entry.candidatos.map((c) => c.id))]));
  for (const raw of data.resultados) {
    if (!raw || typeof raw !== 'object') continue;
    const { id, assuntos, proposta } = raw as { id?: unknown; assuntos?: unknown; proposta?: unknown };
    const allowed = typeof id === 'string' ? byId.get(id) : undefined;
    if (!allowed || results.has(id as string)) continue;
    const escolhidos = (Array.isArray(assuntos) ? assuntos : [])
      .filter((a): a is { id: string; confianca: unknown } => !!a && typeof a === 'object' && typeof (a as { id?: unknown }).id === 'string')
      .filter((a) => allowed.has(a.id))
      .map((a) => ({ id: a.id, confianca: clamp(Number(a.confianca) || 0) }))
      .slice(0, MAX_ASSUNTOS);
    results.set(id as string, { assuntos: escolhidos, proposta: parseProposta(proposta) });
  }
  return results;
}
