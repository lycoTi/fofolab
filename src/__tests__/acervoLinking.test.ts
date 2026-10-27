// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  aiCandidates,
  assuntoIdFromCaminho,
  buildLinkPrompt,
  cleanSubjectName,
  linkByName,
  normalizeName,
  parseLinkResponse,
  topicCaminho,
} from '../lib/acervo/linking';
import type { PacoteAssunto } from '../lib/acervo/pacote';
import { createEditalDraft, draftToPlanInput } from '../features/edital-import/editalDraft';
import { parseEdital } from '../lib/editalParser';
import { createMemoryStorage } from '../lib/storage';
import type { Topic } from '../types/database';
import { loadFixturePdfLines } from './helpers/loadPdfLines';

function assunto(caminho: string[], sinonimos: string[] = []): PacoteAssunto {
  return { id: assuntoIdFromCaminho(caminho), caminho, sinonimos };
}

const VOCAB: PacoteAssunto[] = [
  assunto(['Direito Administrativo']),
  assunto(['Direito Administrativo', 'Atos administrativos']),
  assunto(['Direito Administrativo', 'Atos administrativos', 'Atributos']),
  assunto(['Direito Administrativo', 'Licitações'], ['Licitações e contratos']),
  assunto(['Direito Administrativo', 'Atos administrativos', 'Conceito']),
  assunto(['Direito Administrativo', 'Licitações', 'Conceito']),
  assunto(['Direito Constitucional']),
  assunto(['Direito Constitucional', 'Controle de constitucionalidade']),
];

const topic = (id: string, title: string, parentId: string | null = null): Topic =>
  ({ id, subject_id: 's1', parent_id: parentId, code: null, title, mastery_score: 0, status: 'PENDING', last_studied_at: null, initial_knowledge_level: null }) as Topic;

describe('Ligação de tópico a assunto pelo nome (spec 12c §5.3, 1º passo)', () => {
  it('normaliza como o minerador: sem acento, minúsculas, hífens', () => {
    expect(normalizeName('  Licitações & Contratos (Lei 14.133) ')).toBe('licitacoes-contratos-lei-14-133');
    expect(assuntoIdFromCaminho(['Direito Administrativo', 'Atos administrativos'])).toBe('direito-administrativo>atos-administrativos');
    expect(cleanSubjectName('Direito Administrativo (Exceto para o Cargo 3')).toBe('Direito Administrativo');
    expect(cleanSubjectName('Estatística: I Estatística descritiva')).toBe('Estatística');
  });

  it('caminho do tópico: matéria limpa, títulos dos pais e o título do tópico', () => {
    const pai = topic('t1', 'Atos administrativos');
    const filho = topic('t2', 'Atributos', 't1');
    const byId = new Map([pai, filho].map((t) => [t.id, t]));
    expect(topicCaminho('Direito Administrativo (exceto para o cargo 2)', filho, byId)).toEqual([
      'Direito Administrativo',
      'Atos administrativos',
      'Atributos',
    ]);
  });

  it('caminho inteiro igual liga', () => {
    expect(linkByName(['Direito Administrativo', 'Atos administrativos', 'Atributos'], VOCAB)).toEqual({
      kind: 'linked',
      assuntoId: 'direito-administrativo>atos-administrativos>atributos',
    });
  });

  it('folha igual na mesma matéria liga, mesmo com outro pai; sinônimo também', () => {
    expect(linkByName(['Direito Administrativo', 'Poderes e atos', 'Atributos'], VOCAB)).toEqual({
      kind: 'linked',
      assuntoId: 'direito-administrativo>atos-administrativos>atributos',
    });
    expect(linkByName(['Direito Administrativo', 'Licitações e contratos'], VOCAB)).toEqual({
      kind: 'linked',
      assuntoId: 'direito-administrativo>licitacoes',
    });
  });

  it('folha repetida em dois pais da mesma matéria fica para a IA', () => {
    expect(linkByName(['Direito Administrativo', 'Noções gerais', 'Conceito'], VOCAB)).toEqual({
      kind: 'ambiguous',
      candidates: ['direito-administrativo>atos-administrativos>conceito', 'direito-administrativo>licitacoes>conceito'],
    });
  });

  it('nunca liga a um assunto de outra matéria, nem à matéria inteira', () => {
    expect(linkByName(['Direito Tributário', 'Controle de constitucionalidade'], VOCAB)).toEqual({ kind: 'none' });
    expect(linkByName(['Direito Administrativo'], VOCAB)).toEqual({ kind: 'none' });
    expect(linkByName(['Direito Constitucional', 'Direito Constitucional'], VOCAB)).toEqual({ kind: 'none' });
  });

  it('os tópicos do plano criado do edital real da CGU ligam pelo nome ao vocabulário real', async () => {
    const vocab = (JSON.parse(readFileSync('acervo/vocabulario.json', 'utf8')) as { assuntos: PacoteAssunto[] }).assuntos;
    const edital = parseEdital(await loadFixturePdfLines('cgu-2026-affc-edital.pdf'));
    vi.resetModules();
    const db = await import('../lib/database');
    await db.initDatabase({ storage: createMemoryStorage(), sqlJsConfig: {} });
    const plan = db.createPlanFromEdital(draftToPlanInput(createEditalDraft(edital, 4, 20), edital, 4));

    const results: { caminho: string[]; kind: string }[] = [];
    for (const subject of db.getSubjectsByPlan(plan.id)) {
      const topics = db.getTopicsBySubject(subject.id);
      const byId = new Map(topics.map((t) => [t.id, t]));
      for (const t of topics) {
        const caminho = topicCaminho(subject.name, t, byId);
        results.push({ caminho, kind: linkByName(caminho, vocab).kind });
      }
    }
    const linked = results.filter((r) => r.kind === 'linked').length;
    expect(results.length).toBeGreaterThan(150);
    expect(linked / results.length).toBeGreaterThanOrEqual(0.95);
  }, 60_000);
});

