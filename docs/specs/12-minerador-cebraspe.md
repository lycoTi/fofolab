# ⛏️ Spec 12 — Minerador de provas da Cebraspe e acervo por assunto

> Brainstorm de 2026-10-24 (Claude Code + dono). Status: **design para aprovação**.
> Marcação: o que o dono decidiu está escrito como fato; escolhas do Claude estão marcadas **(decisão do Claude)**.
> Skills: `brainstorming`, `security-and-hardening` (entrada não confiável: PDF e JSON de terceiros), regra autoral de
> prompts (`~/.agents/AGENTS.md`), `learning-analytics-interpretation-guide`. Relacionadas: spec 03 (blueprint e drift),
> spec 06 §5 (contrato de questões), spec 08 (assunto canônico e incidência).

## 1. Intenção
O dono estuda para a **CGU 2026 — Cargo 4, TI – Desenvolvimento de Sistemas (Cebraspe)**, prova em **13/12/2026**, junto
com um amigo do mesmo cargo. Na fase pós-edital ele treina **só com itens da Cebraspe de concursos parecidos**, para pegar
o estilo da banca — hoje no TEC Concursos. Ele quer **migrar os estudos para o FofoLab de vez**, e para isso precisa das
questões dentro do app, ligadas aos tópicos do seu plano.

As questões vêm **direto da banca** (provas e gabaritos definitivos publicados pela Cebraspe), nunca do TEC (Termos de Uso
§18.8). A mineração é **trabalho de administração**: fica fora do app do estudante e do `.exe`.

**O que torna isso especial (palavras do dono, resumidas):** em sites de questões, um item só aparece na matéria em que
alguém o catalogou — o dono procurava um assunto no filtro do QConcursos e só o achava em outra matéria. Aqui cada item é
classificado **pelo que ele pergunta**, pode pertencer a **mais de um assunto**, e o acervo é guardado **por inteiro** para
servir a qualquer concurso (dele, do amigo, de familiares), não só ao edital da vez.

## 2. Objetivos, não-objetivos e anti-objetivos
**Objetivos**
- Ferramenta de administração que descobre os concursos da Cebraspe, baixa **provas objetivas** e **gabaritos
  definitivos**, extrai cada item (C/E e múltipla escolha) com o texto-base e marca os anulados.
- **Acervo** único e completo: todos os itens de todas as provas mineradas, com procedência (concurso, ano, cargo, prova,
  número do item, matéria de origem como pista).
- Cada item recebe **um ou mais assuntos canônicos** de um vocabulário controlado, **uma vez** (custo pago uma vez e
  reaproveitado por todos os planos).
- O vocabulário é **vigiado**: assunto novo é proposto em vez de forçado; sinônimos são propostos para juntar; toda
  mudança tem versão.
- No app, cada **tópico do edital** é ligado a assuntos canônicos (≈ 200 ligações por plano, feitas pela IA uma vez); o
  plano enxerga os itens cujos assuntos batem com os seus tópicos. A ligação pode ser refeita sem minerar de novo.
- Item com classificação incerta entra **marcado** (selinho) e a IA decide; o estudante só avisa casos grosseiros.

**Não-objetivos (agora → BACKLOG)**
- Outras bancas (FGV, FCC, Cesgranrio…): épico próprio; cada uma com seu adaptador.
- **Radar de concursos** (autorizado, iminente, previsto): as fontes são o Diário Oficial e notícias, não o site da banca
  — épico próprio.
- Prova discursiva ("Conhecimentos Aplicados") e provas práticas.
- Mapa de incidência (spec 08): usa este acervo, mas é outra fatia.
- Tirar o Modo Admin atual (dados de exemplo) de dentro do app: tarefa própria.
- Redesenho da aba Questões (filtros): **brainstorm próprio logo depois deste**, já sabendo os dados do acervo.

**Anti-objetivos (fracasso mesmo funcionando)**
- Item com gabarito errado (preliminar no lugar do definitivo, anulado contado como certo, item casado com a resposta de
  outro número).
