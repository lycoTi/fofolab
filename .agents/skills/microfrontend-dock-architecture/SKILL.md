---
name: microfrontend-dock-architecture
description: >-
  Feature-Sliced Microfrontend (Micro-Module) architecture, React Composition Patterns
  (Vercel), and Frontend UI Engineering (Addy Osmani) from finfin/awesome-frontend-skills.
  Use to keep components under 250 lines, isolate features into independent dockable panels,
  minimize AI context token consumption, and prevent God-components.
---

# Microfrontend & Dockable Workbench Architecture (FofoLab)

Sources: `finfin/awesome-frontend-skills` (`addyosmani/frontend-ui-engineering`, `vercel-labs/composition-patterns`, `wshobson/react-state-management`).

## 1. Why "Feature-Sliced Micro-Modules" Instead of Multi-Server MFEs in Tauri
In a desktop application (`.exe` via Tauri v2), distributed multi-server Microfrontends (Webpack Module Federation across separate HTTP servers or `<iframe>` sandboxes) add unnecessary memory overhead. Instead, FofoLab uses **In-Process Feature-Sliced Micro-Modules (VS Code / Obsidian Workbench Pattern)**:

1. **Thin Host Shell (`src/App.tsx` < 250 lines):**
   - `App.tsx` is strictly a **Layout & Slot Host**. It manages which **Dock Panels** are expanded or collapsed (`TopicsSidebar`, `MainStage`, `NotebookDock`, `AiCopilotDock`) and coordinates shared state.
   - It NEVER contains inline feature markup (no inline notebook editors, no inline PDF viewers, no inline Admin tables).
2. **Isolated Feature Slices (`src/features/<slice-name>/`):**
   - Each domain capability lives in its own self-contained folder with a strict public interface (`Props` or Context contract).
   - **AI Token Efficiency Rule:** An AI agent fixing a bug or adding a feature in `ai-copilot` or `notebook-dock` should only need to read that single feature file (~150–250 lines), never the entire application.
3. **250-Line Component Ceiling (Addy Osmani Standard):**
   - Any component exceeding ~250–300 lines is a structural red flag and must be split into focused sub-modules.
4. **Dockable Multi-Pane Control (User-Controlled Workspace):**
   - Users can independently toggle and expand panels side-by-side (`[📂 Tópicos]`, `[🎯 Bancada]`, `[📓 Caderno]`, `[🐹 Chat IA]`) without losing state or resetting their active question/page.

