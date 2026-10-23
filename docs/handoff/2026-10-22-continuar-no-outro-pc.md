# Continuar no outro PC — 22/10/2026

## 1. Preparar o PC (uma vez)
1. **Stack de skills e regras** (`~/.agents`, repositório privado `lycoTi/agents-stack`):
   - Se `~/.agents` já existe (instalações antigas do `npx skills`):
     ```powershell
     cd $HOME\.agents; git init; git remote add origin https://github.com/lycoTi/agents-stack.git
     git fetch; git checkout -f -B main origin/main
     ```
   - Se não existe: `git clone https://github.com/lycoTi/agents-stack.git $HOME\.agents`
   - Depois: `& $HOME\.agents\install.ps1 -DryRun` (confere) e `& $HOME\.agents\install.ps1` (liga as skills no
     Claude Code e no Antigravity, registra o hook que detecta a stack de cada projeto). Reinicie o Antigravity.
2. **Projeto:** `git -C d:\dev-pessoal\fofolab pull` no branch `fatia-7-edital-ciclo`, depois `npm install`.
3. **Impeccable no FofoLab** (o hook do detector de design é por máquina):
   `npx impeccable install --providers=claude --project -y` na raiz do projeto.

## 2. Onde paramos
- **Spec 09 aprovada** (`docs/specs/09-bancada-roteiro-e-revisao.md`): bancada única em 3 entregas.
- **9a (casca) pronta**: cabeçalho fixo, painéis que recolhem em trilho, Copiloto+Caderno em abas. Plano em
  `docs/superpowers/plans/2026-10-22-9a-casca-da-bancada.md`. Testes e build verdes.
- **9b (roteiro na coluna) pronta**: Meu Dia e Bancada numa tela só, roteiro congelado no dia (migração v5), olhada com
  pausa automática. Plano em `docs/superpowers/plans/2026-10-22-9b-roteiro-na-coluna.md`.
- **Próximo:** plano da **9c** (Revisão do dia: 3–5 questões intercaladas dos tópicos esfriando, confiança, pergunta
  aberta como transição, pode desligar). Decisões na spec 09 §5.3 e §5.3.1; usa a migração **v7** (a v6 já existe: assinatura do perfil no roteiro).
- **Depois:** o brainstorm do **minerador de provas da Cebraspe** (épico no BACKLOG; nada do TEC:
  os Termos de Uso §18.8 proíbem processar o conteúdo deles com script ou IA).

## 3. Mensagem para colar na IA (Claude Code ou Antigravity)
> Leia `BACKLOG.md`, a spec `docs/specs/09-bancada-roteiro-e-revisao.md` e o plano da 9a em
> `docs/superpowers/plans/2026-10-22-9a-casca-da-bancada.md`. As entregas 9a e 9b estão prontas (planos em `docs/superpowers/plans/`). Escreva o plano da **9c** com a skill
> `writing-plans`, no mesmo formato dos planos anteriores, seguindo as decisões da spec (§5.3 e §5.3.1). Prefiro executar
> direto na sessão (custo-benefício), com uma revisão independente no fim.
