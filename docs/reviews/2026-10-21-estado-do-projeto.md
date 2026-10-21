# Revisão do estado do projeto — 21/10/2026

> Revisão feita com o Claude Code (no PC do trabalho) sobre o commit `823a6a6`, antes da Fatia 5.5.
> As referências de linha abaixo são **desse commit** — depois da Fatia 5.5 os arquivos mudaram.
> Objetivo deste arquivo: preservar o diagnóstico e as decisões para as próximas sessões (Antigravity ou Claude Code, em qualquer PC).

## Veredito

A visão de produto é forte e o código é organizado, mas o projeto estava **largo e raso**: muitas telas a 60–70%, rodando só nos dados de exemplo, e o `BACKLOG.md` marcava como `[DONE]` coisas que não funcionavam com dados reais. Decisão: **não começar a Fatia 6** antes de uma fatia de endurecimento (**Fatia 5.5**): proteger os dados e fazer o ciclo principal funcionar com conteúdo real.

Verificado na época: `npm test` 15/15 e `tsc` sem erros — ou seja, os testes passavam, mas não cobriam os problemas abaixo.

## O que está bom (manter)

- Decisões de produto com insight real de concurso: orçamento semanal de soma zero, "pegadinha da banca" não derruba a base teórica, explicação escondida até responder (contra descarga cognitiva), Cobertura × Domínio separados, PDFs autorais nunca entram em pacotes.
- Matemática isolada em funções puras (`src/lib/cycleEngine.ts`), schema SQL como fonte única (importado com `?raw`), queries parametrizadas, TypeScript strict.
- Estrutura BACKLOG + specs modulares para dar contexto à IA em sessões curtas.

## Problemas encontrados (por gravidade)

### 1. Risco de perder dados
- O "SQLite real" era sql.js em memória salvo como **base64 no `localStorage`** (`database.ts:64`): limite de ~5 MB e falha de gravação só no console — o app seguia funcionando e perdia tudo ao fechar.
- **Descoberto durante a 5.5:** o `export()` do sql.js reabre a conexão e zera os PRAGMAs, então `foreign_keys` ficava **desligado depois do 1º salvamento** — nenhuma exclusão cascateava (órfãos no banco).
- Banco salvo que não abria era recriado com o exemplo **por cima do original**, sem cópia (`database.ts:294-313`).
- "Restaurar Exemplo" e as lixeiras apagavam com 1 clique, sem confirmação (`App.tsx:707`, `CurriculumManagerModal.tsx:380`).
- Sem versionamento de schema (`CREATE TABLE IF NOT EXISTS` não adiciona colunas) e IDs com `Date.now()` (colidem em lote, atrapalham merge entre PCs).

### 2. O ciclo principal não funcionava com conteúdo real
- Não havia como cadastrar/importar questões — só as 6 do seed.
- Sem chave de API, 100% das respostas do tutor/copiloto eram templates fixos **marcados como `GEMINI_FREE`** (`aiRouter.ts:239-282`). O cache `ai_dissections` nunca era gravado e as regras anti-alucinação da spec 04 não estavam no prompt.

### 3. Bugs que distorciam as métricas
- **Meu Dia de Hoje** usava `allocations[0]`/`[1]` sem ordenar (ordem alfabética): no seed da CGU, TI (peso 2.5) nunca aparecia. E ignorava o que já foi estudado na semana (`sessions` nem era lido em `cycleEngine.ts:179`).
- **Diagnóstico:** dava para clicar "Dominei" várias vezes (+8% cada), sem responder, ou errar e marcar "Dominei". Tempo gasto fixo em 45 s (`database.ts:659`).
- **Pomodoro:** congelava enquanto se digitava no caderno (callback inline recriava o `setInterval` a cada render — `PomodoroWidget.tsx:58`); concluir com < 5 min gravava o bloco inteiro; em dev (StrictMode) gravava 2×.
- **Caderno/PDF:** fallback `OR subject_id` mostrava o caderno de outro tópico e salvar o PDF do tópico B sobrescrevia o do A (`database.ts:884`); rascunho não salvo sumia ao trocar de tópico ou de filtro (`App.tsx:187`).
- **Explicabilidade:** as fórmulas do "ⓘ" não eram as do código (`explainabilityEngine.ts:45` × `cycleEngine.ts:330`); "HLR" era chamado de "estimativa científica" sendo uma regra fixa.
- **Wizard:** a estratégia escolhida era salva no localStorage e nunca usada (`App.tsx:316`).

### 4. Processo
- BACKLOG otimista (ex.: "Leitor de PDF" guardava só o nome do arquivo e total de páginas fixo em 40).
- Grafo do graphify 3 commits atrasado, sem nenhum arquivo de `src/features/`.
- Testes não cobriam `database.ts` e conferiam o texto dos templates da IA.
- No PC do trabalho não há Rust: o app nunca rodou como `.exe` lá; nada usava APIs do Tauri.

## Decisões tomadas com o usuário

1. Fazer a **Fatia 5.5 (endurecimento)** antes da 6.
2. A IA ainda **não tem chave de API**: os exemplos simulados ficam, mas **rotulados como simulação** — nunca como resposta real, e nunca gravados no cache.
3. A visão de alimentação é por **PDF**: subir provas + gabaritos para extrair e catalogar questões, e subir o edital para extrair matérias, áreas, tópicos, subtópicos, datas, taxa, banca etc. Isso **não está pronto** e só pode ir para `[DONE]` depois de testado **ponta a ponta** com PDFs reais.
4. Novos desejos de UX: **área grande para ler PDF** e **redimensionar colunas/módulos em tempo real**.
5. Definição de pronto: funciona com dados reais, sobrevive a reiniciar o app e tem teste (E2E quando o fluxo atravessa várias telas).

## O que a Fatia 5.5 entregou

Ver `BACKLOG.md` (seção da Fatia 5.5) — é lá que fica o estado vivo, com o que foi verificado e o que falta verificar no PC de casa.
