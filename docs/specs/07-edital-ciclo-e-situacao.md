# 🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela "Bom dia"

> Status: **design para aprovação** (21/10/2026). Nada disto foi construído ainda.
> Marcação: o que o dono decidiu está escrito como fato; escolhas do Claude estão marcadas **(decisão do Claude)** e podem ser revistas.

## 1. Por que agora
O dono está no meio da preparação para a **CGU 2026 — AFFC, Cargo 4: TI – Desenvolvimento de Sistemas (Cebraspe)**, prova em **13/12/2026** (53 dias a partir de 21/10). O app ainda roda sobre um plano de exemplo: o ciclo, o "Meu Dia" e o mapa de calor não refletem o edital real. Sem isso, ele não sabe com exatidão **que matéria focar, quais tópicos, o que pode ficar para depois** — que é a razão de existir do FofoLab.

As questões continuam sendo feitas no **TEC Concursos**; o módulo de questões do app e a importação de provas em PDF ficam para depois.

## 2. Objetivos, não objetivos e anti-objetivos
**Objetivos**
1. Importar o **edital em PDF** e montar o plano real: provas, matérias, tópicos, pesos, notas mínimas e datas — com prévia para conferir antes de gravar.
2. No Wizard, uma **autoavaliação em dois níveis** (matéria e tópico numerado) para o ciclo não começar cego.
3. Um ciclo que respeita o **peso real de cada prova** e **nunca deixa uma prova eliminatória sem estudo** (regra da nota mínima).
4. Um **registro rápido** do que foi feito no TEC (tópico, questões, acertos) que alimenta o mapa de calor.
5. Uma tela **"Bom dia"** que situa o estudante: o que relembrar, o que estudar hoje, quanto falta.

**Não objetivos (agora)**
- Importar provas anteriores em PDF / banco de questões (fica por último).
- Ler o desempenho do TEC automaticamente (projeto separado; ver §9).
- Ferramentas do leitor (grifar, desenhar, atalho para o caderno, resumo ao fechar) — próximo projeto depois deste.
- Funcionar para qualquer edital de qualquer banca na primeira versão.
- Treino da discursiva (P4): ela não entra no ciclo nesta versão.

**Anti-objetivos** (falha mesmo que "funcione")
- Ciclo que zera uma matéria de P1/P2 porque "vale pouco" e deixa o estudante ser eliminado na nota mínima.
- Gravar matérias/tópicos errados sem o estudante ter visto a prévia.
- Tela "Bom dia" com frase motivacional genérica e enfeite; ela precisa de informação útil.
- Jargão técnico na tela (regra do projeto).

## 3. O edital real (fonte de verdade para testes)
`cgue dital 2026.pdf` (Downloads do dono) — Edital nº 1 – CGU – AFFC, de 8/10/2026, 69 páginas, texto extraível pelo pdf.js sem OCR. Atos oficiais não têm proteção autoral (Lei 9.610/98, art. 8º, IV), então o PDF **pode entrar no repositório como fixture de teste** em `e2e/fixtures/` **(decisão do Claude)**.

| Prova | Itens | Pontos/item (certo / errado) | Mínimo líquido | Matérias (Cargo 4) |
|---|---|---|---|---|
| P1 Conhecimentos básicos | 40 | +1 / −1 | 8 | Estado, Democracia, Direitos e Ciência Política; Sociedade Brasileira, Desigualdades, Diversidade e Desenvolvimento; Ética Pública e Responsabilidade Profissional; Administração Pública e Fundamentos de Políticas Públicas |
| P2 Conhecimentos complementares | 40 | +1 / −1 | 12 | Governança, Riscos e Integridade; Transparência, Ouvidoria e Participação Social; Direito Público Aplicado, Controle e Responsabilização; Evidências, Dados e IA; Auditoria Governamental e Atuação Integrada da CGU |
| P3 Conhecimentos específicos | 90 | +2 / −2 | 54 | Engenharia de Software e Programação; Arquitetura e Integração de Sistemas; Persistência, Integração e Proteção de Dados; Desenvolvimento Seguro, Qualidade e Gestão da Entrega |
| Conjunto P1+P2+P3 | — | — | 78 | — |
| P4 Discursiva | 2 questões | — | — | Complementares + específicos |