- Item gravado sem o texto-base de que depende — o item vira outra afirmação.
- Classificar pelo rótulo da prova de origem e repetir o defeito do QConcursos.
- Importar lixo em silêncio quando a Cebraspe mudar a API ou o layout do PDF.
- Bombardear o site da banca, ou baixar de novo o que já foi baixado.
- Custo de IA multiplicado por estudante (o dono e o amigo pagarem duas vezes a mesma classificação).
- Minerador ou acervo dentro do `.exe` do estudante.

## 3. Restrições
- Regras do projeto: TS strict, sem ternário aninhado, comentários em pt-BR dizendo o porquê, TDD (Vitest), sem jargão na
  tela do estudante, `npm test`/`test:e2e`/`build` verdes.
- **Termos de uso (verificado em 24/10/2026):** `robots.txt` da Cebraspe libera tudo (`Disallow:` vazio); a API é aberta e
  sem login; as provas são publicadas por obrigação de publicidade do concurso; não foi achado termo que proíba acesso
  automatizado. Mesmo assim: **ritmo lento** (uma requisição por vez, com pausa), **cache** (nunca baixar de novo o mesmo
  arquivo), **User-Agent identificável**, **uso pessoal** (o acervo não é publicado; compartilhar com o amigo é uso
  privado). Não é parecer jurídico.
- IA: Groq grátis hoje (1.000 tokens de resposta/min no modelo padrão — spec 11 / BACKLOG); o dono vai pôr crédito no
  **DeepSeek** (~R$ 20/mês) para o trabalho pesado de classificação.
- Banco do app: mudança no contrato SQL → migração nova + `LATEST_SCHEMA_VERSION` (hoje 10), teste dos dois caminhos.
- Entrada não confiável: JSON da API, PDFs e o pacote importado no app (validar formato; texto vai à tela só por
  `RichText`, nunca HTML cru).

## 4. O que a Cebraspe oferece (reconhecimento de 24/10/2026)
- O site `www.cebraspe.org.br/concursos/` é um app em JavaScript que lê uma **API pública em JSON**:
  - `GET https://apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/fase/encerrado` → lista (427 concursos encerrados
    hoje) com `eventoNomeAbreviado`, `eventoURL` (identificador, ex. `SERPRO_23`), `eventoStatus`, `eventoAno`…
  - também `…/tipo/concursos/fase/em-andamento` (e sem `fase`).
  - `GET https://apis.cebraspe.org.br/cebraspe/eventos/{identificador}` → detalhe com `eventoCargos` (`idArea`, `area`),
    `arquivosEdital[]` e `arquivosGabarito[]`; cada arquivo tem `descricaoArquivo`, `nomeArquivo`, `dataArquivoObj`.
  - Arquivo: `https://cdn.cebraspe.org.br/{eventoTipo}/{identificador}/arquivos/{nomeArquivo}` (ex.
    `…/concursos/SERPRO_23/arquivos/846_SERPRO_23_001_01.PDF`).
- Descrições reais: `PROVA OBJETIVA – CONHECIMENTOS ESPECÍFICOS (P3)`, `GABARITO DEFINITIVO – CONHECIMENTOS GERAIS (P1)`,
  `… – ATUALIZADO`, `… – SEM EFEITO`, `Justificativas de alterações de gabarito`, `Caderno de Questões - Prova de
  Conhecimentos Aplicados` (discursiva, fora). Prova e gabarito do mesmo caderno compartilham o código no nome
  (`846_SERPRO_23_001_01` ↔ `GAB_DEFINITIVO_846_SERPRO_23_001_01`).
- **Prova (texto pelo pdf.js):** itens numerados no começo da linha (`66 Considere-se que…`); o **texto-base** vem antes
  ("Considerando…, julgue os itens a seguir.") e vale para os itens seguintes até o próximo texto-base; cabeçalho e rodapé
  repetidos por página (`84600101344553 CEBRASPE – SERPRO – Edital: 2023`); **código perde a indentação** e as aspas
  viram tipográficas (`“`); duas colunas por página.
