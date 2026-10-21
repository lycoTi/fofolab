---
name: prompt-engineering-guide
description: >-
  Apply evidence-based prompt engineering techniques from DAIR.AI (Prompt-Engineering-Guide)
  when designing system prompts, AI tutors, exam parsers, RAG/grounding pipelines, and
  structured JSON extraction in FofoLab.
---

# Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)

Source repository: `https://github.com/dair-ai/Prompt-Engineering-Guide`

Use these principles whenever constructing or auditing prompts in `src/lib/aiRouter.ts`, deep research dossiers, or exam question extraction scripts:

## 1. Grounding & Anti-Hallucination (RAG / Context Anchoring)
- **Immutable Ground Truth:** In civil service exam preparation (FGV, Cebraspe, FCC), the **Official Post-Appeal Answer Key (`final_answer`)** and the **Official Exam Statement (`statement`)** are immutable axioms.
- **Explicit Citation Separation:** Force the model to separate its explanation into 3 distinct epistemic layers:
  1. **Letra da Lei / Normativo Exato** (e.g., *Lei 14.133/2021, Art. 75*, *ISSAI 100*, *MCASP*);
  2. **Jurisprudência Dominante** (STF, STJ, TCU);
  3. **Perfil da Banca** (How FGV vs. Cebraspe frames distractors).
- **Abstention Rule:** Instruct the model: *"Se o artigo exato não estiver confirmado, explique o conceito doutrinário sem inventar número de artigo ou inciso."*

## 2. Structured Decomposition (Chain-of-Thought + Elimination)
- For multiple-choice questions (`A` to `E`), never explain only the correct option. Require **Contrastive Elimination**:
  1. Identify the **Command Core** (what the question actually asks);
  2. Explain why the official answer is right;
  3. Diagnose the specific **Distractor Pattern** in each wrong option (*Extrapolation*, *Conceptual Inversion*, *Literal Exception Swap*, *Wrong Organ Competence*).

## 3. Token Economy & Caching Architecture
- **System Prompt Compression:** Keep static instructions concise and structured with clear delimiters.
- **Deterministic Fallback & Local Caching:** Persist every generated dissection in `ai_dissections` so identical prompts never consume external tokens twice.
- **Prompt Chaining over Monolithic Prompts:** For Admin Mode PDF/Exam extraction, split into:
  - Step 1: Structural segmentation (question boundaries + option keys);
  - Step 2: Answer key matching & post-appeal annulment verification;
  - Step 3: Topic classification & 4D complexity scoring.

