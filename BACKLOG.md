# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** leia este arquivo no início de cada sessão. Ele descreve o estado **real** (o que foi verificado e o que não foi). Detalhes técnicos ficam em `docs/specs/`; a última revisão completa está em `docs/reviews/2026-10-21-estado-do-projeto.md`.

## 📌 Status Global
- **Objetivo imediato:** uso pessoal nos estudos da **CGU** e do **BACEN**; depois, compartilhar com família e amigos.
- **Stack:** Tauri v2 + React 19 + TypeScript + Vite + Tailwind + Vitest + Playwright + sql.js (banco SQLite em memória, gravado em arquivo/IndexedDB).
- **Fase atual:** Fatia 5.5 (endurecimento) entregue no branch **`fatia-5.5-endurecimento`**. Antes de juntar na `main`, falta o **checklist do PC de casa** (abaixo), porque o lado Tauri não foi compilado no PC do trabalho (sem Rust).

## ✅ Definição de Pronto
Um item só vira **[DONE]** quando: (1) funciona com dados reais, não só com o exemplo; (2) sobrevive a fechar e abrir o app; (3) tem teste automatizado da regra e, se o fluxo atravessa telas, teste E2E; (4) `npm test`, `npm run test:e2e` e `npm run build` passam.
Legenda: **[DONE]** verificado • **[PARCIAL]** funciona com limitações listadas • **[A VERIFICAR]** implementado, sem verificação ponta a ponta • **[ ]** não começou.

## 🎯 Estado real por área

**Dados & segurança** (spec `06-importacao-e-persistencia.md`)
- [DONE] Contrato SQL v2 + migrações (`PRAGMA user_version`); teste garante banco novo = banco v1 migrado.
- [DONE] No navegador: gravação em IndexedDB logo após cada ação, aviso visível de falha + nova tentativa, cópia diária, quarentena de banco ilegível, backup/restauração (arquivo e cópias automáticas) — testado E2E.
- [A VERIFICAR] No `.exe`: arquivo real `%APPDATA%\com.fofolab.desktop\fofolab.db` via `tauri-plugin-fs` (código pronto, **nunca compilado**).
- [DONE] Excluir/restaurar pede confirmação, mostra o que vai junto e guarda cópia antes. IDs UUID.

**Ciclo & métricas** (specs `02` e `05`)
- [DONE] Motor do ciclo (soma zero, confiança da amostra, curva de esquecimento); o "ⓘ" mostra a conta que o motor faz.
- [DONE] "Meu Dia" escolhe pelo que falta do ciclo na semana; o Wizard grava horas/estratégia/momento no plano e aplica ao ciclo.
- [PARCIAL] Estratégias são multiplicadores v1; "o que mais cai" ainda não usa a frequência real das questões (depende da Fatia 7).
- [DONE] Pomodoro pelo relógio real; registra só o tempo focado, no tópico em que começou.

**Questões & estudo reverso**
- [DONE] Importar questões coladas (texto ou JSON): prévia, Certo/Errado, tópico pelo código, sem duplicar.
- [DONE] Diagnóstico coerente: 1 por tentativa, resposta travada após ver o gabarito, tempo real.
- [PARCIAL] IA sem chave = respostas marcadas "Exemplo simulado". Com chave: prompt com regras anti-alucinação e explicação guardada — [A VERIFICAR] com chave real (só testado com API simulada).
- [ ] Importar prova em PDF + gabarito (extração automática) → Fatia 7.

**Caderno, PDF & layout**
- [DONE] Caderno por tópico com salvamento automático (não perde rascunho ao trocar de tópico).
- [DONE] Leitura de PDF em tela grande (painéis laterais recolhem) + colunas redimensionáveis com largura lembrada.
- [PARCIAL] PDF guarda só nome/página/total (direitos autorais): após reiniciar é preciso abrir o arquivo de novo; a página atual é marcada à mão.

**Edital**
- [PARCIAL] Colar o conteúdo programático → tópicos e subtópicos (heurístico, com prévia).
- [ ] Importar o edital em PDF (matérias, áreas, tópicos, datas de inscrição e prova, taxa, banca) → Fatia 7.

**Ainda não começou:** grafo interativo (Fatia 6) • pacote `.fofopack` para amigos • Modo Admin real (a tela mostra dados de exemplo) • vídeo/Gran/YouTube.

## 🏠 Checklist no PC de casa (antes do merge na `main`)
1. `git fetch && git switch fatia-5.5-endurecimento && npm install` → `npm test`, `npm run test:e2e`, `npm run build`.
2. `npm run tauri:dev` precisa compilar com `tauri-plugin-fs`. Se reclamar de permissão, conferir os identificadores em `src-tauri/capabilities/default.json`.
3. No app desktop: criar um tópico, fechar, abrir → continua lá? Existem `fofolab.db` e `backups/` em `%APPDATA%\com.fofolab.desktop\`?
4. Digitar no caderno e fechar a janela em seguida → perdeu? (não há gravação no fechamento da janela; se perder, implementar `onCloseRequested` + permissão `core:window:allow-destroy`).
5. "Fazer Backup" no app desktop baixa o arquivo? (se não, usar `plugin-dialog` + `plugin-fs`). Abrir um PDF mostra o leitor?
6. Tudo ok → merge na `main` e trocar os [A VERIFICAR] verificados por [DONE].

## 🔜 Próximas fatias
- **5.6 — IA real (quando houver chave):** `.env.local` a partir do `.env.example`; testar explicação, tutor e copiloto de ponta a ponta; gateway próprio antes de distribuir o `.exe`.
- **6 — Mapa de conceitos & pacotes:** grafo de tópicos/pré-requisitos; decidir o formato do pacote (o backup completo já existe; para amigos, um pacote só de conteúdo, sem progresso pessoal).
- **7 — Importação por PDF (visão original):** edital PDF → texto → IA → JSON → prévia → grava; prova + gabarito PDF → IA → JSON (formato da spec 06) → `importQuestions`. DoD: E2E com PDFs reais (FGV/CGU, Cebraspe/BACEN).
- **Leitura:** pdf.js (página atual automática, grifos em `highlights_json`), reabrir o último PDF no `.exe`.
- **Dívidas conhecidas:** painel do ciclo apertado com os dois painéis laterais abertos; bundle ~515 kB; histórico do copiloto não é salvo; acertar depois de ver a explicação ainda permite "Dominei" (fica registrado em `used_ai_review`).
