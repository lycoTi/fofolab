import type { LawCatalogEntry } from './types';

/**
 * Catálogo das normas federais basilares mais cobradas em concursos públicos (CF/88, Administrativo, etc.).
 * O app faz o download sob demanda apenas das normas que o edital ativo do estudante exigir.
 */
export const CORE_LAWS_CATALOG: LawCatalogEntry[] = [
  {
    id: 'cf88',
    shortName: 'CF/88',
    title: 'Constituição da República Federativa do Brasil de 1988',
    githubPath: 'constituicao.md',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    year: 1988,
  },
  {
    id: 'lei-8112-1990',
    shortName: 'Lei 8.112/1990',
    title: 'Regime Jurídico dos Servidores Públicos Civis da União',
    githubPath: 'federal/leis-ordinarias/1990/8112.md',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm',
    year: 1990,
  },
  {
    id: 'lei-9784-1999',
    shortName: 'Lei 9.784/1999',
    title: 'Processo Administrativo no âmbito da Administração Pública Federal',
    githubPath: 'federal/leis-ordinarias/1999/9784.md',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm',
    year: 1999,
  },
  {
    id: 'lei-14133-2021',
    shortName: 'Lei 14.133/2021',
    title: 'Nova Lei de Licitações e Contratos Administrativos',
    githubPath: 'federal/leis-ordinarias/2021/14133.md',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    year: 2021,
  },
  {
    id: 'lei-8429-1992',
    shortName: 'Lei 8.429/1992',
    title: 'Lei de Improbidade Administrativa',
    githubPath: 'federal/leis-ordinarias/1992/8429.md',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',
    year: 1992,
  },
  {
    id: 'lei-12527-2011',
    shortName: 'Lei 12.527/2011',
    title: 'Lei de Acesso à Informação (LAI)',
    githubPath: 'federal/leis-ordinarias/2011/12527.md',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm',
    year: 2011,
  },
];

const CATALOG_BY_ID = new Map(CORE_LAWS_CATALOG.map((entry) => [entry.id, entry]));

/** Recupera a entrada do catálogo pelo ID. */
export function getLawCatalogEntry(id: string): LawCatalogEntry | undefined {
  return CATALOG_BY_ID.get(id);
}