- **Gabarito definitivo:** grade com uma linha de números (`51 52 … 70`) e a linha de respostas abaixo (`E C E … X`);
  **`X` = anulado**; `0` = posição vazia. No caderno de específicos do SERPRO 2023: itens 51–120.

## 5. Abordagens consideradas (escolhida: C, pelo dono)
Em todas, a extração é a mesma; muda onde cada item ganha o assunto e como chega ao plano.
- **A. Classificar no app, contra o plano:** o app pergunta à IA o tópico de cada item. Cada plano classifica do seu jeito,
  mas são milhares de chamadas **por plano** — o dono e o amigo pagariam a mesma conta duas vezes no limite grátis.
- **B. Classificar na ferramenta, com o plano exportado:** gera o texto que o importador atual já lê (`[tópico 3.2]`).
  Quase nada muda no app, mas é **um tópico por item** (o defeito do QConcursos), e cada plano novo exige rodar a
  ferramenta de novo — o acervo fica preso ao edital.
- **C. Assunto canônico no acervo + ligação barata no app** *(escolhida)*: cada item recebe, uma vez, um ou mais assuntos
  canônicos de um vocabulário controlado; o app liga cada tópico do edital a assuntos (≈ 200 ligações por plano). Item em
  vários tópicos, custo pesado pago uma vez para todos os planos, edital novo custa só as ligações, e é a base do mapa de
  incidência. Custo: manter o vocabulário (mitigado pela vigilância do §6.4) e uma migração no app.

## 6. O que foi decidido

### 6.1 Escopo
- **Só Cebraspe**, **qualquer formato** (Certo/Errado e múltipla escolha) — "deixar questão na mesa só pelo formato é
  desperdício; banca diferente cobra diferente" (dono). Outras bancas → BACKLOG.
- **Recorte pelas matérias do edital, não pelo cargo:** item de prova de outro cargo (ex.: auditor de TCE) serve se o
  assunto cai no plano. O acervo guarda **tudo** de cada prova minerada; o recorte é só a visão do plano.
- Provas objetivas com **gabarito definitivo**. Prova sem definitivo publicado ainda não entra (no máximo fica pendente).
- **Primeiro lote (decisão do Claude):** concursos encerrados da Cebraspe de **2021 em diante** com cargo de TI
  (Tecnologia, Desenvolvimento, Sistemas, Dados, Infraestrutura) ou de controle/auditoria/gestão (auditor, analista de
  controle, TCEs, TCU, CGU, MPU, STJ…), priorizando a **P3** do dono (peso ≈ 45 contra 10 e 8): o seletor do lote é uma
  lista de identificadores editável, gerada por palavras-chave sobre o nome e as áreas do concurso e conferida pelo dono.

### 6.2 Onde roda
- **Ferramenta de administração separada do app** (decisão do dono: "não deve fazer parte do app que o usuário acessa").
  **(decisão do Claude)** Uma ferramenta de linha de comando em TypeScript no mesmo repositório, numa pasta própria
  (`tools/minerador/`), com seus testes no Vitest, que **reaproveita** o que o app já tem (`pdfjs-dist`,
  `normalizeStatement`, `questionOptions`) e **nunca é importada** por `src/`. Roda pelo terminal (pelo dono ou pela IA,
  no Claude Code ou no Antigravity). Agendamento periódico fica para depois.
- **Onde ficam os dados (decisão do dono, a partir da proposta do Claude):**
  - **Acervo** (itens, gabaritos, procedência, assuntos, vocabulário com versões) **no git do projeto**: é pequeno (≈ 1 KB
    por item; 20 mil itens ≈ 20 MB), sincroniza os dois PCs do dono e guarda a classificação paga com IA. Formato
    textual e estável (ex.: um arquivo por concurso), para o diff do git ser legível e não crescer à toa.
  - **PDFs** (provas, gabaritos, editais, retificações — centenas de arquivos, alguns GB) **só como cache local, fora do
    git**: a Cebraspe é a fonte e o minerador baixa de novo quando precisar. Se um dia for preciso guardá-los na nuvem
    (ex.: a banca apagar provas antigas), o caminho é o **Object Storage da Oracle Cloud** (Always Free, 20 GB, compatível
    com S3, mesma conta do FofoDeck, sem container) — fica no BACKLOG.
  - **Pacote para os amigos:** um arquivo gerado a partir do acervo, enviado por link (Drive, WhatsApp). Baixar o pacote
    sozinho de um link fica para depois.

