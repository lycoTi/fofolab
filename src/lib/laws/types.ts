/**
 * Tipos e contratos de dados para a legislação oficial (spec 11 §8 - Fatia 11.2).
 */

export interface LawArticle {
  /** Número normalizado para busca rápida (ex.: "1", "5", "37", "103-a"). */
  key: string;
  /** Rótulo legível original do artigo (ex.: "Art. 1º", "Art. 37", "Art. 103-A"). */
  label: string;
  /** Texto completo do artigo incluindo caput, parágrafos e incisos. */
  fullText: string;
  /** Apenas o caput (cabeça do artigo). */
  caput: string;
}

export interface ParsedLaw {
  /** Identificador único da norma (ex.: "cf88", "lei-8112-1990"). */
  id: string;
  /** Título oficial da norma. */
  title: string;
  /** Nome curto para exibição e prompts (ex.: "CF/88", "Lei 8.112/1990"). */
  shortName: string;
  /** Ano de promulgação/publicação. */
  year?: number;
  /** Link oficial para o texto compilado no Planalto ou Senado. */
  sourceUrl: string;
  /** Identificador URN LexML se disponível. */
  urn?: string;
  /** Ementa da norma se disponível. */
  description?: string;
  /** Artigos indexados por chave normalizada ("1", "37", etc.). */
  articles: Record<string, LawArticle>;
  /** Total de artigos encontrados. */
  articleCount: number;
}

export interface LawCatalogEntry {
  /** Identificador único correspondente (ex.: "cf88", "lei-8112-1990"). */
  id: string;
  /** Nome curto (ex.: "CF/88", "Lei 8.112/1990"). */
  shortName: string;
  /** Título da lei. */
  title: string;
  /** Caminho relativo no repositório ctresb/leis. */
  githubPath: string;
  /** Link oficial no portal do Planalto/Senado. */
  sourceUrl: string;
  /** Ano de publicação. */
  year: number;
}
