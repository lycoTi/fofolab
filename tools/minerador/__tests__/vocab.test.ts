// @vitest-environment node
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { assuntoId, readEditalLines, seedFromEdital, type Vocabulario } from '../vocab';

const EDITAL = join(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'cgu-2026-affc-edital.pdf');

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
