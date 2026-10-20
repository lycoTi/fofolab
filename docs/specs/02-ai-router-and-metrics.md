# 🤖 Roteador Inteligente de IA & Métricas Sem Viés

## 1. Roteador de IA Transparente (Zero Config para o Usuário Final)
Para que familiares, sobrinhos e amigos não precisem criar conta em plataforma de desenvolvedor nem configurar chaves de API:

1. **Camada 0 — Cache SQLite Local (`ai_dissections`):**
   - Antes de qualquer chamada de rede, o FofoLab consulta `SELECT * FROM ai_dissections WHERE question_id = ?`.
   - Se a questão já foi destrinchada antes (por você ou em um pacote `.fofopack` importado), a explicação abre instantaneamente com **custo R$ 0,00 e 0 tokens**.
2. **Camada 1 — Google AI Studio (Cota Gratuita):**
   - Requisição enviada para `gemini-2.5-flash` usando a cota gratuita do Google AI Studio.
3. **Camada 2 — Fallback Automático para DeepSeek V3 (`deepseek-chat`):**
   - Se a Camada 1 retornar `HTTP 429 (Rate Limit)` ou indisponibilidade, o roteador redireciona automaticamente para a API da DeepSeek.
   - **Trava Financeira Segura:** A conta DeepSeek opera no formato pré-pago (*Top-up* manual de ex: R$ 50/mês sem recarga automática), garantindo risco zero de cobrança extra.
4. **Gateway Opcional na Oracle Cloud:**
   - Para não expor as chaves dentro do binário `.exe`, o app pode apontar para um micro-proxy hospedado na instância gratuita da Oracle Cloud.

---

## 2. Cálculo de Domínio e Afinidade Sem Penalizar o Uso da IA
**Regra Fundamental:** Abrir o chat da IA para revisar um conceito, pedir exemplos ou explorar aprofundamentos **nunca diminui o nível do estudante**.

O **Índice de Domínio do Tópico (`mastery_score` de 0 a 100)** é atualizado a cada questão resolvida combinando o acerto com o **Diagnóstico de 1 Clique (`self_diagnosis`)**:

| Botão de Diagnóstico Pós-Questão | Impacto no Domínio Teórico | Impacto no Ciclo de Estudos |
| :--- | :--- | :--- |
| 🟢 **Dominei / Só revisei detalhe** (`MASTERED`) | `+8%` a `+12%` (ponderado pela recência) | Reduz gradualmente a urgência de teoria; move para revisão espaçada. |
| 🟡 **Acertei na dúvida** (`DOUBT`) | `+2%` | Agenda bateria curta de questões similares em 7 dias. |
| 🟠 **Pegadinha da Banca / Desatenção** (`BOARD_TRAP`) | **`0%` (Não pune a nota teórica!)** | Mantém a nota de teoria intacta e adiciona flag *"Treinar malícia da banca"*. |
| 🔴 **Lacuna de Base** (`BASE_GAP`) | `-10%` | Aumenta automaticamente a fatia de minutos da matéria no Ciclo de Estudos. |
