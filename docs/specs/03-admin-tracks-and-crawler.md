# 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Dossiês e Crawler de Bancas

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

## 2. Verificador de Blueprint das Bancas (DOM Drift Detection)
Sites de bancas (FGV, Cebraspe, FCC, Cesgranrio, Vunesp) alteram seu HTML periodicamente. Para garantir que os scripts extratores nunca salvem dados corrompidos:

1. **Snapshot / Blueprint (`admin_board_blueprints`):**
   - Guardamos a estrutura esperada de seletores CSS/DOM da página de concurso da banca e um *hash* estrutural.
2. **Health Check antes da Extração:**
   - Antes de rodar o crawler (Playwright/Crawlee sob demanda no painel Admin), o verificador testa se os seletores de *Prova PDF*, *Gabarito Preliminar*, *Gabarito Definitivo* e *Comunicado de Anulações* permanecem idênticos ao Blueprint.
   - Se houver divergência (`DRIFT_DETECTED`), o crawler pausa e exibe um alerta visual para atualizarmos o seletor antes de processar.
