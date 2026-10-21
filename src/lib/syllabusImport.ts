import type { ImportTopicItem } from '../types/database';

/**
 * Converte o "conteúdo programático" colado do edital em tópicos verticalizados.
 * Aceita um tópico por linha (estilo FGV) e também tudo num parágrafo só (estilo Cebraspe:
 * "1 Conceitos de auditoria. 2 Normas. 2.1 ISSAI 100."). Números no meio do texto
 * ("Lei 14.133/2021", "NBC TA 530 Amostragem") não quebram o tópico: o corte só acontece
 * no início da linha ou depois de ". ", "; " ou ": " (fim do título da matéria), com número
 * seguido de letra maiúscula.
 *
 * É heurístico: a tela sempre mostra a prévia antes de gravar.
 */
const SEGMENT_START = /(^|[.;:]\s+)(\d+(?:\.\d+)*)\.?\s+(?=\p{Lu})/gu;
const LEADING_BULLET = /^\s*(?:[•●▪◦‣\-–—*]\s+)/;

function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/[\s.;,]+$/, '').trim();
}

function splitNumberedSegments(line: string): string[] {
  const cutPoints: number[] = [];
  SEGMENT_START.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SEGMENT_START.exec(line))) {
    cutPoints.push(match.index + match[1].length);
    if (match[0].length === 0) SEGMENT_START.lastIndex++;
  }
  if (cutPoints.length === 0) return [line];
  if (cutPoints[0] !== 0) cutPoints.unshift(0);

  return cutPoints
    .map((start, i) => line.slice(start, cutPoints[i + 1] ?? line.length).trim())
    .filter(Boolean);
}

function looksLikeHeader(segment: string): boolean {
  if (segment.endsWith(':')) return true;
  const letters = segment.replace(/[^\p{L}]/gu, '');
  const words = segment.split(/\s+/).length;
  return letters.length >= 4 && letters === letters.toUpperCase() && words <= 8;
}

export function parseSyllabusTopics(text: string): ImportTopicItem[] {
  const topics: ImportTopicItem[] = [];

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(LEADING_BULLET, '').trim();
    if (!line) continue;

    for (const segment of splitNumberedSegments(line)) {
      const numbered = /^(\d+(?:\.\d+)*)\.?\s*[-–)]?\s+(.+)$/su.exec(segment);
      if (numbered) {
        const title = cleanTitle(numbered[2]);
        if (title.length > 1) topics.push({ code: numbered[1], title });
        continue;
      }
      // Sem número: ignora cabeçalhos ("CONHECIMENTOS ESPECÍFICOS:", "AUDITORIA GOVERNAMENTAL")
      if (looksLikeHeader(segment)) continue;
      const title = cleanTitle(segment);
      if (title.length > 1) topics.push({ code: null, title });
    }
  }

  return topics;
}

/** Código do tópico pai ("2.1.3" → "2.1"; "2" → null). */
export function parentTopicCode(code: string | null): string | null {
  if (!code || !code.includes('.')) return null;
  return code.split('.').slice(0, -1).join('.');
}
