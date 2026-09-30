# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Genlab is a browser idle game about creature breeding and genetics: TypeScript (strict), Svelte 5 (runes), Vite, `break_infinity.js` for big numbers, Vitest. It is packaged as a PWA, Tauri desktop app (`src-tauri/`) and Capacitor mobile app (`android/`, `ios/`). The game, the docs, commit messages and all player-facing text are **German**. Code comments and identifiers are English.

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm test             # all Vitest tests (tests/**/*.test.ts)
npx vitest run tests/management.test.ts        # one file
npx vitest run tests/management.test.ts -t "infusion"   # tests matching a name
npm run check        # svelte-check / tsc – the only "lint" step
npm run build        # check + production build to dist/ (incl. PWA service worker)
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm test`, `npm run build`.

Balancing bots (slow, print timelines):
```bash
GENLAB_TIMELINE=1 npx vitest run tests/progression.test.ts --silent=false   # first hour, unlock order
GENLAB_TIMELINE=1 npx vitest run tests/longrun.test.ts --silent=false       # multi-day idle player
GENLAB_LONGRUN=1  npx vitest run tests/longrun.test.ts --silent=false       # two weeks, several minutes
GENLAB_AEON=1     npx vitest run tests/aeon.test.ts --silent=false           # endgame over 4 weeks (tower, relics, anomalies, Äon, talents, Großprojekt), ~20 min; days via GENLAB_AEON_DAYS
GENLAB_RPG=1      npx vitest run tests/rpgBot.test.ts --silent=false         # GenLab RPG: clear rate per dungeon and hero level, loot per Fackel, runs a fresh monster needs
```

## Architecture

Three layers with strict import direction `ui → core ← content` (aliases `@ui`, `@core`, `@content`):

- **`src/core/`** – pure game logic. No DOM, no Svelte, no UI imports; everything is testable in Node.
- **`src/content/`** – all game content as data (species, genes, upgrades, missions …) plus `balance.ts` (every tuning number). Validated at startup by `core/content/validate.ts`. Content errors produce a readable error page, and `tests/content.test.ts` checks them too. How to add content: `CONTENT.md`.
- **`src/ui/`** – Svelte components. They read state and call actions, and contain no game rules. Read-only helpers for the UI belong in `core/queries.ts` or the feature module.

### Core concepts (span many files)

- **`Game` / `GameContext`** (`core/game.ts`, `core/context.ts`): one object holding `state`, `content`, `balance`, typed event `bus`, seeded `rng`, and `mods()`. Every core function takes a `GameContext` as its first argument. Tests construct games with `makeGame(seed, balanceOverrides)` from `tests/helpers.ts`.
- **Simulation**: `step(dtMs)` runs the `DEFAULT_SYSTEMS` (`core/systems/index.ts`) in order. Live play uses fixed `balance.sim.tickMs` steps. Offline progress reuses `step()` with coarser steps and is capped. Running processes and buffs keep following the real clock beyond the cap (`systems/timers.ts`).
- **Modifiers** (`core/modifiers.ts`, `core/providers.ts`): every bonus is `{ target, op: 'add'|'pct'|'mult', value }`, combined as `(base + Σadd) × (1 + Σpct) × Πmult`. Each bonus source (upgrades, achievements, dex, talents, anomalies, weekly mutation …) is a `ModifierProvider`. Results are cached, so **call `ctx.invalidate()` after any state change that affects bonuses** (creature stats, upgrades, jobs …). Valid target roots are listed in `MODIFIER_ROOTS`.
- **Processes** (`core/systems/processes.ts`): generic timed jobs (egg, mission, sequencing, voyage, grand research …) keyed by `kind`. Feature modules register their `ProcessHandler` on import (`core/features/index.ts` is imported by `game.ts`). They can also mark kinds as surviving prestige (`registerResetSurvivor`) or occupying an expedition camp (`registerCampProcess`).
- **Features** (`core/features/*.ts`): one module per game system. Actions return `ActionResult` (`{ ok: true } | { ok: false, reason }`, where `reason` is a German player-facing message) and never throw for invalid player input. Unlocks are data (`content/progression.ts` `features` with `Condition`s), checked by `systems/unlocks.ts`. Test for an unlock with `state.features[id]`.
- **Creature jobs**: `creature.job` is `null` or `{ kind: 'building' | 'nest' | 'mission' | 'tower', target }`. Voyage teams also use `'mission'`. Consuming creatures (sell, recycle, infuse) must go through `canConsume` / `takeConsumable` in `features/stable.ts`, which protect favourites (`locked`), busy creatures and creatures being sequenced.
- **Save** (`core/save.ts`): versioned envelope with `SAVE_VERSION` and `MIGRATIONS[old]` (old → old+1). New fields with defaults in `createEmptyState` are merged automatically. Only renames and restructures need a migration. New gene loci and latent traits are added to old creatures on load (`ensureGenomes`, `ensureLatentTraits`). The RNG state lives in the save, so runs are reproducible.
- **Prestige** (`core/prestige.ts`): what a reset clears is data (`PrestigeLayerDef.resets`).

### UI layer

- `ui/store.svelte.ts` bridges core and Svelte. It holds the single `game`, runs the loop, autosaves, and handles native/PWA hooks. Game state is **plain, not reactive**. Components re-derive inside `$derived.by(() => { view.frame; … })`: `view.frame` ticks about every 100 ms, `view.slowFrame` about every 250 ms and is used for heavier derivations.
- Call core actions through `act(result)`: it shows the failure reason as a toast and refreshes. Confirmations use `await ask(text, { ok, danger })` (never `window.confirm`). Messages use `toast(...)`.
- Per-device UI settings live outside the save game:
  - `viewState.svelte.ts`: filters, sort orders and collapsed panels that survive tab switches.
  - `prefs.svelte.ts`: notation, reduced motion, notifications.
  - `news.svelte.ts`: which release notes were already shown.
  
  When adding a field to `viewState`, give it a default and make sure `load()` merges that section.
- Tabs are registered in `TABS` in `ui/App.svelte` and map to `FeatureDef.tab`. The tab bar shows areas (`GROUPS` in `App.svelte`) with the tabs as a second row; add a new tab to an area there (a tab in no area gets an area of its own). The last tab per area lives in `viewState.nav`. The filling bar on a tab comes from `core/tabActivity.ts` (`PROCESS_TABS`: add new process kinds there).
- Never put a whole `GameState` (import, sync download) into deep `$state`: it would be adopted as Svelte proxies (slow, `structuredClone` fails). Use `$state.raw`.
- Styling: global tokens in `ui/styles.css` (`--teal`, `--gold`, `--violet`, `--panel`, `--line` …), component-scoped CSS otherwise. Respect the `.reduce-motion` class for animations. Layouts must also work at phone width, where the tab bar moves to the bottom.
- Platform glue: `ui/platform/` (storage, notifications, PWA, native). Mobile uses Capacitor Preferences instead of `localStorage` for saves.
- Device sync: `ui/sync.svelte.ts` (when to upload/download, conflicts) on top of `ui/platform/sync.ts` (sync code, AES-GCM, HTTP client). The server is the Cloudflare Worker in `sync-server/` (D1, tested in `tests/sync.test.ts`). The build only offers sync if `VITE_SYNC_URL` is set. Uploads count "played" time: a device that was not in the foreground since its last upload takes a newer cloud save silently, otherwise the player chooses (`SyncDialog`).

### Player-facing release notes

Before a release, add a new entry at the **top** of `src/ui/changelog.ts` and increase `id` by one. Write it for players.
- **No spoilers:** give items that name a system a `feature` id. Such items stay hidden until that feature is unlocked.
- **Delivery:** the build also emits `changelog.json` (vite plugin in `vite.config.ts`), so the *old* version's update banner can preview the notes. It is deliberately excluded from the service-worker precache.

## Conventions

- Keep rules in `core`, numbers in `content/balance.ts`, content in `content/`. A new bonus should be new data or a provider, not a special case in the tick.
- Player-visible strings are German, with typographic quotes „…“ and `–` dashes. Numbers are formatted via `core/format.ts` (`formatNumber`, `formatDuration`, `formatPercent`).
- Use `D()` / `Decimal` from `core/num.ts` for resources. Stats are plain numbers.
- `README.md` has the full feature/architecture table and platform packaging notes. `TODO.md` tracks planned work, and `genlab-neubau-prompt.md` is the original project brief.
