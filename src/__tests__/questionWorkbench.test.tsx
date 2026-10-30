import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionWorkbench, type QuestionWorkbenchProps } from '../features/questions/QuestionWorkbench';
import { SEED_AI_DISSECTIONS, SEED_QUESTIONS } from '../data/initialSeed';
import type { Question } from '../types/database';

const bundles = SEED_QUESTIONS.map((q) => ({ question: q, dissection: SEED_AI_DISSECTIONS.find((d) => d.question_id === q.id) || null }));
const first = bundles[0]; // gabarito C, com explicação de exemplo

function renderWorkbench(overrides: Partial<QuestionWorkbenchProps> = {}) {
  const props: QuestionWorkbenchProps = {
    questions: [first],
    scopeFilter: 'all',
    onChangeScopeFilter: vi.fn(),
    onAnswer: vi.fn(() => ({ attemptId: 'att-1' })),
    onChangeDiagnosis: vi.fn(),
    lastDiagnosisFeedback: null,
    onAskFofoIa: vi.fn(),
    onActiveQuestionChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<QuestionWorkbench {...props} />), props };
}

const optionA = () => screen.queryByRole('button', { name: /^A\) Risco de Controle/ });

describe('Aba Questões: confiança antes de responder (spec 11 §5.5)', () => {
  it('as alternativas só aparecem depois da confiança', () => {
    renderWorkbench();
    expect(optionA()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    expect(optionA()).toBeTruthy();
  });

  it('responder grava na hora com o diagnóstico deduzido; o "Por quê?" corrige a mesma tentativa; a 1ª resposta vale', () => {
    const { props } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Acho que sei' }));
    fireEvent.click(optionA()!);
    expect(props.onAnswer).toHaveBeenCalledTimes(1);
    expect(props.onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOptionLetter: 'A', isCorrect: false, confidence: 'THINK', diagnosis: 'BASE_GAP', usedAiReview: false })
    );
    expect(screen.getByText('Por quê?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confundi com outra coisa/ }));
    expect(props.onChangeDiagnosis).toHaveBeenCalledWith('att-1', 'MISCONCEPTION');
    fireEvent.click(screen.getByRole('button', { name: /^C\) Risco Inerente/ }));
    expect(props.onAnswer).toHaveBeenCalledTimes(1);
  });

  it('Certo/Errado: "Sei" e acertou chega como Dominei', () => {
    const certoErrado: Question = { ...SEED_QUESTIONS[2], id: 'q-ce', statement: 'O DICT é operado pelo Banco Central.', options_json: JSON.stringify(['C) Certo', 'E) Errado']), final_answer: 'C' };
    const { props } = renderWorkbench({ questions: [{ question: certoErrado, dissection: null }] });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Certo' }));
    expect(screen.getByText('Você acertou.')).toBeTruthy();
    expect(props.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ selectedOptionLetter: 'C', isCorrect: true, diagnosis: 'MASTERED' }));
  });

  it('1º contato: ver a explicação antes de responder grava lacuna, sem confiança, e esconde as alternativas', () => {
    const { props } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: /Ver explicação antes de responder/ }));
    expect(props.onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOptionLetter: null, isCorrect: false, confidence: null, diagnosis: 'BASE_GAP', usedAiReview: true })
    );
    expect(screen.getByText(/Explicação de exemplo/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sei' })).toBeNull();
  });

  it('a explicação aparece embaixo da questão só depois de responder; não existe mais o painel lateral de IA', () => {
    renderWorkbench();
    expect(screen.queryByText(/Explicação de exemplo/)).toBeNull();
    expect(screen.queryByText('Explicação & Estudo Reverso')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(screen.getByText(/Explicação de exemplo/)).toBeTruthy();
  });

  it('pista antes de responder e aprofundar depois vão para a FofoIA; a questão ativa é avisada', () => {
    const { props } = renderWorkbench();
    expect(props.onActiveQuestionChange).toHaveBeenLastCalledWith({ question: first.question, answered: false });
    fireEvent.click(screen.getByRole('button', { name: /Pedir pista à FofoIA/ }));
    expect(props.onAskFofoIa).toHaveBeenCalledWith({ kind: 'hint', question: first.question });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(props.onActiveQuestionChange).toHaveBeenLastCalledWith({ question: first.question, answered: true });
    fireEvent.click(screen.getByRole('button', { name: /Aprofundar com a FofoIA/ }));
    expect(props.onAskFofoIa).toHaveBeenLastCalledWith({ kind: 'deepen', question: first.question });
  });

  it('pedir pista antes de responder fica registrado como ajuda da IA na tentativa', () => {
    const { props } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: /Pedir pista à FofoIA/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vou chutar' }));
    fireEvent.click(optionA()!);
    expect(props.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ usedAiReview: true, confidence: 'GUESS' }));
  });

  it('questão sem explicação no acervo: direciona para explicar com a FofoIA sem poluição na folha', () => {
    const semExplicacao = { question: SEED_QUESTIONS[0], dissection: null };
    const { props } = renderWorkbench({ questions: [semExplicacao] });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    // Não tem mais caixa pontilhada no centro da folha de prova
    expect(screen.queryByText(/Esta questão ainda não tem explicação/)).toBeNull();
    // O botão principal é Explicar com a FofoIA
    const deepenBtn = screen.getByRole('button', { name: /Aprofundar com a FofoIA/ });
    expect(deepenBtn).toBeTruthy();
    expect(screen.getByText('Explicar com a FofoIA')).toBeTruthy();
    fireEvent.click(deepenBtn);
    expect(props.onAskFofoIa).toHaveBeenCalledWith({ kind: 'deepen', question: semExplicacao.question });
  });

  it('sair da aba Questões avisa que não há mais questão ativa (a FofoIA não fica presa nela)', () => {
    const { props, unmount } = renderWorkbench();
    unmount();
    expect(props.onActiveQuestionChange).toHaveBeenLastCalledWith(null);
  });

  it('voltar a uma questão já respondida mostra a correção travada, sem segunda tentativa', () => {
    const { props } = renderWorkbench({ questions: bundles.slice(0, 2) });
    fireEvent.click(screen.getByRole('button', { name: 'Acho que sei' }));
    fireEvent.click(optionA()!);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima questão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Questão anterior' }));
    expect(screen.getByText(/^Gabarito: C/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sei' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Confundi com outra coisa/ }));
    expect(props.onChangeDiagnosis).toHaveBeenCalledWith('att-1', 'MISCONCEPTION');
    expect(props.onAnswer).toHaveBeenCalledTimes(1);
  });

  it('filtro por banca e navegação continuam', () => {
    renderWorkbench({ questions: bundles });
    fireEvent.change(screen.getByLabelText('Filtrar por banca'), { target: { value: 'Cebraspe' } });
    expect(screen.getAllByText(/Cebraspe/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Próxima questão' })).toBeTruthy();
  });

  it('avança pelo fluxo natural de próxima questão preservando a intercalação', () => {
    const q1 = {
      ...bundles[0],
      question: { ...bundles[0].question, id: 'q1' },
    };
    const q2 = {
      ...bundles[1],
      question: { ...bundles[1].question, id: 'q2' },
    };
    renderWorkbench({ questions: [q1, q2] });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);

    const nextBtn = screen.getByRole('button', { name: 'Próxima questão →' });
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);
    expect(screen.getByText(q2.question.statement)).toBeTruthy();
  });
});

