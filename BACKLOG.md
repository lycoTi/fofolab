# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** leia este arquivo no início de cada sessão. Ele descreve o estado **real** (o que foi verificado e o que não foi). Detalhes técnicos ficam em `docs/specs/`; a última revisão completa está em `docs/reviews/2026-10-21-estado-do-projeto.md`.

## 📌 Status Global
- **Objetivo imediato:** uso pessoal nos estudos da **CGU** e do **BACEN**; depois, compartilhar com família e amigos.
- **Stack:** Tauri v2 + React 19 + TypeScript + Vite + Tailwind + Vitest + Playwright + sql.js (banco SQLite em memória, gravado em arquivo/IndexedDB).
- **Fase atual:** Fatias 5.5 (endurecimento), 5.6 (IA real via Groq) e 5.7 (leitor de PDF) **na `main`** (21/10/2026), verificadas no navegador. O app desktop (Tauri) ainda **não foi compilado em nenhum PC** — falta o **checklist do app desktop** (abaixo). Fatia 7a (edital real → ciclo pela nota mínima, spec `07`) no branch **`fatia-7-edital-ciclo`**; próxima: 7b.

- **Retomando em outro PC?** Siga `docs/handoff/2026-10-22-continuar-no-outro-pc.md` (instalar a stack `~/.agents`, onde paramos, mensagem pronta para a IA).

## ✅ Definição de Pronto
Um item só vira **[DONE]** quando: (1) funciona com dados reais, não só com o exemplo; (2) sobrevive a fechar e abrir o app; (3) tem teste automatizado da regra e, se o fluxo atravessa telas, teste E2E; (4) `npm test`, `npm run test:e2e` e `npm run build` passam.
Legenda: **[DONE]** verificado • **[PARCIAL]** funciona com limitações listadas • **[A VERIFICAR]** implementado, sem verificação ponta a ponta • **[ ]** não começou.

## 🎯 Estado real por área

**Dados & segurança** (spec `06-importacao-e-persistencia.md`)
- [DONE] Contrato SQL v4 + migrações (`PRAGMA user_version`); teste garante banco novo = banco v1 migrado.
- [DONE] No navegador: gravação em IndexedDB logo após cada ação, aviso visível de falha + nova tentativa, cópia diária, quarentena de banco ilegível, backup/restauração (arquivo e cópias automáticas) — testado E2E.
- [A VERIFICAR] No `.exe`: arquivo real `%APPDATA%\com.fofolab.desktop\fofolab.db` via `tauri-plugin-fs` (código pronto, **nunca compilado**).
- [DONE] Excluir/restaurar pede confirmação, mostra o que vai junto e guarda cópia antes. IDs UUID.

**Ciclo & métricas** (specs `02` e `05`)
- [DONE] Motor do ciclo (soma zero, confiança da amostra, curva de esquecimento); o "ⓘ" mostra a conta que o motor faz.
- [DONE] "Meu Dia" escolhe pelo que falta do ciclo na semana; o Wizard grava horas/estratégia/momento no plano e aplica ao ciclo.
- [PARCIAL] Estratégias são multiplicadores v1; "o que mais cai" ainda não usa a frequência real das questões (depende do banco de questões). O texto da estratégia "Base Comum" fala de Português, que não cai em todo edital.
- [DONE] Planos do edital: peso de cada matéria pelos pontos da prova, **piso de tempo pela nota mínima** (30% do orçamento; nenhuma matéria de prova eliminatória fica sem tempo) e domínio inicial pela autoavaliação — testado com o edital real e a autoavaliação do dono.
- [DONE] **Bloco de estudo** (um só para o app: cartão no Meu Dia/Ciclo + relógio no cabeçalho): pomodoros de 00:20/00:30/00:50 com pausas (00:05/00:10) e "pomodoro 2 de 4", ou modo livre até a meta; relógio real; grava cada trecho de foco no tópico em que o bloco começou — testado (máquina de estados + E2E).
- [DONE] Aba **Ciclo** (matérias agrupadas por prova, feito × meta em HH:mm, motivo em uma linha) separada da aba **Mapa de Calor** (grade: um quadradinho por tópico, detalhe e "Estudar este tópico") — E2E.
- [DONE] Tempo sempre em HH:mm (regra em `.agents/rules/ui-clean-design-and-tdd.md`); o alerta "foque em 4 ou 5 matérias" não aparece em planos do edital; o "ⓘ" explica o piso da nota mínima.
- [A VERIFICAR] O bloco em andamento não sobrevive a recarregar a página (o tempo já gravado, sim).

