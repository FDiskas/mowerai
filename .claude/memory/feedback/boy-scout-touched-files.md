---
name: boy-scout-touched-files
description: MANDATORY — in every file you change, review the whole file and fix its tsc errors, ESLint problems and code smells in the same task; never report them as "pre-existing"
keywords:
  [
    boy scout rule,
    clean-code,
    pre-existing errors,
    tsc,
    eslint,
    no-explicit-any,
    touched files,
    cleanup,
    duplication,
  ]
source: Vytenis Kuciauskas
updated: 2026-10-18
---

### Rule / Fact

When a task changes a file, also fix the existing problems in that whole file before you report:

- `tsc` errors in that file: `npx tsc -b 2>&1 | grep <file>`.
- ESLint problems: `npx eslint <file>`. ESLint is the team's linter (`eslint.config.js`); the team decided not to use Biome.
- `any` types (`@typescript-eslint/no-explicit-any` is most of the lint debt) — replace with the real types from `src/types.ts` or `src/domain/`.
- Duplicated logic or markup (extract a small named function or component).
- Commented-out code (delete it).
- Unneeded `?.` on required values, `||` where `??` is meant, redundant checks.
- Unused parameters, unused variables, aliases that only rename a field.

### Why

The user corrected "pre-existing" reports more than once and then made the rule a hard requirement (IMPORTANT section in `CLAUDE.md`). A partial cleanup of one line does not count. It applies to follow-up edits in the same session too, not only to the first change.

### How to apply

- Scope: only files the diff touches. Do not clean untouched files. The whole repo does not pass `npx eslint .` today, so filter to the touched files.
- Apply it again after each follow-up edit, not only once per task.
- Keep cleanups behaviour-preserving. If a cleanup changes behaviour (an empty `catch`, a `react-hooks/exhaustive-deps` fix that changes when an effect runs, conflicting Tailwind classes), name it in the report and ask.
- After the cleanup, run `npx eslint <files>`, `npx tsc -b` and `npm test`.

Related: [[tooling-and-commands]]
