# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** leia este arquivo no início de cada sessão. Ele descreve o estado **real** (o que foi verificado e o que não foi). Detalhes técnicos ficam em `docs/specs/`; a última revisão completa está em `docs/reviews/2026-10-21-estado-do-projeto.md`.

## 📌 Status Global
- **Objetivo imediato:** uso pessoal nos estudos da **CGU** e do **BACEN**; depois, compartilhar com família e amigos.
- **Stack:** Tauri v2 + React 19 + TypeScript + Vite + Tailwind + Vitest + Playwright + sql.js (banco SQLite em memória, gravado em arquivo/IndexedDB).
- **25/10/2026:** **Plano de estudo (spec 13): 13a pronta** — horas por dia, folgas, "mudar o tempo de hoje" e a semana dia a dia. Spec 12 (minerador da Cebraspe) e entrega **12a** prontas — acervo de 29,9 mil itens em `acervo/` (revisão independente feita e corrigida); **12b [PARCIAL]** — vocabulário de assuntos e os primeiros 300 itens classificados pela IA. FofoIA: cumprimento respondido pelo app e resposta surgindo por parágrafo.
- **Fase atual (24/10/2026):** fatias 5.5–5.7 na `main`; no branch **`fatia-7-edital-ciclo`**: 7a/7b, 9a/9b/9c (bancada, roteiro, Revisão do dia e aba Início), FofoDoro (10) e **FofoIA (11)** — banco na migração **v10**. O app desktop (Tauri) ainda **não foi compilado em nenhum PC** (checklist abaixo). **Estado e próximos passos: `docs/handoff/2026-10-24-estado-e-proxima-ia.md`.**

- **Retomando (outra IA ou outro PC)?** Leia `docs/handoff/2026-10-24-estado-e-proxima-ia.md`; para preparar um PC novo, a seção 1 de `docs/handoff/2026-10-22-continuar-no-outro-pc.md`.

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
- [DONE] O bloco em andamento sobrevive a recarregar (23/10): guardado neste computador a cada mudança, volta no ponto certo pelo relógio real (pomodoro que acabou com a página fechada é gravado quando o banco abre); guardado há mais de 3 h não volta; abre na bancada. Unit + E2E.

