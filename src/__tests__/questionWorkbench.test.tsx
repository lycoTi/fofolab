import { fireEvent, render, screen } from '@testing-library/react';
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

  it('questão sem explicação: sem IA, aviso honesto; com IA, "Gerar explicação" só quando pedido', () => {
    const semExplicacao = { question: SEED_QUESTIONS[0], dissection: null };
    const { unmount } = renderWorkbench({ questions: [semExplicacao], aiConfigured: false, onGenerateDissection: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(screen.getByText(/ainda não tem explicação/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Gerar explicação/ })).toBeNull();
    unmount();

    const onGenerate = vi.fn(async () => ({ ok: true }));
    renderWorkbench({ questions: [semExplicacao], aiConfigured: true, onGenerateDissection: onGenerate });
    fireEvent.click(screen.getByRole('button', { name: 'Sei' }));
    fireEvent.click(optionA()!);
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Gerar explicação/ }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole('button', { name: 'Ver as do grupo 2.3' }));
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
    expect(screen.queryByRole('button', { name: /Ver as do grupo/ })).toBeNull();
  });

  it('o filtro mostra o grupo quando o tópico tem um, com os nomes novos do escopo', () => {
    renderWorkbench({ questions: [], scopeFilter: 'topic', acervo: acervoProps({ groupCode: '2.3' }) });
    const options = [...(screen.getByLabelText('Escopo das questões') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual(['Deste tópico', 'Do grupo 2.3', 'Toda a matéria', 'Todo o plano']);
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

  it('"Não é deste tópico" tira o item do tópico', () => {
    const acervo = acervoProps();
    renderWorkbench({ questions: [{ question: acervoItem, dissection: null }], scopeFilter: 'topic', acervo });
    fireEvent.click(screen.getByRole('button', { name: 'Não é deste tópico' }));
    expect(acervo.onExcludeItem).toHaveBeenCalledWith(acervoItem);
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

  it('questão própria não oferece "Não é deste tópico"', () => {
    renderWorkbench({ questions: [first], scopeFilter: 'topic', acervo: acervoProps() });
    expect(screen.queryByRole('button', { name: 'Não é deste tópico' })).toBeNull();
  });

  it('linha "Do acervo" com "Desligar este assunto"; tirados podem ser devolvidos', () => {
    const acervo = acervoProps({
      links: [{ assuntoId: 'direito-administrativo>licitacoes>lei-14-133', caminho: ['Direito Administrativo', 'Licitações', 'Lei 14.133'] }],
      excluded: [{ itemId: 'TCU_25:c1:9', sourceLabel: 'Cebraspe · TCU 2025 · item 9' }],
    });
    renderWorkbench({ questions: [{ question: acervoItem, dissection: null }], scopeFilter: 'topic', acervo });
    expect(screen.getByText('Do acervo: Licitações › Lei 14.133')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar este assunto' }));
    expect(acervo.onDisableLink).toHaveBeenCalledWith('direito-administrativo>licitacoes>lei-14-133');

    expect(screen.queryByRole('button', { name: 'Devolver ao tópico' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tirados deste tópico (1)' }));
    expect(screen.getByText('Cebraspe · TCU 2025 · item 9')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Devolver ao tópico' }));
    expect(acervo.onRestoreItem).toHaveBeenCalledWith('TCU_25:c1:9');
  });

  it('acervo que não está neste computador: avisa como trazer de volta', () => {
    renderWorkbench({ questions: [first], scopeFilter: 'topic', acervo: acervoProps({ acervoMissing: true }) });
    expect(screen.getByText('O acervo da Cebraspe não está neste computador. Importe o pacote de novo em "Importar Questões".')).toBeTruthy();
  });

  it('sem termos técnicos e sem emoji nas telas do acervo', () => {
    const acervo = acervoProps({
      links: [{ assuntoId: 'x>y', caminho: ['X', 'Y'] }],
      excluded: [{ itemId: 'i', sourceLabel: 'Cebraspe · TCU 2025 · item 9' }],
      acervoMissing: true,
      groupCode: '1',
    });
    const { container } = renderWorkbench({ questions: [{ question: { ...acervoItem, acervo_uncertain: 1 }, dissection: null }], scopeFilter: 'topic', acervo });
    fireEvent.click(screen.getByRole('button', { name: 'Tirados deste tópico (1)' }));
    for (const term of FORBIDDEN) expect(container.textContent).not.toContain(term);
    expect(EMOJI.test(container.textContent ?? '')).toBe(false);
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
});
