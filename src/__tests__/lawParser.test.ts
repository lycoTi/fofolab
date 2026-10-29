import { describe, expect, it } from 'vitest';
import { normalizeArticleKey, parseLawMarkdown } from '../lib/laws/parser';

describe('Parser da Letra da Lei (Fatia 11.2.2)', () => {
  describe('normalizeArticleKey', () => {
    it('normaliza números e rótulos de artigos para chaves consistentes', () => {
      expect(normalizeArticleKey('1')).toBe('1');
      expect(normalizeArticleKey('1º')).toBe('1');
      expect(normalizeArticleKey('1o')).toBe('1');
      expect(normalizeArticleKey('Art. 1º')).toBe('1');
      expect(normalizeArticleKey('Art. 37.')).toBe('37');
      expect(normalizeArticleKey('Artigo 37')).toBe('37');
      expect(normalizeArticleKey('Art. 103-A')).toBe('103-a');
      expect(normalizeArticleKey('art. 37, § 6º')).toBe('37');
      expect(normalizeArticleKey('Art. 5º, inc. X')).toBe('5');
    });
  });

  describe('parseLawMarkdown com frontmatter (padrão Lei 8.112)', () => {
    const rawMarkdown = `---
fonte: https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm
urn: urn:lex:br:federal:lei:1990-12-11;8112
titulo: Lei nº 8.112, de 11 de dezembro de 1990
ementa: Dispõe sobre o regime jurídico dos servidores públicos civis da União.
---

# LEI Nº 8.112, DE 11 DE DEZEMBRO DE 1990

Dispõe sobre o regime jurídico dos servidores públicos civis da União...

TÍTULO I
Disposições Preliminares

Art. 1º Esta Lei institui o Regime Jurídico dos Servidores Públicos Civis da União, das autarquias e das fundações públicas federais.

Art. 2º Para os efeitos desta Lei, servidor é a pessoa legalmente investida em cargo público.

Art. 3º Cargo público é o conjunto de atribuições e responsabilidades previstas na estrutura organizacional que devem ser cometidas a um servidor.

Parágrafo único. Os cargos públicos, acessíveis a todos os brasileiros, são criados por lei, com denominação própria e vencimento pago pelos cofres públicos.

Art. 4º É proibida a prestação de serviços gratuitos, salvo os casos previstos em lei.
`;

    it('extrai metadados do cabeçalho YAML e indexa os artigos', () => {
      const parsed = parseLawMarkdown(rawMarkdown, {
        id: 'lei-8112-1990',
        shortName: 'Lei 8.112/1990',
        year: 1990,
      });

      expect(parsed.id).toBe('lei-8112-1990');
      expect(parsed.shortName).toBe('Lei 8.112/1990');
      expect(parsed.title).toBe('Lei nº 8.112, de 11 de dezembro de 1990');
      expect(parsed.sourceUrl).toBe('https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm');
      expect(parsed.urn).toBe('urn:lex:br:federal:lei:1990-12-11;8112');
      expect(parsed.articleCount).toBe(4);

      // Artigo 1º
      const art1 = parsed.articles['1'];
      expect(art1).toBeDefined();
      expect(art1.label).toBe('Art. 1º');
      expect(art1.caput).toContain('Esta Lei institui o Regime Jurídico');

      // Artigo 3º (com Parágrafo único)
      const art3 = parsed.articles['3'];
      expect(art3).toBeDefined();
      expect(art3.caput).toBe(
        'Art. 3º Cargo público é o conjunto de atribuições e responsabilidades previstas na estrutura organizacional que devem ser cometidas a um servidor.'
      );
      expect(art3.fullText).toContain('Parágrafo único. Os cargos públicos');
    });
  });

  describe('parseLawMarkdown sem frontmatter (padrão constituicao.md)', () => {
    const rawConstituicao = `# CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988

NÓS, OS REPRESENTANTES DO POVO BRASILEIRO...

TÍTULO I
Dos Princípios Fundamentais

Art. 1º A República Federativa do Brasil tem como fundamentos:
I - a soberania;
II - a cidadania;
III - a dignidade da pessoa humana;
IV - os valores sociais do trabalho;
V - o pluralismo político.

Parágrafo único. Todo o poder emana do povo.

Art. 2º São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.

TÍTULO III
Da Organização do Estado

Art. 37. A administração pública direta e indireta obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência.

§ 1º A publicidade dos atos deverá ter caráter educativo.

§ 6º As pessoas jurídicas de direito público responderão pelos danos que seus agentes causarem a terceiros.
`;

    it('extrai título do documento e isola artigos com parágrafos e incisos', () => {
      const parsed = parseLawMarkdown(rawConstituicao, {
        id: 'cf88',
        shortName: 'CF/88',
        sourceUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
        year: 1988,
      });

      expect(parsed.id).toBe('cf88');
      expect(parsed.shortName).toBe('CF/88');
      expect(parsed.title).toBe('CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988');
      expect(parsed.sourceUrl).toBe('https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm');
      expect(parsed.articleCount).toBe(3);

      // Art. 1º
      const art1 = parsed.articles['1'];
      expect(art1).toBeDefined();
      expect(art1.caput).toBe('Art. 1º A República Federativa do Brasil tem como fundamentos:');
      expect(art1.fullText).toContain('I - a soberania;');
      expect(art1.fullText).toContain('Parágrafo único. Todo o poder emana do povo.');

      // Art. 37
      const art37 = parsed.articles['37'];
      expect(art37).toBeDefined();
      expect(art37.label).toBe('Art. 37');
      expect(art37.caput).toBe(
        'Art. 37. A administração pública direta e indireta obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência.'
      );
      expect(art37.fullText).toContain('§ 1º A publicidade dos atos');
      expect(art37.fullText).toContain('§ 6º As pessoas jurídicas de direito público');
    });
  });
});
