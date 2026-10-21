# FofoLab — guia para o Claude Code

Projeto pessoal em pt-BR: bancada de estudos para concursos (CGU/BACEN), local-first. O dono desenvolve com o **Antigravity** no PC do trabalho e com o **Claude Code** no PC de casa — o contexto entre os dois vive **neste repositório**, não na memória da IA.

## Antes de mexer
1. Leia `BACKLOG.md` — estado real, definição de pronto e checklist do PC de casa.
2. Leia só a spec do módulo que vai tocar em `docs/specs/` (01 banco, 02 IA/métricas, 03 admin, 05 wizard/meu dia, 06 persistência/importação).
3. Histórico de decisões: `docs/reviews/2026-10-21-estado-do-projeto.md`.
4. `graphify-out/` ajuda a navegar (`graphify query "..."`), mas confira a data: rode `graphify update .` depois de mudar código (o grafo fica velho fácil).

## Regras do projeto
- **Interface sem jargão técnico** (`.agents/rules/ui-clean-design-and-tdd.md`): nada de "SQLite", "IndexedDB", "Cache", "_score"… na tela. Há teste que audita.
- **Definição de pronto** (`.agents/rules/definition-of-done.md`): só marque `[DONE]` no BACKLOG o que funciona com dados reais, sobrevive a reiniciar e tem teste (E2E se atravessar telas). O resto é `[PARCIAL]` / `[A VERIFICAR]` com o motivo.
- **Nunca** grave resposta simulada da IA como explicação real; sem chave o app fica em modo demonstração rotulado.
- **Dados do estudante:** toda ação que apaga/substitui pede confirmação e chama `createSafetyBackup()` antes.
- Mudou o contrato SQL (`docs/specs/01-database-schema.sql`)? Crie a migração equivalente em `src/lib/migrations.ts` e suba `LATEST_SCHEMA_VERSION` (o teste de migrações compara os dois caminhos).
- Estilo: TypeScript strict, comentários e textos em pt-BR, sem ternários aninhados.

## Comandos
- `npm run dev` — navegador em http://localhost:1420 (banco no IndexedDB).
- `npm test` — Vitest (inclui o banco real rodando no Node).
- `npm run test:e2e` — Playwright no Microsoft Edge instalado (sobe o `npm run dev` sozinho); capturas em `e2e/.screens/`.
- `npm run build` — `tsc -b` + Vite. `npm run tauri:dev` / `tauri:build` — app desktop (precisa de Rust + VS C++ Build Tools).
- IA: copie `.env.example` para `.env.local` (sem variáveis = modo demonstração).

## Mapa rápido do código
- `src/lib/database.ts` — inicialização, gravação (imediata + agrupamento), backups/restauração, CRUD e importações.
- `src/lib/storage.ts` — onde o banco é gravado (arquivo Tauri / IndexedDB / memória) + cópias de segurança.
- `src/lib/migrations.ts` — versões do banco. `src/lib/saveStatus.ts` — status de gravação mostrado no cabeçalho.
- `src/lib/cycleEngine.ts` — motor do ciclo (pesos exportados) • `dailyPlanner.ts` — "Meu Dia" • `explainabilityEngine.ts` — textos do "ⓘ".
- `src/lib/aiRouter.ts` — Gateway → Gemini → DeepSeek, prompts com grounding, modo demonstração.
- `src/lib/questionImport.ts` / `syllabusImport.ts` — importadores (texto/JSON e conteúdo programático).
- `src/App.tsx` — orquestra estado e painéis; componentes em `src/components/` e `src/features/`.
