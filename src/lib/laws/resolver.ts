import type { LawExcerpt } from '../fofoia/context';
import { detectLawReferences } from './detector';
import { getActiveLawsStore, type LawsStore } from './store';
import type { ParsedLaw } from './types';

interface TopicLawMapping {
  keywords: RegExp;
  lawId: string;
  articleKey: string;
}

const TOPIC_LAW_MAPPINGS: TopicLawMapping[] = [
  {
    keywords: /responsabilidade\s+civil(?:\s+do\s+estado)?/i,
    lawId: 'cf88',
    articleKey: '37',
  },
  {
    keywords: /princ[íi]pios(?:\s+da\s+administra[çc][ãa]o\s+p[úu]blica)?/i,
    lawId: 'cf88',
    articleKey: '37',
  },
  {
    keywords: /direitos\s+e\s+garantias\s+fundamentais|rem[ée]dios\s+constitucionais/i,
    lawId: 'cf88',
    articleKey: '5',
  },
  {
    keywords: /estabilidade|est[áa]gio\s+probat[óo]rio/i,
    lawId: 'lei-8112-1990',
    articleKey: '20',
  },
  {
    keywords: /provimento|vac[âa]ncia/i,
    lawId: 'lei-8112-1990',
    articleKey: '8',
  },
  {
    keywords: /regime\s+disciplinar|demiss[ãa]o|penalidades/i,
    lawId: 'lei-8112-1990',
    articleKey: '127',
  },
  {
    keywords: /processo\s+administrativo/i,
    lawId: 'lei-9784-1999',
    articleKey: '2',
  },
  {
    keywords: /inexigibilidade|dispensa\s+de\s+licita[çc][ãa]o/i,
    lawId: 'lei-14133-2021',
    articleKey: '74',
  },
  {
    keywords: /improbidade\s+administrativa/i,
    lawId: 'lei-8429-1992',
    articleKey: '9',
  },
  {
    keywords: /acesso\s+[àa]\s+informa[çc][ãa]o/i,
    lawId: 'lei-12527-2011',
    articleKey: '10',
  },
];

export function buildLawExcerpt(law: ParsedLaw, articleKey: string): LawExcerpt | null {
  const article = law.articles[articleKey];
  if (!article) return null;

  const sourceUrl = law.sourceUrl
    ? `${law.sourceUrl}#art${articleKey}`
    : '';

  return {
    lawName: law.shortName,
    article: article.label,
    text: article.fullText,
    sourceUrl: sourceUrl || undefined,
  };
}

export interface ResolveLawExcerptsInput {
  text?: string;
  topicTitle?: string;
  store?: LawsStore;
}

/**
 * Resolve e extrai fragmentos oficiais da lei (LawExcerpt[]) para fundamentar a FofoIA.
 * 1º tenta referências explícitas no texto da questão (enunciado/alternativas).
 * 2º tenta mapeamento heurístico pelo tópico de estudo do edital.
 */
export async function resolveLawExcerpts(input: ResolveLawExcerptsInput): Promise<LawExcerpt[]> {
  const store = input.store ?? (await getActiveLawsStore());
  const excerpts: LawExcerpt[] = [];

  // 1. Detecção explícita no texto (enunciado + alternativas)
  if (input.text && input.text.trim().length > 0) {
    const detected = detectLawReferences(input.text);
    for (const ref of detected) {
      if (excerpts.length >= 3) break;
      try {
        const law = await store.fetchAndStoreLaw(ref.lawId);
        const excerpt = buildLawExcerpt(law, ref.articleKey);
        if (excerpt && !excerpts.some((e) => e.lawName === excerpt.lawName && e.article === excerpt.article)) {
          excerpts.push(excerpt);
        }
      } catch {
        // Falha graciosa: se não deu para baixar ou não achou artigo, não trava o app
      }
    }
  }

  // 2. Fallback por palavras-chave do tópico do edital se não houver referências explícitas
  if (excerpts.length === 0 && input.topicTitle) {
    for (const mapping of TOPIC_LAW_MAPPINGS) {
      if (excerpts.length >= 2) break;
      if (mapping.keywords.test(input.topicTitle)) {
        try {
          const law = await store.fetchAndStoreLaw(mapping.lawId);
          const excerpt = buildLawExcerpt(law, mapping.articleKey);
          if (excerpt && !excerpts.some((e) => e.lawName === excerpt.lawName && e.article === excerpt.article)) {
            excerpts.push(excerpt);
          }
        } catch {
          // Falha graciosa
        }
      }
    }
  }

  return excerpts.slice(0, 3);
}

