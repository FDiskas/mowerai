---
name: browser-check-every-change
description: MANDATORY — after every UI or simulation change, run the Vite app, open it in a browser, run a simulation and check a screenshot; unit tests alone do not count
keywords:
  [
    browser test,
    visual check,
    screenshot,
    chrome headless,
    vite dev,
    port 3000,
    verify,
  ]
source: Vytenis Kuciauskas ("Always confirm that it works by running a test browser and do a visual check")
updated: 2026-10-19
---

### Rule / Fact

A code change is not done until the app works in a real browser and you have looked at a screenshot of it.

### Why

The project is about mower path finding, and the user decided that the result must be checked in the browser: a path that passes a coverage test can still look wrong on the grid (zigzags, spinning, overlap, a bad return to the dock). Unit tests cover only `src/algorithms/` and `src/domain/MowingStep.ts`. The React components, hooks, the training worker and the grid rendering have no tests, so only the browser shows if they work.

### How to apply

1. Start the dev server in the background: `npm run dev`. It listens on port **3000** (`vite.config.ts`), not 5173 as `README.md` says.
2. Take a screenshot with a headless Chrome, for example Chrome for Testing (`npx -y @puppeteer/browsers install chrome@stable --path <scratchpad>/cft`) and a small CDP or Puppeteer script against `http://localhost:3000`.
3. For simulation changes, start a run (and select the changed algorithm) before the screenshot, so the mowed tiles and the mower path show.
4. Look at the PNG with Read. Check the grid, the sidebar and the stats panel.
5. Gotchas: if port 3000 is taken (another dev server), Vite starts on 3001 — read the port from the log and do not touch the other process. With puppeteer-core, `page.setViewport` during NN training gave "detached Frame" errors; set `defaultViewport` in `launch` instead, and take the screenshot while training runs. `innerText` applies CSS `uppercase`, so the NN card reads "GEN 12", not "Gen 12" — match case-insensitively. Use a `userDataDir` in the scratchpad to test IndexedDB across reloads. Do not drive the system `/Applications/Google Chrome.app` headless: its updater closes the whole browser after ~30 s ("DISCONNECTED"); use Chrome for Testing. The NN card is below the fold at 1500×1000 — screenshot the card element. Toasts disappear fast; record them with a MutationObserver.
6. Stop the dev server and Chrome before the turn ends (CLAUDE.md: stop every process you start).
7. Put the result of the check in the report.

Related: [[boy-scout-touched-files]], [[tooling-and-commands]]
