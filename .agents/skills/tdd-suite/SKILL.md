---
name: tdd-suite
description: >-
  Use esta skill ao criar novas funcionalidades, refatorar motores de cálculo
  (Ciclo de Estudos, Roteador IA, Banco de Dados) ou validar entregas do FofoLab
  com testes unitários, testes de integração de componentes e verificação de build.
---

# Suíte de Testes & TDD (FofoLab)

Siga este fluxo para garantir estabilidade em cada Fatia do projeto:

## 1. Camadas de Teste
1. **Unitários (`src/lib/__tests__/*.test.ts`):**
   - Validam regras matemáticas e de domínio puras (`cycleEngine.ts`, `aiRouter.ts`, cálculos de complexidade e proteção de 1º contato no Estudo Reverso).
   - Regra crítica: testar sempre a invariante de **Orçamento Semanal Fixo (Soma Zero)** para garantir que erros em questões nunca inflem as horas semanais do aluno.
2. **Integração de Funcionalidades (`src/components/__tests__/*.test.tsx`):**
   - Validam fluxos entre componentes React e estado da aplicação (ex: filtrar questões, responder, registrar diagnóstico, abrir chat de Estudo Reverso e salvar no caderno).
3. **Auditoria de UX Limpa (`uiCleanliness.test.tsx`):**
   - Verifica que a interface renderizada não vaza jargões técnicos internos (`SQLite`, `_score`, `0 tokens`, `Anti-Alucinação`, `Seed`).

## 2. Comandos de Verificação
```powershell
npm test
npm run build
```
