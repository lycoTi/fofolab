import { normalizeArticleKey } from './parser';

export interface DetectedLawReference {
  lawId: string;
  articleKey: string;
  rawReference: string;
}

interface LawPattern {
  lawId: string;
  regex: RegExp;
  acronymRegex?: RegExp;
}

const LAW_PATTERNS: LawPattern[] = [
  {
    lawId: 'cf88',
    regex: /(?:constitui[çc][ãa]o(?:\s+federal|\s+da\s+rep[úu]blica)?(?:\s+de\s+1988)?|carta\s+magna|cf\s*(?:\/|\s*)?88)/iu,
  },
  {
    lawId: 'lei-8112-1990',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?8\.?112(?:\/(?:19)?9[0-9])?|estatuto\s+dos\s+servidores(?:\s+da\s+uni[ãa]o)?|regime\s+jur[íi]dico\s+[úu]nico)/iu,
    acronymRegex: /(?<!\p{L})RJU(?!\p{L})/u,
  },
  {
    lawId: 'lei-9784-1999',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?9\.?784(?:\/(?:19)?9[0-9])?|processo\s+administrativo(?:\s+federal)?)/iu,
  },
  {
    lawId: 'lei-14133-2021',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?14\.?133(?:\/(?:20)?2[0-9])?|nova\s+lei\s+de\s+licita[çc][õo]es|lei\s+de\s+licita[çc][õo]es)/iu,
    acronymRegex: /(?<!\p{L})NLLC(?!\p{L})/u,
  },
  {
    lawId: 'lei-8429-1992',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?8\.?429(?:\/(?:19)?9[0-9])?|lei\s+de\s+improbidade(?:\s+administrativa)?)/iu,
    acronymRegex: /(?<!\p{L})LIA(?!\p{L})/u,
  },
  {
    lawId: 'lei-12527-2011',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?12\.?527(?:\/(?:20)?1[0-9])?|lei\s+de\s+acesso\s+[àa]\s+informa[çc][ãa]o)/iu,
    acronymRegex: /(?<!\p{L})LAI(?!\p{L})/u,
  },
  {
    lawId: 'lei-13709-2018',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?13\.?709(?:\/(?:20)?1[89])?|lei\s+geral\s+de\s+prote[çc][ãa]o\s+de\s+dados)/iu,
    acronymRegex: /(?<!\p{L})LGPD(?!\p{L})/u,
  },
  {
    lawId: 'lei-12965-2014',
    regex: /(?:lei\s+(?:n[ºo°.]\s*)?12\.?965(?:\/(?:20)?1[4-9])?|marco\s+civil(?:\s+da\s+internet)?)/iu,
    acronymRegex: /(?<!\p{L})MCI(?!\p{L})/u,
  },
];

const ARTICLE_PATTERN = /(?:art(?:igo)?s?\.?\s*)(\d+[a-z0-9\-]*)(?:(?:\s*,\s*|\s+e\s+)(\d+[a-z0-9\-]*))?/gi;

interface LawOccurrence {
  lawId: string;
  index: number;
}

interface ArticleOccurrence {
  key: string;
  index: number;
}

/**
 * Detecta referências explícitas a normas e artigos em um texto (enunciado de questão ou anotações).
 * Exemplo: "conforme o art. 37, § 6º da CF/88" -> { lawId: 'cf88', articleKey: '37' }
 */
export function detectLawReferences(text: string): DetectedLawReference[] {
  if (!text || text.trim().length === 0) return [];

  const lawOccurrences: LawOccurrence[] = [];
  for (const { lawId, regex, acronymRegex } of LAW_PATTERNS) {
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const globalRegex = new RegExp(regex.source, flags);
    let m: RegExpExecArray | null;
    while ((m = globalRegex.exec(text)) !== null) {
      lawOccurrences.push({ lawId, index: m.index });
    }
    if (acronymRegex) {
      const aFlags = acronymRegex.flags.includes('g') ? acronymRegex.flags : acronymRegex.flags + 'g';
      const globalAcronym = new RegExp(acronymRegex.source, aFlags);
      while ((m = globalAcronym.exec(text)) !== null) {
        lawOccurrences.push({ lawId, index: m.index });
      }
    }
  }

  if (lawOccurrences.length === 0) {
    return [];
  }

  const uniqueLaws = Array.from(new Set(lawOccurrences.map((o) => o.lawId)));

  const articleOccurrences: ArticleOccurrence[] = [];
  let match: RegExpExecArray | null;
  ARTICLE_PATTERN.lastIndex = 0;

  while ((match = ARTICLE_PATTERN.exec(text)) !== null) {
    const rawNum1 = match[1];
    const key1 = normalizeArticleKey(rawNum1);
    articleOccurrences.push({ key: key1, index: match.index });
    if (match[2]) {
      const key2 = normalizeArticleKey(match[2]);
      articleOccurrences.push({ key: key2, index: match.index });
    }
  }

  if (articleOccurrences.length === 0) {
    // Se a norma foi citada sem artigo específico, entrega o Art. 1º (conceito/escopo basilar da lei)
    return uniqueLaws.slice(0, 3).map((lawId) => ({
      lawId,
      articleKey: '1',
      rawReference: `Art. 1 (${lawId})`,
    }));
  }

  // Caso 1: Apenas uma lei detectada no texto inteiro
  if (uniqueLaws.length === 1) {
    const lawId = uniqueLaws[0];
    const seenArticles = new Set<string>();
    const results: DetectedLawReference[] = [];
    for (const art of articleOccurrences) {
      if (!seenArticles.has(art.key)) {
        seenArticles.add(art.key);
        results.push({
          lawId,
          articleKey: art.key,
          rawReference: `Art. ${art.key} (${lawId})`,
        });
      }
    }
    return results.slice(0, 3);
  }

  // Caso 2: Múltiplas leis detectadas — associação por proximidade física no texto
  // Evita o produto cartesiano onde Lei 8.112 ganhava "Art. 37" só porque CF/88 Art. 37 foi citado antes
  const results: DetectedLawReference[] = [];
  const pairedLaws = new Set<string>();
  const seenPairs = new Set<string>();

  for (const art of articleOccurrences) {
    // Encontra a ocorrência de lei mais próxima deste artigo
    let closestLawId: string | null = null;
    let minDistance = Infinity;

    for (const lawOcc of lawOccurrences) {
      const dist = Math.abs(art.index - lawOcc.index);
      if (dist < minDistance) {
        minDistance = dist;
        closestLawId = lawOcc.lawId;
      }
    }

    if (closestLawId && minDistance <= 160) {
      const pairKey = `${closestLawId}:${art.key}`;
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        pairedLaws.add(closestLawId);
        results.push({
          lawId: closestLawId,
          articleKey: art.key,
          rawReference: `Art. ${art.key} (${closestLawId})`,
        });
      }
    }
  }

  // Leis detectadas que não tinham nenhum artigo próximo ganham Art. 1º (fallback individual)
  for (const lawId of uniqueLaws) {
    if (!pairedLaws.has(lawId)) {
      const pairKey = `${lawId}:1`;
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        results.push({
          lawId,
          articleKey: '1',
          rawReference: `Art. 1 (${lawId})`,
        });
      }
    }
  }

  return results.slice(0, 3);
}
