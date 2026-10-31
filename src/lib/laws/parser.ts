import type { LawArticle, ParsedLaw, LawCatalogEntry } from './types';

/**
 * Normaliza referências a artigos para chave de busca rápida (ex.: "Art. 1º" -> "1", "Art. 37, § 6º" -> "37", "Art. 103-A" -> "103-a").
 */
export function normalizeArticleKey(input: string): string {
  const cleaned = input.trim();
  const match = cleaned.match(/(?:art(?:igo|\.)?\s*)?(\d+[a-z0-9\-]*)/i);
  if (!match) return cleaned.toLowerCase().replace(/[ºª°.]/g, '');
  return match[1]
    .toLowerCase()
    .replace(/[ºª°.]/g, '')
    .replace(/^(\d+)o$/, '$1');
}

interface FrontmatterResult {
  metadata: Record<string, string>;
  body: string;
}

/** Extrai cabeçalho YAML frontmatter se presente no início do Markdown. */
function extractFrontmatter(raw: string): FrontmatterResult {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return { metadata: {}, body: raw };
  }

  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { metadata: {}, body: raw };
  }

  const yamlContent = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 4).trimStart();
  const metadata: Record<string, string> = {};

  for (const line of yamlContent.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      metadata[key] = val;
    }
  }

  return { metadata, body };
}

const ARTICLE_LINE_REGEX = /^(?:#{1,4}\s*|\*{0,2})Art(?:igo|\.)\s*(\d+[a-zA-Z0-9\-\wºoªa]*)[.\s–—\*\:]\s*(.*)$/i;
const SUBDIVISION_REGEX = /^(?:§|Parágrafo|[IVXLCDM]+\s*[-–—.)])/i;

function extractCaput(lines: string[]): string {
  const caputLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (caputLines.length > 0 && SUBDIVISION_REGEX.test(trimmed)) {
      break;
    }
    caputLines.push(line);
  }
  return caputLines.join('\n').trim();
}

/**
 * Parser de arquivos Markdown da legislação brasileira (padrão ctresb/leis e Planalto).
 * Converte o texto integral em artigos estruturados e indexados por chave normalizada.
 */
export function parseLawMarkdown(
  rawMarkdown: string,
  fallback: Partial<LawCatalogEntry> = {}
): ParsedLaw {
  const { metadata, body } = extractFrontmatter(rawMarkdown);

  // Metadados com prioridade: frontmatter > fallback > detecção no corpo
  const firstTitleLine = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = metadata.titulo || fallback.title || firstTitleLine || 'Norma Federal';
  const shortName = fallback.shortName || metadata.sigla || title.slice(0, 30);
  const sourceMatch = body.match(/>\s*Fonte:\s*\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
  const rawSource = metadata.fonte || metadata.url || (sourceMatch ? sourceMatch[1] : '');
  const isNormasLeg = /normas\.leg\.br/i.test(rawSource);
  // Se o link vier do normas.leg.br (LexML que costuma travar em tela branca no navegador), prefere a URL direta do Planalto
  const sourceUrl = isNormasLeg && fallback.sourceUrl
    ? fallback.sourceUrl
    : (rawSource || fallback.sourceUrl || '');
  const urn = metadata.urn;
  const description = metadata.ementa || metadata.descricao;

  const rawLines = body.split('\n');
  const articles: Record<string, LawArticle> = {};

  let currentKey: string | null = null;
  let currentLabel = '';
  let currentLines: string[] = [];
  let isAdct = false;

  const flushCurrent = () => {
    if (!currentKey || currentLines.length === 0) return;
    const fullText = currentLines.join('\n').trim();
    const caput = extractCaput(currentLines);
    articles[currentKey] = {
      key: currentKey,
      label: currentLabel,
      fullText,
      caput,
    };
  };

  const STRUCTURAL_HEADER_REGEX = /^#{1,6}\s+|^[#\s]*(?:LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|PARTE)\s+[IVXLCDM\d]+/i;

  for (const line of rawLines) {
    if (/ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS/i.test(line)) {
      isAdct = true;
    }
    const trimmed = line.trim();
    const match = trimmed.match(ARTICLE_LINE_REGEX);
    if (match) {
      flushCurrent();
      const rawNum = match[1].replace(/[.]/g, '');
      const baseKey = normalizeArticleKey(rawNum);
      currentKey = isAdct ? `adct-${baseKey}` : baseKey;
      currentLabel = isAdct ? `ADCT Art. ${rawNum}` : `Art. ${rawNum}`;
      currentLines = [line];
    } else if (STRUCTURAL_HEADER_REGEX.test(trimmed)) {
      // Cabeçalho estrutural de capítulo/seção (ex.: "#### CAPÍTULO IV — DA SUBSTITUIÇÃO")
      // Encerra o artigo anterior para não vazar títulos de capítulos subsequentes no texto do artigo
      flushCurrent();
      currentKey = null;
      currentLines = [];
    } else if (currentKey) {
      currentLines.push(line);
    }
  }
  flushCurrent();

  const articleKeys = Object.keys(articles);

  return {
    id: fallback.id || normalizeArticleKey(shortName),
    title,
    shortName,
    year: fallback.year,
    sourceUrl,
    urn,
    description,
    articles,
    articleCount: articleKeys.length,
  };
}
