---
trigger: always_on
description: Definição de pronto do FofoLab — quando um item do BACKLOG pode ser marcado como [DONE].
---

# Definição de Pronto (DoD)

Um item do `BACKLOG.md` só pode ser marcado como **[DONE]** quando TODOS valem:
1. Funciona com **dados reais** (não só com o exemplo inicial do seed).
2. **Sobrevive a fechar e abrir o app** (a persistência foi verificada, não presumida).
3. Tem **teste automatizado** da regra (Vitest) e, se o fluxo atravessa mais de uma tela, **teste E2E** (Playwright, `e2e/`).
4. `npm test`, `npm run test:e2e` e `npm run build` passam.

Caso contrário, use:
- **[PARCIAL]** — funciona, com as limitações listadas ao lado;
- **[A VERIFICAR]** — implementado, mas sem verificação ponta a ponta (diga o que falta verificar e onde);
- **[ ]** — não começou.

Regras extras:
- Respostas simuladas da IA (sem chave) nunca contam como funcionalidade de IA pronta.
- Ao terminar uma fatia, atualize o BACKLOG com o que foi **verificado** e rode `graphify update .`.
