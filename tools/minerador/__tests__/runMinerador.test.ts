// @vitest-environment node
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FormatoCebraspeMudou } from '../cebraspeApi';
import { FalhaDeRede, type PoliteClient } from '../politeClient';
import { formatReport } from '../report';
import { runMinerador } from '../runMinerador';
import { fixtureJson } from './fixtures';

const FIXTURES = join(__dirname, '..', '__fixtures__');

/** Cliente falso: serve o detalhe do SERPRO 2023 e os PDFs reais do caderno de específicos; o de básicos "cai" (503). */
function fakeClient(detail: unknown = fixtureJson('evento-SERPRO_23.json')): PoliteClient & { downloads: number } {
  const client = {
    downloads: 0,
    async getJson(url: string) {
      if (url.endsWith('/SERPRO_23')) return detail;
      throw new FalhaDeRede(url, 404, 'status 404');
    },
    async download(url: string, cachePath: string) {
      if (existsSync(cachePath)) return { path: cachePath, fromCache: true };
      const name = url.split('/').pop()!;
      if (!existsSync(join(FIXTURES, name))) throw new FalhaDeRede(url, 503, 'status 503');
      mkdirSync(dirname(cachePath), { recursive: true });
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
