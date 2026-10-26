# FofoLab — guia para o Claude Code

Projeto pessoal em pt-BR: bancada de estudos para concursos (CGU/BACEN), local-first. O dono desenvolve com o **Antigravity** no PC do trabalho e com o **Claude Code** no PC de casa — o contexto entre os dois vive **neste repositório**, não na memória da IA.

## Antes de mexer
1. Leia `docs/handoff/2026-10-24-estado-e-proxima-ia.md` (onde paramos, armadilhas, próximos passos) e `BACKLOG.md` (estado real, definição de pronto).
2. Leia só a spec do módulo que vai tocar em `docs/specs/` (01 banco, 02 IA/métricas, 03 admin, 05 wizard/meu dia, 06 persistência/importação, 07 edital real/ciclo pela nota mínima, 08 mapa de incidência (rascunho), 09 bancada/roteiro/Revisão do dia, 10 FofoDoro, 11 FofoIA e diagnóstico pela confiança, 12 minerador da Cebraspe, 13 plano de estudo).
3. Histórico de decisões: `docs/reviews/2026-10-21-estado-do-projeto.md`.
4. `graphify-out/` ajuda a navegar (`graphify query "..."`), mas confira a data: rode `graphify update .` depois de mudar código (o grafo fica velho fácil).

## Regras do projeto (carregadas sempre — fonte única em `.agents/rules/`, também usada pelo Antigravity)
@.agents/rules/definition-of-done.md
@.agents/rules/ui-clean-design-and-tdd.md
@.agents/rules/graphify.md
@.agents/rules/fofolab-especificos.md
@.agents/rules/identidade-fofolab.md

## Skills — leia o SKILL.md ANTES de começar o trabalho correspondente
Globais (stack `~/.agents`, valem para todos os projetos; o que é só do FofoLab está em `.agents/rules/fofolab-especificos.md`)
e locais (`.agents/skills/`: as originais de ciência da aprendizagem do GarethManning, lock em `skills-lock.json`). Regra global × local: `~/.agents/AGENTS.md`.

A tabela de qual skill global usar para cada trabalho está em `~/.agents/AGENTS.md` (seção 6). Aqui, só o que é do FofoLab:

| Trabalho | Skill / regra |
|---|---|
| Ciclo, domínio, revisão espaçada, métricas, tutor de IA, qualquer regra "pedagógica" | `learning-analytics-interpretation-guide`, `individual-spacing-algorithm-explainer`, `spaced-practice-scheduler`, `productive-failure-desirable-difficulty-designer` e as demais de `.agents/skills/` + seção Pedagogia de `fofolab-especificos.md` |
| Tela nova ou redesenho | `impeccable` + `ux-ui-clean` + `identidade-fofolab.md` (zonas, Fofo, pixel) + paleta/tom em `fofolab-especificos.md` |
| Ajuste em tela, modal, gráfico ou componente existente | `ux-ui-clean` + `identidade-fofolab.md` + paleta/tom em `fofolab-especificos.md` |
| Novo painel, componente grande, `App.tsx` | regra autoral de componentes (~250 linhas) + painéis em `fofolab-especificos.md` |
| Prompts de IA, parser de provas/edital, extração JSON | regra autoral de prompts + camadas lei → jurisprudência → banca em `fofolab-especificos.md` |
| Chaves de API, PDFs/HTML de bancas, `.fofopack` | `security-and-hardening` + seção Segurança de `fofolab-especificos.md` |
| Toda entrega | `test-driven-development` + `tdd-suite` + `verification-before-completion` |

## Outras regras
- **Nunca** grave resposta simulada da IA como explicação real; sem chave o app fica em modo demonstração rotulado.
- **Dados do estudante:** toda ação que apaga/substitui pede confirmação e chama `createSafetyBackup()` antes.
- Mudou o contrato SQL (`docs/specs/01-database-schema.sql`)? Crie a migração equivalente em `src/lib/migrations.ts` e suba `LATEST_SCHEMA_VERSION` (o teste de migrações compara os dois caminhos).
- Estilo: TypeScript strict, comentários e textos em pt-BR, sem ternários aninhados.

