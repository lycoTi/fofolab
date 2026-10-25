import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildLote, LOTE_PALAVRAS_PADRAO } from './acervoStore';
import { eventListUrl, FormatoCebraspeMudou, parseEventList } from './cebraspeApi';
import { createPoliteClient } from './politeClient';
import { formatReport } from './report';
import { runMinerador } from './runMinerador';

/**
 * Minerador da Cebraspe (spec 12, entrega 12a). Uso, na raiz do projeto:
 *   npm run minerar -- lote    → gera acervo/lote.json (o dono confere e edita a lista)
 *   npm run minerar -- rodar   → minera o lote, grava acervo/cebraspe/*.json e acervo/quarentena.json
 */
const ACERVO = 'acervo';
const CACHE = '.minerador-cache';
const ANO_MINIMO = 2021;
const USER_AGENT = 'FofoLab-minerador (estudo pessoal; github.com/lycoTi)';

const writeJson = (path: string, data: unknown) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

async function main(command: string | undefined): Promise<number> {
  const client = createPoliteClient({ delayMs: 1000, userAgent: USER_AGENT });
  mkdirSync(ACERVO, { recursive: true });

  if (command === 'lote') {
    const events = parseEventList(await client.getJson(eventListUrl()));
    const identificadores = buildLote(events, { anoMinimo: ANO_MINIMO, palavras: LOTE_PALAVRAS_PADRAO });
    writeJson(join(ACERVO, 'lote.json'), { anoMinimo: ANO_MINIMO, identificadores });
    console.log(`${identificadores.length} concursos no lote (de ${events.length} encerrados). Confira e edite ${ACERVO}/lote.json.`);
    return 0;
  }

  if (command === 'rodar') {
    const lotePath = join(ACERVO, 'lote.json');
    if (!existsSync(lotePath)) {
      console.error('Falta acervo/lote.json: rode "npm run minerar -- lote" primeiro.');
      return 1;
    }
    const { identificadores } = JSON.parse(readFileSync(lotePath, 'utf8')) as { identificadores: string[] };
    const report = await runMinerador({ client, acervoDir: ACERVO, cacheDir: CACHE, lote: identificadores });
    writeJson(join(ACERVO, 'quarentena.json'), [...report.quarentena].sort((a, b) => a.caderno.localeCompare(b.caderno)));
    console.log(formatReport(report));
    return 0;
  }

  console.error('Uso: npm run minerar -- lote | rodar');
  return 1;
}

main(process.argv[2])
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof FormatoCebraspeMudou ? err.message : err);
    process.exit(1);
  });
