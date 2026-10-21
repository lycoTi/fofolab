---
name: education-learning-science
description: >-
  Evidence-based pedagogical and cognitive science skills from GarethManning/education-agent-skills
  (Ebbinghaus Forgetting Curve, Duolingo Half-Life Regression, Cepeda 10-20% Spacing Rule,
  Mandinach & Gummer Learning Analytics Sample Confidence, and Kapur Productive Failure).
  Use when designing study cycles, mastery metrics, spaced repetition, and AI tutoring in FofoLab.
---

# Education & Learning Science (GarethManning/education-agent-skills)

Source repository: `https://github.com/GarethManning/education-agent-skills`

## 1. Learning Analytics & The Small-Sample Trap (Mandinach & Gummer, 2016; Wiliam, 2011)
- **Never Over-Interpret Small Samples:** Answering 2 or 3 questions in a broad discipline (e.g., Administrative Law or Public Accounting) has **near-zero statistical confidence** for declaring mastery or failure.
- **Continuous Sample Confidence Curve ($C_n$):**
  Instead of magic thresholds like `if (attempts < 3)`, weight empirical accuracy by sample maturity and subtopic breadth:
  $$C_n = \frac{n_{\text{weighted}}}{n_{\text{weighted}} + k}$$
  where $k$ scales with the topic's complexity/size (e.g., $k = 10\text{ to }15$ weighted questions), and harder questions (3–5 stars) carry higher evidentiary weight than trivial recall questions.
- **Separate Coverage from Mastery (Avoid the Diluted Average Trap):**
  Never average `0%` unvisited topics with `85%` studied topics into a single misleading number. Always separate:
  1. **Proficiência nos Tópicos Estudados** (Quality of what was studied);
  2. **Cobertura do Edital** (% of topics explored with minimum confidence).
- **Start with the Decision, Not Raw Data:** Analytics in FofoLab exists for one formative decision: *"Which topic should I study next, and in what format (Theory PDF, Reverse Study Questions, or Quick Review)?"*

## 2. Spaced Repetition & Forgetting Curve (Ebbinghaus, 1885; Cepeda et al., 2006; Settles & Meeder, 2016)
- **Memory Decays Exponentially Without Retrieval:** A topic with `90%` mastery studied 30 days ago is at high risk of forgetting.
- **Half-Life Regression (Duolingo Model):**
  Each topic has a **Memory Half-Life ($h$, in days)** that grows with successful retrievals (`MASTERED`) and resets/shrinks on `BASE_GAP`.
  Recall probability after $\Delta t$ days since `last_studied_at`:
  $$R(\Delta t) = 2^{-\Delta t / h}$$
  As $R(\Delta t)$ drops, the topic's urgency (`heatScore`) rises automatically in the Heatmap!
- **Cepeda's 10–20% Horizon Rule:** Optimal review spacing for consolidated topics is ~10–20% of `daysUntilExam` (capped between 3 and 21 days).

## 3. Productive Failure & Desirable Difficulty in Reverse Study (Kapur, 2008/2016; Kornell et al., 2009)
- **Failed Retrieval Enhances Subsequent Encoding:** In Reverse Study, attempting a question *before* mastering the PDF and getting it wrong primes the brain for deep encoding when reading the explanation (**Productive Failure**).
- **Prevent Cognitive Offloading:** Do not reveal the full AI dissection before the student commits to an answer option or explicitly clicks "Explorar Conceito". Struggle before consolidation is what builds long-term retention.

