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

  it('anulada: só para ler, sem confiança, sem resposta e sem explicação antes', () => {
    const annulled = { ...acervoItem, is_annulled: 1, final_answer: 'X' };
    const { props } = renderWorkbench({ questions: [{ question: annulled, dissection: null }], scopeFilter: 'topic', acervo: acervoProps() });
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
});
