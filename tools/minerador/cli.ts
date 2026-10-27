import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLote, LOTE_PALAVRAS_PADRAO } from './acervoStore';
import { createAgyProvider, createProvider, loadKeys, type AiProvider } from './aiProvider';
import { eventDetailUrl, eventListUrl, fileUrl, isSafeIdentifier, parseEventDetail, parseEventList } from './cebraspeApi';
import { CLASSIFY_SCHEMA } from './classifyPrompt';
import { juntar, recalcularConsenso, runClassificacao, type Alvo, type ClassifyReport } from './classifyRun';
import { writePacoteAndIndex } from './pacote';
import { createPoliteClient } from './politeClient';
import { formatReport } from './report';
import { runMinerador, safeFileName } from './runMinerador';
import { selectOpeningEdital } from './examFiles';
import { createSpendLedger } from './spendLedger';
import { mergeVocabularios, readEditalLines, readVocabulario, seedFromEdital, writeVocabulario } from './vocab';

/**
 * Minerador da Cebraspe (spec 12). Uso, na raiz do projeto:
 *   npm run minerar -- lote          → gera acervo/lote.json (o dono confere e edita a lista)
 *   npm run minerar -- rodar         → minera o lote, grava acervo/cebraspe/*.json e acervo/quarentena.json
 *   npm run minerar -- semente [edital.pdf] [--forcar]   → vocabulário inicial a partir do edital (padrão: CGU 2026)
 *   npm run minerar -- classificar [--provedor agy|groq|deepseek] [--modelo id] [--limite N]   → 1ª opinião  (--paralelo N: lotes simultâneos)
 *   npm run minerar -- conferir    [...]   → opinião independente de outro modelo em todos os itens
 *   npm run minerar -- desempatar  [...]   → só os itens em que as opiniões discordam
 *   npm run minerar -- juntar <de> <para>   → assunto repetido vira o outro (vocabulário e classificações)
 *   npm run minerar -- recalcular  → refaz o consenso das opiniões guardadas, sem IA
 *   npm run minerar -- pacote      → acervo/pacote/fofolab-acervo-cebraspe.json (para o app, na 12c)
 */
const ACERVO = 'acervo';
const CACHE = '.minerador-cache';
/** Teto de gasto por dia com a DeepSeek (decisão do dono) e a cotação usada na conta, alta de propósito. */
const DEEPSEEK_TETO_BRL = 5;
const USD_BRL_CONSERVADOR = 6;
const ANO_MINIMO = 2021;
const USER_AGENT = 'FofoLab-minerador (estudo pessoal; github.com/lycoTi)';
const EDITAL_PADRAO = join('e2e', 'fixtures', 'cgu-2026-affc-edital.pdf');
const CANDIDATOS = 10;
/**
 * Editais de abertura que completam a semente (Português, Raciocínio Lógico, Direito, Contabilidade, Economia, TI): o
 * edital da CGU não tem essas matérias e, sem semente, cada modelo inventava um nome (spec 12 §6.4).
 */
const EDITAIS_SEMENTE = ['SERPRO_23', 'TCE_SC_21_AUDITOR', 'CNJ_24', 'CD_25_NS', 'MPO_24', 'SEFAZ_RN_25_AUDITOR'];

/**
 * Provedor e modelo padrão de cada comando, pelo que a cota permite (medido em 25/10): classificar com o Gemini Flash
 * (assinatura Google; ~5 mil itens por semana, 300 em ~24 min); conferir com o gpt-oss-120b no Groq grátis (outra
 * família; o limite de tokens por dia para em ~100 itens — e erra mais que o Gemini nos itens de interpretação de
 * texto); desempatar com o Claude Sonnet pelo Antigravity, que esgota a janela de 5 h em ~200 itens — só para poucos.
 */
