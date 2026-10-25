// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  estimateSubjectWeights,
  parseEdital,
  subjectsForRole,
  toTitleCasePt,
  type ParsedEdital,
} from '../lib/editalParser';
import { loadFixturePdfLines } from './helpers/loadPdfLines';

/** Tópicos de primeiro nível ("1", "2"…), contados à mão no edital. */
const topLevel = (codes: { code: string | null }[]) => codes.filter((t) => t.code && !t.code.includes('.')).length;

describe('Leitura do edital real (CGU 2026 — AFFC, Cebraspe)', () => {
  let edital: ParsedEdital;

  beforeAll(async () => {
    edital = parseEdital(await loadFixturePdfLines('cgu-2026-affc-edital.pdf'));
  }, 60_000);

  it('acha o concurso, as datas e a taxa', () => {
    expect(edital.organ).toBe('CGU');
    expect(edital.board).toBe('Cebraspe');
    expect(edital.roleBaseTitle).toBe('Auditor Federal de Finanças e Controle (AFFC)');
    expect(edital.examDate).toBe('2026-12-13');
    expect(edital.registrationDeadline).toBe('2026-11-04');
    expect(edital.fee).toBe(170);
  });

  it('acha as provas objetivas com itens, pontos por item e notas mínimas', () => {
    expect(edital.parts).toEqual([
      { code: 'P1', name: 'Conhecimentos básicos', itemCount: 40, pointsPerItem: 1, minScore: 8 },
      { code: 'P2', name: 'Conhecimentos complementares', itemCount: 40, pointsPerItem: 1, minScore: 12 },
      { code: 'P3', name: 'Conhecimentos específicos', itemCount: 90, pointsPerItem: 2, minScore: 54 },
    ]);
    expect(edital.minTotalScore).toBe(78);
  });

  it('lista os 4 cargos pela especialidade', () => {
    expect(edital.roles.map((r) => r.label)).toEqual([
      'Auditoria',
      'Tecnologia da Informação – Ciência de Dados',
      'Tecnologia da Informação – Infraestrutura de TI',
      'Tecnologia da Informação – Desenvolvimento de Sistemas',
    ]);
  });

  it('Cargo 4: 13 matérias nas provas certas, com os tópicos do edital', () => {
    const subjects = subjectsForRole(edital, 4);
    expect(subjects.map((s) => [s.partCode, s.name, topLevel(s.topics)])).toEqual([
      ['P1', 'Estado, Democracia, Direitos e Ciência Política', 9],
      ['P1', 'Sociedade Brasileira, Desigualdades, Diversidade e Desenvolvimento', 5],
      ['P1', 'Ética Pública e Responsabilidade Profissional', 5],
      ['P1', 'Administração Pública e Fundamentos de Políticas Públicas', 5],
      ['P2', 'Fundamentos de Governança, Riscos e Integridade Pública e Privada', 5],
      ['P2', 'Fundamentos de Transparência, Ouvidoria e Participação Social', 5],
      ['P2', 'Fundamentos de Direito Público Aplicado, Controle e Responsabilização', 5],
      ['P2', 'Fundamentos de Evidências, Dados e Inteligência Artificial', 5],
      ['P2', 'Fundamentos de Auditoria Governamental e Atuação Integrada da CGU', 5],
      ['P3', 'Engenharia de Software e Programação', 5],
      ['P3', 'Arquitetura e Integração de Sistemas', 5],
      ['P3', 'Persistência, Integração e Proteção de Dados', 4],
      ['P3', 'Desenvolvimento Seguro, Qualidade e Gestão da Entrega', 5],
    ]);

    const engenharia = subjects[9].topics;
    expect(engenharia[0]).toEqual({ code: '1', title: 'Problemas e requisitos' });
    expect(engenharia).toContainEqual({
      code: '4.5',
      title: 'Desenvolvimento de interfaces com JavaScript e Vue.js: componentes, reatividade, tratamento de eventos e consumo de APIs',
    });
    // A assinatura no fim do edital não vira tópico
    const lastTopic = subjects[12].topics.at(-1);
    expect(lastTopic?.title).toMatch(/plano de saída$/);
  });

  it('cada cargo tem as próprias matérias específicas', () => {
    expect(Object.keys(edital.roleSubjects)).toEqual(['1', '2', '3', '4']);
    expect(edital.roleSubjects[1][0].name).toBe('Auditoria Governamental: Avaliação, Consultoria e Apuração');
    expect(Object.values(edital.roleSubjects).map((subjects) => subjects.length)).toEqual([5, 4, 4, 4]);
  });

  it('peso estimado: pontos da prova divididos entre as matérias, relativo à média', () => {
    const subjects = subjectsForRole(edital, 4);
    const weights = estimateSubjectWeights(edital.parts, subjects);
    expect(weights[0]).toEqual({ points: 10, weight: 0.5 }); // P1: 40 itens × 1 ÷ 4 matérias
    expect(weights[4]).toEqual({ points: 8, weight: 0.4 }); // P2: 40 × 1 ÷ 5
    expect(weights[9]).toEqual({ points: 45, weight: 2.25 }); // P3: 90 × 2 ÷ 4
  });
});

describe('Nomes do edital em letras normais', () => {
  it('mantém preposições minúsculas e siglas maiúsculas', () => {
    expect(toTitleCasePt('ENGENHARIA DE SOFTWARE E PROGRAMAÇÃO')).toBe('Engenharia de Software e Programação');
    expect(toTitleCasePt('TECNOLOGIA DA INFORMAÇÃO – INFRAESTRUTURA DE TI')).toBe(
      'Tecnologia da Informação – Infraestrutura de TI'
    );
  });
});

describe('Rodapé de página no meio do conteúdo programático', () => {
  it('o número da página sozinho na linha não entra no tópico nem esconde o tópico seguinte', () => {
    const lines = [
      '15.2.1 CONHECIMENTOS BÁSICOS',
      'CONTABILIDADE: 1 Mensuração de ativos. 1.1 Reavaliação e redução ao valor',
      '27',
      'recuperável. 2 Estatística.',
      '28',
      '2.1 Estatística descritiva.',
    ];
    const titles = parseEdital(lines).commonSubjects[0].topics.map((t) => `${t.code} ${t.title}`);
    expect(titles).toEqual([
      '1 Mensuração de ativos',
      '1.1 Reavaliação e redução ao valor recuperável',
      '2 Estatística',
      '2.1 Estatística descritiva',
    ]);
  });
});