## Comandos
- `npm run dev` — navegador em http://localhost:1420 (banco no IndexedDB).
- `npm test` — Vitest (inclui o banco real rodando no Node).
- `npm run test:e2e` — Playwright no Microsoft Edge instalado (sobe o `npm run dev` sozinho); capturas em `e2e/.screens/`.
- `npm run build` — `tsc -b` + Vite. `npm run tauri:dev` / `tauri:build` — app desktop (precisa de Rust + VS C++ Build Tools).
- IA: chaves em `.env` ou `.env.local` (ambos fora do git), modelo em `.env.example`; sem chaves = modo demonstração. Groq é o provedor grátis em uso.

## Mapa rápido do código
- `src/lib/database.ts` — inicialização, gravação (imediata + agrupamento), backups/restauração, CRUD e importações.
- `src/lib/storage.ts` — onde o banco é gravado (arquivo Tauri / IndexedDB / memória) + cópias de segurança.
- `src/lib/migrations.ts` — versões do banco. `src/lib/saveStatus.ts` — status de gravação mostrado no cabeçalho.
- `src/lib/cycleEngine.ts` — motor do ciclo (pesos exportados) • `dailyPlanner.ts` — "Meu Dia" • `explainabilityEngine.ts` — textos do "ⓘ".
- `src/lib/aiRouter.ts` — Gateway → Groq → Gemini → DeepSeek (`callAiProviders`, com modelo forte opcional), explicação-base das questões.
- `src/lib/fofoia/` + `src/features/fofoia/` — FofoIA (spec 11): jeitos, contexto sem gabarito antes da resposta, prompts, resumo, "Cai no meu edital?", painel da coluna direita.
- `src/features/questions/` — aba Questões (confiança antes, correção embaixo) • `src/features/answer-flow/` — confiança/diagnóstico compartilhados • `src/lib/diagnosis.ts` — regras do diagnóstico e falsa certeza.
- `src/features/good-morning/` + `src/lib/{dailyReview,goodMorning,goodMorningStats}.ts` — aba Início e Revisão do dia (spec 09 §5.3).
- `src/features/pdf-reader/` — leitor de PDF (pdf.js): página atual, páginas lidas, zoom; maximizar/tela cheia ficam no `App.tsx`.
- `src/lib/questionImport.ts` / `syllabusImport.ts` — importadores (texto/JSON e conteúdo programático).
- `src/lib/editalParser.ts` + `src/features/edital-import/` — edital em PDF → prévia → plano (spec 07); teste com o PDF real em `e2e/fixtures/`.
- `src/features/study-block/` — bloco de estudo (máquina pura `studyBlockMachine.ts` + cartão e relógio do cabeçalho) • `features/study-plan/` — aba Plano de estudo (Sua semana, Ajustar; spec 13) + `lib/availability.ts` (horas por dia) e `lib/weekForecast.ts` (previsão da semana) + `lib/examProjection.ts` ("Dá tempo?", linha do tempo, reta final) • `features/cycle/` — divisão da semana por matéria • `features/heatmap/` — grade do Mapa de Calor.
- `src/lib/timeFormat.ts` — HH:mm • `src/components/RichText.tsx` — texto da IA/caderno formatado com segurança.
- `src/App.tsx` — orquestra estado e painéis; componentes em `src/components/` e `src/features/`.
- `tools/minerador/` — minerador da Cebraspe (spec 12), **fora do app**: `npm run minerar -- lote | rodar`. Grava o acervo
  em `acervo/cebraspe/<ID>.json` (no git); PDFs ficam em `.minerador-cache/` (fora do git). Nada em `src/` importa `tools/`.
  Assuntos (12b): `semente | classificar | conferir | desempatar | juntar | recalcular | pacote` → `acervo/vocabulario.json`
  e `acervo/classificacao/<ID>.json`; o `agy` (Antigravity CLI) roda numa pasta vazia com `--sandbox`. Um comando por vez.
