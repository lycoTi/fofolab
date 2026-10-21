import { describe, expect, it } from 'vitest';
import { IMPORT_TEXT_EXAMPLE } from '../features/question-import/QuestionImportModal';
import { parseQuestionImport, toImportItems } from '../lib/questionImport';
import { findCorrectOption, parseQuestionOptions } from '../lib/questionOptions';
import { parentTopicCode, parseSyllabusTopics } from '../lib/syllabusImport';
import { SEED_TOPICS } from '../data/initialSeed';

describe('Importador de questões (texto colado do PDF ou JSON)', () => {
  it('lê o exemplo da tela: múltipla escolha e Certo/Errado, com banca, órgão, ano e tópico', () => {
    const result = parseQuestionImport(IMPORT_TEXT_EXAMPLE);

    expect(result.issues).toEqual([]);
    expect(result.questions).toHaveLength(2);

    const [multipla, certoErrado] = result.questions;
    expect(multipla).toMatchObject({ examBoard: 'FGV', organ: 'CGU', examYear: 2022, topicCode: '1.1', answer: 'C' });
    expect(multipla.options).toHaveLength(4);
    expect(multipla.statement.startsWith('Segundo a ISSAI 100')).toBe(true);

    expect(certoErrado).toMatchObject({ examBoard: 'Cebraspe', organ: 'BACEN', examYear: 2024, answer: 'C' });
    expect(certoErrado.options).toEqual(['C) Certo', 'E) Errado']);
  });

  it('listas "a) b)" dentro do enunciado não são confundidas com as alternativas', () => {
    const text = `Considere as afirmativas:
a) a primeira afirmativa do enunciado;
b) a segunda afirmativa do enunciado.
Está correto o que se afirma em
A) apenas a.
B) apenas b.
C) a e b.
Gabarito: C`;
    const [q] = parseQuestionImport(text).questions;
    expect(q.options).toEqual(['A) apenas a.', 'B) apenas b.', 'C) a e b.']);
    expect(q.statement).toContain('b) a segunda afirmativa');
  });

  it('aponta problemas sem travar o resto: gabarito inválido, anulada e texto sem gabarito', () => {
    const text = `Questão boa?
A) sim
B) não
Gabarito: A

Questão com gabarito errado?
A) x
B) y
Gabarito: D

Questão anulada?
A) x
B) y
Gabarito: Anulada

Texto solto sem gabarito`;
    const result = parseQuestionImport(text);
    expect(result.questions).toHaveLength(1);
    expect(result.issues.map((i) => i.message)).toEqual([
      'Gabarito "D" não corresponde a nenhuma alternativa.',
      'Questão anulada — não importada.',
      'Texto sem linha "Gabarito:" no final — não importado.',
    ]);
  });

  it('aceita JSON com chaves em português (contrato do futuro leitor de PDF)', () => {
    const json = JSON.stringify([
      { enunciado: 'Pergunta JSON?', alternativas: ['Sim', 'Não'], gabarito: 'B', banca: 'cespe', ano: 2021, orgao: 'TCU', topico: '1.2' },
    ]);
    const result = parseQuestionImport(json);
    expect(result.format).toBe('json');
    expect(result.questions[0]).toMatchObject({
      options: ['A) Sim', 'B) Não'],
      answer: 'B',
      examBoard: 'Cebraspe',
      examYear: 2021,
      organ: 'TCU',
      topicCode: '1.2',
    });
  });

  it('resolve o tópico pelo código e usa os padrões do formulário quando faltar dado', () => {
    const parsed = parseQuestionImport(`[tópico 1.2] Pergunta sem banca?\nA) x\nB) y\nGabarito: A`).questions;
    const topics = SEED_TOPICS.filter((t) => t.subject_id === 'subj-cgu-auditoria');
    const [item] = toImportItems(parsed, {
      subjectTopics: topics,
      defaultTopicId: null,
      defaults: { examBoard: 'FGV', examYear: 2025, organ: 'CGU' },
    });
    expect(item.topicId).toBe('t-cgu-1-2');
    expect(item).toMatchObject({ examBoard: 'FGV', examYear: 2025, organ: 'CGU', finalAnswer: 'A' });
  });
});

describe('Alternativas com a letra real', () => {
  it('lê prefixos variados e Certo/Errado, sem confundir "E-mail" com a letra E', () => {
    const options = parseQuestionOptions(JSON.stringify(['(A) um', 'B. dois', 'E-mail corporativo', 'Certo']));
    expect(options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'C']);
    expect(options[2].text).toBe('E-mail corporativo');
    expect(findCorrectOption(parseQuestionOptions(JSON.stringify(['C) Certo', 'E) Errado'])), 'e')?.text).toBe('Errado');
  });
});

describe('Importador do conteúdo programático do edital', () => {
  it('separa tópicos num parágrafo único (estilo Cebraspe) sem quebrar números do meio do texto', () => {
    const topics = parseSyllabusTopics(
      'AUDITORIA GOVERNAMENTAL: 1 Conceitos de auditoria. 2 Normas da Lei 14.133/2021 e NBC TA 530 Amostragem. 2.1 ISSAI 100. 3 Controle interno.'
    );
    expect(topics).toEqual([
      { code: '1', title: 'Conceitos de auditoria' },
      { code: '2', title: 'Normas da Lei 14.133/2021 e NBC TA 530 Amostragem' },
      { code: '2.1', title: 'ISSAI 100' },
      { code: '3', title: 'Controle interno' },
    ]);
  });

  it('aceita um tópico por linha, com marcadores, e ignora cabeçalhos', () => {
    const topics = parseSyllabusTopics(`CONHECIMENTOS ESPECÍFICOS
1. Banco de Dados
1.1 - Modelagem relacional;
• Normalização`);
    expect(topics).toEqual([
      { code: '1', title: 'Banco de Dados' },
      { code: '1.1', title: 'Modelagem relacional' },
      { code: null, title: 'Normalização' },
    ]);
  });

  it('descobre o código do tópico pai', () => {
    expect(parentTopicCode('2.1.3')).toBe('2.1');
    expect(parentTopicCode('2')).toBeNull();
    expect(parentTopicCode(null)).toBeNull();
  });
});
