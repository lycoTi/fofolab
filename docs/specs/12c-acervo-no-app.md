# Spec 12c — Acervo da Cebraspe no app

> Parte da spec 12 (`12-minerador-cebraspe.md`, §6.5 e §7 item 3). Desenho de 26/10/2026, conversado com o dono.
> Status: **aprovada pelo dono em 27/10/2026** (inclusive as decisões marcadas "decisão do Claude"); **implementada em
> 27/10/2026** (BACKLOG, 12c). Decisões do plano: cópia única **por matéria**; nos escopos amplos o item vai ao tópico
> mais específico; desligar um assunto tira as cópias dele da Revisão do dia do tópico.

## 1. Intenção
O minerador já produz `acervo/pacote/fofolab-acervo-cebraspe.json` (27.522 itens da Cebraspe; 619 com assunto
classificado, 548 com classificação segura). O dono quer **usar essas questões no app já**, na aba Questões, para
estudar e testar o app com o módulo de questões funcionando. Cada dia o minerador classifica mais 200 itens; o app precisa
receber pacotes novos sem perder o que o estudante respondeu.

## 2. Objetivos, não objetivos e anti-objetivos
- **Objetivo:** importar o pacote; ligar cada tópico do plano aos assuntos do vocabulário; mostrar no tópico as questões
  classificadas naquele assunto, com a procedência; responder, diagnosticar e usar a FofoIA nelas como nas questões de hoje.
- **Objetivo:** importar um pacote mais novo atualiza o acervo (mais itens, assuntos e anulações) sem tocar nas tentativas.
- **Não objetivo (12c):** os filtros novos da aba (formato C/E × múltipla escolha, não resolvidas, já errei, banca/ano,
  barra compacta com gaveta — proposta do Gemini de 26/10). Vêm no brainstorm da aba Questões, depois da 12c (spec 12 §7).
- **Não objetivo:** devolver ao minerador o "Não é deste tópico" e o "Desligar este assunto" para reclassificar (fica
  para depois; ver §6).
- **Anti-objetivo (dono):** questão **fora do tópico** aparecendo no tópico. Item sem assunto classificado não aparece
  em tópico nenhum — nada de mostrar pela "matéria de origem" do item.
- **Anti-objetivo:** o banco do estudante pesado. O app grava o banco inteiro (`db.export()`) a cada mudança e guarda até
  12 cópias de segurança; 30 MB de acervo ali deixariam cada gravação e cada cópia lentas.

## 3. Restrições
- Contrato SQL em `docs/specs/01-database-schema.sql` + migração equivalente em `src/lib/migrations.ts` (v12), testada nos
  dois caminhos (regra do CLAUDE.md).
- O pacote é **entrada não confiável** (regra de segurança do projeto): validar formato e tamanho, texto renderizado sem
  HTML cru.
- IA: só pela cadeia do app (`callAiProviders`: gateway → Groq → Gemini → DeepSeek). Sem chave, nada de ligação
  simulada gravada como real (modo demonstração rotulado).
- Funciona no navegador (IndexedDB) e no app de desktop (arquivo na pasta de dados), como o banco de hoje.

## 4. Abordagens consideradas (escolhida: B, pelo dono)
- **A — Tudo no banco do estudante:** simples, mas 30 MB em cada gravação e cópia. Descartada.
- **B — Acervo separado, só leitura, com cópia ao usar:** o pacote vira um banco à parte, que só muda ao importar; a
  questão entra no banco do estudante no primeiro uso, com a procedência. Gravações continuam leves; reimportar troca o
  acervo sem mexer nas tentativas. Mais código na importação. **Escolhida.**
- **C — Só os itens classificados, direto no banco do estudante:** pequeno hoje, mas cresce até os 30 MB com a
  classificação (200/dia) e volta ao problema da A.

## 5. O que foi decidido
### 5.1 Acervo separado
- Ao importar, o pacote vira um **banco SQLite próprio** (sql.js, o mesmo motor de hoje) guardado à parte: no navegador,
  outra chave/loja do IndexedDB; no desktop, um arquivo `acervo.db` na pasta de dados. Nunca é regravado fora da
  importação e **não entra nas cópias de segurança** do estudante (pode ser reimportado do pacote).
- Entram no acervo **só os itens com pelo menos um assunto** (os sem assunto não aparecem em tópico nenhum — §2) e o
  vocabulário do pacote (ids, caminhos, sinônimos, versão).
