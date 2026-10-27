# Spec 12d — Sincronização automática do acervo, fila da aba Questões e Reta Final flexível

> Parte da spec 12 (`12-minerador-cebraspe.md`, §7 item 4) e complemento da spec 13 (`13-plano-de-estudo.md`, §4.3).
> Status: **aprovada pelo dono em 27/10/2026**.

## 1. Intenção
1. **Sincronização automática do acervo (`Zero-Click Sync`):** o minerador classifica ~200 itens novos por dia (e no futuro haverá novos pacotes/bancas). O dono não quer rodar `npm run minerar -- pacote` separado nem clicar em "Importar Questões" manualmente a cada rodada: qualquer comando de classificação já atualiza o pacote e o manifesto em `acervo/pacote/`, e o app sincroniza sozinho ao abrir ou trocar de plano.
2. **Fila inteligente e filtros na aba Questões:** o estudante quer abrir a aba Questões no tópico do bloco atual e resolver **questões inéditas** primeiro, priorizando o formato da sua prova sem esconder questões de múltipla escolha (que cobrem lacunas de tópicos raros), podendo refazer as que errou/chutou ou subir para o grupo quando as inéditas acabarem.
3. **Reta Final sem engessar:** nos últimos dias antes da prova, se o estudante já dominou os tópicos estudados (ou se quiser continuar vendo matéria nova até a véspera), o planejador não deve forçar revisão redundante.

## 2. Objetivos, não objetivos e anti-objetivos
- **Objetivos:**
  - Minerador atualiza `acervo/pacote/<banca>.json` (e mantém `fofolab-acervo-cebraspe.json` por compatibilidade) + `acervo/pacote/index.json` automaticamente ao final de `classificar`, `conferir`, `desempatar`, `juntar`, `recalcular` e `pacote`.
  - App verifica `/__acervo/index.json` ao iniciar e ao trocar de plano: se houver pacote novo/atualizado ou tópico do plano sem tentativa de ligação, sincroniza em segundo plano e exibe aviso discreto.
  - Aba Questões filtra por **Status da fila** (`Inéditas` por padrão, `Errei ou chutei`, `Todas`) e **Formato** (`Todos os formatos` por padrão, `Certo/Errado`, `Múltipla escolha`), ordenando Certo/Errado primeiro quando em "Todos os formatos".
  - Questão já respondida exibe selo discreto com a última tentativa ("Respondida em DD/MM · Acertou / Errou / Chutou / 1º contato") e, quando aberta para refazer, permite nova tentativa limpa.
  - Item anulado pela banca sai da fila de resolução padrão (`Inéditas` e `Errei ou chutei`) e da contagem do bloco, aparecendo apenas em `Todas`.
  - Quando as inéditas do tópico acabam (mas há questões respondidas no tópico), a tela vazia oferece atalhos diretos para **"Refazer as que errei ou chutei (N)"**, **"Ver todas deste tópico (N)"** e **"Ver as do grupo ‹código›"**.
  - Na Reta Final (`planDailyBlocks`), só revisa tópicos estudados que realmente precisam (`R < 0,85` ou domínio `< 75%`); se todos os tópicos estudados estiverem frescos e dominados — ou se o estudante ativar **"Continuar avançando em tópicos novos na reta final"** (`final_stretch_allow_new` ou no planejador) — libera tópicos inéditos normalmente.
- **Não objetivos:**
  - Distribuição remota na nuvem de pacotes/atualizações para terceiros (anotado no BACKLOG para a fase de compartilhamento).
- **Anti-objetivos:**
  - Esconder a questão da tela no exato instante em que o estudante clica na alternativa (enquanto ele está na questão, a correção e a conversa com a FofoIA permanecem abertas; ela só conta como respondida na fila ao avançar/recarregar o filtro).
  - Travar a abertura do app esperando sincronização ou IA.

## 3. Como funciona

### 3.1 Manifesto e pacotes em `acervo/pacote/`
- `writePacoteAndIndex(acervoDir)` grava:
  - `acervo/pacote/cebraspe.json` (e `fofolab-acervo-cebraspe.json` com o mesmo conteúdo);
  - `acervo/pacote/index.json`:
    ```json
    {
      "formato": "fofolab-acervo-index",
      "versao": 1,
      "pacotes": [
        {
          "id": "cebraspe",
          "banca": "Cebraspe",
          "arquivo": "cebraspe.json",
          "vocabVersion": 27,
          "itensComAssunto": 619,
          "atualizadoEm": "2026-10-27T..."
        }
      ]
    }
    ```
