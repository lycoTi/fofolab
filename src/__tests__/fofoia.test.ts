import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askFofoIa, isStrongMode } from '../lib/fofoia/ask';
import { buildFofoContext, NOTEBOOK_CONTEXT_CHARS } from '../lib/fofoia/context';
import { demoFofoReply } from '../lib/fofoia/demo';
import { matchEditalTopics, EDITAL_MAX_CANDIDATES, type EditalTopicEntry } from '../lib/fofoia/editalMatch';
import { buildFofoPrompt } from '../lib/fofoia/prompts';
import { chooseMode, isBasicQuestion, shouldSuggestLesson, type ModeSignals } from '../lib/fofoia/signals';
import { formatSummaryForNotebook, parseSummary } from '../lib/fofoia/summary';
import type { StudentContextSnapshot } from '../lib/aiRouter';
import type { Question, Topic } from '../types/database';

const student: StudentContextSnapshot = {
  planTitle: 'CGU', organ: 'CGU', examBoard: 'Cebraspe', roleTitle: 'Auditor', daysUntilExam: 50, weeklyHoursTarget: 21,
  currentSubjectName: 'Arquitetura', currentSubjectWeight: 2, currentSubjectMastery: 20, currentSubjectCoverage: 10,
  currentTopicCode: '1.1', currentTopicTitle: 'Monolitos e microsserviços', currentTopicMastery: 20, currentTopicConfidence: 5,
  strongTopics: ['2.1 Requisitos'], priorityWeakTopics: [], relatedPrerequisites: ['1.0 Arquitetura em camadas'],
};
const question = {
  id: 'q1', statement: 'Microsserviços se comunicam apenas de forma síncrona.', exam_board: 'Cebraspe', organ: 'CGU', exam_year: 2025,
  options_json: JSON.stringify(['C) Certo', 'E) Errado']), final_answer: 'E',
} as unknown as Question;

const signals = (over: Partial<ModeSignals> = {}): ModeSignals => ({
  requested: null, text: 'Qual a diferença entre orquestração e coreografia?', topicMastery: 70, firstContact: false, activeQuestion: null, followUps: 0, ...over,
});

describe('Sinais e jeito da FofoIA (spec 11 §5.2.1)', () => {
  it('reconhece pergunta "de base" sem depender de acento ou caixa', () => {
    for (const t of ['O que é um monolito?', 'não entendi nada disso', 'Me explica do zero', 'como funciona o JWT', 'Nunca vi isso']) expect(isBasicQuestion(t)).toBe(true);
    expect(isBasicQuestion('Qual a diferença entre orquestração e coreografia?')).toBe(false);
  });

  it('escolhe o jeito pelos sinais, com o pedido explícito na frente', () => {
    expect(chooseMode(signals())).toBe('QUICK');
    expect(chooseMode(signals({ text: 'o que é saga?' }))).toBe('FROM_ZERO');
    expect(chooseMode(signals({ topicMastery: 10 }))).toBe('FROM_ZERO');
    expect(chooseMode(signals({ firstContact: true }))).toBe('FROM_ZERO');
    expect(chooseMode(signals({ activeQuestion: { answered: true, diagnosis: 'MISCONCEPTION', falseCertainty: false } }))).toBe('FROM_ZERO');
    expect(chooseMode(signals({ activeQuestion: { answered: true, diagnosis: 'BASE_GAP', falseCertainty: true } }))).toBe('FROM_ZERO');
    expect(chooseMode(signals({ requested: 'LESSON', text: 'o que é saga?' }))).toBe('LESSON');
    expect(chooseMode(signals({ requested: 'SUMMARY' }))).toBe('SUMMARY');
    expect(chooseMode(signals({ requested: 'EDITAL' }))).toBe('EDITAL');
  });

  it('com a questão ativa sem resposta, perguntar vira pista; a aula pedida segue; pista sem questão aberta não vira', () => {
    expect(chooseMode(signals({ activeQuestion: { answered: false, diagnosis: null, falseCertainty: false } }))).toBe('HINT');
    expect(chooseMode(signals({ requested: 'HINT' }))).toBe('QUICK');
    // Pedir a aula do tópico explicitamente segue valendo (o prompt não leva o gabarito e proíbe revelar a alternativa)
    expect(chooseMode(signals({ requested: 'LESSON', activeQuestion: { answered: false, diagnosis: null, falseCertainty: false } }))).toBe('LESSON');
    expect(chooseMode(signals({ requested: 'HINT', activeQuestion: { answered: false, diagnosis: null, falseCertainty: false } }))).toBe('HINT');
  });

  it('sugere a aula pelos sinais, sem chamada extra', () => {
    expect(shouldSuggestLesson(signals())).toBe(false);
    expect(shouldSuggestLesson(signals({ followUps: 2 }))).toBe(true);
    expect(shouldSuggestLesson(signals({ topicMastery: 10 }))).toBe(true);
    expect(shouldSuggestLesson(signals({ requested: 'LESSON', topicMastery: 10 }))).toBe(false);
  });
});

