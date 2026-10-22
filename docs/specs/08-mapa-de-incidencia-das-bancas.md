# 💎 Spec 08 — Mapa de incidência: o que a banca realmente cobra

> Status: **rascunho para brainstorm** (21/10/2026). Ideia do dono registrada para não se perder; ainda **não** passou pela skill `brainstorming` nem foi aprovada. Ao retomar: ler este arquivo, rodar o brainstorming a partir das "Perguntas abertas" (§7) e só então escrever o design final.
> Provável companheira do **módulo de questões** (importar provas anteriores em PDF — spec 06 §7.2).

## 1. A ideia, nas palavras do dono
Hoje o mapa de calor do FofoLab é **pessoal**: cruza o edital (peso, nota mínima) com o desempenho e a autoavaliação do estudante. Falta o outro lado: **o que a banca de fato cobra**. Com as provas anteriores catalogadas — cada item (o "átomo" da prova) extraído, minerado e ligado a um tópico — dá para medir a **incidência** de cada assunto e estudar os **padrões de cada banca, órgão, área, trilha e concurso**.

Cruzar a incidência (o que cai) com o mapa pessoal (o que eu sei) dá o estudo mais eficiente possível. Segundo o dono, quase ninguém faz isso, porque só é possível com um catálogo grande de provas.

## 2. Por que vale (hipótese a validar)
- O edital diz **o que pode cair**; a incidência diz **o que costuma cair** e **como**.
- Dois tópicos com o mesmo peso no edital podem ter frequências muito diferentes nas provas.
- Padrões da banca (tipo de pegadinha, profundidade, lei mais cobrada) mudam o **jeito** de estudar, não só o **quanto**.

## 3. Conceitos (rascunho)
- **Item / átomo:** a menor unidade cobrada. No Cebraspe, cada afirmação Certo/Errado de um texto-base é um item; na FGV/FCC, cada questão de múltipla escolha.
- **Assunto canônico:** os editais mudam a redação dos tópicos de um ano para outro ("Arquiteturas de aplicações" × "Arquitetura de software"). A incidência precisa de uma **taxonomia estável** à qual os tópicos de cada edital e os itens de cada prova são ligados.
- **Incidência:** quantos itens de um assunto aparecem por prova (ou % da prova), filtrável por banca, órgão, área, cargo e ano, com peso maior para provas recentes.
- **Rentabilidade de estudo (cruzamento):** algo como `incidência × peso no edital × (1 − domínio)`, com a nota mínima da prova como restrição. A fórmula é do brainstorm.
- **Perfil da banca:** padrões de distrator já usados no prompt da IA (extrapolação, inversão conceitual, troca de exceção, competência errada), mais profundidade e fontes favoritas (lei seca, jurisprudência, doutrina).

## 4. De onde vêm os dados
- **Provas e gabaritos em PDF** fornecidos pelo dono (ele tem muitas; ver a pasta de downloads e o acervo de casa).
- Gabarito **definitivo** vence o preliminar; itens **anulados** são marcados e ficam fora da incidência.
- Pipeline provável, reaproveitando a 7a: pdf.js → texto → segmentação dos itens → gabarito → **classificação no assunto canônico** (IA, com grau de confiança) → **revisão humana** do que ficou com baixa confiança → catálogo.
- O formato de cada item já existe no contrato JSON de questões (spec 06 §5); falta o vínculo com o assunto canônico e a confiança da classificação.

## 5. Como aparece para o estudante (rascunho)
- Um **segundo mapa de calor**, "O que mais cai", ao lado do mapa pessoal, e uma visão **cruzada** que destaca o que cai muito e eu sei pouco.
- Filtros: banca, órgão, área, cargo e período.
- O ciclo e o "Meu Dia" podem passar a usar a incidência como fator de prioridade, dentro do orçamento semanal fixo e respeitando o piso da nota mínima (spec 07).

## 6. Não objetivos (por enquanto)
- Raspar sites de questões (TEC, QConcursos, PCI): termos de uso e direitos. O catálogo nasce das provas que o dono fornece.
- Distribuir o catálogo para terceiros antes de entender os direitos sobre provas de bancas privadas.

## 7. Perguntas abertas (roteiro do brainstorm)
1. Qual decisão de estudo essa visão precisa mudar primeiro: **o que estudar**, **quanto tempo** ou **como estudar** (padrão da banca)?
2. Qual o recorte inicial: só Cebraspe? Só TI + controle (CGU, TCU, BACEN)? Quantas provas o dono tem desse recorte?
3. A taxonomia canônica nasce do edital atual (CGU 2026) e as provas antigas são ligadas a ela, ou é uma taxonomia própria e mais ampla?
4. Quanto de revisão manual o dono aceita por prova importada? (Define a confiança mínima da classificação automática.)
5. Incidência pura (contagem) ou ponderada por recência, dificuldade e índice de acerto dos candidatos, quando houver?
6. O cruzamento com o mapa pessoal entra no ciclo automaticamente ou fica como sugestão ("Aplicar ao ciclo")?
7. Itens de prova discursiva entram?
8. Isso vira um "pacote" compartilhável com amigos (spec do `.fofopack`)? Com que cuidado de direitos?
9. Como medir que funcionou? (Ex.: acerto nas questões dos assuntos mais incidentes subiu mais que nos outros.)

## 8. Dependências
- Módulo de questões / importação de provas em PDF (spec 06 §7.2).
- Leitura de PDF já existente (pdf.js, Fatias 5.7 e 7a).
- IA real para classificar (Groq grátis hoje; volume alto pode exigir provedor pago ou processamento em lotes).