Onde está cada coisa no texto: cargos em §2.1.x ("CARGO N: …"); quadro de provas em §7.1; pontuação e mínimos em §8.11.2 e §8.11.4; conteúdo em §15.2.2 (básicos, comum), §15.2.3 (complementares, comum) e §15.2.4 (específicos, **um bloco por cargo**); datas no Anexo I ("CRONOGRAMA PREVISTO"). Cada matéria vem como `NOME EM MAIÚSCULAS: 1 Tópico. 1.1 Subtópico. …` — o formato que `syllabusImport.ts` já entende.

## 4. Ponto de partida do dono (para semear a autoavaliação e validar o ciclo)
Relato do dono, com palpites do Claude entre parênteses:
- **P3:** engenharia de software conceitual e requisitos **forte**; frontend/JS/Vue **bom** (não avançado); Java/concorrência/padrões (palpite: fraco, é backend); **fraco** em arquitetura, Spring, REST, OAuth/SSO, mensageria, nuvem; **fraco na prática** em banco de dados/SQL/JPA/ETL; **fraco** em segurança e DevOps (palpite: testes/Scrum/gestão médios; contratação de TI possivelmente boa pelo estudo do TCU).
- **P2:** Auditoria Governamental **forte** (foco TCU; palpite: a parte "atuação integrada da CGU" é nova); Governança e Dados/IA **superficial**; Direito Público **fraco** (histórico ruim em Direito); Transparência/Ouvidoria (palpite: nunca viu).
- **P1:** Ética e Administração Pública **superficial**; Estado/Democracia **fraco** (tem direito constitucional); Sociedade Brasileira (palpite: nunca viu). **Não há Português nesta prova.**

Resultado esperado do ciclo com esses dados: **Arquitetura** e **Persistência** no topo; básicas fracas com tempo pequeno e fixo, nunca zero.

## 5. Como funciona

### 5.1 Importar o edital
1. Na tela de organizar o edital (e oferecido no Wizard), **"Importar edital em PDF"**.
2. O app extrai o texto com pdf.js (já instalado, carregado só nesse momento) e procura as seções do §3.
3. Se houver vários cargos, o estudante **escolhe o cargo**; o app junta conteúdo comum + bloco do cargo.
4. **Prévia editável** antes de gravar: dados do concurso (órgão, banca, cargo, data da prova, fim das inscrições), provas (itens, pontos por item, mínimo), matérias por prova com o peso calculado, e a árvore de tópicos por matéria. Tudo pode ser corrigido ali.
5. Ao confirmar, cria um **plano novo** (o exemplo continua existindo e pode ser apagado depois, com a confirmação e cópia de segurança de sempre).

**Extração sem IA primeiro (decisão do Claude):** o texto deste edital é regular o bastante para regras simples, testáveis e grátis. A IA (Groq) entra só como **ajuda opcional** para os campos que o parser não achar (ex.: datas em outro formato), com a regra de nunca inventar: campo não encontrado fica vazio na prévia, marcado "confira". O conteúdo programático (~20 mil caracteres) **não** é mandado para a IA — cabe mal no limite grátis e o parser já resolve.

**Peso de cada matéria (decisão do Claude):** o edital dá itens por prova, não por matéria. Peso = `pontos por item × itens da prova ÷ matérias da prova` → P3 ≈ 45, P1 = 10, P2 = 8. A prévia mostra "estimado: o edital não divide por matéria" e deixa editar.

### 5.2 Autoavaliação no Wizard
- Passo novo depois de escolher o plano: cada matéria com 4 níveis — **Nunca vi / Já vi por cima / Sei bem / Domino** (usa o `initial_knowledge_level` que já existe).
- Cada matéria pode ser **aberta** para ajustar os tópicos numerados de primeiro nível (≈5 por matéria); tópico sem ajuste herda o nível da matéria.
- Linguagem acolhedora, sem nota punitiva; dá para pular e voltar depois pelo "Recalibrar Perfil".

### 5.3 Ciclo pela nota mínima
- O peso de cada matéria (§5.1) e a autoavaliação entram no motor do ciclo que já existe (orçamento semanal fixo, soma zero — invariante coberta por teste).
- **Piso por prova eliminatória:** toda matéria de uma prova com nota mínima recebe um **tempo mínimo semanal** que nunca é zerado, maior quando a autoavaliação é baixa e a mínima da prova é exigente. O resto do tempo vai pelo peso e pelo calor. (A fórmula exata é do construtor; a regra a garantir é "nenhuma matéria de prova eliminatória com 0 minutos" e "o piso total cabe no orçamento".)
- O "ⓘ" explica em linguagem humana: "garantindo a nota mínima da P1" / "vale o dobro: prova de conhecimentos específicos".
- **Dias até a prova** passam a vir da data do edital.