- O acervo é aberto **sob demanda** (primeira vez que um tópico com ligação é aberto na sessão), não no início do app.

### 5.2 Importar o pacote
- Opção nova na importação de questões já existente (`QuestionImportModal`): **"Acervo da Cebraspe (pacote do
  minerador)"**, escolhendo o `.json`. **(decisão do Claude: é onde o estudante já importa questões.)**
- Valida `formato`/`versao` do pacote e os campos de cada item; item inválido é contado e ignorado, sem derrubar a
  importação. Tamanho máximo aceito: o construtor define com folga sobre os 30 MB de hoje.
- Ao fim: resumo em linguagem humana ("619 questões com assunto · 32 tópicos do seu plano ligados · 4 sem ligação").
- **Reimportar** (pacote mais novo): substitui o acervo inteiro; as questões já copiadas para o banco do estudante têm
  atualizados gabarito, anulação e selinho de incerto pelo id do item; tentativas ficam intactas.

### 5.3 Ligação tópico ↔ assunto (por plano)
- Tabela nova no banco do estudante (pequena): tópico → assunto(s), com a origem da ligação (por nome ou pela IA) e a
  versão do vocabulário usada.
- **1º passo, por nome (sem IA):** o vocabulário nasceu do edital da CGU, então a maioria casa pelo nome (minúsculas, sem
  acento e pontuação). **(decisão do Claude, revisão de 26/10: 292 folhas se repetem entre matérias — "Conceito" está em
  14.)** Ordem: (1) caminho inteiro igual (matéria › pais › título do tópico, como o vocabulário foi semeado); (2) senão,
  folha ou sinônimo igual **dentro da mesma matéria** (raiz do vocabulário com o nome da matéria do plano); (3) mais de um
  candidato, ou nenhum → IA. **Nunca liga pelo nome a um assunto de outra matéria** (é o anti-objetivo; perder um item
  classificado no "gêmeo" de outra matéria é o preço aceito).
- **2º passo, IA só para quem sobrou:** uma chamada por tópico, com candidatos filtrados localmente por palavras (como o
  minerador faz), resposta em JSON validado: só ids da lista de candidatos, com confiança; "nenhum serve" é aceito e o
  tópico fica sem ligação. Sem IA configurada: só o 1º passo, e o resumo diz quantos tópicos ficaram sem ligação.
- Ligar a um assunto vale para os **descendentes** dele (item classificado num subassunto aparece no tópico).
- **Refazer (decisão do Claude):** o vocabulário muda de versão quase todo dia, então ligação existente **não é refeita**
  (a IA não responde sempre igual; item visto não pode sumir à toa). Na importação só se ligam: tópicos novos do plano,
  tópicos ainda sem ligação e tópicos cujo assunto ligado deixou de existir (juntado a outro no minerador). Sem ler o
  `historico` (texto livre) e sem mexer em `tools/`.
- **Ver e desfazer (decisão do Claude):** no topo da lista do tópico, uma linha discreta diz de qual assunto do acervo
  vêm as questões ("Do acervo: Licitações › Lei 14.133") com **"Desligar este assunto"** por ligação — uma ligação
  errada se desfaz de uma vez, sem tirar item por item. Desfeita, ela não volta nas importações seguintes.
  **(decisão do dono, 27/10: rótulo diferente do "Não é deste tópico" do item (§5.7), porque são duas ações.)**

### 5.4 Questões do tópico
- Lista = questões próprias do tópico (as de hoje, importadas por texto/JSON) + itens do acervo cujos assuntos são (ou
  descendem de) os ligados ao tópico, sem repetir o mesmo item.