### 6.3 Pipeline (cada etapa grava o que produziu; rodar de novo retoma de onde parou)
1. **Catálogo:** lista de concursos pela API; detalhe de cada concurso do lote; **verificação de formato** da resposta
   (campos esperados presentes e com o tipo certo). Falhou → para e avisa ("a API da Cebraspe mudou: campo X sumiu"),
   nada é gravado.
2. **Download com cache:** só `PROVA OBJETIVA` e `GABARITO DEFINITIVO` (preferindo `ATUALIZADO`, ignorando `SEM EFEITO`
   e o preliminar), pareados pelo código do caderno; `Justificativas de alterações de gabarito` guardadas para referência.
   Um arquivo por vez, com pausa; arquivo já baixado (mesmo nome e mesmo tamanho) não é pedido de novo.
3. **Extração da prova:** texto pelo pdf.js; remove cabeçalho/rodapé repetidos; segmenta **itens** pelo número no início da
   linha (C/E) ou pelo número + alternativas A–E (múltipla escolha); prende a cada item o **texto-base** vigente; reconstrói
   blocos de código com o máximo de fidelidade possível (aspas normais, quebras preservadas) e marca o item como
   `tem_codigo`; item que cita figura/imagem/tabela que não veio no texto fica marcado `depende_de_figura`.
4. **Gabarito:** lê a grade número → resposta; `X` vira **anulado**; confere que **todo** item extraído tem resposta e
   que **toda** resposta tem item (contagens batem). Não bateu → a prova inteira fica em quarentena com o motivo; nada
   dela entra no acervo.
5. **Assuntos canônicos (IA):** cada item recebe 1 a 3 assuntos do vocabulário, com **confiança**; detalhes em §6.4.
6. **Pacote:** exporta para o app um arquivo com os itens, a procedência e os assuntos (§6.5).
- **Relatório** ao fim de cada rodada: concursos vistos, provas baixadas, itens extraídos, anulados, quarentenas (com
  motivo), itens com código/figura, classificações incertas, assuntos novos e junções propostas.
- **Sem repetidas:** item com o mesmo enunciado normalizado + texto-base no acervo não duplica (Cebraspe às vezes reaplica
  itens); a procedência nova é acrescentada ao item existente.

### 6.4 Vocabulário canônico vigiado (ideia do dono)
- Assunto canônico = caminho em árvore ("Engenharia de software › Testes › TDD"), com nome, sinônimos e descrição curta.
- **Semente (decisão do Claude):** os tópicos do edital da CGU 2026 (P1, P2 e P3) normalizados viram o primeiro
  vocabulário, mais o que as primeiras provas trouxerem.
- Classificação: a IA recebe o item (texto-base + enunciado + alternativas + matéria de origem **como pista**) e a lista de
  assuntos candidatos (filtrada localmente por palavras, para caber no limite) e responde só com JSON validado:
  assuntos escolhidos + confiança + "nenhum serve" com um assunto novo proposto.
- **Vigilância:** assunto novo vira **proposta** (não entra sem passar pela checagem); dois assuntos com muitos itens em
  comum ou nomes parecidos viram **proposta de junção**. **(decisão do Claude, coerente com "a IA decide" do dono, que
  não consegue julgar classificação fina)** A ferramenta aceita sozinha a proposta com confiança alta e a registra no
  relatório; a de confiança baixa fica pendente, com os itens marcados como incertos, até uma rodada com modelo melhor.
  O dono pode desfazer qualquer mudança pelo relatório. Cada mudança aceita gera uma **versão** do vocabulário com a
  lista do que mudou, para os planos refazerem só as ligações dos assuntos afetados.
