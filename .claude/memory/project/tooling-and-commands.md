---
name: tooling-and-commands
description: How to build, test, lint and run MowerAI — npm, Node 22, Vite on port 3000, Vitest, ESLint (no Biome); known errors in README
keywords: [npm, node 22, nvmrc, vite, port 3000, vitest, eslint, tsc -b, biome, genai, allowScripts, readme]
updated: 2026-10-18
---

### Rule / Fact

- Package manager: **npm** (`package-lock.json`). Node version: `.nvmrc` = 22.
- `npm run dev` — Vite dev server on port **3000** (`vite.config.ts`).
- `npm test` — `vitest run`. Tests live next to the code as `*.test.ts`, mostly in `src/algorithms/`.
- `npx tsc -b` — type check (the `build` script runs it before `vite build`).
- `npm run lint` — `eslint .`. There is no Biome in the repo.
- `package.json` `allowScripts` lists the packages allowed to run install scripts (now only `fsevents`). Add an entry when a new dependency needs one.
- There is no LLM or AI SDK dependency. `@google/genai` was unused and the team removed it; the "AI" in MowerAI is the in-repo neural network.

### Why

These facts differ from what a reader expects from the docs, and a wrong command wastes a session.

### How to apply

- `README.md` says the dev server is at `http://localhost:5173`. That is wrong; use 3000.
- `README.md` lists algorithms that do not exist in code (STC, Dijkstra, JPS, D* Lite) and says the NN has 46 inputs (it has 47). The source of truth is `src/constants.ts` `ALGORITHMS_LIST`.
- `npx eslint .` does not pass on the whole repo (mostly `no-explicit-any`). Lint only the files you touch.

Related: [[boy-scout-touched-files]], [[browser-check-every-change]]
