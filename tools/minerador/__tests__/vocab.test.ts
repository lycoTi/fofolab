// @vitest-environment node
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  applyProposals, assuntoId, cleanSubjectName, juntarAssunto, mergeCandidates, mergeVocabularios, readEditalLines, seedFromEdital, type Vocabulario,
} from '../vocab';

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
    // Os dois assuntos e as duas matérias novas (Informática, Economia)
    expect(r.aceitas).toHaveLength(4);
    expect(r.aceitas).toEqual(expect.arrayContaining([assuntoId(['Informática', 'Navegadores']), assuntoId(['Informática'])]));
    expect(r.vocab.historico.at(-1)).toEqual({ versao: 2, mudancas: expect.arrayContaining([expect.stringContaining('Navegadores')]) });
    expect(r.pendentes).toEqual([{ caminho: ['Economia', 'Algo duvidoso'], confianca: 0.5 }]);
    expect(r.vocab.assuntos.find((a) => a.caminho.at(-1) === 'Navegadores')!.origem).toBe('proposta');
  });

  it('matéria da proposta casa com a existente (nome contido, singular/plural) e a nova matéria vira assunto', () => {
    const v = base();
    v.assuntos.push({ id: assuntoId(['Fundamentos de Auditoria Governamental e Atuação Integrada da CGU']), caminho: ['Fundamentos de Auditoria Governamental e Atuação Integrada da CGU'], sinonimos: [], origem: 'edital' });
    const r = applyProposals(
      v,
      [
        { caminho: ['Auditoria Governamental', 'Normas ISSAI'], confianca: 0.9 },
        { caminho: ['Raciocínio Lógico-Matemático', 'Regra de três'], confianca: 0.9 },
        { caminho: ['Raciocínio Lógico e Matemática', 'Conjuntos'], confianca: 0.9 },
        { caminho: ['Língua Portuguesa', 'Interpretação de texto'], confianca: 0.9 },
        { caminho: ['Língua Portuguesa', 'Compreensão e interpretação de textos'], confianca: 0.9 },
      ],
      0.8
    );
    const caminhos = r.vocab.assuntos.map((a) => a.caminho.join(' › '));
    expect(caminhos).toContain('Fundamentos de Auditoria Governamental e Atuação Integrada da CGU › Normas ISSAI');
    expect(caminhos).toContain('Raciocínio Lógico-Matemático › Conjuntos');
    expect(caminhos).not.toContain('Raciocínio Lógico e Matemática › Conjuntos');
    expect(caminhos).toContain('Raciocínio Lógico-Matemático');
    expect(caminhos).toContain('Língua Portuguesa');
    expect(caminhos.filter((c) => c.startsWith('Língua Portuguesa ›'))).toEqual(['Língua Portuguesa › Interpretação de texto']);
    // Toda proposta (aceita ou casada) tem destino em `mapeadas`
    expect(r.mapeadas[assuntoId(['Língua Portuguesa', 'Compreensão e interpretação de textos'])]).toBe(assuntoId(['Língua Portuguesa', 'Interpretação de texto']));
    expect(r.mapeadas[assuntoId(['Raciocínio Lógico e Matemática', 'Conjuntos'])]).toBe(assuntoId(['Raciocínio Lógico-Matemático', 'Conjuntos']));
  });

  it('proposta casa com tópico de nível mais fundo da mesma matéria, com plural em "-ões" (rodada de 25/10)', () => {
    const v = base();
    for (const c of [['Raciocínio Lógico'], ['Raciocínio Lógico', 'Razões e proporções'], ['Raciocínio Lógico', 'Razões e proporções', 'Regras de três simples e compostas']]) {
      v.assuntos.push({ id: assuntoId(c), caminho: c, sinonimos: [], origem: 'edital' });
    }
    const r = applyProposals(
      v,
      [
        { caminho: ['Raciocínio Lógico', 'Regra de três simples e composta'], confianca: 0.95 },
        { caminho: ['Raciocínio Lógico', 'Razão, proporção e divisão proporcional'], confianca: 0.95 },
      ],
      0.8
    );
    expect(r.aceitas).toEqual([]);
    expect(r.mapeadas[assuntoId(['Raciocínio Lógico', 'Regra de três simples e composta'])]).toBe(
      assuntoId(['Raciocínio Lógico', 'Razões e proporções', 'Regras de três simples e compostas'])
    );
    expect(r.mapeadas[assuntoId(['Raciocínio Lógico', 'Razão, proporção e divisão proporcional'])]).toBe(assuntoId(['Raciocínio Lógico', 'Razões e proporções']));
  });

  it('juntar: o assunto (e o que está abaixo dele) vira o outro; o nome fica de sinônimo; versão nova com a junção', () => {
    const v = base();
    const add = (c: string[], origem: 'edital' | 'proposta' = 'edital') => v.assuntos.push({ id: assuntoId(c), caminho: c, sinonimos: [], origem });
    add(['RL']);
    add(['RL', 'Razões e proporções']);
    add(['RL', 'Razão e divisão'], 'proposta');
    add(['RL', 'Razão e divisão', 'Exemplos'], 'proposta');
    const [de, para] = [assuntoId(['RL', 'Razão e divisão']), assuntoId(['RL', 'Razões e proporções'])];
    const r = juntarAssunto(v, de, para);
    expect(r.remap).toEqual({ [de]: para, [assuntoId(['RL', 'Razão e divisão', 'Exemplos'])]: para });
    expect(r.vocab.assuntos.map((a) => a.id)).not.toContain(de);
    expect(r.vocab.assuntos.find((a) => a.id === para)!.sinonimos).toEqual(['Razão e divisão']);
    expect(r.vocab.versao).toBe(2);
    expect(r.vocab.historico.at(-1)!.mudancas[0]).toBe('junção: RL › Razão e divisão → RL › Razões e proporções');
    expect(() => juntarAssunto(v, 'nao-existe', para)).toThrow(/não existe/);
    // Juntar a matéria num tópico dela mesma apagaria o destino
    expect(() => juntarAssunto(v, assuntoId(['RL']), para)).toThrow(/dentro/);
  });

  it('nome de uma palavra longa contido no outro casa ("Pontuação" × "Emprego dos sinais de pontuação")', () => {
    const v = base();
    v.assuntos.push({ id: assuntoId(['Língua Portuguesa', 'Pontuação']), caminho: ['Língua Portuguesa', 'Pontuação'], sinonimos: [], origem: 'proposta' });
    const r = applyProposals(v, [{ caminho: ['Língua Portuguesa', 'Emprego dos sinais de pontuação'], confianca: 0.9 }], 0.8);
    expect(r.aceitas).toEqual([]);
    expect(r.mapeadas[assuntoId(['Língua Portuguesa', 'Emprego dos sinais de pontuação'])]).toBe(assuntoId(['Língua Portuguesa', 'Pontuação']));
  });

  it('junções sugeridas: irmãos com nomes quase iguais (só para o relatório)', () => {
    const pares = mergeCandidates(base());
    expect(pares).toContainEqual([assuntoId(['X', 'Algoritmos e estrutura de dados']), assuntoId(['X', 'Algoritmos e estruturas de dados'])]);
    expect(pares.flat()).not.toContain(assuntoId(['X', 'Redes de computadores']));
  });
});

