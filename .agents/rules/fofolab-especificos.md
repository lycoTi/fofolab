# Especificidades do FofoLab para as skills globais

As skills `tdd-suite`, `ux-ui-clean`, `microfrontend-dock-architecture`, `prompt-engineering-guide` e
`shannon-security-and-code-craft` vêm da stack global (`~/.agents`). Este arquivo diz como elas se aplicam aqui.
A skill `education-learning-science` é local (`.agents/skills/`).

## Testes (tdd-suite)
- Unitários em `src/lib/__tests__/` (`cycleEngine.ts`, `aiRouter.ts`, complexidade, proteção de 1º contato no Estudo Reverso);
  integração em `src/components/__tests__/` (filtrar, responder, diagnosticar, chat de Estudo Reverso, salvar no caderno).
- Invariante crítica: **orçamento semanal fixo (soma zero)** — erros em questões nunca inflam as horas semanais do aluno.
- Auditoria de UI limpa: `uiCleanliness.test.tsx` (termos proibidos em `ui-clean-design-and-tdd.md`).

## Interface (ux-ui-clean)
- Público: estudante de concurso (CGU, BACEN, tribunais). Tempo sempre em HH:mm (`formatDuration`/`formatClock`).
- Primeiro contato com um tópico: mensagem acolhedora ("Em mapeamento inicial"), nunca alerta punitivo.
- Ajustes do ciclo só no painel do Ciclo, mantendo o total semanal fixo.
- Dark mode: fundo `bg-slate-950`, superfícies `bg-slate-900/70` com `border-slate-800`; destaque `orange-500`/`amber-400`.
- Status: `emerald` dominado/correto · `amber` dúvida/atenção · `blue` mapeamento inicial · `rose/red` lacuna/prioridade alta.

## Arquitetura (microfrontend-dock-architecture)
- App desktop Tauri v2: `src/App.tsx` é só a casca de layout dos painéis (`TopicsSidebar`, `MainStage`, `NotebookDock`,
  `AiCopilotDock`); fatias em `src/features/<fatia>/`.
- Painéis abrem lado a lado (Tópicos, Bancada, Caderno, Chat IA) sem perder questão/página ativa.

## Prompts de IA (prompt-engineering-guide)
- Verdade imutável: gabarito oficial pós-recurso (`final_answer`) e enunciado oficial (`statement`); prompts em `src/lib/aiRouter.ts`.
- Explicação em 3 camadas: letra da lei/normativo exato → jurisprudência dominante (STF, STJ, TCU) → perfil da banca (FGV, Cebraspe, FCC).
- Abstenção: "Se o artigo exato não estiver confirmado, explique o conceito doutrinário sem inventar número de artigo ou inciso."
- Múltipla escolha (A–E): núcleo do comando → por que a oficial está certa → padrão de distrator de cada errada
  (extrapolação, inversão conceitual, troca de exceção literal, competência do órgão errado).
- Cache das dissecações em `ai_dissections`. Extração de provas no modo Admin em cadeia: segmentação → gabarito e anulações → tópico e complexidade 4D.

## Segurança (shannon-security-and-code-craft)
- Entradas não confiáveis: bancos `.fofopack` importados, HTML/PDF de bancas, Markdown gerado pela IA (render via `RichText`).
- Chaves (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, Groq) nunca no bundle distribuído; proxy com teto de gasto se for distribuir.
- Arquivos locais (Tauri): validar extensões `.pdf`/`.fofopack` e impedir caminho arbitrário.