- Fora da lista: item `dependeDeFigura` (a figura não vem no texto), item `temSimboloIlegivel` (fórmula que o PDF não
  deixou ler — 32 dos 619; **decisão do Claude**, contado no resumo da importação) e item tirado deste tópico ("Não é
  deste tópico", §5.7).
- No item: linha de procedência ("Cebraspe · ANATEL 2024 · item 40"); selinho discreto para classificação incerta;
  rótulo "Anulada pela banca" para anulado.
- Um item pode aparecer em mais de um tópico.
- **Tópico sem questões (decisão do dono, 26/10):** a lista fica vazia, com "Ainda não há questões classificadas neste
  tópico" e um botão **"Ver as do grupo ‹código›"** para quem quiser; nada de outro tópico aparece sem o estudante pedir.
  Substitui o recuo automático para o grupo e a matéria da 9b (`getTopicQuestionsWithFallback`), inclusive na contagem do
  bloco na Bancada (conta só as do próprio tópico).
- **Filtros "Matéria" e "Todas" (decisão do Claude):** mostram só itens ligados a tópicos do plano (da matéria, ou do
  plano inteiro) mais as questões próprias — nunca item do acervo sem ligação.

### 5.5 Cópia ao usar (entrada no banco do estudante)
- O item do acervo entra na tabela `questions` **no primeiro uso que grava algo** (responder, 1º contato, explicação da
  IA, FofoIA que guarda dissecação), por uma função única chamada antes de cada gravação. Só exibir não copia.
  **(decisão do Claude: o banco do estudante cresce com o que ele usou, não com o que viu passar.)**
- **Revisão do dia (decisão do Claude):** sorteia só entre questões que já estão no banco do estudante (próprias e as do
  acervo já usadas). Assim o acervo continua abrindo sob demanda e a revisão congelada guarda ids do banco, como hoje.
- Colunas novas em `questions` (v12): id do item no acervo (único), procedência, classificação incerta.
- Item em dois tópicos: uma linha só; cada tentativa já guarda o próprio `topic_id`, então o domínio vai para o tópico
  em que foi respondido.

### 5.6 Domínio
- Item incerto **pesa metade** no domínio do tópico que um item seguro (spec 12 §6.5, decisão do Claude); quando um
  pacote novo o traz seguro, passa a pesar inteiro dali em diante.
- Item anulado: aparece **só para leitura** (sem marcar resposta: o pacote traz anulado sem gabarito) e não conta no
  domínio nem na amostra. Hoje nenhum anulado chega ao app (o minerador não classifica anulados); o caminho existe para o
  item já usado que um pacote mais novo trouxer anulado.
- **Mudança depois de responder vale "dali em diante" (decisão do Claude):** anulação, gabarito trocado, "não é deste
  assunto" ou ligação desfeita não apagam nem recalculam tentativas antigas (o domínio é incremental, como em todo o app).
  Exceção: **gabarito trocado descarta a explicação da IA guardada** daquela questão (ela contradiria o gabarito novo).

### 5.7 "Não é deste tópico"
- Ação discreta no item, com o rótulo **"Não é deste tópico"**: tira o item **deste tópico** (fica guardado no banco do estudante, por tópico). Sem confirmação
  modal (é desfazível pela mesma ação na lista de itens tirados, que o construtor define onde fica).

## 6. Fora da 12c (anotado para depois)
- Brainstorm da aba Questões: filtros (formato, não resolvidas, já errei, banca/ano, cargo, dúvida), barra compacta com
  gaveta, animações de troca de questão e correção (proposta do Gemini serve de entrada).
- Levar os "Não é deste tópico" e "Desligar este assunto" de volta ao minerador para reclassificar.
- Outras bancas (FGV…).

## 7. Testes mínimos
- **Unit:** migração v12 nos dois caminhos; validação do pacote (aceita o real, recusa campo faltando); importação e
  reimportação idempotentes (tentativas intactas, anulação atualizada); ligação por nome (inclui sinônimo e descendente);
  ligação pela IA só com ids da lista (recusa id inventado); sem IA não grava ligação simulada; visão do tópico com item em
  dois tópicos, sem `dependeDeFigura`, sem item tirado do tópico; cópia ao usar (exibir não copia; responder copia uma
  vez); peso metade do incerto; anulado fora do domínio.
- **E2E:** importar um pacote pequeno (fixture feita à mão, sem texto de provas) → itens aparecem nos tópicos certos
  (inclusive um item em dois tópicos) → responder um → recarregar → tentativa e procedência continuam; "Desligar este
  assunto" tira a ligação do tópico e "Não é deste tópico" tira só o item, e os dois sobrevivem a recarregar; tópico sem
  questões fica vazio com o convite do grupo.

## 8. Deixado ao construtor
- Formato exato das tabelas novas e da loja do acervo; se a importação usa Web Worker (a tela não pode congelar por
  vários segundos); ordem dos itens na lista; onde fica a lista de itens tirados do tópico.
- Normalização fina dos nomes e o filtro local de candidatos para a IA (pode reaproveitar a ideia do minerador sem
  importar `tools/` — nada em `src/` importa `tools/`).

## 9. Pronto quando
Definição de pronto do projeto: funciona com o pacote real do minerador, sobrevive a fechar e abrir o app, testes de
unidade e E2E acima, `npm test`, `npm run test:e2e` e `npm run build` verdes.