const PADRAO: Record<Alvo, { provedor: 'agy' | 'groq' | 'deepseek'; modelo: string }> = {
  'sem-opiniao': { provedor: 'agy', modelo: 'gemini-3.8-flash-low' },
  todos: { provedor: 'groq', modelo: 'openai/gpt-oss-120b' },
  discordantes: { provedor: 'agy', modelo: 'claude-sonnet-5-5-low' },
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
  const nome = flag(args, 'provedor') ?? PADRAO[alvo].provedor;
  // Modelo padrão só vale com o provedor padrão; trocou o provedor sem dizer o modelo, vale o padrão daquele provedor
  const modelo = flag(args, 'modelo') ?? (nome === PADRAO[alvo].provedor ? PADRAO[alvo].modelo : undefined);
  if (nome === 'agy') return createAgyProvider({ modelo, ...agyPaths() });
  if (nome !== 'groq' && nome !== 'deepseek') throw new Error(`Provedor desconhecido: ${nome} (use agy, groq ou deepseek)`);
  const keys = loadKeys(process.env, ['.env.local', '.env']);
  const chave = keys[nome];
  if (!chave) throw new Error(`Falta a chave do ${nome} (VITE_${nome.toUpperCase()}_API_KEY no .env.local ou .env).`);
  if (nome === 'groq') return createProvider({ nome, chave, modelo });
  // DeepSeek é paga: teto por dia (R$ 5 por padrão) e dólar conservador (R$ 6), ajustáveis no ambiente
  const tetoBrl = Number(process.env.MINERADOR_DEEPSEEK_TETO_BRL) || DEEPSEEK_TETO_BRL;
  const usdBrl = Number(process.env.MINERADOR_USD_BRL) || USD_BRL_CONSERVADOR;
  const ledger = createSpendLedger(join(CACHE, 'gasto-deepseek.json'), { usdBrl });
  console.log(`DeepSeek: gasto de hoje R$ ${ledger.hoje().toFixed(2)} de R$ ${tetoBrl.toFixed(2)} (contado no preço de pico).`);
  return createProvider({ nome, chave, modelo, gasto: { ledger, tetoBrl } });
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

/** Matérias do edital do dono (ids de 1º nível): os itens delas vão para o começo da fila. */
async function ownerSubjects(): Promise<Set<string>> {
  const seeded = seedFromEdital(await readEditalLines(EDITAL_PADRAO));
  return new Set(seeded.assuntos.filter((a) => a.caminho.length === 1).map((a) => a.id));
}

async function classify(args: string[], alvo: Alvo): Promise<number> {
  const provider = providerFrom(args, alvo);
  const limite = Number(flag(args, 'limite') ?? 1000);
  // O Antigravity aguenta lotes simultâneos (cada um leva ~1,5 min); o Groq grátis tem limite por minuto, então um por vez
  const paralelo = Number(flag(args, 'paralelo') ?? (provider.nome === 'agy' ? 3 : 1));
  const prioridade = await ownerSubjects();
  const inicio = Date.now();
  const report = await runClassificacao({ provider, acervoDir: ACERVO, limite, alvo, k: CANDIDATOS, paralelo, prioridade });
  console.log(formatClassifyReport(report, provider));
  console.log(`Tempo: ${Math.round((Date.now() - inicio) / 1000)} s com ${paralelo} lote(s) em paralelo.`);
  if (report.classificados > 0) {
    const { entry } = writePacoteAndIndex(ACERVO);
    console.log(`Pacote atualizado: ${entry.itensComAssunto} itens com assunto, vocabulário v${entry.vocabVersion}.`);
  }
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
    // O edital do dono primeiro (os nomes dele vencem na junção); depois os de abertura de concursos do acervo
    const edital = args[1] && !args[1].startsWith('--') ? args[1] : EDITAL_PADRAO;
    const vocabs = [seedFromEdital(await readEditalLines(edital))];
    console.log(`  ${edital}: ${vocabs[0].assuntos.length} assuntos`);
    const ids = (flag(args, 'editais') ?? EDITAIS_SEMENTE.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
    const client = createPoliteClient({ delayMs: 1000, userAgent: USER_AGENT });
    for (const id of ids) {
      if (!isSafeIdentifier(id)) continue;
      const detail = parseEventDetail(await client.getJson(eventDetailUrl(id)));
      const opening = selectOpeningEdital(detail);
      if (!opening) {
        console.log(`  ${id}: sem edital de abertura — ignorado`);
        continue;
      }
      const { path } = await client.download(fileUrl(detail.tipo, id, opening.nomeArquivo), join(CACHE, id, safeFileName(opening.nomeArquivo)));
      const seeded = seedFromEdital(await readEditalLines(path));
      // O leitor de edital foi feito no formato da CGU 2026: edital em que ele não acha matérias fica de fora
      if (seeded.assuntos.length === 0) {
        console.log(`  ${id}: o leitor não reconheceu as matérias — ignorado`);
        continue;
      }
      vocabs.push(seeded);
      console.log(`  ${id}: ${seeded.assuntos.length} assuntos`);
    }
    const vocab = mergeVocabularios(vocabs);
    writeVocabulario(vocabPath, vocab);
    const materias = vocab.assuntos.filter((a) => a.caminho.length === 1).length;
    console.log(`Vocabulário criado: ${vocab.assuntos.length} assuntos em ${materias} matérias, de ${vocabs.length} editais.`);
    return 0;
  }

  if (command === 'classificar') return classify(args, 'sem-opiniao');
  if (command === 'conferir') return classify(args, 'todos');
  if (command === 'desempatar') return classify(args, 'discordantes');

  if (command === 'juntar') {
    const [de, para] = [args[1], args[2]];
    if (!de || !para) {
      console.error('Uso: npm run minerar -- juntar <id-repetido> <id-que-fica>  (ids como estão em acervo/vocabulario.json)');
      return 1;
    }
    const r = juntar(ACERVO, de, para);
    const { entry } = writePacoteAndIndex(ACERVO);
    console.log(
      `Junção feita: vocabulário na versão ${r.versaoVocabulario}; ${r.itensAfetados} itens classificados trocaram de assunto (pacote atualizado: ${entry.itensComAssunto} com assunto).`
    );
    return 0;
  }

  if (command === 'recalcular') {
    const t = recalcularConsenso(ACERVO);
    const { entry } = writePacoteAndIndex(ACERVO);
    console.log(
      `Consenso refeito: concordam ${t.concordam} · discordam ${t.discordam} · uma opinião ${t.umaOpiniao} · incertos ${t.incertos} (pacote atualizado: ${entry.itensComAssunto} com assunto).`
    );
    return 0;
  }

  if (command === 'pacote') {
    const { pacote, entry } = writePacoteAndIndex(ACERVO);
    console.log(
      `Pacote gravado em ${join(ACERVO, 'pacote')}: ${pacote.itens.length} itens (${entry.itensComAssunto} com assunto), vocabulário v${entry.vocabVersion}.`
    );
    return 0;
  }

  console.error('Uso: npm run minerar -- lote | rodar | semente | classificar | conferir | desempatar | juntar | recalcular | pacote');
  return 1;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