- **Provedor (decisão do Claude):** DeepSeek quando houver crédito (classificação em lote, barata); até lá, Groq grátis
  com ritmo controlado (o teto de resposta da spec 11 já resolve o 429). A etapa é retomável: parar no limite e continuar
  depois não perde nada.

### 6.5 No app
- **Importar o pacote do acervo** (tela de importação, opção nova): itens, procedência e assuntos entram no banco; repetido
  não duplica; importar um pacote mais novo atualiza assuntos e anulações sem perder as tentativas do estudante.
- **Ligação tópico ↔ assunto por plano:** a IA liga cada tópico do edital aos assuntos do vocabulário (uma chamada por
  tópico, com candidatos filtrados localmente); refeita só para tópicos novos ou assuntos que mudaram de versão.
- **Visão do plano:** um item aparece no tópico se algum assunto dele está ligado ao tópico; um item pode aparecer em mais
  de um tópico.
- **Dúvida marcada (decisão do dono):** item com classificação incerta entra com um **selinho** discreto; a IA decide — o
  estudante não precisa saber classificar. Ele só avisa casos grosseiros ("este item não é deste assunto"), o que pede à
  IA uma nova sugestão e tira o item do tópico até lá. **(decisão do Claude)** Item incerto pesa menos no domínio do tópico
  que um item certeiro; reclassificado com segurança (ex.: pelo DeepSeek), o selinho some.
- Item anulado: aparece rotulado "Anulada pela banca" e não conta no domínio. Item `depende_de_figura`: fica oculto por
  padrão na v1 (a figura não vem no texto) e é contado no relatório.
- Procedência visível no item: "Cebraspe · SERPRO 2023 · Analista – Tecnologia · item 66".

## 7. Entregas sugeridas (o plano detalha)
A prova é em 13/12/2026: a primeira entrega útil precisa chegar cedo.
1. **12a — Minerador até o acervo cru:** catálogo + verificação de formato, download com cache, extração C/E e A–E com
   texto-base, gabarito definitivo com anulados, quarentena, relatório. Testes com fixtures reais (SERPRO 2023 P3 e um
   caderno de múltipla escolha).
2. **12b — Assuntos canônicos:** semente pelo edital da CGU, classificação com IA (JSON validado, confiança), vigilância do
   vocabulário com versão, pacote para o app.
3. **12c — App:** migração (itens com procedência, assuntos, ligações tópico↔assunto, versão do vocabulário), importação
   do pacote, ligação por plano com IA, visão do plano, selinho e "não é deste assunto".
4. **Depois:** brainstorm da aba Questões (filtros por procedência, ano, cargo, formato, dúvida) antes de mexer na tela.

## 8. Testes mínimos
- **Unit (ferramenta):** verificação de formato da API (aceita o real, recusa campo faltando); pareamento prova ↔
  definitivo (prefere `ATUALIZADO`, ignora `SEM EFEITO` e preliminar); segmentação de itens com texto-base no PDF real;
  remoção de cabeçalho/rodapé; leitura da grade do gabarito com `X` e `0`; quarentena quando as contagens não batem;
  cache (segunda rodada não baixa nada); deduplicação; validação do JSON da IA (recusa assunto inexistente sem proposta).
- **Unit (app):** migração nos dois caminhos; importação idempotente do pacote; visão do plano com item em dois tópicos;
  anulado fora do domínio; selinho e peso menor do item incerto.
- **E2E:** importar um pacote pequeno → itens aparecem nos tópicos certos do plano (inclusive um item em dois tópicos) →
  responder um item → recarregar → tentativa e procedência continuam lá.

## 9. O que fica para o construtor
- Formato exato do acervo na ferramenta e do pacote (desde que validável e versionado).
- Heurística de reconstrução do código e de detecção de figura (com os casos reais como teste).
- Filtro local de candidatos para a IA e o limiar de "incerto".
- Pausa entre requisições e o User-Agent.
