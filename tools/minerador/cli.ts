import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLote, LOTE_PALAVRAS_PADRAO } from './acervoStore';
import { createAgyProvider, createProvider, loadKeys, type AiProvider } from './aiProvider';
import { eventListUrl, parseEventList } from './cebraspeApi';
import { CLASSIFY_SCHEMA } from './classifyPrompt';
import { recalcularConsenso, runClassificacao, type Alvo, type ClassifyReport } from './classifyRun';
import { buildPacote, writePacote } from './pacote';
import { createPoliteClient } from './politeClient';
import { formatReport } from './report';
import { runMinerador } from './runMinerador';
import { readEditalLines, readVocabulario, seedFromEdital, writeVocabulario } from './vocab';

/**
 * Minerador da Cebraspe (spec 12). Uso, na raiz do projeto:
 *   npm run minerar -- lote          → gera acervo/lote.json (o dono confere e edita a lista)
 *   npm run minerar -- rodar         → minera o lote, grava acervo/cebraspe/*.json e acervo/quarentena.json
 *   npm run minerar -- semente [edital.pdf] [--forcar]   → vocabulário inicial a partir do edital (padrão: CGU 2026)
 *   npm run minerar -- classificar [--provedor agy|groq|deepseek] [--modelo id] [--limite N]   → 1ª opinião  (--paralelo N: lotes simultâneos)
 *   npm run minerar -- conferir    [...]   → opinião independente de outro modelo em todos os itens
 *   npm run minerar -- desempatar  [...]   → só os itens em que as opiniões discordam
 *   npm run minerar -- pacote      → acervo/pacote/fofolab-acervo-cebraspe.json (para o app, na 12c)
 */
const ACERVO = 'acervo';
const CACHE = '.minerador-cache';
const ANO_MINIMO = 2021;
const USER_AGENT = 'FofoLab-minerador (estudo pessoal; github.com/lycoTi)';
const EDITAL_PADRAO = join('e2e', 'fixtures', 'cgu-2026-affc-edital.pdf');
const CANDIDATOS = 10;

/** Modelo padrão de cada comando no Antigravity: classificar com Gemini; conferir e desempatar com outra família. */
const AGY_PADRAO: Record<Alvo, string> = {
  'sem-opiniao': 'gemini-3.8-flash-low',
  todos: 'claude-sonnet-5-5-low',
  discordantes: 'gemini-4-argon-medium',
};

const writeJson = (path: string, data: unknown) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

/** O `agy` roda numa pasta vazia, longe do projeto: o texto dos itens é entrada não confiável e o agente tem ferramentas. */
function agyPaths() {
  const base = join(tmpdir(), 'fofolab-minerador-agy');
  const workDir = join(base, 'trabalho');
  mkdirSync(workDir, { recursive: true });
  const schemaPath = join(base, 'esquema.json');
  writeFileSync(schemaPath, JSON.stringify(CLASSIFY_SCHEMA));
  return { workDir, schemaPath };
}

function providerFrom(args: string[], alvo: Alvo): AiProvider {
  const nome = flag(args, 'provedor') ?? 'agy';
  const modelo = flag(args, 'modelo');
  if (nome === 'agy') return createAgyProvider({ modelo: modelo ?? AGY_PADRAO[alvo], ...agyPaths() });
  if (nome !== 'groq' && nome !== 'deepseek') throw new Error(`Provedor desconhecido: ${nome} (use agy, groq ou deepseek)`);
  const keys = loadKeys(process.env, ['.env.local', '.env']);
  const chave = keys[nome];
  if (!chave) throw new Error(`Falta a chave do ${nome} (VITE_${nome.toUpperCase()}_API_KEY no .env.local ou .env).`);
  return createProvider({ nome, chave, modelo });
}