### 5.4 Registro rápido do que foi feito no TEC
- Botão **"Registrar questões"** no "Meu Dia" e ao terminar um Pomodoro: matéria, tópico (primeiro nível), **total, certas, em branco** (Cebraspe permite deixar em branco), origem "TEC".
- Conta como evidência para o domínio do tópico e para a **confiança da amostra** do jeito que as questões do app já contam (um registro de 20 questões vale como 20 tentativas). **(decisão do Claude:** guardar como registro agregado numa tabela própria, não como 20 tentativas falsas.)
- Também marca o tópico como estudado hoje (alimenta a curva de esquecimento).

### 5.5 Tela "Bom dia" (topo do "Meu Dia")
Ordem pensada para quem abre o app de manhã:
1. **Relembrar** — o tópico da última sessão e, se já passou um dia, também o da matéria anterior. Primeiro aparece a pergunta *"Antes de abrir suas notas: o que você lembra de ‹tópico›?"* e só depois o botão **"Ver minhas anotações"** mostra o trecho do caderno. (Recordação ativa: tentar lembrar antes de reler fixa mais que só reler — skill `education-learning-science`.)
2. **Hoje** — os próximos blocos do ciclo (o planejador atual), com o motivo curto de cada um.
3. **Situação** — dias até a prova, quanto de cada prova já foi visto, e um aviso discreto quando uma prova eliminatória está ficando para trás.
4. **Uma linha de ânimo baseada em fatos**, não frase pronta (ex.: "Ontem: 2 blocos, 1h40. Arquitetura saiu de 'nunca vi' para 'em andamento'.") **(decisão do Claude)**.

## 6. Dados (mudanças no contrato SQL — com migração, como manda o CLAUDE.md)
- `exam_parts` (nova): `id, plan_id, code ('P1'), name, item_count, points_per_item, min_score, sort_order`.
- `study_plans`: `registration_deadline DATE`, `min_total_score REAL`, `selected_role TEXT`.
- `subjects`: `exam_part_id` (FK para `exam_parts`, nulo nos planos antigos).
- `topics`: `initial_knowledge_level INTEGER NULL` (nulo = herda da matéria).
- `question_logs` (nova): `id, subject_id, topic_id, total, correct, blank, source ('TEC'), logged_at`.

## 7. Decisões deixadas ao construtor
Fórmula do piso por prova; como o motor pondera `question_logs` junto com as tentativas do app; layout fino da prévia; como detectar o bloco do cargo quando o edital tem um só cargo; quais campos pedir à IA quando o parser falhar.

## 8. Ordem de entrega (decisão do Claude — a prova é em 53 dias)
- **7a — usar já:** importar o edital (§5.1) + autoavaliação (§5.2) + ciclo pela nota mínima (§5.3). Com isso o "Meu Dia" atual já passa a mandar estudar o certo.
- **7b — acompanhar:** registro rápido do TEC (§5.4) + tela "Bom dia" (§5.5).

## 9. Pronto quando (definição de pronto do projeto)
- Teste unitário do parser com o **texto real** deste edital: 4 cargos; para o Cargo 4, 13 matérias em P1/P2/P3 com contagem de tópicos de primeiro nível conferida à mão; itens, pontos e mínimos do quadro; prova em 13/12/2026; inscrições até 4/11/2026.
- Teste do ciclo: com a autoavaliação do §4, nenhuma matéria de P1/P2 com 0 minutos; Arquitetura e Persistência entre as 3 primeiras; orçamento semanal intacto.
- E2E: importar o PDF real → escolher o Cargo 4 → conferir a prévia → gravar → Wizard com autoavaliação → "Meu Dia" mostra os blocos esperados → registrar questões → recarregar e tudo continua lá.
- `npm test`, `npm run test:e2e`, `npm run build` passam.

## 10. Depois deste projeto
1. Ferramentas do leitor de PDF (grifar, desenhar, atalho para o caderno, resumo ao fechar).
2. Desempenho do TEC: a forma mais segura é o estudante salvar a página de desempenho ("Salvar como" HTML) e o app ler o arquivo. Abrir o perfil por automação (Playwright) pode violar os termos de uso do TEC e arriscar a conta.
3. Provas anteriores em PDF → banco de questões (formato JSON da spec 06).
