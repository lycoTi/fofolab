# Estado do projeto e instruções para a próxima IA — 24/10/2026

> Para quem continuar (Claude Code, Antigravity ou outra IA, em qualquer PC). Leia isto, depois `BACKLOG.md`. O contexto
> vive no repositório, não na memória da IA. Substitui `2026-10-22-continuar-no-outro-pc.md` (que segue válido para
> preparar um PC novo: stack `~/.agents`, Impeccable, `npm install`).

## 0. Atualização de 25/10/2026 (leia primeiro)
- **Spec 12 — minerador de provas da Cebraspe** (`docs/specs/12-minerador-cebraspe.md`) e entrega **12a** prontas:
  `tools/minerador/` (fora do app, `npm run minerar -- lote | rodar`), acervo com **29,9 mil itens** de 59 concursos (revisão independente corrigida) em
  `acervo/cebraspe/*.json` (no git, 32 MB); PDFs em `.minerador-cache/` (fora do git — no outro PC, `rodar` baixa de
  novo, devagar). Quarentenas e pendentes com motivo no BACKLOG e em `acervo/quarentena.json`.
- **12b em andamento [PARCIAL]** (detalhes no BACKLOG): vocabulário v14 e 300 itens classificados pelo Gemini. Para
  continuar a fila (CGU primeiro; para limpo no limite e continua de onde parou):
  `npm run minerar -- classificar --limite 1000` (Gemini 3.8 Flash pelo Antigravity CLI `agy`, já logado neste PC —
  ~5 mil itens por semana de cota). **Nunca rode dois comandos do minerador ao mesmo tempo:** os dois gravam os
  mesmos arquivos de `acervo/classificacao/`. Assunto repetido no vocabulário: `npm run minerar -- juntar <de> <para>`.
  O Groq grátis só confere ~100 itens por dia (limite de tokens) e erra mais que o Gemini em interpretação de texto;
  a 2ª opinião do acervo todo fica para o DeepSeek, quando o dono puser crédito (decisão dele).
- **Depois:** **brainstorm da aba Questões** (filtros por procedência/ano/cargo/formato) → 12c (app importa e mostra no
  plano).
- **FofoIA (25/10):** "oi"/"valeu"/"ok" respondidos pelo app (`src/lib/fofoia/smallTalk.ts`), resposta nova surgindo
  por parágrafo (`RichText reveal`).
- **Stack `~/.agents`** instalada neste PC (casa) e ligada ao Antigravity; plugin `zizi-skills` desligado no Claude.
- **Armadilhas do minerador:** a Cebraspe publica alguns arquivos com nome em hash (pareia pela descrição); a 1ª página
  tem instruções em duas colunas acima do título da seção (descartadas); o recuo de continuação é aprendido da linha após
  o começo do item, relativo à margem. Cada caso tem prova real em `tools/minerador/__fixtures__/`.

## 1. Onde o projeto está
- **Branch de trabalho:** `fatia-7-edital-ciclo` (a `main` tem só até as fatias 5.5–5.7). Commits locais podem não ter
  ido ao GitHub: confira com `git status` / `git log origin/fatia-7-edital-ciclo..` e pergunte ao dono antes de `push`.
- **Banco:** migração **v10** (`LATEST_SCHEMA_VERSION = 10`): v5 roteiro do dia, v6 assinatura do perfil, v7 registro de
  questões feitas fora do app, v8 Revisão do dia, v9 "Tenho meu método" da FofoIA, v10 delta de domínio aplicado por
  tentativa. Nunca edite uma migração existente.
- **Verificado em 24/10:** `npm test` (355), `npm run test:e2e` (31, duas rodadas), `npm run build` verdes; revisão
  independente da FofoIA feita e corrigida (commit `9375fe9`).
- **Entregas prontas (planos em `docs/superpowers/plans/`):** 9a casca • 9b roteiro na coluna • 7b registro de fora •
  FofoDoro (spec 10) • 9c Revisão do dia + aba Início (Situação, cobertura × proficiência, ritmo, continuar de onde parou,
  últimas 4 semanas, calibração) • bloco que sobrevive a recarregar • **11 FofoIA + diagnóstico pela confiança** (abaixo).

## 2. O que a FofoIA é (spec `docs/specs/11-fofoia.md`)
- Um só professor na coluna direita (aba **FofoIA**; o painel "Explicação & Estudo Reverso" saiu da aba **Questões**).
- **Jeitos** escolhidos pelos sinais do estudante, com selinho: 🐹💡 Rápida · 🐹🌱 Do zero · 🐹📚 Aula completa (em
  partes, alarga a coluna para 560 px) · 🐹📝 Resumo (formato da Dora, só vai ao caderno com IA real e confirmação) ·
  🐹🧭 Cai no meu edital? (filtro local dos tópicos, até 20) · 🐹🔎 Pista. Inspirados nos professores do grupo de estudos
  do dono (Diana, Bill, Dora, Jorge) — créditos na spec.
- **Gabarito nunca vai para a IA antes de o estudante responder** (`src/lib/fofoia/context.ts`). Pergunta livre com a
  questão aberta vira pista; a aula pedida segue sem gabarito.
- **Aba Questões:** confiança obrigatória antes das alternativas (Sei / Acho que sei / Vou chutar); a tentativa é gravada
  ao responder e o diagnóstico é deduzido (acerto: Dominei / Acertei na dúvida / **Acertei no chute**; erro: "Por quê?" →
  Não sabia / **Confundi com outra coisa** / Pegadinha ou desatenção); trocar corrige a mesma tentativa
  (`updateAttemptDiagnosis`). **Falsa certeza** (Sei + erro, exceto pegadinha) pesa mais no calor.
