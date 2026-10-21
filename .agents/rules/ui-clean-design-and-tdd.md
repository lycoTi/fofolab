# Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)

## 1. Proibição de Jargão Técnico na Interface (UX/UI Foco no Estudante)
A interface do FofoLab é voltada para o estudante, nunca para o desenvolvedor.
- **PROIBIDO exibir na UI:** termos de infraestrutura interna como `"SQLite"`, `"Salvar no SQLite"`, `"Tabela"`, `"Cache"`, `"0 tokens"`, `"_score"`, `"Elasticsearch"`, `"Grounding Anti-Alucinação"`, `"Política de Direitos Autorais"`, `"WASM"` ou `"Seed"`.
- **Use sempre linguagem humana e natural:**
  - Em vez de `"Salvar no SQLite"` ➔ use `"Salvar Caderno"` ou `"Salvar"`.
  - Em vez de `"Exportar .sqlite"` / `"Restaurar Seed"` ➔ use `"Fazer Backup"` / `"Restaurar Exemplo Inicial"`.
  - Em vez de `"_score: 4.5"` ➔ use `"Prioridade Alta"` ou `"Relevância"`.
  - Comentários arquiteturais, regras de direitos autorais e detalhes de banco ou IA pertencem exclusivamente a `docs/specs/` e comentários de código, nunca aos textos visíveis na tela.

## 2. Qualidade & Suíte de Testes Obrigatória
- Toda nova funcionalidade ou fatia do backlog deve ser acompanhada de testes automatizados em `src/**/__tests__/*.test.ts(x)` cobrindo regras de negócio, fluxos intermediários e limpeza de UI.
- Antes de encerrar uma entrega ou fazer commit, execute `npm test` e `npm run build`.
