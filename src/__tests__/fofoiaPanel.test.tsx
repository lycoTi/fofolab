import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FofoIaPanel, type FofoIaPanelProps } from '../features/fofoia/FofoIaPanel';
import type { StudentContextSnapshot } from '../lib/aiRouter';
import type { Question, Topic } from '../types/database';

const FORBIDDEN_JARGON = ['SQLite', 'tokens', '_score', 'IndexedDB', 'localStorage', 'null', 'undefined', 'QUICK', 'FROM_ZERO', 'HINT'];

const context: StudentContextSnapshot = {
  planTitle: 'CGU', organ: 'CGU', examBoard: 'Cebraspe', roleTitle: 'Auditor', daysUntilExam: 50, weeklyHoursTarget: 21,
  currentSubjectName: 'Arquitetura', currentSubjectWeight: 2, currentSubjectMastery: 60, currentSubjectCoverage: 30,
  currentTopicCode: '1.1', currentTopicTitle: 'Microsserviços', currentTopicMastery: 60, currentTopicConfidence: 40,
  strongTopics: [], priorityWeakTopics: [], relatedPrerequisites: [],
};
const question = { id: 'q1', statement: 'Enunciado.', exam_board: 'Cebraspe', exam_year: 2025, options_json: '["C) Certo","E) Errado"]', final_answer: 'E' } as unknown as Question;

function props(over: Partial<FofoIaPanelProps> = {}): FofoIaPanelProps {
  return {
    context,
    topicKey: 't1',
    topicLabel: '1.1 Microsserviços',
    notebook: 'Minhas notas',
    activeQuestion: null,
    prerequisites: [],
    editalTopics: [{ topic: { id: 't1', code: '1.1', title: 'Monolitos e microsserviços' } as Topic, subjectName: 'Arquitetura', examPartCode: 'P3', weight: 2 }],
    firstContact: false,
    aiConfigured: false,
    request: null,
    onWiden: vi.fn(),
    onSaveSummary: vi.fn(),
    ...over,
  };
}

async function ask(text: string) {
  fireEvent.change(screen.getByLabelText('Pergunte à FofoIA'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }));
  });
}

beforeEach(() => {
  vi.stubEnv('VITE_FOFOLAB_AI_GATEWAY_URL', '');
  vi.stubEnv('VITE_GROQ_API_KEY', '');
  vi.stubEnv('VITE_GEMINI_API_KEY', '');
  vi.stubEnv('VITE_DEEPSEEK_API_KEY', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('Painel da FofoIA (spec 11)', () => {
  it('responde com o selinho do jeito e o rótulo de exemplo; avisa que as anotações vão junto', async () => {
    const { container } = render(<FofoIaPanel {...props()} />);
    expect(screen.getByText('Suas anotações deste tópico vão junto com a pergunta para a IA.')).toBeTruthy();
    await ask('Qual a diferença entre orquestração e coreografia?');
    expect(screen.getByText('🐹💡 Rápida')).toBeTruthy();
    expect(screen.getAllByText('Exemplo simulado — a IA ainda não está configurada').length).toBeGreaterThan(0);
    for (const term of FORBIDDEN_JARGON) expect(container.textContent).not.toContain(term);
  });

  it('pergunta de base vira "Do zero" e sugere a aula completa', async () => {
    render(<FofoIaPanel {...props()} />);
    await ask('o que é um microsserviço?');
    expect(screen.getByText('🐹🌱 Do zero')).toBeTruthy();
    expect(screen.getByText(/Parece que vale a aula completa sobre 1.1 Microsserviços/)).toBeTruthy();
  });

  it('"Aula completa" alarga a coluna e responde em partes, com "Continuar"', async () => {
    const p = props();
    render(<FofoIaPanel {...p} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aula completa' }));
    });
    expect(p.onWiden).toHaveBeenCalledWith(560);
    expect(screen.getByText('🐹📚 Aula completa')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Continuar \(Parte 2 de 2\)/ })).toBeTruthy();
  });

  it('com a questão ativa sem resposta, pedir pista responde como pista', async () => {
    render(<FofoIaPanel {...props({ activeQuestion: { question, answered: false, dissection: null, diagnosis: null, falseCertainty: false } })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pedir pista' }));
    });
    expect(screen.getByText('🐹🔎 Pista')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Outra pista' })).toBeTruthy();
  });

  it('trocar de tópico recomeça a conversa com um aviso', async () => {
    const { rerender } = render(<FofoIaPanel {...props()} />);
    await ask('pergunta 1');
    rerender(<FofoIaPanel {...props({ topicKey: 't2', topicLabel: '3.2 SQL' })} />);
    expect(screen.getByText('Nova conversa sobre 3.2 SQL.')).toBeTruthy();
    expect(screen.queryByText('pergunta 1')).toBeNull();
  });

  it('resumo de revisão: prévia no formato da Dora; sem chave, não vai para o caderno', async () => {
    const p = props();
    render(<FofoIaPanel {...p} />);
    await ask('pergunta qualquer');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Salvar resumo de revisão' })[0]);
    });
    expect(screen.getByText('🐹📝 Resumo')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Salvar no caderno' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(p.onSaveSummary).not.toHaveBeenCalled();
  });

  it('"Cai no meu edital?" usa o filtro local e responde com o tópico do plano', async () => {
    render(<FofoIaPanel {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cai no meu edital?' }));
    await ask('microsserviços');
    expect(screen.getByText('🐹🧭 Cai no meu edital?')).toBeTruthy();
    expect(screen.getByText(/1.1 Monolitos e microsserviços/)).toBeTruthy();
  });

  it('pedido vindo da aba Questões: "Aprofundar" abre a conversa sobre a questão', async () => {
    const q = { question, answered: true, dissection: null, diagnosis: 'BASE_GAP' as const, falseCertainty: false };
    const { rerender } = render(<FofoIaPanel {...props({ activeQuestion: q })} />);
    await act(async () => {
      rerender(<FofoIaPanel {...props({ activeQuestion: q, request: { id: 1, kind: 'deepen' } })} />);
    });
    expect(screen.getAllByText(/Me explique esta questão/).length).toBeGreaterThan(0);
  });
});
