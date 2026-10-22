# FofoLab — guia para o Claude Code

Projeto pessoal em pt-BR: bancada de estudos para concursos (CGU/BACEN), local-first. O dono desenvolve com o **Antigravity** no PC do trabalho e com o **Claude Code** no PC de casa — o contexto entre os dois vive **neste repositório**, não na memória da IA.

## Antes de mexer
1. Leia `BACKLOG.md` — estado real, definição de pronto e checklist do PC de casa.
2. Leia só a spec do módulo que vai tocar em `docs/specs/` (01 banco, 02 IA/métricas, 03 admin, 05 wizard/meu dia, 06 persistência/importação).
3. Histórico de decisões: `docs/reviews/2026-10-21-estado-do-projeto.md`.
4. `graphify-out/` ajuda a navegar (`graphify query "..."`), mas confira a data: rode `graphify update .` depois de mudar código (o grafo fica velho fácil).

## Regras do projeto (carregadas sempre — fonte única em `.agents/rules/`, também usada pelo Antigravity)
@.agents/rules/definition-of-done.md
@.agents/rules/ui-clean-design-and-tdd.md
@.agents/rules/graphify.md

## Skills do projeto (`.agents/skills/`) — leia o SKILL.md ANTES de começar o trabalho correspondente
| Trabalho | Skill |
|---|---|
| Feature nova ou mudança de comportamento (não para correções pequenas) | `brainstorming` — perguntas antes de construir; `grill-me` quando o usuário pedir para ser questionado |
| Ciclo, domínio, revisão espaçada, métricas, tutor de IA, qualquer regra "pedagógica" | `education-learning-science` |
| Tela, modal, gráfico ou componente React | `ux-ui-clean` (+ `design-system-builder` se for criar/rever o sistema visual) |
| Novo painel, componente grande, `App.tsx` | `microfrontend-dock-architecture` (teto de ~250 linhas por componente) |
| Prompts de IA, parser de provas/edital, extração JSON | `prompt-engineering-guide` |
| Chaves de API, PDFs/HTML de bancas (entrada não confiável), refatoração TS | `shannon-security-and-code-craft` |
| Toda entrega | `tdd-suite` |

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
- `src/lib/aiRouter.ts` — Gateway → Groq → Gemini → DeepSeek, prompts com grounding, modo demonstração.
- `src/features/pdf-reader/` — leitor de PDF (pdf.js): página atual, páginas lidas, zoom; maximizar/tela cheia ficam no `App.tsx`.
- `src/lib/questionImport.ts` / `syllabusImport.ts` — importadores (texto/JSON e conteúdo programático).
- `src/App.tsx` — orquestra estado e painéis; componentes em `src/components/` e `src/features/`.
