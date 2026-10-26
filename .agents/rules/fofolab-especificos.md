# Especificidades do FofoLab para as skills globais

As skills globais vêm da stack `~/.agents` (originais instaladas + regras autorais em `~/.agents/AGENTS.md`).
Este arquivo diz como elas se aplicam aqui.
A skill `education-learning-science` é local (`.agents/skills/`).

## Testes (test-driven-development, tdd-suite, playwright-best-practices)
- Unitários e de integração ficam juntos em `src/__tests__/` (`cycleEngine.ts`, `aiRouter.ts`, complexidade, proteção de
  1º contato no Estudo Reverso; filtrar, responder, diagnosticar, chat de Estudo Reverso, salvar no caderno).
- Invariante crítica: **orçamento semanal fixo (soma zero)** — erros em questões nunca inflam as horas semanais do aluno.
- Auditoria de UI limpa: não há um teste único; cada tela checa os termos proibidos de `ui-clean-design-and-tdd.md`
  no próprio teste (ex.: `FORBIDDEN_JARGON` em `fofodoro.test.tsx`).

## Interface (impeccable, frontend-ui-engineering, ux-ui-clean)
- Público: estudante de concurso (CGU, BACEN, tribunais). Tempo sempre em HH:mm (`formatDuration`/`formatClock`).
- Primeiro contato com um tópico: mensagem acolhedora ("Em mapeamento inicial"), nunca alerta punitivo.
- Ajustes do ciclo só no painel do Ciclo, mantendo o total semanal fixo.
- Dark mode: fundo `bg-slate-950`, superfícies `bg-slate-900/70` com `border-slate-800`; destaque `orange-500`/`amber-400`.
- Status: `emerald` dominado/correto · `amber` dúvida/atenção · `blue` mapeamento inicial · `rose/red` lacuna/prioridade alta.

## Arquitetura (regra autoral de componentes em ~/.agents/AGENTS.md)
- App desktop Tauri v2: `src/App.tsx` é só a casca de layout dos painéis (`TopicsSidebar`, `MainStage`, `NotebookDock`,
  `AiCopilotDock`); fatias em `src/features/<fatia>/`.
- Painéis abrem lado a lado (Tópicos, Bancada, Caderno, Chat IA) sem perder questão/página ativa.

## Prompts de IA (regra autoral de prompts em ~/.agents/AGENTS.md)
- Verdade imutável: gabarito oficial pós-recurso (`final_answer`) e enunciado oficial (`statement`); prompts em `src/lib/aiRouter.ts`.
- Explicação em 3 camadas: letra da lei/normativo exato → jurisprudência dominante (STF, STJ, TCU) → perfil da banca (FGV, Cebraspe, FCC).
- Abstenção: "Se o artigo exato não estiver confirmado, explique o conceito doutrinário sem inventar número de artigo ou inciso."
- Múltipla escolha (A–E): núcleo do comando → por que a oficial está certa → padrão de distrator de cada errada
  (extrapolação, inversão conceitual, troca de exceção literal, competência do órgão errado).
- Cache das dissecações em `ai_dissections`. Extração de provas no modo Admin em cadeia: segmentação → gabarito e anulações → tópico e complexidade 4D.

## Segurança (security-and-hardening)
- Entradas não confiáveis: bancos `.fofopack` importados, HTML/PDF de bancas, Markdown gerado pela IA (render via `RichText`).
- Chaves (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, Groq) nunca no bundle distribuído; proxy com teto de gasto se for distribuir.
- Arquivos locais (Tauri): validar extensões `.pdf`/`.fofopack` e impedir caminho arbitrário.

## Pedagogia — decisões do FofoLab (skills originais do GarethManning em `.agents/skills/`)
Fundamentação nas skills instaladas (`learning-analytics-interpretation-guide`, `individual-spacing-algorithm-explainer`,
`spaced-practice-scheduler`, `productive-failure-desirable-difficulty-designer` e afins). O que segue é como o FofoLab aplica:
- **Amostra pequena não decide domínio** (Mandinach & Gummer; Wiliam): confiança contínua `C_n = n_pond / (n_pond + k)`,
  `k` ≈ 10–15 questões ponderadas conforme o tamanho do tópico; questões difíceis (3–5 estrelas) pesam mais.
  Nada de limiar mágico tipo `if (attempts < 3)`.
- **Cobertura ≠ proficiência:** nunca misturar tópico não visto (0%) com estudado (85%) numa média só. Mostrar separado:
  "Proficiência nos tópicos estudados" e "Cobertura do edital" (% de tópicos com confiança mínima).
- **Analytics serve a uma decisão:** "qual tópico estudar agora, e em que formato (PDF de teoria, Estudo Reverso ou revisão rápida)?".
- **Meia-vida de memória (HLR, Settles & Meeder):** cada tópico tem `h` (dias) que cresce com acerto (`MASTERED`) e encolhe em
  `BASE_GAP`; recordação `R(Δt) = 2^(−Δt/h)` desde `last_studied_at`; quanto menor `R`, maior o `heatScore` no Mapa de Calor.
- **Espaçamento de Cepeda:** revisão de tópico consolidado a ~10–20% de `daysUntilExam`, entre 3 e 21 dias.
- **Falha produtiva no Estudo Reverso (Kapur; Kornell):** tentar a questão antes de dominar o PDF e errar prepara a codificação.
  Não revelar a dissecação completa da IA antes de o aluno marcar uma alternativa ou clicar em "Explorar Conceito".
