# 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler

## 1. Catálogo de Trilhas de Estudos Prontas
No Modo Admin, mapeamos e alimentamos as grandes trilhas para que o estudante possa escolher um caminho pronto:
- **Trilha Federal (Controle & Gestão):** CGU, TCU, Receita, APO/MPO.
- **Trilha Autarquias & Regulação:** BACEN, CVM, SUSEP, Agências.
- **Trilha Tribunais:** TRT, TRF, TJ, TSE, MPU.
- **Trilha Especialidades Transversais:** Tecnologia da Informação (Desenvolvimento / Infra / Dados) e Direito.
- **Trilhas Estadual & Municipal:** Fiscos estaduais/municipais, controladorias e prefeituras.

Cada concurso dentro de uma trilha possui um selo claro:
- `🟢 Catalogado`: Edital verticalizado + Provas anteriores + Gabarito definitivo pós-recurso + Questões anuladas demarcadas.
- `🟡 Parcial`: Edital verticalizado disponível; banco de questões em alimentação.
- `⚪ No Radar`: Mapeado pelo Dossiê de Pesquisa Profunda, aguardando extração.

---

## 2. Matriz de Complexidade e Catalogação Cross-Trilhas das Questões
Para permitir cruzar questões entre diferentes concursos, órgãos, áreas e trilhas, cada questão extraída ou catalogada recebe metadados estruturais (`Área`, `Disciplina`, `Tópico`, `Subtópico`, `Banca`, `Órgão`, `Ano`, `Cargo`) e um **Índice de Complexidade Multidimensional (1 a 5 estrelas)** calculado por 4 vetores:

1. **Interdisciplinaridade / Densidade de Tópicos (`topic_count`):**
   - A questão cobra um único conceito isolado (Nível 1) ou exige cruzar 3 subtópicos/pré-requisitos distintos (Nível 5)?
2. **Complexidade Linguística e Cognitiva (`linguistic_load`):**
   - Mede extensão do enunciado (estudos de caso longos típicos da FGV), presença de dupla negação, inversão de contexto ou vocabulário jurídico/técnico truncado projetado para induzir perda de foco.
3. **Profundidade Normativa (`normative_specificity`):**
   - Cobra a regra geral (núcleo 80/20 do edital) ou uma exceção de parágrafo/jurisprudência específica de informativo?
4. **Telemetria Empírica (`empirical_friction`):**
   - Tempo médio gasto na questão + proporção de diagnósticos `🟠 BOARD_TRAP` (pegadinha) e `🔴 BASE_GAP` registrados no estudo reverso.

---

## 3. Verificador de Blueprint das Bancas (DOM Drift Detection)
Sites de bancas (FGV, Cebraspe, FCC, Cesgranrio, Vunesp) alteram seu HTML periodicamente. Para garantir que os scripts extratores nunca salvem dados corrompidos:

1. **Snapshot / Blueprint (`admin_board_blueprints`):**
   - Guardamos a estrutura esperada de seletores CSS/DOM da página de concurso da banca e um *hash* estrutural.
2. **Health Check antes da Extração:**
   - Antes de rodar o crawler (Playwright/Crawlee sob demanda no painel Admin), o verificador testa se os seletores de *Prova PDF*, *Gabarito Preliminar*, *Gabarito Definitivo* e *Comunicado de Anulações* permanecem idênticos ao Blueprint.
   - Se houver divergência (`DRIFT_DETECTED`), o crawler pausa e exibe um alerta visual para atualizarmos o seletor antes de processar.
