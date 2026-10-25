import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Acesso à Cebraspe com educação (spec 12 §3): uma requisição por vez, pausa entre elas, identificação no User-Agent e
 * cache em disco — arquivo já baixado nunca é pedido de novo.
 */
export interface PoliteClient {
  getJson(url: string): Promise<unknown>;
  download(url: string, cachePath: string): Promise<{ path: string; fromCache: boolean }>;
}

export class FalhaDeRede extends Error {
  constructor(public readonly url: string, public readonly status: number | null, detalhe: string) {
    super(`Falha ao acessar ${url}: ${detalhe}`);
    this.name = 'FalhaDeRede';
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Todo PDF começa com "%PDF-": página de erro em HTML com nome .pdf não entra no cache. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
const isPdf = (data: Uint8Array) => PDF_MAGIC.every((byte, i) => data[i] === byte);

export function createPoliteClient(opts: {
  delayMs: number;
  userAgent: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): PoliteClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  let first = true;

  async function request(url: string): Promise<Response> {
    if (!first) await sleep(opts.delayMs);
    first = false;
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { 'User-Agent': opts.userAgent } });
    } catch (err) {
      throw new FalhaDeRede(url, null, err instanceof Error ? err.message : String(err));
    }
    if (!response.ok) throw new FalhaDeRede(url, response.status, `status ${response.status}`);
    return response;
  }

  return {
    async getJson(url) {
      const response = await request(url);
      const text = await response.text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new FalhaDeRede(url, response.status, 'a resposta não é JSON');
      }
    },

    async download(url, cachePath) {
      const expectsPdf = /\.pdf$/i.test(cachePath);
      // Cache corrompido (ex.: página de erro salva como .pdf numa versão antiga) é baixado de novo
      if (existsSync(cachePath) && (!expectsPdf || isPdf(readFileSync(cachePath)))) return { path: cachePath, fromCache: true };
      const response = await request(url);
      const data = new Uint8Array(await response.arrayBuffer());
      if (expectsPdf && !isPdf(data)) throw new FalhaDeRede(url, response.status, 'o arquivo baixado não é um PDF');
      mkdirSync(dirname(cachePath), { recursive: true });
      // Grava ao lado e renomeia: download interrompido não vira cache corrompido
      const partial = `${cachePath}.parcial`;
      writeFileSync(partial, data);
      renameSync(partial, cachePath);
      return { path: cachePath, fromCache: false };
    },
  };
}
