# Ninefold

Ultimate Tic-Tac-Toe as a stained-glass window, with classic nine-square tic-tac-toe as a second game. Everything is drawn and synthesized in code: there are no image, video or audio files.

- Play against three computer opponents (Apprentice, Glazier, Master) or with two players on one device.
- Pick a background: Space or Ocean, each in a lively and a calm version, or the plain stone room. The scenery answers the pointer. Reach a star and its constellation draws itself. Rest on a star or an animal to read about it. It never affects the game.
- The full spec is in [docs/SPEC.md](docs/SPEC.md). Choices made where the spec was open, and where later requests override it, are in [docs/DECISIONS.md](docs/DECISIONS.md).

## Run

Needs Node 22.

```sh
npm ci
npm run dev        # http://localhost:5173
```

Useful query parameters: `?seed=7` makes the computer repeatable, `?bg=ocean-calm` picks a background for one visit (`space-lively`, `space-calm`, `ocean-lively`, `ocean-calm`, `stone`).

## Test

```sh
npm test                               # rules, search and classic unit tests (Vitest)
npx playwright install chromium        # once
npm run e2e                            # full games, phone view, keyboard, scenery, screenshots (Playwright)
npm run balance                        # opponent win rates; takes about 6 minutes, not part of CI
```

`npm run e2e` builds the site, serves it on port 4173 and writes screenshots to `e2e/screenshots/`.

## Build and deploy

```sh
npm run build      # type-checks, then writes dist/
npm run preview
```

Every push to `main` runs `.github/workflows/pages.yml`: unit tests, build, end-to-end tests, then a deploy of `dist/` to GitHub Pages. In the repository settings, Pages must have its source set to "GitHub Actions".

## Data

Constellation star data in `src/bg/constellations.ts` is generated from the [HYG star catalogue](https://github.com/astronexus/HYG-Database) v4.1, licensed CC BY-SA 4.0. Regenerate it with `python3 scripts/make-constellations.py path/to/hygdata_v41.csv`.

## Layout

```
src/rules.ts            Ninefold rules engine, no browser code
src/classic.ts          nine-square rules and opponent
src/ai/                 Monte Carlo tree search, opponents, Web Worker
src/game.ts             controller: turns, undo, save, resume
src/render/             the SVG window, glass, light, motion
src/bg/                 interactive backgrounds: space and ocean
src/audio.ts            synthesized sound
src/ui/                 title, status line, how to play, menu
tests/                  unit tests
e2e/                    Playwright games and screenshots
scripts/balance.ts      opponent win rates
```
