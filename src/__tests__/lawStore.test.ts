// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLawsStore, type LawsStore } from '../lib/laws/store';
import type { ParsedLaw } from '../lib/laws/types';

let dbCounter = 0;
const uniqueDbName = () => `fofolab-laws-test-${++dbCounter}`;

const mockLaw8112Markdown = `---
fonte: https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm
urn: urn:lex:br:federal:lei:1990-12-11;8112
titulo: Lei nº 8.112, de 11 de dezembro de 1990
---

# LEI Nº 8.112, DE 11 DE DEZEMBRO DE 1990

Art. 1º Esta Lei institui o Regime Jurídico dos Servidores Públicos Civis da União.

Art. 2º Para os efeitos desta Lei, servidor é a pessoa legalmente investida em cargo público.
`;

describe('Armazenamento Local e Download Sob Demanda de Leis (Fatia 11.2.2)', () => {
  let store: LawsStore;

  beforeEach(async () => {
    store = await createLawsStore({ dbName: uniqueDbName() });
    await store.clearStoredLaws();
  });

  it('salva e recupera uma lei no armazenamento local (offline)', async () => {
    const law: ParsedLaw = {
      id: 'cf88',
      title: 'Constituição Federal de 1988',
      shortName: 'CF/88',
      sourceUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
      articles: {
        '1': {
          key: '1',
          label: 'Art. 1º',
          caput: 'A República Federativa do Brasil tem como fundamentos:',
          fullText: 'Art. 1º A República Federativa do Brasil tem como fundamentos:\nI - a soberania;',
        },
      },
      articleCount: 1,
    };

    expect(await store.getLaw('cf88')).toBeNull();
    expect(await store.hasLaw('cf88')).toBe(false);

    await store.saveLaw(law);

    expect(await store.hasLaw('cf88')).toBe(true);
    const retrieved = await store.getLaw('cf88');
    expect(retrieved).toBeDefined();
    expect(retrieved?.shortName).toBe('CF/88');
    expect(retrieved?.articles['1']?.label).toBe('Art. 1º');
  });

  it('baixa sob demanda da fonte remota e guarda no cache local', async () => {
    const mockFetcher = vi.fn().mockResolvedValue(mockLaw8112Markdown);
    const customStore = await createLawsStore({
      dbName: uniqueDbName(),
      fetcher: mockFetcher,
    });

    // 1º acesso: busca na rede via fetcher
    const downloaded = await customStore.fetchAndStoreLaw('lei-8112-1990');
    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(downloaded.id).toBe('lei-8112-1990');
    expect(downloaded.articleCount).toBe(2);
    expect(downloaded.articles['1']?.caput).toContain('Regime Jurídico dos Servidores');

    // 2º acesso: recupera do cache local sem tocar no fetcher
    const fromCache = await customStore.fetchAndStoreLaw('lei-8112-1990');
    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(fromCache.id).toBe('lei-8112-1990');

    // Lista de leis baixadas
    const list = await customStore.listStoredLaws();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('lei-8112-1990');
    expect(list[0].articleCount).toBe(2);
  });

  it('lança erro acolhedor ao tentar baixar norma inexistente no catálogo', async () => {
    await expect(store.fetchAndStoreLaw('lei-inexistente-9999')).rejects.toThrow(
      'não encontrada no catálogo de legislação'
    );
  });
});
