import { describe, expect, it } from 'vitest';
import { chooseMode, isRetrievalQuestion, type ModeSignals } from '../lib/fofoia/signals';
import { buildFofoPrompt } from '../lib/fofoia/prompts';
import { demoFofoReply } from '../lib/fofoia/demo';
import type { FofoContext } from '../lib/fofoia/context';

describe('Ciclo Socrático de Fixação da FofoIA (Retrieval Practice Multi-Turn)', () => {
  const baseSignals: ModeSignals = {
    requested: null,
    text: '',
    topicMastery: 50,
    firstContact: false,
    activeQuestion: null,
    followUps: 0,
  };

  const dummyContext: FofoContext = {
    student: {
      planTitle: 'CGU',
      organ: 'CGU',
      examBoard: 'Cebraspe',
      roleTitle: 'Auditor',
      daysUntilExam: 50,
      weeklyHoursTarget: 21,
      currentSubjectName: 'Arquitetura',
      currentSubjectWeight: 2,
      currentSubjectMastery: 50,
      currentSubjectCoverage: 30,
      currentTopicCode: '1.1',
      currentTopicTitle: 'Ameaças e vulnerabilidades',
      currentTopicMastery: 50,
      currentTopicConfidence: 50,
      strongTopics: ['2.1 Criptografia'],
      priorityWeakTopics: [],
      relatedPrerequisites: [],
    },
    notebookExcerpt: 'SQL Injection: sanitizar entradas com prepared statements.',
    prerequisites: [],
    activeQuestion: null,
  };

  it('reconhece gatilhos de recuperação ativa / testar se fixei', () => {
    expect(isRetrievalQuestion('testar se fixei')).toBe(true);
    expect(isRetrievalQuestion('me teste')).toBe(true);
    expect(isRetrievalQuestion('pergunta de fixacao')).toBe(true);
    expect(isRetrievalQuestion('como funciona o sql injection?')).toBe(false);
  });

  it('escolhe RETRIEVAL ao pedir para testar a fixação', () => {
    const mode = chooseMode({
      ...baseSignals,
      text: 'quero testar se fixei esse conceito',
    });
    expect(mode).toBe('RETRIEVAL');
  });

  it('mantém RETRIEVAL quando o estudante responde ao desafio anterior (isAnsweringRetrieval)', () => {
    const mode = chooseMode({
      ...baseSignals,
      text: 'acho que é nulo porque faltou a competência legal',
      isAnsweringRetrieval: true,
    });
    expect(mode).toBe('RETRIEVAL');
  });

  it('gera prompt de proposta de micro-cenário na primeira mensagem de RETRIEVAL', () => {
    const prompt = buildFofoPrompt(
      'RETRIEVAL',
      dummyContext,
      [],
      'testar se fixei',
      { isEvaluatingRetrieval: false }
    );
    expect(prompt).toContain('<jeito nome="Fixação">');
    expect(prompt).toContain('Proponha 1 único micro-cenário prático e inédito');
    expect(prompt).toContain('NUNCA dê a resposta nem a justificativa nesta mensagem');
  });

  it('gera prompt de avaliação quando o estudante está respondendo ao desafio (isEvaluatingRetrieval)', () => {
    const conversation = [
      { id: '1', role: 'student' as const, content: 'testar se fixei', createdAt: '' },
      {
        id: '2',
        role: 'tutor' as const,
        content: 'Imagine que um ato administrativo foi praticado sem motivação expressa. O ato é válido ou nulo? Pode responder de cabeça ou mandar aqui para conferir.',
        createdAt: '',
      },
    ];
    const prompt = buildFofoPrompt(
      'RETRIEVAL',
      dummyContext,
      conversation,
      'acho que é nulo porque a motivação é obrigatória',
      { isEvaluatingRetrieval: true }
    );
    expect(prompt).toContain('<jeito nome="Fixação">');
    expect(prompt).toContain('Avalie diretamente a resposta do estudante');
    expect(prompt).toContain('diga com clareza se o julgamento está correto');
    expect(prompt).not.toContain('NUNCA dê a resposta');
  });

  it('demoFofoReply responde com avaliação acolhedora em modo simulado', () => {
    const reply = demoFofoReply('RETRIEVAL', dummyContext, 'acho que é nulo', {
      isEvaluatingRetrieval: true,
    });
    expect(reply).toContain('Exato!');
    expect(reply).toContain('recuperação ativa');
  });
});
