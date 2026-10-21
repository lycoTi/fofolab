# 🤖 Roteador IA, Estudo Reverso, Score estilo Elasticsearch & Anti-Alucinação

## 1. Roteador de IA Transparente (Zero Config + Grounding Anti-Alucinação)
Para que o estudo reverso funcione com custo mínimo e **risco mínimo de alucinação**:

1. **Camada 0 — Cache SQLite Local (`ai_dissections`):**
   - Consulta instantânea (`0 tokens` / `R$ 0,00`) caso a questão já tenha sido destrinchada.
   - **[5.5]** Questão sem explicação + IA configurada → botão "Gerar explicação com IA" (`generateQuestionDissection` pede JSON `{explicacao_markdown, pre_requisitos}`) e o resultado é guardado aqui (`saveAiDissection`). `provider_used = 'EXAMPLE'` marca as explicações de exemplo do seed.
2. **Camada 1 — Google AI Studio (`gemini-flash-latest`, configurável em `VITE_GEMINI_MODEL`)** ➔ **Camada 2 — Fallback DeepSeek (`deepseek-flash` sem modo de raciocínio, configurável em `VITE_DEEPSEEK_MODEL`; saldo pré-pago funciona como teto de gasto)**.
   - **[5.5]** Antes delas, o Gateway próprio (`VITE_FOFOLAB_AI_GATEWAY_URL`), recomendado para o `.exe` distribuído. Variáveis em `.env.example`; tempo limite de 30 s por chamada.
   - **[5.5] Modo demonstração:** sem nenhuma variável, tutor e copiloto respondem com exemplos montados localmente, **sempre** marcados "Exemplo simulado" na tela e nunca gravados como explicação. IA configurada que falha mostra aviso de falha (não um exemplo).
3. **Protocolo Anti-Alucinação no Estudo Reverso (Grounding Estrito):**
   - Toda explicação ou conversa com a IA recebe como **âncora imutável**:
     - O enunciado oficial da prova + o **Gabarito Definitivo Pós-Recurso** da banca;
     - Os tópicos/pré-requisitos oficiais do edital verticalizado;
     - Exigência de **citação normativa explícita** (ex: *Lei 14.133/2021, Art. 75*, *ISSAI 100, item 40*, *MCASP 10ª Ed.*) e separação clara entre *Letra da Lei*, *Jurisprudência (TCU/STF)* e *Entendimento específico da banca (FGV vs. Cebraspe)*.
   - **[5.5] Implementado em `GROUNDING_RULES` (`src/lib/aiRouter.ts`):** gabarito definitivo como âncora (nunca contradizer; suspeita de erro vira observação separada), **eliminação contrastiva** com tipo de armadilha (Inversão Conceitual, Extrapolação, Troca de Competência, Exceção Literal), separação Lei/Jurisprudência/Banca e **regra de abstenção** ("não consigo confirmar o dispositivo exato" — nunca inventar número de lei/artigo). Valores do contexto são escapados antes de entrar no prompt.

---

## 2. Política de PDFs Locais (Estratégia / Gran Cursos — Direitos Autorais)
- **Zero Armazenamento de Material Autoral:** PDFs de cursinhos (Estratégia, Gran Cursos, Direção) possuem direitos autorais e marca d'água pessoal. O FofoLab **nunca copia nem inclui arquivos PDF dentro de pacotes `.fofopack` ou repositórios**.
- **Ancoragem Local por Metadados:** Cada estudante vincula seus próprios arquivos PDF locais no seu computador (`file_path`). O SQLite guarda apenas o progresso pessoal (página atual, total de páginas, coordenadas de grifos locais e vínculo com o tópico do edital).

---

## 3. Estudo Reverso & Motor de Pontuação estilo Elasticsearch (`Relevance Score`)
No **Estudo Reverso** (resolver questões primeiro para mapear o que a banca realmente cobra), **errar questões no 1º contato é parte natural e esperada do mapeamento**, e o estudante possui um **teto fixo de horas na semana** (rotina de trabalho, alimentação, descanso).

Por isso:
1. **Regra do Orçamento Fixo (Soma Zero):**
   - Errar 10 questões **nunca soma minutos extras soltos** na semana. O total de horas semanais (`weekly_hours_target`) é **travado** na realidade do estudante.
2. **Proteção de 1º Contato (*Cold Start* no Estudo Reverso):**
   - Nas primeiras questões de um tópico ainda em fase de reconhecimento (`PENDING` / `STUDYING`), os erros alimentam o **Mapa de Calor de Prioridade** sem penalizar emocionalmente o aluno e sem bagunçar o ciclo em andamento.
3. **Cálculo de Prioridade inspirado no Elasticsearch (`_score`):**
   Cada tópico $t$ e disciplina $d$ recebe um **Score de Relevância (`relevance_score`)** combinando:
   $$\text{Score}_d = \text{PesoEdital}_d \times \left(1 + \text{FatorBaseInicial}_d + \text{BoostMapaDeCalor}_d + \text{BoostPreRequisitos}_d\right)$$
   - **` MASTERED` (🟢 Dominei / Só revisei):** Reduz a temperatura de urgência do tópico (`-0.25 no calor`) e consolida domínio (`+8% a +10%`).
   - **`DOUBT` (🟡 Acertei na dúvida):** Leve aumento de temperatura (`+0.30 no calor`) para revisão espaçada.
   - **`BOARD_TRAP` (🟠 Pegadinha da Banca / Desatenção):** **`0%` de perda na base teórica!** Soma apenas no indicador de *"Atenção à malícia da banca"* (`+0.20`).
   - **`BASE_GAP` (🔴 Lacuna de Base / Estudo Reverso):** Aumenta a temperatura do tópico no **Mapa de Calor (`+0.65`)** e propaga `+0.25` de calor para seus **tópicos pré-requisitos** (`topic_links`).
4. **Sugestão Não-Invasiva para o Próximo Ciclo:**
   - Em vez de alterar o ciclo durante o estudo ou criar vários botões manuais, o FofoLab cruza o **Mapa de Calor** e apresenta uma **Sugestão de Rebalanceamento para o Próximo Ciclo** (mantendo as horas totais fixas), além de alertar caso o estudante tenha colocado matérias demais para poucas horas semanais.
