---
name: real-nn-vs-algorithms-plan
description: DECISION 2026-10-18 — prove a real NN beats the algorithms (fixed score, unknown map, TS training, beat best algorithm per held-out lawn); user allowed distance inputs + imitation-then-ES; measured results of every approach (ES plateau, rollout teacher 2.02, students 2.19–2.30, soft labels worse)
keywords: [neural network, proof, benchmark, unknown map, known map, sensor, evolution strategies, OpenAI-ES, imitation, DAgger, rollout teacher, privileged teacher, distance field, held-out maps, SCORE_WEIGHTS, validation, plateau, branch real-network]
updated: 2026-10-19
---

### Rule / Fact

User goal: prove that a real neural network beats the hand-written algorithms. User choices (2026-10-18):

- **Score:** `SCORE_WEIGHTS` in `src/simulation/score.ts` (step 1, turn 2, overlap 1, charge trip 25, missed tile 20, not docked 100), cost per reachable tile, lower is better. Fixed before training.
- **Unknown map** for every model (sensor range 2), **browser-only TypeScript** training, **bar = best algorithm on each held-out lawn**. Old assisted NN, GA, fitness and imitation warm start were deleted.
- Seeds: training 1…999 999, validation 1 000 000 + 0…23, test 2 000 000 + 0…59 (`SEED_RANGES`, `seedsOf`).

Built on branch `real-network` (uncommitted when written): `src/simulation/*` (engine, generator, score, benchmark, network, ES, task pool, trainer), `scripts/` (CLI), UI Proof Benchmark modal, fog of war, ES training in Web Workers.

Measured 2026-10-18:

- Algorithms, validation (24 lawns): smart_ai 2.344, potential_field 2.351, a_star 2.355, energy 2.363, dfs 2.367 … spiral 2.929; **best per lawn 2.192**. Test (60 lawns): dfs/smart_ai 1.901 … spiral 2.498. On unknown maps greedy planners win, not lane sweeps.
- Pure ES from scratch (48 pairs, σ 0.04, lr 0.02, 8 lawns/gen): validation 21.7 → 13.3 in 80 generations, then flat (14–15 at gen 120). The network loops when no grass is near.
- DAgger imitation of Smart AI with the same inputs: 98 % action match but validation 5.5–6.8. With 4 extra "distance to nearest grass per move" inputs: 3.9. The gap is long-range navigation; a few wrong moves start loops.

User answers (2026-10-18): (a) distance-field input **allowed**, (b) **imitation first, then ES**.

After that (validation, cost/tile, bar = best algorithm per lawn ≈ 2.19):

- Distance inputs = nearness 1/(1+d) + gradient sign per move. With them, DAgger of one algorithm already beats that algorithm (Smart AI 2.344 → student 2.254; per-lawn-best teacher → 2.204, but worse after round 3 as labels conflict).
- Rollout teacher (try each move, finish with Smart AI on the **real** lawn, take the cheapest): itself 2.019, wins 19/24 vs the bar. Students of it: 2.188 (32-32), 2.232/2.235 (64-64), 2.270, 2.303 (6 rounds) — big run-to-run spread (±0.06 noise on 24 lawns). The same lookahead on the known map only: 2.322 → the edge is privileged knowledge, partly unlearnable.
- ES after the warm start (σ 0.01, lr 0.002, 8 lawns) made it worse (2.20–2.27); defaults now lr 0.0005, 16 lawns. The trainer keeps the best validated network, so ES cannot make the saved model worse.
- RRT uses `Math.random`, so the per-lawn bar moves slightly between runs (2.189–2.193).

Final state 2026-10-18 (user: "I will train by myself, I just need a working solution"):

- Shipped `public/models/policy.json` = rollout-teacher student, seed 1, + 10 careful ES generations: validation 2.188.
- Test (60 lawns, run once): network 1.835 = lowest mean of all models (dfs/smart_ai 1.901); vs best algorithm per lawn 22 wins, 3 ties, 35 losses, sign test p = 0.11 → not proven. Report in `results/benchmark-test.md`.
- `npm run train` resumes from `training/checkpoint.json` (git-ignored), else from the shipped model; `--fresh` = warm start from zero. It saves a model only when validation improves.
- Seeds 2–4 gave 2.219, 2.219, 2.324; 64-64 networks and more DAgger rounds did not help.
- Re-check 2026-10-18 (user: "preview always drives the same"): 30 more ES generations from the shipped model (defaults) → validation 2.184 at gen 15 (noise-sized gain), then 2.20 → 2.238 at gen 40. ES on top of the warm start does not learn; it drifts. The preview drives the **best validated** network with argmax on the user's lawn, so its path is identical until validation improves — which almost never happens. Per-generation training cost jumps (1.88–2.03) because every generation uses new lawns.
- Soft labels tried 2026-10-19 (user picked it): rollout teacher's per-move extra cost → softmax target with a temperature (code removed after the test at the user's request; rebuild it from this note if needed). Students, 3 seeds each, mean cost on 96 validation lawns: T 0 (one-hot) **2.146**, T 1 2.161, T 2 2.169, T 5 2.173; T 0 best for every seed. Soft labels do **not** help — likely because moves that cost the same when Smart AI finishes the job are not equal for the student.
- 96 validation lawns: student 2.139 = lowest mean (smart_ai 2.224), but vs best algorithm per lawn 32 W / 9 T / 55 L. A 96-lawn benchmark takes ~3 s, a warm start ~4 min (11 threads); 24-lawn validation scores disagree with 96-lawn ones by up to 0.08.

### Why

The old NN was not a real policy (A* compass input, wrapper overrode it). A fair proof needs a fixed metric, held-out lawns, and must be allowed to say "no".

### How to apply

- Never tune `SCORE_WEIGHTS`, the test seeds or the engine rules after seeing network results.
- Tell the user honestly if the network does not win; the Proof Benchmark modal and `npm run benchmark` give the verdict.

Related: [[simulation-paths-and-nn]], [[algorithm-review-findings]], [[nn-training-persistence]]
