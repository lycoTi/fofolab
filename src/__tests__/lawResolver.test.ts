import { describe, expect, it } from 'vitest';
import { resolveLawExcerpts } from '../lib/laws/resolver';
import type { LawsStore } from '../lib/laws/store';
import type { ParsedLaw } from '../lib/laws/types';

const mockCf88: ParsedLaw = {
  id: 'cf88',
  title: 'Constituição da República Federativa do Brasil de 1988',
  shortName: 'CF/88',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
  articleCount: 2,
  articles: {
    '5': {
      key: '5',
      label: 'Art. 5º',
      caput: 'Todos são iguais perante a lei.',
      fullText: 'Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza.',
    },
    '37': {
      key: '37',
      label: 'Art. 37',
      caput: 'A administração pública direta e indireta obedecerá aos princípios de legalidade e moralidade.',
      fullText: 'Art. 37. A administração pública direta e indireta obedecerá aos princípios de legalidade e moralidade.\n§ 6º As pessoas jurídicas de direito público responderão pelos danos causados por seus agentes.',
    },
  },
};

const mockLei8112: ParsedLaw = {
  id: 'lei-8112-1990',
  title: 'Lei nº 8.112, de 11 de dezembro de 1990',
  shortName: 'Lei 8.112/1990',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm',
  articleCount: 1,
  articles: {
    '20': {
      key: '20',
      label: 'Art. 20',
      caput: 'Ao entrar em exercício, o servidor nomeado para cargo efetivo ficará sujeito a estágio probatório.',
      fullText: 'Art. 20. Ao entrar em exercício, o servidor nomeado para cargo efetivo ficará sujeito a estágio probatório.',
    },
  },
};

function createMockLawsStore(): LawsStore {
  const laws = new Map<string, ParsedLaw>([
    ['cf88', mockCf88],
    ['lei-8112-1990', mockLei8112],
  ]);

  return {
    getLaw: async (id) => laws.get(id) ?? null,
    hasLaw: async (id) => laws.has(id),
    saveLaw: async (law) => {
      laws.set(law.id, law);
    },
    fetchAndStoreLaw: async (id) => {
      const law = laws.get(id);
      if (!law) throw new Error(`Lei ${id} não encontrada`);
      return law;
    },
    listStoredLaws: async () => [],
    clearStoredLaws: async () => {
      laws.clear();
    },
  };
}

describe('Resolvedor de Artigos e Letra da Lei (Fatia 11.2.3)', () => {
  it('resolve fragmento oficial quando o enunciado cita artigo da CF/88', async () => {
    const store = createMockLawsStore();
    const excerpts = await resolveLawExcerpts({
      text: 'Conforme preceitua o art. 37 da CF/88 sobre responsabilidade:',
      store,
    });

    expect(excerpts).toHaveLength(1);
    expect(excerpts[0].lawName).toBe('CF/88');
    expect(excerpts[0].article).toBe('Art. 37');
    expect(excerpts[0].text).toContain('§ 6º As pessoas jurídicas de direito público responderão');
    expect(excerpts[0].sourceUrl).toContain('constituicao.htm#art37');
  });

  it('resolve fragmento oficial da Lei 8.112 quando citada na questão', async () => {
    const store = createMockLawsStore();
    const excerpts = await resolveLawExcerpts({
      text: 'Nos termos do art. 20 da Lei 8.112/1990, julgue o item relativo ao estágio probatório:',
      store,
    });

    expect(excerpts).toHaveLength(1);
    expect(excerpts[0].lawName).toBe('Lei 8.112/1990');
    expect(excerpts[0].article).toBe('Art. 20');
    expect(excerpts[0].text).toContain('estágio probatório');
    expect(excerpts[0].sourceUrl).toContain('l8112cons.htm#art20');
  });

  it('usa fallback heurístico por tópico do edital quando a questão não cita artigo explicitamente', async () => {
    const store = createMockLawsStore();
    const excerpts = await resolveLawExcerpts({
      text: 'Julgue o item a respeito da responsabilidade civil da administração.',
      topicTitle: 'Direito Administrativo - Responsabilidade Civil do Estado',
      store,
    });

    expect(excerpts).toHaveLength(1);
    expect(excerpts[0].lawName).toBe('CF/88');
    expect(excerpts[0].article).toBe('Art. 37');
  });

  it('faz fallback gracioso para o primeiro artigo disponível quando o artigo específico não está no arquivo', async () => {
    const store = createMockLawsStore();
    // mockLei8112 só tem o Art. 20 cadastrado; buscando menção geral sem número (que pede o Art. 1)
    const excerpts = await resolveLawExcerpts({
      text: 'O que diz a Lei 8.112/1990 sobre servidores?',
      store,
    });

    expect(excerpts).toHaveLength(1);
    expect(excerpts[0].lawName).toBe('Lei 8.112/1990');
    expect(excerpts[0].article).toBe('Art. 20');
  });

  it('retorna array vazio quando nem o texto nem o tópico têm relação com legislação cadastrada', async () => {
    const store = createMockLawsStore();
    const excerpts = await resolveLawExcerpts({
      text: 'A complexidade de tempo do QuickSort no pior caso é O(n^2).',
      topicTitle: 'Estruturas de Dados e Algoritmos',
      store,
    });

    expect(excerpts).toEqual([]);
  });
});

