// @vitest-environment node
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FormatoCebraspeMudou } from '../cebraspeApi';
import { FalhaDeRede, type PoliteClient } from '../politeClient';
import { formatReport } from '../report';
import { runMinerador } from '../runMinerador';
import type { AcervoItem } from '../types';
import { fixtureJson } from './fixtures';

const FIXTURES = join(__dirname, '..', '__fixtures__');

/**
 * Cliente falso: serve o detalhe do SERPRO 2023 e os PDFs reais do caderno de específicos; o de básicos "cai" (503).
 * `trocas` substitui o conteúdo de um arquivo pelo nome (PDF corrompido, gabarito de outra prova).
 */
function fakeClient(detail: unknown = fixtureJson('evento-SERPRO_23.json'), trocas: Record<string, Uint8Array> = {}): PoliteClient & { downloads: number } {
  const client = {
    downloads: 0,
    async getJson(url: string) {
      if (url.endsWith('/SERPRO_23')) return detail;
      throw new FalhaDeRede(url, 404, 'status 404');
    },
    async download(url: string, cachePath: string) {
      if (existsSync(cachePath)) return { path: cachePath, fromCache: true };
      const name = decodeURIComponent(url.split('/').pop()!);
      mkdirSync(dirname(cachePath), { recursive: true });
      if (trocas[name]) {
        writeFileSync(cachePath, trocas[name]);
        client.downloads += 1;
        return { path: cachePath, fromCache: false };
      }
      if (!existsSync(join(FIXTURES, name))) throw new FalhaDeRede(url, 503, 'status 503');
      copyFileSync(join(FIXTURES, name), cachePath);
      client.downloads += 1;
      return { path: cachePath, fromCache: false };
    },
  };
  return client;
}

describe('Rodada completa do minerador', () => {
  it('minera o SERPRO 2023, registra a falha de rede sem parar e grava o acervo', async () => {
    const root = mkdtempSync(join(tmpdir(), 'minerador-'));
    const opts = { acervoDir: join(root, 'acervo'), cacheDir: join(root, 'cache'), lote: ['SERPRO_23'] };
    const report = await runMinerador({ ...opts, client: fakeClient() });

    expect(report).toMatchObject({ concursos: 1, provas: 1, itens: 70, anulados: 9, comCodigo: 2, quarentena: [], pendentes: [] });
    // O caderno de básicos (e as justificativas, que o cliente falso também não tem) falham sem parar a rodada
    expect(report.falhas).toContainEqual({ identificador: 'SERPRO_23/846_SERPRO_23_CB1_01', erro: expect.stringContaining('503') });
    const file = join(opts.acervoDir, 'cebraspe', 'SERPRO_23.json');
    expect(existsSync(file)).toBe(true);
    expect(formatReport(report)).toContain('Itens extraídos: 70');

    // Segunda rodada: nada novo é baixado e o acervo sai idêntico, byte a byte
    const before = readFileSync(file);
    const again = await runMinerador({ ...opts, client: fakeClient() });
    expect(again.baixados).toBe(0);
    expect(readFileSync(file).equals(before)).toBe(true);
  }, 15000);

  it('PDF que o leitor não consegue abrir vai para a quarentena sem derrubar a rodada', async () => {
    const root = mkdtempSync(join(tmpdir(), 'minerador-'));
    const corrompido = new TextEncoder().encode('%PDF-1.4\nisto não é um PDF de verdade');
    const report = await runMinerador({
      client: fakeClient(undefined, { '846_SERPRO_23_001_01.PDF': corrompido }),
      acervoDir: join(root, 'acervo'), cacheDir: join(root, 'cache'), lote: ['SERPRO_23'],
    });
    expect(report.quarentena).toContainEqual({ caderno: 'SERPRO_23/846_SERPRO_23_001_01', motivo: expect.stringContaining('PDF') });
  });

  it('reprocessar um caderno tira só as procedências dele; quarentena tira os itens antigos do caderno', async () => {
    const root = mkdtempSync(join(tmpdir(), 'minerador-'));
    const opts = { acervoDir: join(root, 'acervo'), cacheDir: join(root, 'cache'), lote: ['SERPRO_23'] };
    await runMinerador({ ...opts, client: fakeClient() });
    const file = join(opts.acervoDir, 'cebraspe', 'SERPRO_23.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    // Simula um item que também veio de outro caderno (que hoje falha por rede)
    data.itens[0].procedencias.push({ ...data.itens[0].procedencias[0], caderno: '846_SERPRO_23_CB1_01', numero: 3 });
    writeFileSync(file, JSON.stringify(data));
    await runMinerador({ ...opts, client: fakeClient() });
    const after = JSON.parse(readFileSync(file, 'utf8'));
    expect(after.itens.some((i: AcervoItem) => i.procedencias.some((p) => p.caderno === '846_SERPRO_23_CB1_01'))).toBe(true);

    // O caderno agora em quarentena (gabarito trocado por outro de outra prova): seus itens antigos saem
    const otherKey = new Uint8Array(readFileSync(join(FIXTURES, 'GAB_DEFINITIVO_860_PMSC_OFICIAL_OBJ_001_01.PDF')));
    const report = await runMinerador({
      ...opts, cacheDir: join(root, 'cache2'),
      client: fakeClient(undefined, { 'GAB_DEFINITIVO_846_SERPRO_23_001_01.PDF': otherKey }),
    });
    expect(report.quarentena.map((q) => q.caderno)).toContain('SERPRO_23/846_SERPRO_23_001_01');
    const final = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).itens : [];
    expect(final.some((i: AcervoItem) => i.procedencias.some((p) => p.caderno === '846_SERPRO_23_001_01'))).toBe(false);
  }, 15000);

  it('identificador estranho no lote não vira caminho de arquivo', async () => {
    const root = mkdtempSync(join(tmpdir(), 'minerador-'));
    const report = await runMinerador({ client: fakeClient(), acervoDir: join(root, 'acervo'), cacheDir: join(root, 'cache'), lote: ['../fora'] });
    expect(report.falhas).toEqual([{ identificador: '../fora', erro: expect.stringContaining('identificador') }]);
    expect(existsSync(join(root, 'fora.json'))).toBe(false);
  });

  it('formato inesperado da API para tudo e não grava nada', async () => {
    const root = mkdtempSync(join(tmpdir(), 'minerador-'));
    const broken = { eventoURL: 'SERPRO_23', eventoAno: 2023, eventoTipo: 'concursos' };
    await expect(
      runMinerador({ client: fakeClient(broken), acervoDir: join(root, 'acervo'), cacheDir: join(root, 'cache'), lote: ['SERPRO_23'] })
    ).rejects.toBeInstanceOf(FormatoCebraspeMudou);
    expect(existsSync(join(root, 'acervo')) ? readdirSync(join(root, 'acervo'), { recursive: true }) : []).toEqual([]);
  });
});
