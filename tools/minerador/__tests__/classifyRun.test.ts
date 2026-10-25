// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { writeConcurso } from '../acervoStore';
import { LimiteDiario, type AiProvider } from '../aiProvider';
import { consensus, readClassificacao, writeClassificacao } from '../classificationStore';
import { juntar, recalcularConsenso, runClassificacao } from '../classifyRun';
import type { AcervoItem } from '../types';
import { assuntoId, readVocabulario, writeVocabulario, type Vocabulario } from '../vocab';

const vocab: Vocabulario = {
  versao: 1,
  assuntos: [
    { id: assuntoId(['Banco de dados', 'Consultas SQL']), caminho: ['Banco de dados', 'Consultas SQL'], sinonimos: [], origem: 'edital' },
    { id: assuntoId(['Banco de dados', 'Normalização']), caminho: ['Banco de dados', 'Normalização'], sinonimos: [], origem: 'edital' },
    { id: assuntoId(['Segurança', 'Injeção']), caminho: ['Segurança', 'Injeção'], sinonimos: [], origem: 'edital' },
  ],
  historico: [{ versao: 1, mudancas: ['semente'] }],
};
const SQL = assuntoId(['Banco de dados', 'Consultas SQL']);

const item = (concurso: string, numero: number, enunciado: string, anulado = false): AcervoItem => ({
  id: `${concurso}:C:${numero}`, formato: 'CERTO_ERRADO', textoBase: null, enunciado, alternativas: null, gabarito: anulado ? null : 'C',
  anulado, materiaOrigem: null, temCodigo: false, dependeDeFigura: false, temSimboloIlegivel: false,
  procedencias: [{ banca: 'Cebraspe', identificador: concurso, concurso, ano: 2023, prova: 'P', caderno: 'C', numero }],
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'classif-'));
  writeVocabulario(join(dir, 'vocabulario.json'), vocab);
  const meta = (id: string) => ({ identificador: id, concurso: id, ano: 2023, areas: [] });
  writeConcurso(join(dir, 'cebraspe'), meta('A_23'), [
    item('A_23', 1, 'Consultas SQL com junção.'), item('A_23', 2, 'Consultas SQL agregadas.'),
    item('A_23', 3, 'Normalização na terceira forma.'), item('A_23', 4, 'Item anulado sobre consultas SQL.', true),
  ]);
  writeConcurso(join(dir, 'cebraspe'), meta('B_23'), [item('B_23', 1, 'Injeção de SQL em consultas.'), item('B_23', 2, 'Normalização de tabelas.')]);
  return dir;
}

/** Itens de número par no `setup` (os códigos do lote escondem o número, então o falso decide pelo enunciado). */
const PARES = /agregadas|tabelas/;

/** Provedor falso: escolhe o 1º (ou o 2º, se `pick` mandar) candidato; confiança 0.9 nos itens pares, 0.5 nos ímpares. */
function fakeProvider(modelo: string, pick: (enunciado: string) => number = () => 0): AiProvider & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    nome: 'fake', modelo, tamanhoLote: 2, prompts,
    async complete(prompt) {
      prompts.push(prompt);
      const resultados = prompt.split('### Item ').slice(1).map((block) => {
        const id = block.split('\n')[0].trim();
        const enunciado = /^Enunciado: (.*)$/m.exec(block)?.[1] ?? '';
        const candidatos = [...block.matchAll(/^ {2}- (\S+) — /gm)].map((m) => m[1]);
        const escolhido = candidatos[Math.min(pick(enunciado), candidatos.length - 1)];
        return { id, assuntos: escolhido ? [{ id: escolhido, confianca: PARES.test(enunciado) ? 0.9 : 0.5 }] : [], proposta: null };
      });
      return JSON.stringify({ resultados });
    },
  };
}