**Questões & estudo reverso**
- [DONE] Importar questões coladas (texto ou JSON): prévia, Certo/Errado, tópico pelo código, sem duplicar.
- [DONE] Diagnóstico coerente: 1 por tentativa, resposta travada após ver o gabarito, tempo real.
- [DONE] IA sem chave = respostas marcadas "Exemplo simulado". Com chave: prompt com regras anti-alucinação e explicação guardada.
- [DONE] IA real pelo **Groq** (grátis, `qwen/qwen3.8-27b`): tutor e explicação-base verificados no Edge contra a API real (~1-2 s). Ordem: gateway → Groq → Gemini → DeepSeek. Erros dos provedores aparecem no console.
- [A VERIFICAR] Copiloto com IA real. Gemini exige crédito pré-pago; DeepSeek (`deepseek-flash`, sem modo de raciocínio) fica como reserva paga.
- [ ] Importar prova em PDF + gabarito (extração automática) → depois da 7b (o dono usa o TEC Concursos para questões).

**Caderno, PDF & layout**
- [DONE] Caderno por tópico com salvamento automático (não perde rascunho ao trocar de tópico).
- [DONE] Colunas redimensionáveis com largura lembrada.
- [DONE] Leitor de PDF próprio (pdf.js, aba "Leitura de PDF", um leitor só): total de páginas exato, página atual seguida pela rolagem, página conta como lida após 15 s na tela com a janela em foco (desmarcável), volta onde parou, zoom, texto selecionável — testado E2E.
- [DONE] Maximizar (esconde cabeçalho, abas e painéis; caderno por botão; Esc restaura) — testado E2E. [A VERIFICAR] Tela cheia (API do navegador; conferir no `.exe`).
- [PARCIAL] O app guarda só nome/página/páginas lidas (direitos autorais): após reiniciar é preciso abrir o arquivo de novo.

**Edital**
- [PARCIAL] Colar o conteúdo programático → tópicos e subtópicos (heurístico, com prévia).
- [DONE] Importar edital em PDF (modelo Cebraspe, sem IA): cargos, provas com pontos e mínimos, matérias por prova, tópicos, datas, taxa → prévia editável → plano novo → Wizard com **autoavaliação por matéria e por tópico**. Testado com o PDF real da CGU 2026 (`e2e/fixtures/`), unitário e E2E.
- [PARCIAL] Editais de outras bancas (FGV, FCC…) não foram testados; quando o leitor não reconhece, a tela avisa e sugere colar o conteúdo.

**Ainda não começou:** grafo interativo (Fatia 6) • pacote `.fofopack` para amigos • Modo Admin real (a tela mostra dados de exemplo) • vídeo/Gran/YouTube.