describe('Aba Questões com o acervo da Cebraspe (spec 12c §5.3, §5.4 e §5.7)', () => {
  const FORBIDDEN = ['SQLite', 'JSON', 'banco', 'Cache', 'IndexedDB', 'acervo_item', 'null', 'undefined', 'NaN'];
  const EMOJI = /\p{Extended_Pictographic}/u;
  const acervoItem: Question = {
    ...SEED_QUESTIONS[2],
    id: 'acv:s1:ANATEL_24:c1:40',
    statement: 'A celebração de termo de ajustamento de conduta visa afastar discussão litigiosa.',
    options_json: JSON.stringify(['C) Certo', 'E) Errado']),
    final_answer: 'C',
    exam_board: 'Cebraspe',
    acervo_item_id: 'ANATEL_24:c1:40',
    source_label: 'Cebraspe · ANATEL 2024 · item 40',
    acervo_uncertain: 0,
  };

  function acervoProps(view: Partial<NonNullable<QuestionWorkbenchProps['acervo']>['view']> = {}) {
    return {
      view: { links: [], excluded: [], groupCode: null, acervoMissing: false, ...view },
      onDisableLink: vi.fn(),
      onExcludeItem: vi.fn(),
      onRestoreItem: vi.fn(),
      onShowGroup: vi.fn(),
    };
  }

  it('tópico vazio: diz que não há questões classificadas e oferece as do grupo', () => {
    const acervo = acervoProps({ groupCode: '2.3' });
    renderWorkbench({ questions: [], scopeFilter: 'topic', acervo });
    expect(screen.getByText('Ainda não há questões classificadas neste tópico.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver do tópico 2.3' }));
    expect(acervo.onShowGroup).toHaveBeenCalledTimes(1);
  });

  it('enquanto o acervo abre, diz que está carregando em vez de "não há questões"', () => {
    renderWorkbench({ questions: [], scopeFilter: 'topic', acervo: acervoProps({ groupCode: '2.3' }), loading: true });
    expect(screen.getByText('Carregando as questões do acervo…')).toBeTruthy();
    expect(screen.queryByText('Ainda não há questões classificadas neste tópico.')).toBeNull();
  });

  it('tópico vazio sem grupo: sem o botão do grupo', () => {
    renderWorkbench({ questions: [], scopeFilter: 'topic', acervo: acervoProps() });
    expect(screen.getByText('Ainda não há questões classificadas neste tópico.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ver do tópico/ })).toBeNull();
  });

  it('o filtro mostra o grupo quando o tópico tem um, com os nomes novos do escopo', () => {
    renderWorkbench({ questions: [], scopeFilter: 'topic', acervo: acervoProps({ groupCode: '2.3' }) });
    const options = [...(screen.getByLabelText('Escopo das questões') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual(['Deste tópico', 'Tópico 2.3', 'Toda a matéria', 'Todo o plano']);
  });

  it('item do acervo mostra a procedência e, se incerto, o selo', () => {
    renderWorkbench({ questions: [{ question: { ...acervoItem, acervo_uncertain: 1 }, dissection: null }], scopeFilter: 'topic', acervo: acervoProps() });
    expect(screen.getByText('Cebraspe · ANATEL 2024 · item 40')).toBeTruthy();
    expect(screen.getByText('Classificação incerta')).toBeTruthy();
  });

  it('anulada: fora da fila de inéditas por padrão; aparece em "Todas" só para ler, sem confiança e sem resposta', () => {
    const annulled = { ...acervoItem, is_annulled: 1, final_answer: 'X' };
    const { props } = renderWorkbench({ questions: [{ question: annulled, dissection: null }], scopeFilter: 'topic', acervo: acervoProps() });
    expect(screen.queryByText('Anulada pela banca')).toBeNull();
    fireEvent.change(screen.getByLabelText('Filtrar por situação'), { target: { value: 'ALL' } });
    expect(screen.getByText('Anulada pela banca')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sei' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ver explicação antes de responder/ })).toBeNull();
    expect(screen.getByText('Certo')).toBeTruthy();
    expect(props.onAnswer).not.toHaveBeenCalled();
  });

  it('bancada de estudos limpa: sem botões de curadoria técnica ou desligar assunto', () => {
    const acervo = acervoProps({
      links: [{ assuntoId: 'direito-administrativo>licitacoes>lei-14-133', caminho: ['Direito Administrativo', 'Licitações', 'Lei 14.133'] }],
      excluded: [{ itemId: 'TCU_25:c1:9', sourceLabel: 'Cebraspe · TCU 2025 · item 9' }],
    });
    const { container } = renderWorkbench({ questions: [{ question: acervoItem, dissection: null }], scopeFilter: 'topic', acervo });
    expect(screen.queryByRole('button', { name: 'Não é deste tópico' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desligar este assunto' })).toBeNull();
    expect(screen.queryByText(/Do acervo:/)).toBeNull();
    for (const term of FORBIDDEN) expect(container.textContent).not.toContain(term);
    expect(EMOJI.test(container.textContent ?? '')).toBe(false);
  });

  it('o mesmo item em dois tópicos: respondido em A, continua aberto em B', () => {
    const inA = { ...acervoItem, topic_id: 'tA' };
    const { props, rerender } = renderWorkbench({ questions: [{ question: inA, dissection: null }], scopeFilter: 'topic', acervo: acervoProps() });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Certo' }));
    expect(screen.queryByRole('button', { name: 'Sei' })).toBeNull();

    rerender(<QuestionWorkbench {...props} questions={[{ question: { ...acervoItem, topic_id: 'tB' }, dissection: null }]} />);
    expect(screen.getByRole('button', { name: 'Sei' })).toBeTruthy();
  });

  it('fila inteligente (spec 12d §3.2): mostra inéditas por padrão, ordena C/E antes de múltipla escolha, mantém na tela ao responder e permite refazer erros/chutes', () => {
    const qMe: Question = {
      ...SEED_QUESTIONS[0],
      id: 'q-me',
      topic_id: 't1',
      statement: 'Questão inédita de múltipla escolha.',
      exam_year: 2025,
    };
    const qCe: Question = {
      ...acervoItem,
      id: 'q-ce',
      topic_id: 't1',
      statement: 'Questão inédita Certo/Errado.',
      exam_year: 2023,
    };
    const qErrada: Question = {
      ...acervoItem,
      id: 'q-err',
      topic_id: 't1',
      statement: 'Questão que eu já errei antes.',
      exam_year: 2024,
    };
    const qDominada: Question = {
      ...acervoItem,
      id: 'q-dom',
      topic_id: 't1',
      statement: 'Questão que eu já dominei antes.',
      exam_year: 2024,
    };

    const items = [
      { question: qMe, dissection: null, attemptSummary: null },
      { question: qCe, dissection: null, attemptSummary: null },
      {
        question: qErrada,
        dissection: null,
        attemptSummary: {
          count: 1,
          lastIsCorrect: false,
          lastConfidence: 'THINK' as const,
          lastDiagnosis: 'BASE_GAP' as const,
          lastAttemptAt: '2026-10-25T12:00:00Z',
          needsRetry: true,
        },
      },
      {
        question: qDominada,
        dissection: null,
        attemptSummary: {
          count: 1,
          lastIsCorrect: true,
          lastConfidence: 'SURE' as const,
          lastDiagnosis: 'MASTERED' as const,
          lastAttemptAt: '2026-10-25T12:00:00Z',
          needsRetry: false,
        },
      },
    ];

    const { props, rerender } = renderWorkbench({ questions: items, scopeFilter: 'topic', acervo: acervoProps() });

    // 1. Por padrão mostra só as 2 inéditas, e Certo/Errado vem antes de Múltipla Escolha
    expect(screen.getByText('Questão inédita Certo/Errado.')).toBeTruthy();
    expect(screen.queryByText('Questão que eu já errei antes.')).toBeNull();

    // 2. Filtro de formato: escolher Múltipla Escolha mostra só a de múltipla escolha
    fireEvent.change(screen.getByLabelText('Filtrar por formato'), { target: { value: 'ME' } });
    expect(screen.getByText('Questão inédita de múltipla escolha.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filtrar por formato'), { target: { value: 'ALL' } });
    expect(screen.getByText('Questão inédita Certo/Errado.')).toBeTruthy();

    // 3. Responder a questão inédita não esconde ela da tela mesmo quando attemptSummary passa a existir no banco
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Certo' }));
    const updatedItems = items.map((it) =>
      it.question.id === 'q-ce'
        ? {
            ...it,
            attemptSummary: {
              count: 1,
              lastIsCorrect: true,
              lastConfidence: 'SURE' as const,
              lastDiagnosis: 'MASTERED' as const,
              lastAttemptAt: '2026-10-27T12:00:00Z',
              needsRetry: false,
            },
          }
        : it
    );
    rerender(<QuestionWorkbench {...props} questions={updatedItems} />);
    expect(screen.getByText('Questão inédita Certo/Errado.')).toBeTruthy();
    expect(screen.getByText('Você acertou.')).toBeTruthy();

    // 4. Trocar para "Errei ou chutei" mostra a qErrada aberta para tentar de novo e com o selo da tentativa anterior
    fireEvent.change(screen.getByLabelText('Filtrar por situação'), { target: { value: 'RETRY' } });
    expect(screen.getByText('Questão que eu já errei antes.')).toBeTruthy();
    expect(screen.getByText(/Já respondida · Errou/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(screen.getByRole('button', { name: 'Certo' }));
    expect(props.onAnswer).toHaveBeenCalledTimes(2);
  });

  it('quando as inéditas do tópico acabam (mas há respondidas), oferece refazer as que errou/chutou, ver todas ou subir para o grupo', () => {
    const qErrada: Question = { ...acervoItem, id: 'q-err', topic_id: 't1', statement: 'Questão já tentada.' };
    const items = [
      {
        question: qErrada,
        dissection: null,
        attemptSummary: {
          count: 1,
          lastIsCorrect: false,
          lastConfidence: 'THINK' as const,
          lastDiagnosis: 'BASE_GAP' as const,
          lastAttemptAt: '2026-10-25T12:00:00Z',
          needsRetry: true,
        },
      },
    ];
    const acervo = acervoProps({ groupCode: '1.2' });
    renderWorkbench({ questions: items, scopeFilter: 'topic', acervo });
    expect(screen.getByText(/Você já respondeu todas as questões inéditas deste tópico/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Refazer as que errei ou chutei \(1\)/ }));
    expect(screen.getByText('Questão já tentada.')).toBeTruthy();
  });

  it('permite fluxo de resolução 100% pelo teclado: 1 (confiança) -> C (resposta) -> Enter (próxima)', () => {
    const q1: Question = { ...SEED_QUESTIONS[2], id: 'q-ce-1', statement: 'Questão 1 Certo/Errado.', options_json: JSON.stringify(['C) Certo', 'E) Errado']), final_answer: 'C' };
    const q2: Question = { ...SEED_QUESTIONS[2], id: 'q-ce-2', statement: 'Questão 2 Certo/Errado.', options_json: JSON.stringify(['C) Certo', 'E) Errado']), final_answer: 'E' };
    const { props } = renderWorkbench({ questions: [{ question: q1, dissection: null }, { question: q2, dissection: null }] });

    expect(screen.getByText('Questão 1 Certo/Errado.')).toBeTruthy();
    // 1. Pressiona tecla 1 (Sei)
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByRole('button', { name: 'Certo' })).toBeTruthy();

    // 2. Pressiona tecla C (Certo)
    fireEvent.keyDown(window, { key: 'c' });
    expect(props.onAnswer).toHaveBeenCalledWith(expect.objectContaining({ selectedOptionLetter: 'C', isCorrect: true }));
    expect(screen.getByText('Você acertou.')).toBeTruthy();

    // 3. Pressiona Enter para avançar
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText('Questão 2 Certo/Errado.')).toBeTruthy();
  });

  it('riscador de distratores: Alt+A descarta a alternativa com line-through e botão de descarte', () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));

    const optionBtnA = optionA()!;
    expect(optionBtnA.className).not.toContain('line-through');

    // Descartar via atalho Alt+A
    fireEvent.keyDown(window, { key: 'a', altKey: true });
    expect(optionBtnA.className).toContain('line-through');

    // Clicar no botão de restaurar
    const restoreA = screen.getByRole('button', { name: 'Restaurar alternativa A' });
    fireEvent.click(restoreA);
    expect(optionBtnA.className).not.toContain('line-through');
  });

  it('exibe cronômetro discreto de ritmo (Time Pacing) que inicia e congela ao responder quando bloco está ativo', () => {
    vi.useFakeTimers();
    try {
      renderWorkbench({ blockRunning: true });
      expect(screen.getByLabelText(/Tempo decorrido: 00:00/)).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByLabelText(/Tempo decorrido: 00:05/)).toBeTruthy();

      // Ao responder, o cronômetro congela
      fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
      fireEvent.click(optionA()!);

      expect(screen.getByLabelText(/Tempo final de resolução: 00:05/)).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(10000);
      });
      // Permanece congelado
      expect(screen.getByLabelText(/Tempo final de resolução: 00:05/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('no modo livre (sem bloco), o cronômetro não corre sozinho mas permite play manual', () => {
    vi.useFakeTimers();
    try {
      renderWorkbench({ blockRunning: false });
      expect(screen.getByText('(livre)')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByLabelText(/Tempo decorrido: 00:00/)).toBeTruthy();

      // Clicar no botão dá play manual
      fireEvent.click(screen.getByTitle(/Iniciar cronômetro para esta questão/));
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByLabelText(/Tempo decorrido: 00:03/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('após responder, teclas 1..5 ajustam o diagnóstico e tecla E aprofunda na FofoIA', () => {
    const q1: Question = { ...SEED_QUESTIONS[2], id: 'q-ce-diag', statement: 'Questão para diagnóstico.', options_json: JSON.stringify(['C) Certo', 'E) Errado']), final_answer: 'C' };
    const { props } = renderWorkbench({ questions: [{ question: q1, dissection: null }] });

    // 1 (Sei) -> C (Certo)
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'c' });
    expect(props.onAnswer).toHaveBeenCalledTimes(1);

    // Tecla 2 no diagnóstico altera para o 2º diagnóstico permitido
    fireEvent.keyDown(window, { key: '2' });
    expect(props.onChangeDiagnosis).toHaveBeenCalledWith('att-1', expect.any(String));

    // Tecla E abre explicação / aprofunda na FofoIA
    fireEvent.keyDown(window, { key: 'e' });
    expect(props.onAskFofoIa).toHaveBeenCalledWith({ kind: 'deepen', question: q1 });
  });
});
