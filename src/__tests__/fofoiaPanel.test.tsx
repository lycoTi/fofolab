import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
    warmupEnabled: true,
    topicHasQuestions: false,
    onTryQuestions: vi.fn(),
    onRequestHandled: vi.fn(),
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
  localStorage.clear();
  vi.stubEnv('VITE_FOFOLAB_AI_GATEWAY_URL', '');
  vi.stubEnv('VITE_GROQ_API_KEY', '');
  vi.stubEnv('VITE_GEMINI_API_KEY', '');
  vi.stubEnv('VITE_DEEPSEEK_API_KEY', '');
});
afterEach(() => vi.unstubAllEnvs());

/** Selinho do jeito da resposta, dentro da conversa (os botões de baixo têm nomes iguais). */
const badge = (text: string) => within(screen.getByRole('log', { name: 'Conversa com a FofoIA' })).getByText(text);

describe('Painel da FofoIA (spec 11)', () => {
  it('responde com o selinho do jeito e o rótulo de exemplo; avisa que as anotações vão junto', async () => {
    const { container } = render(<FofoIaPanel {...props()} />);
    expect(screen.getByText('Suas anotações deste tópico vão junto com a pergunta para a IA.')).toBeTruthy();
    await ask('Qual a diferença entre orquestração e coreografia?');
    expect(badge('Rápida')).toBeTruthy();
    expect(screen.getAllByText('Exemplo simulado — a IA ainda não está configurada').length).toBeGreaterThan(0);
    for (const term of FORBIDDEN_JARGON) expect(container.textContent).not.toContain(term);
  });

  it('"oi" recebe um convite curto do app, sem selinho de jeito nem "Salvar resumo"', async () => {
    const { container } = render(<FofoIaPanel {...props()} />);
    await ask('oi');
    expect(screen.getByText(/Estou aqui para estudar/)).toBeTruthy();
    expect(within(screen.getByRole('log', { name: 'Conversa com a FofoIA' })).queryByText('Rápida')).toBeNull();
    expect(container.textContent).not.toContain('Exemplo simulado');
    expect(screen.queryByRole('button', { name: 'Salvar resumo de revisão' })).toBeNull();
  });

  it('só a resposta mais nova surge por parágrafo', async () => {
    const { container } = render(<FofoIaPanel {...props()} />);
    await ask('qual a diferença entre orquestração e coreografia?');
    const first = container.querySelectorAll('.fofolab-reveal').length;
    expect(first).toBeGreaterThan(0);
    await ask('e a coreografia escala melhor?');
    // A resposta anterior já está parada; a nova é a que anima
    expect(container.querySelectorAll('.fofolab-reveal').length).toBeGreaterThan(0);
    const answers = [...container.querySelectorAll('.fofolab-enter.rounded-xl.border')];
    expect(answers[0].querySelector('.fofolab-reveal')).toBeNull();
    expect(answers.at(-1)!.querySelector('.fofolab-reveal')).not.toBeNull();
  });

  it('pergunta de base vira "Do zero" e sugere a aula completa', async () => {
    render(<FofoIaPanel {...props()} />);
    await ask('o que é um microsserviço?');
    expect(badge('Do zero')).toBeTruthy();
    expect(screen.getByText(/Parece que vale a aula completa sobre 1.1 Microsserviços/)).toBeTruthy();
  });

  it('"Aula completa" alarga a coluna e responde em partes, com "Continuar"', async () => {
    const p = props();
    render(<FofoIaPanel {...p} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aula completa' }));
    });
    expect(p.onWiden).toHaveBeenCalledWith(560);
    expect(badge('Aula completa')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Continuar \(Parte 2 de 2\)/ })).toBeTruthy();
  });

  it('com a questão ativa sem resposta, pedir pista responde como pista', async () => {
    render(<FofoIaPanel {...props({ activeQuestion: { question, answered: false, dissection: null, diagnosis: null, falseCertainty: false } })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pedir pista' }));
    });
    expect(badge('Pista')).toBeTruthy();
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
    expect(badge('Resumo')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Salvar no caderno' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(p.onSaveSummary).not.toHaveBeenCalled();
  });

  it('"Cai no meu edital?" usa o filtro local e responde quando o estudante pergunta sobre edital', async () => {
    render(<FofoIaPanel {...props()} />);

    await ask('microsserviços cai no edital?');
    expect(badge('Cai no meu edital?')).toBeTruthy();
    expect(screen.getByText(/1.1 Monolitos e microsserviços/)).toBeTruthy();
  });

  it('exibe atalhos dinâmicos conforme o estado do estudante', () => {
    const { rerender } = render(<FofoIaPanel {...props()} />);
    expect(screen.getByRole('button', { name: 'Aula completa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Do zero' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar resumo' })).toBeTruthy();

    const unans = { question, answered: false, dissection: null, diagnosis: null, falseCertainty: false };
    rerender(<FofoIaPanel {...props({ activeQuestion: unans })} />);
    expect(screen.getByRole('button', { name: 'Pedir pista' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conceito-base' })).toBeTruthy();

    const wrong = {
      question,
      answered: true,
      dissection: null,
      diagnosis: 'BASE_GAP' as const,
      falseCertainty: false,
      attempt: { selectedOption: 'C', isCorrect: false, confidence: 'SURE' as const, diagnosis: 'BASE_GAP' as const, falseCertainty: false },
    };
    rerender(<FofoIaPanel {...props({ activeQuestion: wrong })} />);
    expect(screen.getByRole('button', { name: 'Por que errei?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aula completa' })).toBeTruthy();
  });

  it('pedido vindo da aba Questões: "Aprofundar" abre a conversa sobre a questão', async () => {
    const q = { question, answered: true, dissection: null, diagnosis: 'BASE_GAP' as const, falseCertainty: false };
    const { rerender } = render(<FofoIaPanel {...props({ activeQuestion: q })} />);
    await act(async () => {
      rerender(<FofoIaPanel {...props({ activeQuestion: q, request: { id: 1, kind: 'deepen' } })} />);
    });
    expect(screen.getAllByText(/Me explique esta questão/).length).toBeGreaterThan(0);
    expect(props().onRequestHandled).toBeDefined();
  });
});

describe('Aquecimento antes da aula (spec 11 §5.4, camada 3)', () => {
  const clickLesson = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aula completa' }));
    });
  };

  it('tópico nunca tentado: uma pergunta de aquecimento antes da aula, só uma vez por tópico', async () => {
    const { unmount } = render(<FofoIaPanel {...props({ firstContact: true })} />);
    await clickLesson();
    expect(screen.getByText(/Antes da aula/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar 3 questões antes da aula' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Seu palpite (fica só na conversa)'), { target: { value: 'divide o sistema' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ver a aula agora' }));
    });
    expect(badge('Aula completa')).toBeTruthy();
    expect(screen.getAllByText(/Meu palpite antes da aula: divide o sistema/).length).toBeGreaterThan(0);
    unmount();

    render(<FofoIaPanel {...props({ firstContact: true })} />);
    await clickLesson();
    expect(screen.queryByText(/Antes da aula/)).toBeNull();
  });

  it('com questões no tópico, convida a tentar 3 antes', async () => {
    const p = props({ firstContact: true, topicHasQuestions: true });
    render(<FofoIaPanel {...p} />);
    await clickLesson();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar 3 questões antes da aula' }));
    expect(p.onTryQuestions).toHaveBeenCalled();
  });

  it('"Tenho meu método" desligado ou tópico já tentado: a aula vem direto', async () => {
    const { unmount } = render(<FofoIaPanel {...props({ firstContact: true, warmupEnabled: false })} />);
    await clickLesson();
    expect(screen.queryByText(/Antes da aula/)).toBeNull();
    unmount();
    // Outro dia de estudo: a conversa guardada do primeiro painel já não volta
    localStorage.clear();
    render(<FofoIaPanel {...props({ firstContact: false })} />);
    await clickLesson();
    expect(screen.queryByText(/Antes da aula/)).toBeNull();
    expect(badge('Aula completa')).toBeTruthy();
  });
});

describe('Pedidos e trocas de tópico', () => {
  it('pedido atendido avisa o App para limpá-lo (não é reenviado quando o painel volta)', async () => {
    const onRequestHandled = vi.fn();
    const q = { question, answered: true, dissection: null, diagnosis: null, falseCertainty: false };
    const { rerender } = render(<FofoIaPanel {...props({ activeQuestion: q, onRequestHandled })} />);
    await act(async () => {
      rerender(<FofoIaPanel {...props({ activeQuestion: q, onRequestHandled, request: { id: 7, kind: 'deepen' } })} />);
    });
    expect(onRequestHandled).toHaveBeenCalledTimes(1);
  });

  it('o convite de aquecimento fecha ao trocar de tópico', async () => {
    const { rerender } = render(<FofoIaPanel {...props({ firstContact: true })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Aula completa' }));
    });
    expect(screen.getByText(/Antes da aula/)).toBeTruthy();
    rerender(<FofoIaPanel {...props({ firstContact: true, topicKey: 't2', topicLabel: '3.2 SQL' })} />);
    expect(screen.queryByText(/Antes da aula/)).toBeNull();
  });
});

describe('Resposta cortada no teto de tamanho', () => {
  it('mostra "Continuar de onde parou" no lugar do "Continuar (Parte...)" e pede o resto pelo botão', async () => {
    const { FofoMessage } = await import('../features/fofoia/FofoMessage');
    const onResume = vi.fn();
    const onContinue = vi.fn();
    render(
      <FofoMessage
        turn={{ id: 't', role: 'tutor', content: 'Parte 1 de 3\n\nO mesh externaliza políticas.', mode: 'LESSON', part: { n: 1, total: 3 }, cut: true }}
        topicLabel="1.1 Microsserviços"
        aiConfigured
        onContinue={onContinue}
        onResume={onResume}
        onAnotherHint={() => {}}
        onLesson={() => {}}
        onSummary={() => {}}
        onSaveSummary={() => {}}
        onRetry={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /Continuar \(Parte/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar de onde parou' }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe('Aula completa e resumo depois de uma conversa', () => {
  const press = async (name: string) => {
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name })[0]);
    });
  };

  it('sem conversa, a aula é do tópico; depois de conversar, aula e resumo são sobre o que foi conversado', async () => {
    const { unmount } = render(<FofoIaPanel {...props()} />);
    await press('Aula completa');
    expect(screen.getByText('Aula completa sobre 1.1 Microsserviços.')).toBeTruthy();
    unmount();
    localStorage.clear();

    render(<FofoIaPanel {...props()} />);
    await ask('Por que o broker de log distribuído deixa o offset com o consumidor?');
    await press('Aula completa');
    expect(screen.getByText('Aula completa sobre o que conversamos (tópico 1.1 Microsserviços).')).toBeTruthy();
    await press('Salvar resumo de revisão');
    expect(screen.getByText('Resumo de revisão do que conversamos (tópico 1.1 Microsserviços).')).toBeTruthy();
  });

  it('Enter envia a pergunta; Shift+Enter não envia e permite nova linha', async () => {
    render(<FofoIaPanel {...props()} />);
    const textarea = screen.getByLabelText('Pergunte à FofoIA');

    fireEvent.change(textarea, { target: { value: 'Primeira linha\nSegunda linha' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(screen.queryByText('Primeira linha\nSegunda linha')).toBeNull();

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    });
    expect(screen.getAllByText(/Primeira linha/).length).toBeGreaterThan(0);
  });
});

describe('Gestão da conversa, memória por questão e envio ao caderno', () => {
  const q1 = {
    question: { id: 'q1', statement: 'Questão um', exam_board: 'Cebraspe', exam_year: 2025, options_json: JSON.stringify(['C', 'E']), final_answer: 'C' } as Question,
    answered: true,
    dissection: null,
    diagnosis: null,
    falseCertainty: false,
  };
  const q2 = {
    question: { id: 'q2', statement: 'Questão dois', exam_board: 'Cebraspe', exam_year: 2025, options_json: JSON.stringify(['C', 'E']), final_answer: 'E' } as Question,
    answered: true,
    dissection: null,
    diagnosis: null,
    falseCertainty: false,
  };

  it('isola a conversa por questão ativa: trocar de questão limpa a lousa; voltar restaura a conversa', async () => {
    localStorage.clear();
    const { rerender } = render(<FofoIaPanel {...props({ activeQuestion: q1 })} />);
    await ask('Minha dúvida na questão 1');
    expect(screen.getByText('Minha dúvida na questão 1')).toBeTruthy();

    // Troca para a questão 2: lousa limpa, sem histórico da questão 1
    rerender(<FofoIaPanel {...props({ activeQuestion: q2 })} />);
    expect(screen.queryByText('Minha dúvida na questão 1')).toBeNull();

    // Volta para a questão 1: a conversa anterior reaparece intacta
    rerender(<FofoIaPanel {...props({ activeQuestion: q1 })} />);
    expect(screen.getByText('Minha dúvida na questão 1')).toBeTruthy();
  });

  it('botão "Limpar" no cabeçalho limpa a lousa da questão atual', async () => {
    render(<FofoIaPanel {...props({ activeQuestion: q1 })} />);
    await ask('Pergunta para zerar');
    expect(screen.getByText('Pergunta para zerar')).toBeTruthy();

    const clearBtn = screen.getByRole('button', { name: 'Limpar conversa' });
    await act(async () => {
      fireEvent.click(clearBtn);
    });
    expect(screen.queryByText('Pergunta para zerar')).toBeNull();
  });

  it('em modo simulado (sem chave), o botão "+ Caderno" fica desabilitado para não poluir o caderno', async () => {
    const onSave = vi.fn();
    render(<FofoIaPanel {...props()} />);
    await ask('Explique broker');
    const addBtn = screen.getAllByRole('button', { name: '+ Caderno' })[0] as HTMLButtonElement;
    expect(addBtn).toBeTruthy();

    expect(addBtn.disabled).toBe(true);

  });

  it('botão "+ Caderno" na fala real do tutor salva a explicação e altera o estado', async () => {
    const { FofoMessage } = await import('../features/fofoia/FofoMessage');
    const onSave = vi.fn();
    render(
      <FofoMessage
        turn={{ id: 't1', role: 'tutor', content: 'Explicação importante sobre arquitetura.', mode: 'QUICK', simulated: false }}
        topicLabel="Arquitetura"
        aiConfigured={true}
        onContinue={() => {}}
        onResume={() => {}}
        onAnotherHint={() => {}}
        onLesson={() => {}}
        onSummary={() => {}}
        onSaveSummary={onSave}
        onRetry={() => {}}
      />
    );
    const addBtn = screen.getByRole('button', { name: '+ Caderno' });
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn);
    expect(onSave).toHaveBeenCalledWith('Explicação importante sobre arquitetura.');
    expect(screen.getByRole('button', { name: 'Salvo no caderno' })).toBeTruthy();
  });

  it('atalho "Comparar com a certa" aparece ao errar questão e responde com o comparativo', async () => {
    const wrongQuestion = {
      question: { id: 'q-wrong', statement: 'Questão de teste', options_json: '["A) Certo","B) Errado"]', final_answer: 'A' },
      answered: true,
      dissection: null,
      diagnosis: 'MISCONCEPTION',
      falseCertainty: true,
      attempt: {
        selectedOption: 'B',
        isCorrect: false,
        confidence: 'SURE',
        diagnosis: 'MISCONCEPTION',
        falseCertainty: true,
      },
    };
    render(<FofoIaPanel {...props({ activeQuestion: wrongQuestion as any })} />);
    const contrastBtn = screen.getByRole('button', { name: 'Comparar com a certa' });
    expect(contrastBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(contrastBtn);
    });

    expect(badge('Comparativo')).toBeTruthy();
    expect(screen.getByText(/No que prestar aten/)).toBeTruthy();
    expect(screen.getByText('Cuidado na prova:')).toBeTruthy();
  });

  it('exibe o atalho "Testar se fixei" e responde no jeito Fixação', async () => {
    const activeQuestion = {
      question: {
        id: 'q1',
        subject_id: 's1',
        topic_id: 't1',
        exam_board: 'Cebraspe',
        exam_year: 2024,
        organ: 'ANATEL',
        statement: 'CSRF statement',
        options_json: '["C) Certo","E) Errado"]',
        preliminary_answer: null,
        final_answer: 'C',
        is_annulled: 0,
        annulment_reason: null,
      },
      answered: true,
      dissection: null,
      diagnosis: 'MISCONCEPTION' as const,
      falseCertainty: true,
      attempt: {
        selectedOption: 'E',
        isCorrect: false,
        confidence: 'SURE' as const,
        diagnosis: 'MISCONCEPTION' as const,
        falseCertainty: true,
      },
    };

    render(<FofoIaPanel {...props({ activeQuestion })} />);

    const testBtn = screen.getByRole('button', { name: 'Testar se fixei' });
    expect(testBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(testBtn);
    });

    expect(badge('Fixação')).toBeTruthy();
    expect(screen.getByText(/testar se você fixou/i)).toBeTruthy();
  });
});
