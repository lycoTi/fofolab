// @vitest-environment node
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyProposals, assuntoId, mergeCandidates, readEditalLines, seedFromEdital, type Vocabulario } from '../vocab';

const EDITAL = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'cgu-2026-affc-edital.pdf');

describe('Propostas de assunto novo e versões', () => {
  const base = (): Vocabulario => ({
    versao: 1,
    assuntos: [
      { id: assuntoId(['Banco de Dados', 'SQL']), caminho: ['Banco de Dados', 'SQL'], sinonimos: [], origem: 'edital' },
      { id: assuntoId(['X', 'Algoritmos e estruturas de dados']), caminho: ['X', 'Algoritmos e estruturas de dados'], sinonimos: [], origem: 'edital' },
      { id: assuntoId(['X', 'Algoritmos e estrutura de dados']), caminho: ['X', 'Algoritmos e estrutura de dados'], sinonimos: [], origem: 'edital' },
      { id: assuntoId(['X', 'Lógica de programação']), caminho: ['X', 'Lógica de programação'], sinonimos: [], origem: 'edital' },
      { id: assuntoId(['X', 'Redes de computadores']), caminho: ['X', 'Redes de computadores'], sinonimos: [], origem: 'edital' },
    ],
    historico: [{ versao: 1, mudancas: ['semente'] }],
  });

  it('proposta igual a um assunto existente vira o existente e não muda a versão', () => {
    const r = applyProposals(base(), [{ caminho: ['banco de dados', 'sql'], confianca: 0.95 }], 0.8);
    expect(r.mapeadas).toEqual({ [assuntoId(['banco de dados', 'sql'])]: assuntoId(['Banco de Dados', 'SQL']) });
    expect(r.vocab.versao).toBe(1);
    expect(r.aceitas).toEqual([]);
  });

  it('propostas novas com confiança alta entram numa versão nova; baixa fica pendente', () => {
    const r = applyProposals(
      base(),
      [
        { caminho: ['Informática', 'Navegadores'], confianca: 0.9 },
        { caminho: ['Economia', 'História monetária do Brasil'], confianca: 0.85 },
        { caminho: ['Economia', 'Algo duvidoso'], confianca: 0.5 },
      ],
      0.8
    );
    expect(r.vocab.versao).toBe(2);
    expect(r.aceitas).toHaveLength(2);
    expect(r.vocab.historico.at(-1)).toEqual({ versao: 2, mudancas: expect.arrayContaining([expect.stringContaining('Navegadores')]) });
    expect(r.pendentes).toEqual([{ caminho: ['Economia', 'Algo duvidoso'], confianca: 0.5 }]);
    expect(r.vocab.assuntos.find((a) => a.caminho.at(-1) === 'Navegadores')!.origem).toBe('proposta');
  });

  it('junções sugeridas: irmãos com nomes quase iguais (só para o relatório)', () => {
    const pares = mergeCandidates(base());
    expect(pares).toContainEqual([assuntoId(['X', 'Algoritmos e estrutura de dados']), assuntoId(['X', 'Algoritmos e estruturas de dados'])]);
    expect(pares.flat()).not.toContain(assuntoId(['X', 'Redes de computadores']));
  });
});

describe('Semente do vocabulário a partir do edital da CGU 2026', () => {
  let vocab: Vocabulario;
  beforeAll(async () => {
    vocab = seedFromEdital(await readEditalLines(EDITAL));
  }, 60_000);

  it('todas as matérias de todos os cargos viram assunto de primeiro nível (26)', () => {
    const materias = vocab.assuntos.filter((a) => a.caminho.length === 1).map((a) => a.caminho[0]);
    expect(materias).toHaveLength(26);
    expect(materias).toContain('Engenharia de Software e Programação');
    expect(materias).toContain('Fundamentos de Auditoria Governamental e Atuação Integrada da CGU');
    expect(materias).toContain('Cibersegurança, Privacidade e Continuidade de Serviços');
  });

  it('tópico e subtópico levam o caminho dos pais, sem a numeração', () => {
    const req = vocab.assuntos.find((a) => a.caminho.at(-1) === 'Requisitos funcionais e não funcionais')!;
    expect(req.caminho).toEqual(['Engenharia de Software e Programação', 'Problemas e requisitos', 'Requisitos funcionais e não funcionais']);
    expect(req.origem).toBe('edital');
  });

  it('ids únicos e estáveis (sem acento, caixa ou espaço extra); versão 1', () => {
    const ids = vocab.assuntos.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(assuntoId(['Persistência', 'SQL'])).toBe(assuntoId(['persistencia', ' SQL ']));
    expect(assuntoId(['Persistência', 'SQL'])).toBe('persistencia>sql');
    expect(vocab.versao).toBe(1);
    expect(vocab.historico).toEqual([{ versao: 1, mudancas: [`semente: ${vocab.assuntos.length} assuntos do edital`] }]);
  });
});