function formatClassifyReport(r: ClassifyReport, provider: AiProvider): string {
  const lines = [
    `== Classificação (${provider.nome}:${provider.modelo}) ==`,
    `Itens com opinião nova: ${r.classificados} · incertos: ${r.incertos} · concordam: ${r.concordam} · discordam: ${r.discordam}`,
    `Sem resposta válida (voltam à fila): ${r.semResposta}`,
    `Vocabulário na versão ${r.versaoVocabulario}; assuntos novos aceitos: ${r.propostasAceitas.length}; propostas pendentes: ${r.propostasPendentes}`,
  ];
  for (const id of r.propostasAceitas) lines.push(`  + ${id}`);
  if (r.juncoesSugeridas.length > 0) {
    lines.push(`Junções sugeridas (${r.juncoesSugeridas.length}) — confira:`);
    for (const [a, b] of r.juncoesSugeridas.slice(0, 20)) lines.push(`  ${a}  ≈  ${b}`);
  }
  if (r.parouNoLimite) lines.push('Parou no limite de uso: rode o mesmo comando mais tarde — a fila continua de onde parou.');
  return lines.join('\n');
}

async function classify(args: string[], alvo: Alvo): Promise<number> {
  const provider = providerFrom(args, alvo);
  const limite = Number(flag(args, 'limite') ?? 1000);
  // O Antigravity aguenta lotes simultâneos (cada um leva ~1,5 min); o Groq grátis tem limite por minuto, então um por vez
  const paralelo = Number(flag(args, 'paralelo') ?? (provider.nome === 'agy' ? 3 : 1));
  const inicio = Date.now();
  const report = await runClassificacao({ provider, acervoDir: ACERVO, limite, alvo, k: CANDIDATOS, paralelo });
  console.log(formatClassifyReport(report, provider));
  console.log(`Tempo: ${Math.round((Date.now() - inicio) / 1000)} s com ${paralelo} lote(s) em paralelo.`);
  return 0;
}

async function main(args: string[]): Promise<number> {
  const command = args[0];
  mkdirSync(ACERVO, { recursive: true });

  if (command === 'lote' || command === 'rodar') {
    const client = createPoliteClient({ delayMs: 1000, userAgent: USER_AGENT });
    if (command === 'lote') {
      const events = parseEventList(await client.getJson(eventListUrl()));
      const identificadores = buildLote(events, { anoMinimo: ANO_MINIMO, palavras: LOTE_PALAVRAS_PADRAO });
      writeJson(join(ACERVO, 'lote.json'), { anoMinimo: ANO_MINIMO, identificadores });
      console.log(`${identificadores.length} concursos no lote (de ${events.length} encerrados). Confira e edite ${ACERVO}/lote.json.`);
      return 0;
    }
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

  if (command === 'semente') {
    const vocabPath = join(ACERVO, 'vocabulario.json');
    if (readVocabulario(vocabPath) && !args.includes('--forcar')) {
      console.error('O vocabulário já existe (e pode ter assuntos aceitos pela IA). Use --forcar para recomeçar da semente.');
      return 1;
    }
    const edital = args[1] && !args[1].startsWith('--') ? args[1] : EDITAL_PADRAO;
    const vocab = seedFromEdital(await readEditalLines(edital));
    writeVocabulario(vocabPath, vocab);
    const materias = vocab.assuntos.filter((a) => a.caminho.length === 1).length;
    console.log(`Vocabulário criado: ${vocab.assuntos.length} assuntos em ${materias} matérias (${edital}).`);
    return 0;
  }

  if (command === 'classificar') return classify(args, 'sem-opiniao');
  if (command === 'conferir') return classify(args, 'todos');
  if (command === 'desempatar') return classify(args, 'discordantes');

  if (command === 'recalcular') {
    const t = recalcularConsenso(ACERVO);
    console.log(`Consenso refeito: concordam ${t.concordam} · discordam ${t.discordam} · uma opinião ${t.umaOpiniao} · incertos ${t.incertos}.`);
    return 0;
  }

  if (command === 'pacote') {
    const path = join(ACERVO, 'pacote', 'fofolab-acervo-cebraspe.json');
    const pacote = buildPacote(ACERVO);
    writePacote(path, pacote);
    const classificados = pacote.itens.filter((i) => i.assuntos.length > 0).length;
    console.log(`Pacote gravado em ${path}: ${pacote.itens.length} itens (${classificados} com assunto), vocabulário v${pacote.vocabulario.versao}.`);
    return 0;
  }

  console.error('Uso: npm run minerar -- lote | rodar | semente | classificar | conferir | desempatar | recalcular | pacote');
  return 1;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
