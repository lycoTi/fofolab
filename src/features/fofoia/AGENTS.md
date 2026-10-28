# Regras da Fatia FofoIA (`src/features/fofoia/`)

Este arquivo governa todas as modificações na interface e no comportamento da FofoIA.
Fonte única e viva do estado do módulo: `src/features/fofoia/CONTEXT.md`.

## Diretrizes Locais Obrigatórias
1. **Componentes:** Teto de ~250 linhas por componente. Se crescer, extraia subcomponentes ou hooks locais.
2. **Design e UX (ux-ui-clean):**
   - Não use callouts com emojis decorativos genéricos de IA, glassmorphism excessivo ou cards de 3 colunas.
   - Respeite o modo *Operate*: linhas de 1px, tipografia compacta, superfícies escuras padrão do FofoLab (`bg-slate-950`, `bg-slate-900/70`, bordas `border-slate-800`).
   - Texto de IA sempre formatado e renderizado via `RichText`, nunca HTML cru (`dangerouslySetInnerHTML`).
   - Apenas o selinho e o avatar do mascote usam o emoji do hamster 🐹 e das modalidades.
3. **Comportamento Pedagógico:**
   - Nunca expor respostas ou gabaritos antes de a questão ser respondida pelo estudante.
   - Mantenha a distinção entre os 5 jeitos (Rápida, Do zero, Aula completa, Resumo, Edital, Pista).
   - Resumo segue estritamente o formato de 6 linhas (Dora) para não poluir o caderno.
4. **Isolamento da Fatia:**
   - Não acople a FofoIA diretamente a outras features além dos contratos declarados em `FofoIaPanelProps`.
   - Modificações de prompts ou regras de IA pertencem a `src/lib/fofoia/`, e a UI a `src/features/fofoia/`.