describe('Consenso entre opiniões', () => {
  it('uma opinião: incerto pela confiança do principal; secundário fraco não entra', () => {
    const c = consensus({ 'agy:g': { assuntos: [{ id: 'x', confianca: 0.95 }, { id: 'y', confianca: 0.15 }], versaoVocabulario: 1 } });
    expect(c).toEqual({ consenso: [{ id: 'x', confianca: 0.95 }], incerto: false, concordancia: 'uma-opiniao' });
  });

  it('mesmos assuntos em ordem diferente concordam (o principal de cada um está na escolha do outro)', () => {
    const c = consensus({
      'agy:g': { assuntos: [{ id: 'x', confianca: 0.9 }, { id: 'y', confianca: 0.85 }], versaoVocabulario: 1 },
      'agy:c': { assuntos: [{ id: 'y', confianca: 0.7 }, { id: 'x', confianca: 0.5 }], versaoVocabulario: 1 },
    });
    expect(c.concordancia).toBe('concordam');
    expect(c.consenso.map((a) => a.id).sort()).toEqual(['x', 'y']);
    expect(c.incerto).toBe(false);
  });

  it('mesmo tópico vindo de editais diferentes (nome igual no último nível) ou pai/filho no mesmo ramo concordam', () => {
    const sameLeaf = consensus({
      'agy:g': { assuntos: [{ id: 'financas-publicas>despesas-de-exercicios-anteriores', confianca: 0.9 }], versaoVocabulario: 1 },
      'groq:o': { assuntos: [{ id: 'administracao-orcamentaria>despesa-publica>despesas-de-exercicios-anteriores', confianca: 0.8 }], versaoVocabulario: 1 },
    });
    expect(sameLeaf.concordancia).toBe('concordam');
    const parentChild = consensus({
      'agy:g': { assuntos: [{ id: 'lp>coesao', confianca: 0.9 }], versaoVocabulario: 1 },
      'groq:o': { assuntos: [{ id: 'lp>coesao>referenciacao', confianca: 0.8 }], versaoVocabulario: 1 },
    });
    expect(parentChild.concordancia).toBe('concordam');
    // Fica o mais específico
    expect(parentChild.consenso[0].id).toBe('lp>coesao>referenciacao');
    // Nome genérico no último nível não junta matérias diferentes
    const generic = consensus({
      'agy:g': { assuntos: [{ id: 'direito-constitucional>conceitos-basicos', confianca: 0.9 }], versaoVocabulario: 1 },
      'groq:o': { assuntos: [{ id: 'contabilidade>conceitos-basicos', confianca: 0.8 }], versaoVocabulario: 1 },
    });
    expect(generic.concordancia).toBe('discordam');
  });

  it('o principal de uma opinião também escolhido pela outra concorda nele; a confiança média decide o selinho', () => {
    // Programa Segundo Tempo (TRT10 2024): políticas sociais × direitos humanos, os dois com direitos humanos
    const c = consensus({
      'agy:g': { assuntos: [{ id: 'politicas-sociais', confianca: 0.85 }, { id: 'direitos-humanos', confianca: 0.75 }], versaoVocabulario: 1 },
      'groq:o': { assuntos: [{ id: 'direitos-humanos', confianca: 0.9 }], versaoVocabulario: 1 },
    });
    expect(c).toEqual({ consenso: [{ id: 'direitos-humanos', confianca: 0.83 }], incerto: false, concordancia: 'concordam' });
    // Só como secundário fraco do outro: concorda, mas fica incerto
    const fraco = consensus({
      'agy:g': { assuntos: [{ id: 'x', confianca: 0.9 }], versaoVocabulario: 1 },
      'groq:o': { assuntos: [{ id: 'y', confianca: 0.9 }, { id: 'x', confianca: 0.45 }], versaoVocabulario: 1 },
    });
    expect(fraco.concordancia).toBe('concordam');
    expect(fraco.incerto).toBe(true);
  });

  it('duas opiniões que discordam no principal: incerto, com os dois principais', () => {
    const c = consensus({
      'agy:g': { assuntos: [{ id: 'x', confianca: 0.9 }], versaoVocabulario: 1 },
      'agy:c': { assuntos: [{ id: 'y', confianca: 0.8 }], versaoVocabulario: 1 },
    });
    expect(c.concordancia).toBe('discordam');
    expect(c.incerto).toBe(true);
    expect(c.consenso.map((a) => a.id).sort()).toEqual(['x', 'y']);
  });
});