- Aquecimento antes da primeira aula num tópico nunca tentado (palpite + "Tentar 3 questões"), uma vez por tópico;
  desligável no Wizard ("Sugerir tentar antes da aula").
- Modelo forte opcional: `VITE_GROQ_MODEL_STRONG` / `VITE_GEMINI_MODEL_STRONG` (aula e edital).

## 3. Mapa do código novo
- `src/lib/fofoia/` — regras puras (sinais, contexto, prompts, resumo, filtro do edital, demonstração, chamada).
- `src/features/fofoia/` — painel, mensagem, conversa (memória, recomeça ao trocar de tópico), entradas vindas do App.
- `src/features/questions/` — aba Questões (filtros, cartão, correção, orquestrador).
- `src/features/answer-flow/` + `src/lib/answerLabels.ts` — confiança, alternativas, correção e diagnóstico
  compartilhados (aba Questões e Revisão do dia).
- `src/features/good-morning/` + `src/lib/{dailyReview,goodMorning,goodMorningStats}.ts` — aba Início e Revisão do dia.
- `src/components/Collapse.tsx` + `.fofolab-collapse` em `index.css` — abrir/fechar animado (respeita "menos movimento").

## 4. Armadilhas conhecidas (economize tempo)
- **Node:** o projeto precisa de Node 20+ (`nvm use 22.21.1`); o Node do sistema do dono está na 16 por outro projeto.
- **RDP/AnyDesk:** o Windows desliga as animações na sessão remota e o app obedece a "menos movimento" — animação "sumida"
  no acesso remoto não é defeito; confira direto no PC.
- **`scrollIntoView` no Chromium recente devolve uma Promise:** nunca use em `useEffect(() => el.scrollIntoView())` sem
  chaves (o React trata a Promise como limpeza e a árvore cai — os E2E travam por timeout sem erro claro).
- **E2E:** Playwright no Edge instalado; rótulos com `exact: true` quando um nome contém o outro ("Sei" × "Acho que sei").
  Sondas descartáveis em `e2e/_probe/` (apague depois).
- **graphify:** `graphify-out/` vai para o git sem `cache/` (ignorado); rode `graphify update .` depois de mudar código.
- **TEC:** Termos de Uso §18.8 proíbem processar o conteúdo deles com script ou IA — nada de colar questão do TEC na IA.
- **Groq grátis:** 8.000 tokens/min no total e **1.000 tokens de resposta/min** no `qwen/qwen3.8-27b`; todo pedido precisa
  de teto (`maxTokens` em `callAiProviders`). Sem isso o 429 vem em ~100 ms e parece "a IA caiu".
- **Stack `~/.agents`:** no PC de casa sem Modo de Desenvolvedor o `~/.gemini/GEMINI.md` é **cópia** do `AGENTS.md` —
  depois de `git -C ~/.agents pull`, rode `~/.agents/install.ps1` de novo.
- **Dívida:** `App.tsx` (~1.440 linhas) e o Wizard (~420) passam do teto de ~250; extrair fatias quando mexer neles.

## 5. Próximos passos (em ordem sugerida, confirme com o dono)
1. ~~Testar a FofoIA com a chave real do Groq~~ **feito em 24/10 (tarde)**: teto de resposta por chamada (o Groq grátis só
   aceita 1.000 tokens de resposta por minuto e recusava quase tudo), aviso de pausa no 429, prompts mais firmes. Pista de C/E agora é do
   app, sem IA (a IA entregava a resposta em qualquer modelo). O dono pôs `VITE_GROQ_MODEL_STRONG=openai/gpt-oss-120b`
   (aula e edital) e vai pôr crédito no DeepSeek (~R$ 20/mês) — testar o DeepSeek quando houver saldo. Como
   testar de novo: uma sonda Vitest temporária com `// @vitest-environment node` chamando `buildFofoPrompt` +
   `fetch` no Groq, 61 s entre chamadas (limite por minuto), e apagar o arquivo depois (o `npm test` o pegaria).
2. **FofoIA com a letra da lei** (spec 11 §8): brainstorm próprio sobre o repositório público `ctresb/leis` — trazer só
   as leis do edital, com link da fonte oficial, e mandar o artigo exato no prompt.
3. **Topo da aba Ciclo junto com o cronograma** (BACKLOG): "Sua semana" com uma barrinha por dia.
4. **Banco de questões a partir das provas oficiais** (épico; brainstorm antes) e depois o mapa de incidência (spec 08).
5. **Checklist do app desktop** (Tauri nunca compilado) — BACKLOG.

## 6. Como o dono gosta de trabalhar
- pt-BR, direto, sem jargão; economizar uso de IA; executar na própria sessão com **revisão independente no fim**.
- Fluxo: brainstorm (`brainstorming`) → spec em `docs/specs/` → plano (`writing-plans`) → TDD tarefa a tarefa com commit
  por tarefa → `npm test` + E2E (2 rodadas) + build → revisor independente → correções com teste → BACKLOG + handoff +
  `graphify update .`.
- Ação que apaga dados do estudante: confirmação + `createSafetyBackup()`. Não fazer `push` sem o dono pedir.

## 7. Mensagem para colar na próxima IA
> Leia `docs/handoff/2026-10-24-estado-e-proxima-ia.md` e o `BACKLOG.md`. A FofoIA (spec 11) está pronta no branch
> `fatia-7-edital-ciclo`. Quero começar pelo passo ‹N› da seção 5. Siga o fluxo da seção 6 (brainstorm se for coisa nova;
> execução na sessão com revisão independente no fim).
