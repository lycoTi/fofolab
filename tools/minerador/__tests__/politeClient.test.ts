// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createPoliteClient, FalhaDeRede } from '../politeClient';

const UA = 'FofoLab-minerador (teste)';

function setup(responder: (url: string) => Response | Promise<Response>) {
  const fetchImpl = vi.fn(async (url: string | URL | Request) => responder(String(url)));
  const sleep = vi.fn(async () => {});
  const client = createPoliteClient({ delayMs: 1000, userAgent: UA, fetchImpl: fetchImpl as unknown as typeof fetch, sleep });
  return { client, fetchImpl, sleep };
}

describe('Cliente educado: pausa, identificação e cache', () => {
  it('espera 1 s entre requisições e se identifica', async () => {
    const { client, fetchImpl, sleep } = setup(() => new Response('{"ok":true}'));
    await client.getJson('https://x/a');
    await client.getJson('https://x/b');
    expect(sleep).toHaveBeenCalledWith(1000);
    const init = fetchImpl.mock.calls[0][1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get('User-Agent')).toBe(UA);
  });

  it('baixa uma vez e depois usa o cache, sem pedir de novo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'minerador-'));
    const { client, fetchImpl } = setup(() => new Response(new Uint8Array([1, 2, 3])));
    const path = join(dir, 'SERPRO_23', 'prova.pdf');
    expect(await client.download('https://x/prova.pdf', path)).toEqual({ path, fromCache: false });
    expect([...readFileSync(path)]).toEqual([1, 2, 3]);
    expect(await client.download('https://x/prova.pdf', path)).toEqual({ path, fromCache: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('erro do servidor ou de rede vira FalhaDeRede, sem deixar arquivo pela metade', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'minerador-'));
    const { client } = setup((url) => {
      if (url.endsWith('/caiu')) throw new TypeError('fetch failed');
      return new Response('fora do ar', { status: 503 });
    });
    await expect(client.download('https://x/503.pdf', join(dir, 'a.pdf'))).rejects.toMatchObject({ name: 'FalhaDeRede', status: 503 });
    expect(existsSync(join(dir, 'a.pdf'))).toBe(false);
    await expect(client.getJson('https://x/caiu')).rejects.toMatchObject({ name: 'FalhaDeRede', status: null });
  });

  it('corpo que não é JSON vira FalhaDeRede', async () => {
    const { client } = setup(() => new Response('<html>manutenção</html>'));
    await expect(client.getJson('https://x/a')).rejects.toBeInstanceOf(FalhaDeRede);
  });
});