**Questões & estudo reverso**
- [DONE] Importar questões coladas (texto ou JSON): prévia, Certo/Errado, tópico pelo código, sem duplicar.
- [DONE] Diagnóstico coerente: 1 por tentativa, resposta travada após ver o gabarito, tempo real.
- [DONE] IA sem chave = respostas marcadas "Exemplo simulado". Com chave: prompt com regras anti-alucinação e explicação guardada.
- [DONE] IA real pelo **Groq** (grátis, `qwen/qwen3.8-27b`): tutor e explicação-base verificados no Edge contra a API real (~1-2 s). Ordem: gateway → Groq → Gemini → DeepSeek. Erros dos provedores aparecem no console.
- [PARCIAL] FofoIA com IA real (ver a fatia 11 abaixo: teto de resposta corrigido; pista de Certo/Errado e Direito do `qwen` em aberto). Gemini exige crédito pré-pago; DeepSeek (`deepseek-flash`, sem modo de raciocínio) fica como reserva paga.
  **26/10/2026:** crédito de US$ 5 na DeepSeek; chave no `.env` testada com uma chamada real (200, ~1,5 s, `deepseek-flash`).
  **Minerador com teto de R$ 5 por dia na DeepSeek** (`tools/minerador/spendLedger.ts`): conta o custo pelo `usage` de
  cada resposta no preço de pico (US$ 0,30/US$ 1,20 por milhão; fontes de terceiros, a página oficial não abriu) e dólar
  a R$ 6; ao bater o teto, para com o limite diário e a fila continua no dia seguinte (`MINERADOR_DEEPSEEK_TETO_BRL`,
  `MINERADOR_USD_BRL`). No app, a DeepSeek só entra quando o Groq falha e não tem teto diário (só o saldo pré-pago).
  **26/10/2026 (relato do dono, aula sobre service mesh cortada no meio):** o app agora lê o aviso de corte do provedor
  (`finish_reason: length` / `MAX_TOKENS`), mostra a resposta até a última frase completa e oferece **"Continuar de onde
  parou"** (manda o final já mostrado; o resto herda a parte da aula). Aula: uma parte por resposta (~300 palavras, 3 a 5
  partes) e o "Continuar" leva o total anunciado e proíbe repetir (antes vinha "Parte 3 de 4" e conteúdo repetido).
  **Conversa sobrevive ao F5 e a fechar/abrir o app por 20 minutos** (desde a última fala, só no mesmo tópico; fica no
  `localStorage` deste computador). Testes: `aiRouter`, `fofoia`, `useFofoConversation`, `fofoiaPanel` + E2E do F5 em
  `e2e/fofoia.spec.ts`; `npm test` (626), `test:e2e` (38) e `build` verdes. Não verificado com a IA real: se o modelo
  respeita a parte de ~300 palavras (o corte agora é tratado de qualquer jeito).
  **26/10/2026 (2º relato: "Aula completa" e "Resumo" ignoravam a conversa):** depois de conversar, os botões pedem
  "Aula completa / Resumo de revisão do que conversamos (tópico X)"; o prompt da aula e do resumo trata da questão ou
  dúvida da conversa (o tópico vira pano de fundo); o texto longo que o estudante colou (a questão) vai sempre junto,
  mesmo depois de sair das 6 últimas falas; e se ele anunciar uma questão sem colar, a FofoIA pede em vez de inventar.
  Testes em `fofoia.test.ts` e `fofoiaPanel.test.tsx`. Não verificado com a IA real.
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
- [DONE] **Fofo no app** (regra `.agents/rules/identidade-fofolab.md`; desenhos em `tools/mascote/`, 11 roupas).
  **Parte 1 feita (26/10/2026):** guarda-roupa `src/features/mascot/wardrobe.ts` (roupa fixa > dia da prova > nomeado >
  data especial > madrugada > aba > base; Carnaval pela Páscoa), `FofoSprite` (SVG pixel a pixel; parado / só pisca /
  momento; "reduzir movimento" para tudo), roupa por contexto refeita a cada minuto (`FofoOutfitContext`). O Fofo
  aparece no cabeçalho (só pisca), no painel da FofoIA, no aviso do FofoDoro (se mexe) e nas telas de carregar/erro.
  Sprites do app gerados por `node tools/mascote/gen.cjs` em `fofoSprites.generated.ts` (tipado: falta de roupa não
  compila). Testes: `fofoWardrobe`, `fofoSprite`, `fofoOutfitContext` + E2E `e2e/fofo.spec.ts` (roupa por aba e
  Halloween em outubro); `npm test` (616), `test:e2e` (37) e `build` verdes. Nada novo é gravado no banco. Fechamento (parte 2c): `npm test` (642), `test:e2e` (41) e `build` verdes.
  **Parte 2a feita (26/10/2026):** emojis de interface trocados — status por `StatusSquare` (quadradinho de pixel +
  texto: diagnóstico, painel Admin, resultado de importação), ações por ícone (`Lightbulb` "Pedir pista",
  `GraduationCap` "Aprofundar", `Calculator`, `Link2`, `Layers`), selinho da FofoIA só com o nome do jeito, Fofo no
  Wizard; títulos sem emoji. Auditoria `src/__tests__/noEmojiInUi.test.ts` reprova emoji em texto de interface (exceções
  de conteúdo listadas com o porquê). A lista da conversa da FofoIA virou `role="log"` ("Conversa com a FofoIA").
  `npm test` (627), `test:e2e` (38) e `build` verdes.
  **Parte 2b feita (26/10/2026, decisões do dono):** roupas pela hora do dia e pelo sol do fuso do computador
  (`sun.ts`, cidade de referência por fuso; fazendeiro de dia, explorador do pôr do sol às 22:00, madrugada até o
  nascer do sol; fuso desconhecido = 06:00–18:00); Fofo do relógio no FofoDoro; o Fofo se mexe o tempo todo e só
  pisca durante um bloco de foco (hover anima); clicar no Fofo do cabeçalho abre o **guarda-roupa** (Automática ou
  roupa fixa) e o **"Fui nomeado!"** — guardados neste computador (`useFofoPrefs`, sem mudar o banco); o nomeado
  vale para o plano e a data de prova de quando foi marcado. Testes `fofoWardrobe`, `fofoSprite`,
  `fofoOutfitContext` + E2E `e2e/fofo.spec.ts` (sol, Halloween, guarda-roupa e nomeado depois do F5);
  `npm test` (634), `test:e2e` (41) e `build` verdes.
  **Parte 2c feita (26/10/2026):** poses `pensando` (no "A FofoIA está pensando…"), `dormindo` (aviso do começo da
  pausa) e `comemorando` ("Meta da semana cumprida." no pé da coluna), com testes e o E2E do FofoDoro conferindo o
  Fofo dormindo; ícone de 16 px desenhado à parte (`tools/mascote/icon.cjs` → favicon pixel a pixel e ícones do app
  de desktop via `tauri icon`), com teste que barra imagem embutida no favicon. **Fofo no app: [DONE]** salvo o que
  depende do app de desktop compilado (o ícone na barra de tarefas não foi visto num .exe).
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
- [DONE] **Tela "Bom dia"** (spec 07 §5.5) — entregue com a 9c como aba **Início** (ver 9c abaixo).
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
  [DONE] **9c Revisão do dia + Início** (23/10/2026, plano `docs/superpowers/plans/2026-10-23-9c-revisao-do-dia.md`, decisões
  do dono na spec 09 §5.3.2): aba **Início** (primeira; abre sozinha; título Bom dia/Boa tarde/Boa noite) com linha de ânimo
  factual do último dia de estudo, **Revisão do dia** e **Situação** (dias, % visto por prova, um aviso `amber` para prova
  com nota mínima ≥ 20 pontos atrás das outras) e o atalho "Começar o bloco de ‹matéria›" (leva à aba Questões).
  Revisão: até 5 tópicos já estudados e não estudados hoje — até 2 do último dia de estudo, o resto dos que mais esfriaram
  (`R < 0,9`), intercalados por matéria; congelada no dia (migração **v8**: `daily_reviews`, `recall_checks`, confiança e
  origem em `question_attempts`, `daily_review_enabled` no plano). Três caminhos: questão do app (confiança antes,
  correção logo depois, diagnóstico já marcado e trocável; grava no "Próxima"), pergunta aberta (lembrar → ver anotações →
  Lembrei bem/em parte/não lembrei = ±0,5 na meia-vida, domínio intacto) e "Fiz questões fora do app" (abre o registro
  rápido com o tópico; o registro conclui o item). Cada item feito grava uma sessão `REVIEW` (conta na semana, não no
  roteiro). "Pular a revisão de hoje" sem penalidade; desligar na caixa do último passo do Wizard. Testes: unit (seleção,
  progresso, textos, cartões, hook, migração v8 nos dois caminhos) + E2E `e2e/revisao.spec.ts` (responder, recarregar no
  meio, concluir e continuar feita; registro de fora conclui o item; desligada no Wizard; começar o bloco pelo Início).
  Revisão independente: começar o bloco pelo Início agora leva à aba Questões e o botão some com um bloco rodando (antes
  recomeçava do zero e perdia o foco); questão apagada depois do sorteio conclui pela autoavaliação (antes, laço);
  tópico apagado sai da revisão (antes ela dava "feita" antes da hora); sessão de revisão não mexe no atrito da matéria;
  um dia só de revisão não vira o "último dia de estudo" da revisão seguinte; a linha de ânimo acompanha a virada do dia.
  `npm test` (286), `test:e2e` (26, 2 rodadas) e `build` verdes.