describe('Semente com vários editais', () => {
  it('limpa o nome da matéria: ressalva de cargo entre parênteses e resto de numeração romana', () => {
    expect(cleanSubjectName('Noções de Direito Administrativo (Exceto para o Cargo de Auditor Fiscal de Controle Externo – Área: Direito)')).toBe('Noções de Direito Administrativo');
    expect(cleanSubjectName('Noções de Administração Pública (Exceto para ')).toBe('Noções de Administração Pública');
    expect(cleanSubjectName('Estatística e Raciocínio Lógico: I Estatística')).toBe('Estatística e Raciocínio Lógico');
    expect(cleanSubjectName('Língua Portuguesa')).toBe('Língua Portuguesa');
    // Resto do tópico anterior que o leitor colou no começo do nome
    expect(cleanSubjectName('(Sei). Gestão de Contratos')).toBe('Gestão de Contratos');
    expect(cleanSubjectName('Nbc Tsp 34. Legislação Tributária Estadual')).toBe('Legislação Tributária Estadual');
    expect(cleanSubjectName('Noções de Estatística/Probabilidade')).toBe('Noções de Estatística/Probabilidade');
  });

  it('junta os vocabulários: matéria de mesmo nome (ou contido) vira uma só; tópicos iguais não repetem', () => {
    const v = (assuntos: string[][]): Vocabulario => ({
      versao: 1, historico: [], assuntos: assuntos.map((c) => ({ id: assuntoId(c), caminho: c, sinonimos: [], origem: 'edital' as const })),
    });
    const merged = mergeVocabularios([
      v([['Engenharia de Software e Programação'], ['Engenharia de Software e Programação', 'Requisitos']]),
      v([['Língua Portuguesa'], ['Língua Portuguesa', 'Coesão textual'], ['Direito Constitucional'], ['Direito Constitucional', 'Direitos fundamentais']]),
      v([['Língua Portuguesa'], ['Língua Portuguesa', 'Coesão textual'], ['Noções de Direito Constitucional'], ['Noções de Direito Constitucional', 'Controle de constitucionalidade']]),
    ]);
    const caminhos = merged.assuntos.map((a) => a.caminho.join(' › '));
    expect(caminhos.filter((c) => c === 'Língua Portuguesa › Coesão textual')).toHaveLength(1);
    expect(caminhos).toContain('Direito Constitucional › Controle de constitucionalidade');
    expect(caminhos.some((c) => c.startsWith('Noções de Direito Constitucional'))).toBe(false);
    expect(merged.versao).toBe(1);
    expect(new Set(merged.assuntos.map((a) => a.id)).size).toBe(merged.assuntos.length);
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
