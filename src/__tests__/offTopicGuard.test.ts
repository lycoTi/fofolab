import { describe, expect, it } from 'vitest';
import { checkOffTopic, formatOffTopicReply, isOffTopicQuery } from '../lib/fofoia/offTopicGuard';

describe('Guarda Local Anti-Desvio da FofoIA (Zero-Token Off-Topic Shield)', () => {
  const defaultOpts = {
    currentTopicTitle: '1.1 Ameaças e vulnerabilidades em aplicações e interfaces',
    currentTopicCode: '1.1',
  };

  describe('Detecção de desvios clássicos alheios a estudos e editais', () => {
    it('bloqueia receitas culinárias e preparo de alimentos', () => {
      const queries = [
        'como fazer bolo de cenoura com cobertura de chocolate?',
        'receita de strogonoff de frango simples',
        'qual o modo de preparo de lasanha?',
        'como cozinhar feijao na panela de pressao',
        'ingredientes para torta de limao',
      ];
      for (const q of queries) {
        expect(isOffTopicQuery(q, defaultOpts)).toBe(true);
        const res = checkOffTopic(q, defaultOpts);
        expect(res.isOffTopic).toBe(true);
        expect(res.category).toBe('CULINARY');
      }
    });

    it('bloqueia apostas, jogos de azar e promessas de dinheiro fácil', () => {
      const queries = [
        'qual a melhor dica do jogo do tigrinho para ganhar dinheiro?',
        'como ganhar no jogo do bicho hoje',
        'palpite de aposta esportiva para o jogo de hoje',
        'como ficar rico rapido sem trabalhar',
      ];
      for (const q of queries) {
        expect(isOffTopicQuery(q, defaultOpts)).toBe(true);
        const res = checkOffTopic(q, defaultOpts);
        expect(res.isOffTopic).toBe(true);
        expect(res.category).toBe('BETTING_GAMBLING');
      }
    });

    it('bloqueia horóscopos, astrologia e esoterismo', () => {
      const queries = [
        'qual a previsão do horóscopo para o signo de leão hoje?',
        'como fazer meu mapa astral completo',
        'tarot do amor para esta semana',
        'simpatia para ganhar dinheiro urgente',
      ];
      for (const q of queries) {
        expect(isOffTopicQuery(q, defaultOpts)).toBe(true);
        const res = checkOffTopic(q, defaultOpts);
        expect(res.isOffTopic).toBe(true);
        expect(res.category).toBe('ESOTERIC');
      }
    });

    it('bloqueia placar esportivo e fofocas de celebridades', () => {
      const queries = [
        'quem ganhou o jogo do flamengo ontem a noite?',
        'qual o placar do jogo do corinthians?',
        'quem foi eliminado do bbb ontem?',
        'fofoca de celebridades e famosos do momento',
      ];
      for (const q of queries) {
        expect(isOffTopicQuery(q, defaultOpts)).toBe(true);
        const res = checkOffTopic(q, defaultOpts);
        expect(res.isOffTopic).toBe(true);
        expect(res.category).toBe('ENTERTAINMENT_SPORTS');
      }
    });

    it('bloqueia prescrição médica e diagnósticos clínicos (segurança)', () => {
      const queries = [
        'qual remédio tomar para dor de cabeça forte?',
        'posso tomar amoxicilina sem receita médica?',
        'como curar infecção com remédio caseiro?',
      ];
      for (const q of queries) {
        expect(isOffTopicQuery(q, defaultOpts)).toBe(true);
        const res = checkOffTopic(q, defaultOpts);
        expect(res.isOffTopic).toBe(true);
        expect(res.category).toBe('HEALTH_PRESCRIPTION');
      }
    });
  });

  describe('Proteção contra falsos positivos (termos legítimos do edital e estudos)', () => {
    it('permite "receita" quando o tópico for Orçamento Público ou Direito Financeiro', () => {
      const orcamentoOpts = {
        currentTopicTitle: '1.2 Orçamento Público, Receita e Despesa Pública',
        currentTopicCode: '1.2',
      };
      const queries = [
        'qual a diferença entre receita originária e receita derivada?',
        'como é classificada a receita corrente no orçamento?',
        'o que é receita de capital?',
      ];
      for (const q of queries) {
        expect(isOffTopicQuery(q, orcamentoOpts)).toBe(false);
        expect(checkOffTopic(q, orcamentoOpts).isOffTopic).toBe(false);
      }
    });

    it('permite "bitcoin / blockchain" quando o tópico for Criptografia ou Finanças Digitais', () => {
      const cryptoOpts = {
        currentTopicTitle: '2.4 Criptografia, Hash e Blockchain',
        currentTopicCode: '2.4',
      };
      const q = 'como funciona a assinatura digital e o hash no blockchain do bitcoin?';
      expect(isOffTopicQuery(q, cryptoOpts)).toBe(false);
      expect(checkOffTopic(q, cryptoOpts).isOffTopic).toBe(false);
    });

    it('permite dúvidas comuns de estudo, leis, questões e concurso', () => {
      const legitimateQueries = [
        'o que é SQL Injection e como prevenir?',
        'qual a diferença entre processo e procedimento administrativo?',
        'me fale sobre o artigo 37 da constituicao federal',
        'como a banca cebraspe costuma cobrar esse ponto?',
        'não entendi nada, pode explicar do zero com uma metáfora?',
        'pode resumir para o meu caderno de revisão?',
        'isso cai no meu edital da cgu?',
        'oi, tudo bem?',
        'obrigado pela ajuda',
      ];
      for (const q of legitimateQueries) {
        expect(isOffTopicQuery(q, defaultOpts)).toBe(false);
        expect(checkOffTopic(q, defaultOpts).isOffTopic).toBe(false);
      }
    });
  });

  describe('Resposta formatada do Fofo', () => {
    it('gera resposta acolhedora citando o tópico ativo e sem emojis de UI', () => {
      const res = checkOffTopic('receita de pudim de leite condensado', defaultOpts);
      expect(res.isOffTopic).toBe(true);
      expect(res.reply).toBeTruthy();
      expect(res.reply).toContain('1.1 Ameaças e vulnerabilidades');
      expect(res.reply).toContain('edital');
      expect(res.reply).toContain('foco');
      // Respeita voz sem emojis decorativos nos callouts
      expect(res.reply).not.toContain('🍰');
      expect(res.reply).not.toContain('🚀');
    });
  });
});