- No `vite.config.ts`, um middleware simples serve `GET /__acervo/*` lendo arquivos de `acervo/pacote/` (apenas `.json` dentro dessa pasta, sem path traversal). Se a pasta não existir, responde `404` limpo.
- No app (`src/lib/acervo/autoSync.ts`), `syncLocalAcervoIfNeeded({ planId, ai })`:
  1. Busca `/__acervo/index.json` (se 404 ou offline, encerra em silêncio).
  2. Compara `vocabVersion` e `itensComAssunto` do manifesto com os metadados salvos no `acervo.db` (`vocab_version` e `with_subject_count`) e verifica se o plano ativo possui tópicos sem ligação testada.
  3. Se precisar sincronizar, baixa os pacotes listados no índice, mescla num `PacoteValido` unificado e chama `importAcervoPacote`.

### 3.2 Histórico de tentativas e fila na aba Questões
- Em `src/lib/acervo/topicQuestions.ts`, `QuestionsView['items']` passa a incluir o resumo das tentativas daquele item no tópico (`attemptSummary: { count: number; lastIsCorrect: boolean; lastConfidence: ReviewConfidence | null; lastDiagnosis: SelfDiagnosisType; lastAttemptAt: string; needsRetry: boolean } | null`).
  - `needsRetry = true` quando a última tentativa não foi acerto seguro (`!is_correct` ou `confidence === 'GUESS'` ou `self_diagnosis === 'FIRST_CONTACT'` / `'GUESSED_RIGHT'`).
- Filtros em `QuestionWorkbench`:
  - `statusFilter`: `'UNSOLVED' | 'RETRY' | 'ALL'` (padrão `'UNSOLVED'`).
  - Questão respondida **nesta sessão** (`attempts[activeId]`) continua visível enquanto for a questão ativa ou enquanto o usuário estiver navegando naquela leva, para não sumir debaixo do clique; um conjunto `sessionSolvedIds` mantém na leva atual as que acabaram de ser respondidas até o usuário trocar de filtro ou de tópico.
  - `formatFilter`: `'ALL' | 'CE' | 'ME'` (padrão `'ALL'`). Quando `'ALL'`, ordena Certo/Errado antes de Múltipla Escolha (mantendo ano mais recente primeiro dentro de cada grupo).
  - Itens com `is_annulled === 1` só entram quando `statusFilter === 'ALL'` e não inflam `useTopicQuestionCount`.

### 3.3 Reta Final sem engessar
- Em `src/lib/dailyPlanner.ts`:
  - Um tópico estudado precisa de revisão na reta final quando `recallOf(h) < 0.85` ou `h.topic.mastery_score < 75` (`needsStretchReview`).
  - Se `allowNewInFinalStretch` estiver ativo no plano (ou se uma matéria não tiver mais nenhum tópico estudado precisando de revisão e ainda tiver tópicos inéditos), `pickTopic` libera tópicos inéditos para não forçar revisão de conteúdo já dominado.
  - No `AdjustPlanModal` (aba Plano de estudo), ao lado dos dias de Reta Final, uma caixa de seleção permite ligar **"Continuar avançando em tópicos novos na reta final"**.

## 4. Testes mínimos
- **Unit (`tools/minerador/`):** `writePacoteAndIndex` gera `cebraspe.json`, `fofolab-acervo-cebraspe.json` e `index.json` válido.
- **Unit (`src/lib/acervo/`):** `autoSync` ignora quando o acervo já está na mesma versão e os tópicos do plano já foram ligados; importa quando `vocabVersion` ou `itensComAssunto` sobe ou quando há plano novo; `getQuestionsView` traz `attemptSummary` por tópico e exclui anuladas da contagem do bloco.
- **Unit (`QuestionWorkbench`):** filtro padrão mostra só inéditas e ordena C/E antes de Múltipla Escolha; responder não esconde a questão na hora; trocar para "Errei ou chutei" mostra as pendências com o selo da última tentativa e permite responder de novo; quando inéditas = 0 mas há respondidas, oferece refazer ou ver todas.
- **Unit (`dailyPlanner`):** na reta final, tópico já dominado (`>= 75%`) e fresco (`R >= 0,85`) cede lugar a tópico inédito (ou quando o estudante permite inéditos na reta final).
- **E2E (`e2e/acervo.spec.ts`):** sincronização automática sem clicar em importar e filtros de inéditas / refazer na aba Questões.