describe('Contexto e prompts', () => {
  it('caderno cortado em 1.500 caracteres', () => {
    const ctx = buildFofoContext({ context: student, notebook: 'x'.repeat(4000), activeQuestion: null, prerequisites: [] });
    expect(ctx.notebookExcerpt).toHaveLength(NOTEBOOK_CONTEXT_CHARS);
    expect(buildFofoContext({ context: student, notebook: '   ', activeQuestion: null, prerequisites: [] }).notebookExcerpt).toBeNull();
  });

  it('o gabarito não vai para a IA antes de o estudante responder (nem na pista)', () => {
    const unanswered = buildFofoContext({ context: student, notebook: null, activeQuestion: { question, answered: false, dissection: null }, prerequisites: [] });
    for (const mode of ['HINT', 'QUICK'] as const) {
      const prompt = buildFofoPrompt(mode, unanswered, [], 'qual é a resposta?');
      expect(prompt).not.toMatch(/gabarito_definitivo/i);
      expect(prompt).not.toContain('>E<');
      expect(prompt).toContain(question.statement);
    }
    const answered = buildFofoContext({ context: student, notebook: null, activeQuestion: { question, answered: true, dissection: null }, prerequisites: [] });
    expect(buildFofoPrompt('QUICK', answered, [], 'por quê?')).toMatch(/<gabarito_definitivo>E<\/gabarito_definitivo>/);
  });

  it('regras: listas sem tabela, abstenção, nada de pegadinha da banca sem dados; aula em ordem e em partes', () => {
    const ctx = buildFofoContext({ context: student, notebook: 'Minhas notas', activeQuestion: null, prerequisites: ['1.0 Camadas'] });
    const quick = buildFofoPrompt('QUICK', ctx, [], 'pergunta');
    expect(quick).toMatch(/nunca use tabelas/i);
    expect(quick).toMatch(/não consigo confirmar/i);
    expect(quick).toMatch(/não atribua pegadinhas.*banca/i);
    expect(quick).toContain('Minhas notas');
    const lesson = buildFofoPrompt('LESSON', ctx, [], 'aula', { part: 2 });
    expect(lesson.indexOf('O essencial')).toBeLessThan(lesson.indexOf('Cuidados comuns em provas'));
    expect(lesson).toMatch(/Parte 2/);
    expect(buildFofoPrompt('FROM_ZERO', ctx, [], 'o que é?')).toContain('1.0 Camadas');
  });

  it('modelo forte só na aula completa e no "Cai no meu edital?"', () => {
    expect(['LESSON', 'EDITAL'].every((m) => isStrongMode(m as never))).toBe(true);
    expect(['QUICK', 'FROM_ZERO', 'SUMMARY', 'HINT'].some((m) => isStrongMode(m as never))).toBe(false);
  });
});

describe('Resumo no formato da Dora', () => {
  const dora = `**🧩 Monolito × microsserviços**
· **Palavras-chave:** Acoplamento, Deploy, Escala
· **Conceito curto:** Monolito é uma aplicação implantada como uma unidade. Microsserviços dividem o sistema em serviços independentes.
· **Uso funcional:** Escolher a arquitetura conforme equipe e escala.
· **Analogia:** Um restaurante com uma cozinha só × uma praça de alimentação.
· **Cuidado em prova:** Microsserviço não implica comunicação só síncrona.`;

  it('aceita o formato e devolve no máximo 6 linhas para o caderno', () => {
    const parsed = parseSummary(dora)!;
    expect(parsed.title).toBe('🧩 Monolito × microsserviços');
    expect(parsed.keywords).toBe('Acoplamento, Deploy, Escala');
    const notebook = formatSummaryForNotebook(parsed);
    expect(notebook.split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(6);
    expect(notebook).toContain('**Conceito curto:**');
  });

  it('recusa texto solto (sem os campos)', () => {
    expect(parseSummary('Um texto qualquer sobre microsserviços.')).toBeNull();
  });
});

describe('"Cai no meu edital?": filtro local antes da IA', () => {
  const topic = (id: string, code: string, title: string) => ({ id, code, title, subject_id: 's' }) as unknown as Topic;
  const entries: EditalTopicEntry[] = [
    { topic: topic('a', '1.1', 'Monolitos, microsserviços e arquiteturas orientadas a eventos'), subjectName: 'Arquitetura', examPartCode: 'P3', weight: 2 },
    { topic: topic('b', '3.2', 'Linguagem SQL: consultas e junções'), subjectName: 'Banco de dados', examPartCode: 'P3', weight: 2 },
  ];

  it('acha o tópico pelas palavras em comum (sem acento) e não acha o que está fora', () => {
    expect(matchEditalTopics('Microsservicos cai na prova?', entries).map((c) => c.topic.id)).toEqual(['a']);
    expect(matchEditalTopics('Direito tributário cai?', entries)).toEqual([]);
  });

  it('no máximo 20 candidatos', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...entries[1], topic: topic(`t${i}`, `9.${i}`, `Consultas SQL parte ${i}`) }));
    expect(matchEditalTopics('consultas sql', many)).toHaveLength(EDITAL_MAX_CANDIDATES);
  });
});

describe('Modo demonstração (sem chave)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FOFOLAB_AI_GATEWAY_URL', '');
    vi.stubEnv('VITE_GROQ_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_DEEPSEEK_API_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('todos os jeitos respondem marcados como simulação; a pista de exemplo não entrega o gabarito', async () => {
    const ctx = buildFofoContext({ context: student, notebook: null, activeQuestion: { question, answered: false, dissection: null }, prerequisites: [] });
    for (const mode of ['QUICK', 'FROM_ZERO', 'LESSON', 'SUMMARY', 'EDITAL', 'HINT'] as const) {
      const reply = await askFofoIa({ mode, ctx, conversation: [], message: 'microsserviços' });
      expect(reply.simulated).toBe(true);
      expect(reply.reply.length).toBeGreaterThan(20);
    }
    const hint = demoFofoReply('HINT', ctx, 'qual a resposta?');
    expect(hint).not.toMatch(/gabarito|errado|letra e/i);
    expect(parseSummary(demoFofoReply('SUMMARY', ctx, 'resumo'))).not.toBeNull();
  });
});