describe('Ligação pela IA só para quem sobrou (spec 12c §5.3, 2º passo)', () => {
  const LICITACOES = ['Direito Administrativo', 'Licitações'];
  const vocab: PacoteAssunto[] = [
    assunto(['Direito Administrativo']),
    assunto(LICITACOES),
    assunto([...LICITACOES, 'Contratação direta: dispensa e inexigibilidade']),
    assunto([...LICITACOES, 'Modalidades de licitação']),
    assunto([...LICITACOES, 'Lei 14.133 e o planejamento das contratações']),
    assunto(['Direito Administrativo', 'Atos administrativos']),
    assunto(['Auditoria Governamental']),
    assunto(['Auditoria Governamental', 'Contratações públicas auditadas pelo controle']),
    ...Array.from({ length: 20 }, (_, i) => assunto(['Tecnologia da Informação', `Assunto sem relação ${i}`])),
  ];

  it('candidatos pelas palavras do caminho do tópico, sem raiz, até 15', () => {
    const caminho = ['Direito Administrativo', 'Lei 14.133', 'Contratações diretas'];
    const candidates = aiCandidates(caminho, vocab);
    const ids = candidates.map((c) => c.id);
    expect(ids).toContain(assuntoIdFromCaminho([...LICITACOES, 'Contratação direta: dispensa e inexigibilidade']));
    expect(ids[0]).toBe(assuntoIdFromCaminho([...LICITACOES, 'Contratação direta: dispensa e inexigibilidade']));
    expect(candidates.every((c) => c.caminho.length >= 2)).toBe(true);
    expect(ids.some((id) => id.startsWith('tecnologia'))).toBe(false);
    expect(aiCandidates(caminho, vocab, 2)).toHaveLength(2);
  });

  it('o prompt traz os ids dos candidatos, a regra de não inventar e o formato da resposta', () => {
    const candidates = aiCandidates(['Direito Administrativo', 'Lei 14.133', 'Contratações diretas'], vocab);
    const prompt = buildLinkPrompt(['Direito Administrativo', 'Lei 14.133', 'Contratações diretas'], candidates);
    for (const c of candidates) expect(prompt).toContain(c.id);
    expect(prompt).toContain('Direito Administrativo › Lei 14.133 › Contratações diretas');
    expect(prompt).toMatch(/não invente/i);
    expect(prompt).toContain('{"assuntos":[{"id":"…","confianca":0.0}]}');
  });

  const ids = new Set(['a', 'b', 'c', 'd']);

  it('aceita só ids da lista, com confiança de 0,7 para cima, no máximo 3', () => {
    expect(parseLinkResponse('{"assuntos":[{"id":"a","confianca":0.9},{"id":"inventado","confianca":0.99}]}', ids)).toEqual(['a']);
    expect(parseLinkResponse('{"assuntos":[{"id":"a","confianca":0.65},{"id":"b","confianca":0.7}]}', ids)).toEqual(['b']);
    expect(
      parseLinkResponse(
        '```json\n{"assuntos":[{"id":"a","confianca":0.8},{"id":"b","confianca":0.95},{"id":"c","confianca":0.9},{"id":"d","confianca":0.75}]}\n```',
        ids
      )
    ).toEqual(['b', 'c', 'a']);
  });

  it('lista vazia = nenhum serve; texto sem JSON = ilegível', () => {
    expect(parseLinkResponse('{"assuntos":[]}', ids)).toEqual([]);
    expect(parseLinkResponse('Não encontrei nenhum assunto adequado.', ids)).toBeNull();
    expect(parseLinkResponse('{"outra":1}', ids)).toBeNull();
  });
});
