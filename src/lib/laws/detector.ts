import { normalizeArticleKey } from './parser';

export interface DetectedLawReference {
  lawId: string;
  articleKey: string;
  rawReference: string;
}

interface LawPattern {
  lawId: string;
  regex: RegExp;
}

const LAW_PATTERNS: LawPattern[] = [
  {
    lawId: 'cf88',
    regex: /(?:constitui[çc][ãa]o(?:\s+federal)?(?:\s+de\s+1988)?|cf\s*(?:\/|\s*)?88|carta\s+magna)/i,
  },
  {
    lawId: 'lei-8112-1990',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?8\.?112(?:\/90|\/1990)?|estatuto\s+dos\s+servidores(?:\s+da\s+uni[ãa]o)?)/i,
  },
  {
    lawId: 'lei-9784-1999',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?9\.?784(?:\/99|\/1999)?|processo\s+administrativo\s+federal)/i,
  },
  {
    lawId: 'lei-14133-2021',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?14\.?133(?:\/21|\/2021)?|nova\s+lei\s+de\s+licita[çc][õo]es)/i,
  },
  {
    lawId: 'lei-8429-1992',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?8\.?429(?:\/92|\/1992)?|lei\s+de\s+improbidade(?:\s+administrativa)?|\blia\b)/i,
  },
  {
    lawId: 'lei-12527-2011',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?12\.?527(?:\/11|\/2011)?|lei\s+de\s+acesso\s+[àa]\s+informa[çc][ãa]o|\blai\b)/i,
  },
];

const ARTICLE_PATTERN = /(?:art(?:igo)?s?\.?\s*)(\d+[a-z0-9\-]*)(?:(?:\s*,\s*|\s+e\s+)(\d+[a-z0-9\-]*))?/gi;

/**
 * Detecta referências explícitas a normas e artigos em um texto (enunciado de questão ou anotações).
 * Exemplo: "conforme o art. 37, § 6º da CF/88" -> { lawId: 'cf88', articleKey: '37' }
 */
export function detectLawReferences(text: string): DetectedLawReference[] {
  if (!text || text.trim().length === 0) return [];

  const detectedLaws: string[] = [];
  for (const { lawId, regex } of LAW_PATTERNS) {
    if (regex.test(text)) {
      detectedLaws.push(lawId);
    }
  }

  if (detectedLaws.length === 0) {
    return [];
  }

  const articlesFound: string[] = [];
  let match: RegExpExecArray | null;
  ARTICLE_PATTERN.lastIndex = 0;

  while ((match = ARTICLE_PATTERN.exec(text)) !== null) {
    const rawNum1 = match[1];
    const key1 = normalizeArticleKey(rawNum1);
    if (!articlesFound.includes(key1)) {
      articlesFound.push(key1);
    }
    if (match[2]) {
      const key2 = normalizeArticleKey(match[2]);
      if (!articlesFound.includes(key2)) {
        articlesFound.push(key2);
      }
    }
  }

  if (articlesFound.length === 0) {
    return [];
  }

  const results: DetectedLawReference[] = [];
  for (const lawId of detectedLaws) {
    for (const articleKey of articlesFound) {
      results.push({
        lawId,
        articleKey,
        rawReference: `Art. ${articleKey} (${lawId})`,
      });
    }
  }

  return results.slice(0, 3);
}
