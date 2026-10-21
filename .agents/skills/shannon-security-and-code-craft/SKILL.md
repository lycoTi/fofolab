---
name: shannon-security-and-code-craft
description: >-
  Apply defensive security analysis, attack-surface auditing, and clean TypeScript
  engineering standards from KeygraphHQ/shannon. Use when reviewing architecture,
  handling API keys, parsing untrusted PDFs/HTML from exam boards, or refactoring TypeScript.
---

# Shannon — Defensive Security & TypeScript Engineering Craft

Source repository: `https://github.com/KeygraphHQ/shannon`

## 1. Defensive Security Audit (5-Phase Mindset for Desktop & Web Apps)
Whenever adding file handling (PDFs, `.fofopack` imports), AI API gateways, or web crawlers:
1. **Credential Isolation (Zero Exposed Secrets):**
   - Never ship personal production API keys (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`) hardcoded in client bundles distributed to third parties. Route through a bounded proxy (e.g., Oracle Cloud / Cloudflare Worker with spending cap safeguards) or runtime environment store.
2. **Untrusted Input & XSS / Injection Prevention:**
   - Imported `.fofopack` databases, scraped exam HTML, and AI-generated Markdown are **untrusted inputs**.
   - Never use raw `dangerouslySetInnerHTML` without strict sanitization; always use parameterized SQLite queries (`?` placeholders) — never string concatenation.
3. **Local File & Path Traversal Guards (Tauri / Local PDFs):**
   - Validate file extensions (`.pdf`, `.fofopack`) and ensure local file paths never allow arbitrary system file exfiltration.

## 2. TypeScript Code Craft (Shannon Standards)
- **Clarity Over Brevity:** Optimize for readability, not line count — three clear lines beat one dense expression.
- **No Nested Ternaries:** Never use nested ternary operators (`a ? b : c ? d : e`). Use explicit `if/else`, `switch`, or lookup maps.
- **Guard Clauses & Early Returns:** Keep functions focused on a single responsibility with early returns instead of deep nesting.
- **Numbered Sequential Steps (`// 1. ...`, `// 2. ...`):** Use numbered comments inside functions that have 3+ distinct logical phases.
- **Timeless Comments:** Never write comments referencing chat history ("as discussed", "fixed for slice 4"). Document *why* a constraint exists.

