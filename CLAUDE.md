# Agent instructions

## Reporting style (always follow)

Write **every** report, answer, and summary to the user in ASD-STE100 Simplified Technical English. This applies on **every interaction**, not on request. It controls chat output only — never code, comments, or commit messages.

1. **Plain words.** "use" not "utilize", "start" not "initiate", "before" not "prior to".
2. **Active voice. One idea per sentence.** Do not use two clauses when one is enough.
3. **No idioms, no figures of speech, no background the user did not ask for.**
4. **Answer three things:** what you did, if it worked, what the user must do now.
5. **Prefer lists over paragraphs.** Keep technical names, file paths, and endpoint paths exactly as they are in the code.

Non-negotiables from the skill:

1. **Comment discipline.** Prefer self-explanatory names and structure over comments.
2. **Boy Scout Rule.** Leave every file you touch cleaner than you found it. Mandatory — see the IMPORTANT section below. Details: `.claude/memory/feedback/boy-scout-touched-files.md`.
3. **Names reveal intent; functions stay small and do one thing.** If a name needs a comment, fix the name.

## IMPORTANT: Boy Scout Rule on every touched file (always follow)

**IMPORTANT:** This is a hard requirement, not a preference. A task is not done until every file in the diff is cleaner than before.

1. **Before the final message of every task that changes code**, review the **whole** of each changed file, not only your lines.
2. **Fix in the same task:** `tsc` errors and ESLint problems in those files; duplicated markup or logic; commented-out code; unneeded `?.`, `||` where `??` is meant, redundant checks; unused parameters; aliases that only rename a field.
3. **Do not report these as "pre-existing".** Fix them.
4. **Keep fixes behaviour-preserving.** If a fix would change behaviour (an empty `catch`, an effect that does two things, conflicting Tailwind classes), list it in the report and ask.
5. **Verify** with ESLint (`npx eslint <changed files>`), `tsc` filtered to the changed files, and the tests (`npm test`). Then list the cleanups in the report.

## Memory protocol (always follow)

This project keeps a persistent knowledge base in `.claude/memory/` (see the `auto-memory` skill at `.claude/skills/auto-memory/SKILL.md`). Use it on **every task**:

1. **Recall first.** Before starting any task, read `.claude/memory/INDEX.md` and follow the matching folder indexes down to the memory files whose descriptions/keywords match the task. Do not skip this because the task looks simple.
2. **Trust the code over memory.** If a memory contradicts what the code on the current branch shows now, the code wins — update or delete the stale memory immediately, and fix its index line.
3. **Save as you learn.** When a task surfaces a durable, non-obvious fact — a decision and its reasoning, an investigation outcome, a gotcha, a correction from the user — save it via the auto-memory rules (topic folder, frontmatter, index entry). Don't save what the code or git history already records.
4. **Keep it current.** Every memory write, update, or deletion must also update the indexes on its path. Bump the `updated:` date when editing a file.
5. **Verify before acting on memory.** Memories record what was true when written. Check the facts you will act on against the current branch. Do not look up other branches; if the current code does not confirm a memory, investigate again.

## IMPORTANT: Stop every process you start (always follow)

**IMPORTANT:** Never leave a background process running when you finish a turn.

## Clarification before action

If a task is unclear, ambiguous, or missing required context, acknowledge the ambiguity and ask clarifying questions before taking action. Do not make assumptions or proceed with a likely interpretation without confirming the intent.
