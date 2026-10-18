---
name: nn-progress-bar
description: DECISION 2026-10-18 — the NN training bar shows bestFitness as a share of idealFitness (a perfect run on the same maps), not bestFitness / 400000; why, the formula, and measured shares
keywords: [progress bar, idealFitness, shareOfIdeal, TrainingStatus, Sidebar, 400000, boustrophedon, minimum turns, lanes]
updated: 2026-10-18
---

### Rule / Fact

- The bar in `Sidebar.tsx` = `shareOfIdeal(bestFitness, idealFitness)` (clamped 0–1), text "N% of ideal".
- `idealFitness` (`src/utils/fitness.ts`) feeds `scoreOf` a perfect run: every reachable tile cut once, `2 × (lanes − 1)` turns (lanes = rows for horizontal, columns for vertical, as on an empty map), straight aligned steps for the rest, no damage, no charge, ends at the dock.
- The hook averages it over the training maps (like the worker averages fitness) and sets it in the same `setTrainingStatus` as `bestFitness`, before the map refresh, so both come from the same maps.

### Why

The old `bestFitness / 400000` was full at once: random nets already scored 200k–380k (50–95 %). Fitness has no fixed top; it changes with map size and `fitnessConfig`. The user chose a per-map ideal and asked to count the minimum turns.

### How to apply

- Measured on training maps (25×20): ideal ≈ 599k; random nets and Snake Fill both reach 48–61 %. In the app (with the user grid) training shows 75–78 %. Expect a narrow band until step 3 of [[nn-training-review]].
- It is not a strict maximum (straight steps over mowed grass also earn `straightLineBonus`), so keep the clamp.
- If `scoreOf` gets a new term, give it its ideal value in `idealFitness`.

Related: [[nn-training-review]], [[simulation-paths-and-nn]]