describe('Rodada de classificação retomável', () => {
  it('classifica até o limite, grava, e a 2ª rodada continua só do que falta', async () => {
    const dir = setup();
    const p = fakeProvider('m1');
    const r1 = await runClassificacao({ provider: p, acervoDir: dir, limite: 4, alvo: 'sem-opiniao', k: 5 });
    expect(r1.classificados).toBe(4);
    expect(p.prompts.join('\n')).not.toContain('Item anulado');
    const r2 = await runClassificacao({ provider: p, acervoDir: dir, limite: 100, alvo: 'sem-opiniao', k: 5 });
    expect(r2.classificados).toBe(1);
    const a = readClassificacao(join(dir, 'classificacao'), 'A_23');
    expect(a.itens['A_23:C:2'].consenso[0].id).toBe(SQL);
    expect(a.itens['A_23:C:1'].incerto).toBe(true);
    expect(a.itens['A_23:C:2'].incerto).toBe(false);
  });

  it('conferência independente: guarda as duas opiniões, não manda a anterior no prompt e marca quem discorda', async () => {
    const dir = setup();
    await runClassificacao({ provider: fakeProvider('m1'), acervoDir: dir, limite: 100, alvo: 'sem-opiniao', k: 5 });
    const second = fakeProvider('m2', (enunciado) => (enunciado.startsWith('Injeção') ? 1 : 0));
    const r = await runClassificacao({ provider: second, acervoDir: dir, limite: 100, alvo: 'todos', k: 5 });
    expect(r.classificados).toBe(5);
    expect(second.prompts.join('\n')).not.toMatch(/fake:m1|opini/i);
    const b = readClassificacao(join(dir, 'classificacao'), 'B_23');
    expect(Object.keys(b.itens['B_23:C:1'].opinioes).sort()).toEqual(['fake:m1', 'fake:m2']);
    expect(b.itens['B_23:C:1'].concordancia).toBe('discordam');
    expect(b.itens['B_23:C:2'].concordancia).toBe('concordam');

    const third = fakeProvider('m3');
    await runClassificacao({ provider: third, acervoDir: dir, limite: 100, alvo: 'discordantes', k: 5 });
    expect(third.prompts).toHaveLength(1);
    expect(third.prompts[0]).toContain('Injeção de SQL em consultas.');
  });

  it('limite diário no meio: para, guarda o lote já feito e avisa', async () => {
    const dir = setup();
    const base = fakeProvider('m1');
    let calls = 0;
    const limited: AiProvider = { ...base, async complete(prompt, max) {
      calls += 1;
      if (calls === 2) throw new LimiteDiario(3600, 'teste');
      return base.complete(prompt, max);
    } };
    const r = await runClassificacao({ provider: limited, acervoDir: dir, limite: 100, alvo: 'sem-opiniao', k: 5 });
    expect(r.parouNoLimite).toBe(true);
    expect(r.classificados).toBe(2);
  });

  it('em paralelo: vários lotes ao mesmo tempo, até o limite pedido, e nada se perde', async () => {
    const dir = setup();
    const base = fakeProvider('m1');
    let active = 0;
    let peak = 0;
    const slow: AiProvider = { ...base, tamanhoLote: 1, async complete(prompt, max) {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
      return base.complete(prompt, max);
    } };
    const r = await runClassificacao({ provider: slow, acervoDir: dir, limite: 100, alvo: 'sem-opiniao', k: 5, paralelo: 3 });
    expect(r.classificados).toBe(5);
    expect(peak).toBe(3);
    const all = { ...readClassificacao(join(dir, 'classificacao'), 'A_23').itens, ...readClassificacao(join(dir, 'classificacao'), 'B_23').itens };
    expect(Object.keys(all)).toHaveLength(5);
  });

  it('juntar troca o assunto no vocabulário e nas opiniões guardadas, e refaz o consenso', () => {
    const dir = setup();
    const INJECAO = assuntoId(['Segurança', 'Injeção']);
    writeClassificacao(join(dir, 'classificacao'), {
      identificador: 'B_23',
      itens: {
        'B_23:C:1': {
          opinioes: {
            'agy:g': { assuntos: [{ id: INJECAO, confianca: 0.9 }, { id: SQL, confianca: 0.6 }], versaoVocabulario: 1 },
            'groq:o': { assuntos: [{ id: SQL, confianca: 0.8 }], versaoVocabulario: 1 },
          },
          consenso: [], incerto: true, concordancia: 'discordam',
        },
      },
    });
    const r = juntar(dir, INJECAO, SQL);
    expect(r).toEqual({ versaoVocabulario: 2, itensAfetados: 1 });
    expect(readVocabulario(join(dir, 'vocabulario.json'))!.assuntos.map((a) => a.id)).not.toContain(INJECAO);
    const item = readClassificacao(join(dir, 'classificacao'), 'B_23').itens['B_23:C:1'];
    // Os dois assuntos da 1ª opinião viraram um só, com a confiança maior
    expect(item.opinioes['agy:g'].assuntos).toEqual([{ id: SQL, confianca: 0.9 }]);
    expect(item.concordancia).toBe('concordam');
  });

  it('recalcular refaz o consenso a partir das opiniões guardadas (sem chamar IA)', () => {
    const dir = setup();
    writeClassificacao(join(dir, 'classificacao'), {
      identificador: 'A_23',
      itens: {
        'A_23:C:1': {
          opinioes: {
            'agy:g': { assuntos: [{ id: 'x', confianca: 0.9 }, { id: 'y', confianca: 0.85 }], versaoVocabulario: 1 },
            'agy:c': { assuntos: [{ id: 'y', confianca: 0.8 }, { id: 'x', confianca: 0.6 }], versaoVocabulario: 1 },
          },
          // Consenso antigo, calculado pela regra anterior
          consenso: [], incerto: true, concordancia: 'discordam',
        },
      },
    });
    const r = recalcularConsenso(dir);
    expect(r).toMatchObject({ concordam: 1, discordam: 0 });
    expect(readClassificacao(join(dir, 'classificacao'), 'A_23').itens['A_23:C:1'].concordancia).toBe('concordam');
  });

  it('regravar sem mudança dá o mesmo arquivo, byte a byte', async () => {
    const dir = setup();
    await runClassificacao({ provider: fakeProvider('m1'), acervoDir: dir, limite: 100, alvo: 'sem-opiniao', k: 5 });
    const path = join(dir, 'classificacao', 'A_23.json');
    const before = readFileSync(path);
    writeClassificacao(join(dir, 'classificacao'), readClassificacao(join(dir, 'classificacao'), 'A_23'));
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it('assunto proposto e aceito vale para o item', async () => {
    const dir = setup();
    const proposer: AiProvider = {
      nome: 'fake', modelo: 'prop', tamanhoLote: 10,
      complete: vi.fn(async (prompt: string) => JSON.stringify({
        resultados: prompt.split('### Item ').slice(1).map((b) => ({ id: b.split('\n')[0].trim(), assuntos: [], proposta: { caminho: ['Informática', 'Navegadores'], confianca: 0.9 } })),
      })),
    };
    const r = await runClassificacao({ provider: proposer, acervoDir: dir, limite: 1, alvo: 'sem-opiniao', k: 5 });
    expect(r.propostasAceitas).toEqual([assuntoId(['Informática']), assuntoId(['Informática', 'Navegadores'])]);
    expect(r.versaoVocabulario).toBe(2);
    const all = { ...readClassificacao(join(dir, 'classificacao'), 'A_23').itens, ...readClassificacao(join(dir, 'classificacao'), 'B_23').itens };
    expect(Object.values(all)[0].consenso[0].id).toBe(assuntoId(['Informática', 'Navegadores']));
  });
});