## 🏠 Checklist do app desktop (pendente — juntado na `main` antes, por decisão do dono)
0. Pré-requisito: **Build Tools do Visual Studio com "Desenvolvimento para desktop com C++"** (o PC de casa tem Rust 1.99, mas não tem o compilador C++; o PC do trabalho não tem Rust). Compile pelo PowerShell: no Git Bash, o `link` do Git esconde o `link.exe` do Visual Studio.
1. `npm install` → `npm test`, `npm run test:e2e`, `npm run build`.
2. `npm run tauri:dev` precisa compilar com `tauri-plugin-fs`. Se reclamar de permissão, conferir os identificadores em `src-tauri/capabilities/default.json`.
3. No app desktop: criar um tópico, fechar, abrir → continua lá? Existem `fofolab.db` e `backups/` em `%APPDATA%\com.fofolab.desktop\`?
4. Digitar no caderno e fechar a janela em seguida → perdeu? (não há gravação no fechamento da janela; se perder, implementar `onCloseRequested` + permissão `core:window:allow-destroy`).
5. "Fazer Backup" no app desktop baixa o arquivo? (se não, usar `plugin-dialog` + `plugin-fs`). Abrir um PDF mostra o leitor? O botão "Tela cheia" do leitor funciona na janela do `.exe`?
6. Trocar os [A VERIFICAR] verificados por [DONE]; o que falhar vira tarefa com o motivo.

## 🔜 Próximas fatias
- **5.6 — IA real:** feito com Groq (ver acima). Falta: copiloto com IA real; gateway próprio antes de distribuir o `.exe` (chaves `VITE_*` vão dentro do app).
- **6 — Mapa de conceitos & pacotes:** grafo de tópicos/pré-requisitos; decidir o formato do pacote (o backup completo já existe; para amigos, um pacote só de conteúdo, sem progresso pessoal).
- [DONE] **7b — registro rápido de questões feitas fora do app** (23/10/2026, plano `docs/superpowers/plans/2026-10-22-7b-registro-rapido-tec.md`):
  painel no topo da coluna (recolhido; abre sozinho ao concluir um bloco), total/certas/em branco + tópico (o do bloco por
  padrão), validação, "Registrado: 14 de 20 (70%)" com Desfazer (confirmação). Banco: tabela `question_logs` (migração
  **v7**), só números. Domínio = média ponderada pela evidência (histórico pesa até 40 questões); no motor, as questões
  contam como amostra e cada registro ≥ 70% conta como "dominei" (< 50% como lacuna) para a memória. Textos genéricos (não
  citam o TEC: outros estudantes usam outros sites). E2E `e2e/registro-externo.spec.ts`; testes e build verdes.
  Revisão independente: desfazer age pelo id e só volta o domínio se nada mudou depois; recalcula a data de estudo;
  tópico pai não recebe registro; registros com menos de 5 questões não contam como "dominei"/lacuna; trocar de plano ou
  restaurar o banco limpa o convite; excluir avisa quantos registros vão junto.
- **Tela "Bom dia"** (spec 07 §5.5: situação por prova e linha de ânimo com fatos) — junto com a 9c (Revisão do dia).
- **Mapa de incidência das bancas** (spec `08`, **rascunho — rodar o brainstorming antes de construir**): o que cada banca/órgão/área realmente cobra, a partir das provas catalogadas, cruzado com o mapa pessoal. Junto com o módulo de questões.
- **9 — Bancada única (spec `09`, aprovada em 22/10/2026):** [DONE] **9a casca** (22/10/2026, plano
  `docs/superpowers/plans/2026-10-22-9a-casca-da-bancada.md`): cabeçalho fixo de ponta a ponta (concurso, dias, "P1 x% visto"),
  painéis que recolhem em trilho com transição de 220 ms (sem animação com "reduzir movimento"), Copiloto+Caderno em abas
  montadas, "Edital" no pé da coluna, estado recolhido lembrado após reabrir (E2E `e2e/casca.spec.ts`; `npm test`,
  `test:e2e` e `build` verdes). O resumo por prova no cabeçalho só aparece em planos do edital (coberto por teste de unidade).
  [DONE] **9b roteiro na coluna** (22/10/2026, plano `docs/superpowers/plans/2026-10-22-9b-roteiro-na-coluna.md`): Meu Dia
  e Bancada numa tela só; roteiro do dia congelado no banco (migração **v5**, tabela `daily_plans`) e classificado em
  feito/atual/próximo pelas sessões de hoje; "olhada" (tópico fora do bloco, inclusive irmão) pausa o relógio e "Voltar ao
  bloco" retoma, dica única após 3 min; atalhos de PDF/questões/caderno do bloco; tópico sem questões mostra as do grupo
  (ou da matéria) com rótulo; Mapa de Calor, Ciclo (pela matéria) e Edital abrem o tópico como olhada; aviso discreto de
  recalibrar; recalibrar refaz o roteiro do dia. Corrigido no caminho: o detalhe do Mapa de Calor fazia a grade tremer ao
  passar o mouse. E2E `e2e/roteiro.spec.ts`; `npm test`, `test:e2e` (2 rodadas) e `build` verdes. A importação de questões
  passa a sugerir a matéria aberta (a do bloco de hoje), não a primeira da lista.
  Revisão independente: pausa da olhada não conta como atrito; virada do dia não herda o tempo de ontem; bloco extra
  fica fixo no dia; o roteiro guarda a assinatura do perfil e é refeito sozinho se o perfil mudou (recalibrar e fechar o
  app antes de gravar não deixa o roteiro antigo); restaurar backup volta a bancada ao bloco. E2E: 3 rodadas verdes.
  Ajustes pedidos pelo dono (22/10): irmãos do bloco como "Outros tópicos do mesmo grupo" (sem recuo de filho, até 3 +
  "Ver mais", selecionado com fundo e contorno); barrinha de progresso no relógio do cabeçalho (pomodoro/pausa) e no bloco
  atual da coluna (anda ao vivo); clicar no relógio do cabeçalho leva ao Ciclo.
  → 9c Revisão do dia (usará a migração **v8**; v6 = assinatura do perfil no roteiro, v7 = registro externo) (3–5 questões intercaladas dos
  tópicos esfriando, confiança, pergunta aberta como transição, pode desligar).
- **Questões: um só copiloto (pedido do dono, 22/10):** o painel "Explicação & Estudo Reverso" ao lado da questão repete o
  papel do Copiloto da coluna direita. Avaliar fundir o Estudo Reverso no copiloto e dar a ele a voz do hamster
  (nome amigável: **FofoIA** ou **FofoPiloto**), liberando espaço para a questão. Brainstorm antes de construir.
- **Caderno:** já grava sozinho ("Salvo automaticamente", como o Google Docs) — avaliar tirar o botão "Salvar" redundante.
- **Épico — Banco de questões a partir das provas oficiais:** provas e gabaritos definitivos baixados **das bancas**
  (não do TEC: os Termos de Uso §18.8 proíbem extrair/processar com script ou IA o que vem da plataforma, mesmo para uso
  pessoal); extração, sem duplicadas (`normalizeStatement`), classificação por tópico. Catálogo de provas feito à mão ou
  por descoberta nos sites das bancas — **brainstorm próprio antes de construir**.
- **Épico — Guia / mapa de incidência** (spec `08`): depende do banco classificado. Tópico sem questão = baixa incidência
  (reduz prioridade), nunca escondido.
- **TEC só por registro manual (feito na 7b):** a importação do desempenho por arquivo salvo (spec 07 §9) fica descartada —
  ler a página salva com o app é processamento automatizado vedado pelo §18.8.1 dos Termos de Uso do TEC.
- **Depois:** ferramentas do leitor (grifar, desenhar, atalho para o caderno, resumo ao fechar); formato cronograma (planos por dias — formato preferido pela esposa do dono, segunda usuária); tópicos relacionados entre matérias.
- **Leitura:** grifos em `highlights_json`; reabrir o último PDF sozinho no `.exe` (lá o caminho do arquivo é conhecido).
- **Dívidas conhecidas:** `OnboardingWizardModal.tsx` (383 linhas) e `App.tsx` (~1180) passam do teto de ~250 linhas; no mapa de calor, tópicos sem questões da mesma matéria empatam (a diferença aparece com dados de estudo/TEC); bundle ~515 kB; histórico do copiloto não é salvo; acertar depois de ver a explicação ainda permite "Dominei" (fica registrado em `used_ai_review`).
