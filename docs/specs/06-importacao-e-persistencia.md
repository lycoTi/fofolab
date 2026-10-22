# 💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo

> Implementado na Fatia 5.5. Estado de verificação de cada parte: ver `BACKLOG.md`.

## 1. Onde os estudos ficam
O banco é SQLite via **sql.js** (em memória, no WebView). Ele é serializado e gravado por um adaptador (`src/lib/storage.ts`):

| Ambiente | Onde grava | Observações |
| :--- | :--- | :--- |
| `.exe` (Tauri) | `%APPDATA%\com.fofolab.desktop\fofolab.db` | `tauri-plugin-fs`, escrita atômica (`fofolab.db.tmp` → renomeia). Permissões só em `$APPDATA` (`src-tauri/capabilities/default.json`). **A verificar no PC de casa.** |
| `npm run dev` (navegador) | IndexedDB `fofolab` | Sem o limite de ~5 MB do localStorage e sem base64. |
| Testes / falha de acesso | Memória | Aviso persistente na tela: nada está sendo gravado. |

- **Migração do formato antigo:** no 1º carregamento, se o armazenamento novo está vazio e existe `fofolab_sqlite_db_v1` (base64 no localStorage), ele é importado e só é apagado **depois** de gravado no lugar novo.
- **Escolha determinística:** no Tauri sempre arquivo, no navegador sempre IndexedDB — sem cópias divergentes.

## 2. Quando grava (`src/lib/database.ts`)
- Toda mutação chama `persistDatabase()`. A **1ª alteração depois de um tempo parado é gravada na hora** (no mesmo ciclo do clique, juntando o que ele alterou); rajadas (digitar, arrastar o controle de horas) viram no máximo 1 gravação a cada `SAVE_THROTTLE_MS` (400 ms) + 1 final.
- Gravações são enfileiradas (nunca duas ao mesmo tempo). Falha → `saveStatus.state = 'error'`, mensagem na tela e nova tentativa com espera crescente (2,5 s → 60 s).
- Janela escondida/fechando (`visibilitychange`/`pagehide`): grava o rascunho do caderno e o banco imediatamente. **Limitação:** no `.exe` ainda não há gancho no fechamento da janela (`onCloseRequested`).
- **Importante:** o `export()` do sql.js reabre a conexão e zera os PRAGMAs. Toda exportação passa por `exportBytes()`, que religa `PRAGMA foreign_keys = ON` (antes da 5.5 as exclusões não cascateavam).

## 3. Versões do banco (`src/lib/migrations.ts`)
- `PRAGMA user_version` guarda a versão. Banco novo: roda o contrato completo (`01-database-schema.sql`, sempre na versão mais recente). Banco existente: aplica as migrações maiores que a versão gravada, cada uma numa transação.
- Bancos sem versão mas com tabelas = **v1** (anteriores à 5.5).
- Banco de versão **mais nova** que o app: não é aberto nem sobrescrito (o app segue em memória e avisa).
- **v2:** `study_plans.strategy_mode`, `study_plans.study_moment`; explicações do seed marcadas `EXAMPLE`; limpeza dos registros órfãos.
- Regra: mudou o contrato SQL → crie a migração equivalente. O teste `migrations.test.ts` compara "banco novo" × "v1 + migrações".

## 4. Cópias de segurança
- **Automáticas:** 1 por dia (a do 1º salvamento do dia) + antes de excluir plano/disciplina/tópico, restaurar exemplo, restaurar backup e atualizar a versão do banco. Ficam as últimas 12 (`MAX_BACKUPS`).
- **Quarentena:** banco salvo que não abre é guardado à parte (nunca sobrescrito); o app começa pelo exemplo e avisa.
- **Na tela:** "Organizar Edital → 4. Backup & Segurança": baixar backup (`fofolab-backup-AAAA-MM-DD.db`), restaurar de arquivo (valida e atualiza versões antigas), restaurar cópia automática, restaurar exemplo inicial (zona de cuidado). Tudo pede confirmação.
- **Não confundir com o futuro `.fofopack`:** o backup leva tudo (inclusive progresso, cadernos e conversas). Um pacote para amigos deve levar só conteúdo (Fatia 6).

## 5. Importação de questões (`src/lib/questionImport.ts`)
Entrada colada na tela "Importar Questões" (texto ou JSON) → prévia com problemas apontados → `importQuestions()` (ignora enunciado repetido na disciplina).

**Texto** (cada questão termina na linha `Gabarito:`):
```text
1. (FGV/CGU/2022) [tópico 1.1] Enunciado...
A) ...
B) ...
Gabarito: B

2. (Cebraspe/BACEN/2024) Item para julgar...
Gabarito: Certo
```
- `(Banca/Órgão/Ano)` e `[tópico X.Y]` são opcionais (faltando, valem os padrões do formulário).
- As alternativas são a **última** sequência `A) B) C)…` — listas `a) b)` dentro do enunciado continuam no enunciado.
- `Gabarito: Anulada` → ignorada com aviso. Sem alternativas + `Certo/Errado` → item `C) Certo` / `E) Errado`.

**JSON** — é o **contrato que o futuro leitor de PDF (Fatia 7) deve produzir**:
```json
[
  {
    "enunciado": "Texto completo",
    "alternativas": ["A) ...", "B) ..."],
    "gabarito": "B",
    "banca": "FGV",
    "ano": 2024,
    "orgao": "CGU",
    "topico": "1.2"
  }
]
```
Também aceita `{ "questoes": [...] }`, chaves em inglês (`statement`, `options`, `answer`, `board`, `year`, `organ`, `topic`) e alternativas como `{ "letra": "A", "texto": "..." }`.

## 6. Importação do conteúdo programático (`src/lib/syllabusImport.ts`)
Na aba "3. Tópicos", "Colar o conteúdo programático": aceita um tópico por linha (estilo FGV) ou tudo num parágrafo (estilo Cebraspe: `1 Conceitos. 2 Normas. 2.1 ISSAI 100.`). Corta só no início da linha ou depois de `. `, `; ` ou `: ` quando vem número + letra maiúscula (assim `Lei 14.133/2021` e `NBC TA 530 Amostragem` não quebram). Cabeçalhos em maiúsculas são ignorados. Subtópicos (`2.1`) são ligados ao pai (`2`); tópicos "pai" ficam fora do calor e da cobertura no ciclo.

## 7. Importação por PDF
1. **Edital PDF** → feito na Fatia 7a, sem IA (modelo Cebraspe): ver `docs/specs/07-edital-ciclo-e-situacao.md`.
2. **Prova PDF + gabarito PDF** → texto → IA → JSON da seção 5 (gabarito definitivo vence o preliminar; anuladas marcadas) → prévia → `importQuestions`.
3. **Definição de pronto:** E2E com PDFs reais (FGV/CGU e Cebraspe/BACEN), conferindo contagem de questões, gabaritos e tópicos.