- [DONE] **Início mais completo (23/10, ideias aprovadas pelo dono):** Situação com **cobertura do edital** e
  **proficiência nos tópicos estudados** separadas + **ritmo** ("Faltam N tópicos… cerca de X por semana. Seu ritmo nas
  últimas 2 semanas: Y"); **Continuar de onde parou** (último PDF na página e última anotação, a um clique); **Últimas 4
  semanas** (um quadradinho por dia, sem contar sequência); **Sua calibração** (acerto por "Tenho certeza / Acho que sei /
  Chutei", a partir de 8 respostas marcadas na revisão). Regras em `src/lib/goodMorningStats.ts`; unit + E2E. `npm test`
  (306), `test:e2e` (28, 2 rodadas) e `build` verdes. Movimentos da coluna mais suaves (fechar some antes de encolher;
  prévia e relógio trocam sem se sobrepor). No RDP o Windows desliga as animações (o app obedece a "menos movimento").
- [DONE] **Animações do roteiro (23/10):** blocos feito/atual/próximo, árvore de tópicos ao dar play, FofoDoro, prévia,
  registro rápido e faixas do topo abrem e fecham com altura animada (`src/components/Collapse.tsx`, só CSS, respeita
  "reduzir movimento"); os modais ganharam o fade que a classe `animate-fade-in` nunca teve.
- [DONE] **FofoDoro (spec 10, 23/10):** pomodoro no bloco atual da coluna Hoje (opção A), relógio em anel, pausa curta
  proporcional ao foco e pausa longa a cada N (contando entre blocos do dia), ajustes lembrados, prévia do bloco, avisos
  em toast, foco nunca recomeça sozinho; resumo do fim do dia e totais (hoje/semana/ano/tudo) no Ciclo. 219 unit + 22 E2E.
- [DONE] **Barras do tempo reservado no Ciclo** (comprimento proporcional à matéria com mais tempo; preenchimento = estudado).
- **Épico — Plano de estudo (spec `13-plano-de-estudo.md`, brainstorm e design aprovados em 25/10/2026):** a aba Ciclo
  virou **"Plano de estudo"**, com a semana dia a dia e (13b/13c) o caminho até a prova.
  [DONE] **13a — horas por dia e "Sua semana"** (25/10/2026, plano `docs/superpowers/plans/2026-10-25-13a-horas-por-dia-e-sua-semana.md`):
  "Em quais dias você estuda?" + horas de cada dia (folga fixa sem cobrança; atalho "mesmo tempo nos dias de estudo"), no
  "Ajustar" do Plano e no passo 2 do Wizard; **semana atípica** ("Só esta semana é diferente" / "Voltar ao padrão");
  **"Mudar o tempo de hoje"** na coluna ("Hoje não vou estudar" deixa a coluna neutra; os blocos já feitos ficam no roteiro).
  O orçamento do ciclo é a soma dos dias da semana (folga e imprevisto não viram dívida). Roteiro do dia pelas horas do dia:
  dia de até 03:00 igual a antes; dia longo com blocos de até 02:00, matérias intercaladas. **Revisão da semana**: um bloco
  no dia mais longo, no tópico estudado mais frio que não está no dia (some com a Revisão do dia desligada). **Sua semana**:
  dias que passaram com o feito, hoje com o roteiro, os próximos como previsão (o mesmo planejador). Totais "Este ano /
  Desde o começo" saíram. Migração **v11** (`weekday_minutes_json`, `final_stretch_days`, `plan_day_overrides`).
  Verificado: unit (539), E2E 33 em duas rodadas (`e2e/plano.spec.ts` com recarregar; a semana com o edital real da CGU em
  `bancada.spec.ts`), build. Revisão independente (26/10) corrigida com teste: divisão do ciclo gravada pela semana padrão
  (semana de folga/atípica zerava a divisão), previsão limitada ao que sobra da semana, roteiro refeito sem perder tempo
  nem duplicar a revisão, plano novo herda os dias, tempo de hoje travado com bloco rodando. Pendente de olhar no `.exe`.
  [DONE] **13b — "Dá tempo?", linha do tempo e reta final** (26/10/2026, plano
  `docs/superpowers/plans/2026-10-26-13b-da-tempo-linha-do-tempo-reta-final.md`): projetor puro (`src/lib/examProjection.ts`)
  — tempo por tópico pela autoavaliação (Nunca vi 02:00 … Domino 00:30) misturado ao ritmo real das 4 semanas
  (`C = n ÷ (n + 5)`); horas de cada semana até a reta final (dias, folgas, semanas atípicas, menos a Revisão da semana);
  tópicos que faltam espalhados pela divisão do ciclo (matéria que fecha devolve o tempo). **"Dá tempo?"**: % do edital
  visto até a véspera da reta final, ritmo real quando 10%+ abaixo do plano (7+ dias de uso), "+HH:mm por semana" (abre o
  Ajustar) e a lista do que fica para depois, P1/P2/P3 com o aviso da nota mínima; "ⓘ" explica a conta (e que ela tende a
  ser otimista). **Linha do tempo** por semana (fase, tópicos novos, % visto). **Reta final** ajustável (7/10/14/21 dias):
  o roteiro do dia e a previsão passam a ser só de revisão (tópico estudado mais frio; sem nenhum estudado, roteiro normal).
  Revisão independente (26/10) corrigida com teste: reta final enchia pouco ou deixava a coluna vazia; nível do grupo
  (Wizard) ignorado; "+HH:mm" errado e irreal (agora calculado pela projeção, e "Não cabe" quando passaria do dobro do
  plano ou de 08:00 por dia); ritmo real com sessões de outros planos e contra o padrão cru (agora contra o planejado nos
  dias); semanas cheias com "0 tópicos novos" (avanço parcial); lista do que fica para depois pela menor prioridade;
  sessão pulada marcava o tópico como estudado. Ficou de fora (menor): a previsão da semana não para a reta final na data da
  prova.
  Verificado: unit (602), E2E 35 em duas rodadas (`e2e/plano-ate-a-prova.spec.ts` com o edital real da CGU e a reta final),
  build. Com o edital real (cargo 4, ~200 tópicos) e 21:00 por semana sem autoavaliação: 31% até 28/11, "não cabe".
  **Próxima:** 13c (mapa matéria × semana, sugestão de ajustar o padrão).
- [DONE] **FofoIA + diagnóstico pela confiança (spec 11, 24/10/2026; plano `docs/superpowers/plans/2026-10-24-11-fofoia.md`):**
  um só professor na coluna direita (aba **FofoIA**; o painel de IA saiu da aba, que virou **Questões**), com jeitos
  escolhidos pelos sinais e selinho (Rápida · Do zero · Aula completa em partes, alargando a coluna · Resumo no formato da
  Dora · Cai no meu edital? com filtro local · Pista) — inspirados nos professores do grupo de estudos do dono. Contexto com
  o caderno do tópico (até 1.500 caracteres, com aviso); **gabarito nunca vai à IA antes da resposta**; conversa recomeça
  ao trocar de tópico; resumo só vai ao caderno com IA real e confirmação; aquecimento antes da primeira aula num tópico
  nunca tentado (desligável no Wizard: "Sugerir tentar antes da aula", migração **v9**); modelo forte opcional
  (`VITE_*_MODEL_STRONG`). Aba Questões: confiança obrigatória antes das alternativas; tentativa gravada ao responder;
  diagnóstico deduzido (novos: **acertei no chute**, **confundi com outra coisa**; **falsa certeza** pesa mais no calor);
  "Por quê?" corrige a mesma tentativa (delta aplicado guardado, migração **v10**); explicação embaixo da questão. Revisão
  do dia com os mesmos rótulos. Testes: unit (diagnóstico, motor, banco, fluxo de resposta, aba Questões, núcleo e painel
  da FofoIA, entradas, conversa) + E2E `e2e/fofoia.spec.ts`; `npm test` (355), `test:e2e` (31, 2 rodadas) e `build` verdes.
  Revisão independente: trocar diagnóstico perto de 0/100; questão ativa limpa ao sair da aba; resposta atrasada descartada
  na troca de tópico; pedido da aba Questões não se perde nem repete; voltar a questão respondida não dá 2ª tentativa.
  [PARCIAL] **com a IA real (Groq, conferido em 24/10 por sonda com os prompts reais, conteúdo de Direito Administrativo da CGU):**
  - Corrigido (unit): o plano grátis do Groq aceita só **1.000 tokens de resposta por minuto** no `qwen/qwen3.8-27b`;
    sem `max_tokens` ele reservava 2.048 e recusava quase toda chamada (429 "Request too large"). Agora cada pedido leva
    um teto (`MODE_MAX_TOKENS` por jeito; 800 na explicação-base). No 429, a tela diz "pausa curta… tente em N segundos"
    (cabeçalho `retry-after`). Letras chinesas que o Qwen solta no meio do português são retiradas. "Parte 1/3" também
    mostra o "Continuar" (antes só "Parte 1 de 3"). Prompts com tamanho por jeito, sem "corrigir" o caderno sem certeza,
    sem autor preferido da banca, só classificações consagradas.
  - Verificado: rápida, resumo no formato da Dora (`parseSummary` lê) e "Cai no meu edital?" funcionam; respostas em 1–3 s.
  - [DONE] **Pista em questão Certo/Errado sai do próprio app, sem IA** (decisão do dono, 24/10): com o `qwen` e o
    `gpt-oss-120b` a pista entregava a resposta mesmo com a regra explícita ("não é absoluta"). Agora são três níveis de
    texto fixo, iguais para toda questão C/E (só o tópico muda): lembrar a regra do tópico → julgar por partes → "agora é
    com você" (`src/lib/fofoia/trueFalseHint.ts`). Não gasta limite. Múltipla escolha segue com a pista da IA (não
    conferida com a IA real). Unit + E2E.
  - **Falha aberta — Direito errado no `qwen`:** atributos do ato inventados ("PAT", "Imprescritibilidade"), chamou o
    COFIFOMOB (certo) de "inventado". O `openai/gpt-oss-120b` acertou os atributos (PATI) e respeitou o caderno; serve
    como `VITE_GROQ_MODEL_STRONG` (aula e edital), com a ressalva de 21/10 (inventou conceitos de auditoria) e de gastar
    tokens "pensando" (a aula bateu no teto). Correção de fundo: **FofoIA com a letra da lei** (`ctresb/leis`, brainstorm
    próprio). Depois: **professores personalizados** (ideia).
- **Caderno:** já grava sozinho ("Salvo automaticamente", como o Google Docs) — avaliar tirar o botão "Salvar" redundante.
- **Épico — Banco de questões a partir das provas oficiais** — brainstorm feito (25/10), **spec `12-minerador-cebraspe.md`**
  (só Cebraspe, qualquer formato; assunto canônico no acervo + ligação barata no app; acervo no git, PDFs só em cache).
  [DONE] **12a — minerador até o acervo cru** (25/10/2026, plano `docs/superpowers/plans/2026-10-25-12a-minerador-acervo-cru.md`):
  `tools/minerador/` (fora do app; `npm run minerar -- lote | rodar`), API pública da Cebraspe com verificação de formato,
  1 requisição/s com cache, prova ↔ gabarito definitivo (nome do caderno ou descrição, para arquivos com nome em hash;
  `ATUALIZADO` vence, `SEM EFEITO`/preliminar fora), itens Certo/Errado e múltipla escolha com texto-base, anulados,
  código em bloco, figura marcada, quarentena quando as contagens não batem, acervo determinístico (`acervo/cebraspe/<ID>.json`,
  formato v1 com cabeçalho do concurso). 57 testes com 6 provas reais (SERPRO 23, PM SC 23, DATAPREV 23, STM 25, ANATEL 24 ×2).
  **Rodada real:** lote de 67 concursos (2021+, TI e controle, conferido pelo dono) → 59 com itens, 481 provas,
  **29.892 itens** (27,5 mil depois de juntar repetidos entre cadernos), 1.007 anulados, 212 com código, 936 dependem de
  figura/tabela, acervo de 33 MB; conferidos à mão contra o PDF (TCE SC 21 item 60, BCB 24 item 48, CD 25 item 170) e
  gabaritos conferidos por uma leitura independente da grade; rodar de novo não baixa nada e não muda o acervo.
  **Revisão independente (25/10), corrigida com teste:** grade do gabarito fora de ordem (línguas estrangeiras, INPI 23)
  era ignorada e o espanhol ficava com as respostas do inglês → quarentena; repetidos com gabarito diferente (anulado num
  caderno, válido noutro — TRT10 24) eram juntados → o gabarito entra na chave; um gabarito podia servir a duas provas →
  um para um, prova ATUALIZADO vence, código mais específico vence; pedaços de fórmula cortavam o item e viravam
  texto-base; 1ª linha recuada após o título da seção sumia; "-- X --" virava texto-base na múltipla escolha; "definição",
  "importância", "classe" viravam código; PDF ruim derrubava a rodada (agora quarentena; cache valida `%PDF-`); regravar
  um caderno apagava procedências de outros; identificador/nome de arquivo da API iam crus para o caminho do cache.
  Item com fórmula que o PDF não traduz ganhou `temSimboloIlegivel` (≈1 mil itens) — o app decide se avisa ou esconde.
  Ficou de fora (motivos em `acervo/quarentena.json`):
  - **SEFAZ AL 21 / SEFAZ CE 21 ("MATRIZ"):** uma prova por cargo com básicos + específicos, mas gabarito em 2 arquivos
    (o pareamento assume 1 gabarito por prova). **INPI 23 básicos** (línguas estrangeiras com numeração repetida) e
    **SEPLAG CE 24 básicos** (grade fora de ordem): quarentena de propósito — precisam de leitura por bloco de língua.
  - **TELEBRAS 21 (17 cadernos), SERPRO 21, APEX 21-2, SEFA PR 25, SUSEP 25, ANVISA 24:** prova sem gabarito definitivo
    reconhecido (publicação em outro formato) — 32 cadernos "pendentes".
  - **Múltipla escolha com alternativa perdida na virada de página/coluna:** FINEP 23 q47, ITAIPU 23 q42, TCE PR 24 q54,
    SEFAZ SE 25 q100, TCE MG 25 q38, TST 23 q48.
  - **Casos isolados:** ANAC 23 (básicos para no item 35; específicos no 66), CNPq 23 e MPO 24 (gerais sem nenhum item),
    INFRASA 26, INPI 23 (item 120), MME 23 (item 30), PETROBRAS 21 (itens 1–4), SEFIN Fortaleza 23 (142–150), SEPLAG CE 24
    (21–35), TRF6 24 ("item 203" fantasma).
  - Repetidos **entre concursos** ainda não se juntam (só dentro do mesmo concurso): fica para o pacote da 12b.
  **Segundo lote (decisão do dono):** provas de procurador e de servidor de MP e TJ (Direito Público, para P1/P2).
  [PARCIAL] **12b — assuntos canônicos** (25/10/2026, plano `docs/superpowers/plans/2026-10-25-12b-assuntos-canonicos.md`):
  `npm run minerar -- semente | classificar | conferir | desempatar | juntar | recalcular | pacote`. Vocabulário
  (`acervo/vocabulario.json`, v14) nasce do edital da CGU + 6 editais de abertura do acervo (Português, Raciocínio
  Lógico, Direito, Contabilidade, Economia, TI): 3.917 assuntos em 92 matérias; a IA propõe assunto novo (aceito com
  confiança ≥ 0,8, canonizado contra o que já existe em qualquer nível da matéria, versão nova a cada mudança);
  `juntar` funde repetido (vira sinônimo). Classificação em `acervo/classificacao/<ID>.json`: uma opinião por modelo,
  consenso derivado (mesmo tópico = pai/filho ou mesmo nome em matérias diferentes; concorda quando o principal de uma
  opinião está na escolha de todas; selinho "incerto" abaixo de 0,7 de confiança média). Candidatos locais por palavras
  raras + pistas de matéria (Português pelo código do texto "CB2A1", parágrafo, aspas…); fila com as matérias da CGU
  primeiro. Provedores sem chave: `agy` (Antigravity CLI, em pasta vazia e `--sandbox`) com Gemini/Claude; Groq/DeepSeek
  por chave. 101 testes em `tools/minerador/`.
  **Rodada real (25/10):** 300 de 27,5 mil itens com a opinião do Gemini 3.8 Flash (2 incertos, ~24 min, 22 assuntos
  novos aceitos, 2 juntados à mão); conferidos à mão 12 de matérias diferentes — todos fazem sentido. Conferência com o
  gpt-oss-120b (Groq grátis) parou em 107 itens (limite de ~200 mil tokens por dia, ~100 itens) e discordou em 35 — na
  maioria erro do Groq (item de interpretação de texto classificado pelo assunto do texto; inflação em "governança de
  estatais"). **Falta:** terminar a 1ª opinião (cota do Gemini ≈ 5 mil itens/semana → ~5 semanas; CGU primeiro);
  decidir a 2ª opinião (DeepSeek quando houver crédito, para conferir todos — decisão do dono; o Groq não serve para o
  acervo todo); `pacote` + 12c.
  **Próximas:** terminar a 12b → brainstorm da aba Questões → 12c (app).
  Depois: outras bancas (FGV…), radar de concursos (DOU/notícias), PDFs no Object Storage da Oracle se a banca apagar
  provas antigas.
- **Épico — Guia / mapa de incidência** (spec `08`): depende do banco classificado. Tópico sem questão = baixa incidência
  (reduz prioridade), nunca escondido.
- **TEC só por registro manual (feito na 7b):** a importação do desempenho por arquivo salvo (spec 07 §9) fica descartada —
  ler a página salva com o app é processamento automatizado vedado pelo §18.8.1 dos Termos de Uso do TEC.
- **Depois:** ferramentas do leitor (grifar, desenhar, atalho para o caderno, resumo ao fechar); tópicos relacionados entre matérias. (O formato por dias, preferido pela esposa do dono, entrou na 13a.)
- **Leitura:** grifos em `highlights_json`; reabrir o último PDF sozinho no `.exe` (lá o caminho do arquivo é conhecido).
- **Dívidas conhecidas:** `OnboardingWizardModal.tsx` (~420 linhas) e `App.tsx` (~1440) passam do teto de ~250 linhas; no mapa de calor, tópicos sem questões da mesma matéria empatam (a diferença aparece com dados de estudo/TEC); bundle ~515 kB; com 6 abas e os dois painéis abertos, os rótulos longos das abas quebram em 2 linhas (1440 px); histórico do copiloto não é salvo; acertar depois de ver a explicação ainda permite "Dominei" (fica registrado em `used_ai_review`).
