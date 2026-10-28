# Contexto Vivo: Minerador e Motor de Acervo de Questões (FofoLab)

> **Documento de referência rápida para o Especialista de Mineração (`minerador-specialist`).**
> Atualizado em: 28/10/2026

---

## 1. Visão Geral da Arquitetura

O módulo de mineração do FofoLab (`tools/minerador/`) é responsável por abastecer o acervo de questões de concurso público direto da fonte (bancas oficiais), processar os cadernos de prova e gabaritos definitivos, e aplicar classificação taxonômica multi-modelo assistida por IA.

```
 [Cebraspe / Bancas Oficiais]
             │ (PDFs de prova + gabaritos definitivos)
             ▼
   tools/minerador/runMinerador.ts
             │ (Extração de texto-base, itens C/E e múltipla escolha, marcação de anuladas)
             ▼
     acervo/cebraspe/*.json
             │
             ├─────────────────────────────────────────────────┐
             ▼                                                 ▼
   Classificação com IA (1ª Opinião)                Conferência / Desempate
   (DeepSeek Flash / Gemini Flash)                  (Groq 120b grátis / Claude Sonnet)
             │                                                 │
             └───────────────────────┬─────────────────────────┘
                                     ▼
                        acervo/classificacao/*.json
                                     │ (Consenso multi-modelo)
                                     ▼
                         tools/minerador/pacote.ts
                                     │
                                     ▼
                          acervo/pacote/cebraspe.json
                          acervo/pacote/index.json
                                     │
                                     ▼  (Vite serve /__acervo/*)
                 [App FofoLab: Zero-Click Sync em Segundo Plano]
```

---

## 2. Estado Atual do Acervo (Snapshot 28/10/2026)

- **Total de itens com assunto ativo no pacote:** `29.323` (+979 questões novas nesta rodada)
- **Total de concursos Cebraspe minerados:** `76` (`35.221` itens extraídos de provas)
- **Versão do Vocabulário Canônico:** `v1717`
- **Fila Restante:** `3.995` itens sem nenhuma opinião
- **Consenso Atual:**
  - `85` concordâncias plenas.
  - `40` discordâncias ativas (as 41 originais foram desempadas pelo DeepSeek Chat V3).
  - `29.877` itens com 1 opinião consolidada.
- **Gasto do Dia (DeepSeek):** `R$ 1,80` (~$0,30 USD) do saldo restante do usuário (~$1,33 USD livres).
- **Meta prioritária do estudante:** **CGU 2026** (Cargo 4: TI – Desenvolvimento de Sistemas), banca Cebraspe.

---

## 3. Matriz de Provedores e Estratégia de Custos

| Provedor | Modelo Padrão | Custo Estimado | Melhor Uso | Limites / Observações |
|---|---|---|---|---|
| **DeepSeek** | `deepseek-flash` | ~US$ 0,14 por 1k itens com cache hit | **Volume massivo (1ª opinião)** | Controlado pelo ledger diário (`.minerador-cache/gasto-deepseek.json`), teto em BRL configurável. |
| **Groq** | `openai/gpt-oss-120b` | **Gratuito** | **Conferência independente (2ª opinião)** | Teto de 8.000 tokens/minuto. Ideal para lotes menores sem custo. |
| **Antigravity (AGY)** | `claude-sonnet-5-5-low` | Incluído na sessão | **Desempate cirúrgico das 41 discordantes** | Roda em sandbox isolado (`tmpdir`), reservado para poucos itens de alta ambiguidade. |
| **Google Gemini** | `gemini-2.5-flash` | Assinatura / cota gratuita | Volume intermediário | Alta taxa de requisições por minuto e boa aderência conceitual. |

---

## 4. Comandos Canônicos do CLI (`npm run minerar -- ...`)

```bash
# 1. Mineração e Extração de Provas
npm run minerar -- lote                     # Gera acervo/lote.json para conferência
npm run minerar -- rodar                    # Baixa e extrai todas as provas e gabaritos definitivos

# 2. Vocabulário e Semente
npm run minerar -- semente [edital.pdf]     # Gera/atualiza taxonomia inicial a partir de um edital

# 3. Classificação e Consenso
npm run minerar -- classificar              # 1ª opinião nos itens sem nenhuma opinião
npm run minerar -- conferir                 # 2ª opinião independente em todos os itens
npm run minerar -- desempatar               # 3ª opinião estritamente nos itens discordantes
npm run minerar -- recalcular               # Refaz consenso estatístico local sem chamar IA

# 4. Curadoria Taxonômica
npm run minerar -- juntar <de> <para>       # Funde assunto duplicado no vocabulário e nas classificações

# 5. Empacotamento para o App
npm run minerar -- pacote                   # Gera acervo/pacote/cebraspe.json e index.json (Zero-Click Sync)
```

### Flags Úteis de Flexibilidade:
- `--provedor [deepseek|groq|agy]`: escolhe o motor de inferência.
- `--limite N`: processa no máximo `N` itens nesta rodada (útil para testes rápidos de R$ 1 ou R$ 2).
- `--paralelo N`: executa em `N` chamadas simultâneas (padrão 1).

---

## 5. Invariantes Inegociáveis (Qualidade e Integridade)

1. **Gabarito Definitivo Oficial:** Jamais usar gabarito preliminar. Questões anuladas pela banca são marcadas com `anulado = true` e excluídas da contagem de questões para resolução do estudante.
2. **Preservação de Contexto:** Questões associadas a textos de leitura e interpretação precisam carregar seu respectivo texto-base (`baseText`). Um item solto sem o texto do qual depende é considerado defeituoso.
3. **Proteção Financeira (Spend Ledger):** Toda execução da DeepSeek checa o teto diário antes de despachar cada lote. Se atingir o limite, para graciosamente sem corromper o progresso (`parouNoLimite`).
4. **Zero-Click Sync Determinístico:** Ao recalcular ou reclassificar, o arquivo `index.json` é atualizado com novo hash e o app atualiza em segundo plano, sem banners invasivos ou cliques manuais do estudante.
