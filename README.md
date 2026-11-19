# 3D Tic-Tac-Toe

Tic-tac-toe on three stacked 3 by 3 levels, drawn as a stained-glass window, with classic nine-square tic-tac-toe as a second game. A line of three wins: along a level, straight down through the levels, or slanting across them. Everything is drawn and synthesized in code: there are no image, video or audio files.

- Play against three computer opponents (Apprentice, Glazier, Master) or with two players on one device.
- Pick a background: Space or Ocean. The scenery answers the pointer. Reach a star and its constellation draws itself. Rest on a star or an animal to read about it. It never affects the game.
- [docs/SPEC.md](docs/SPEC.md) is the original brief, written for an earlier game called Ninefold. Its game rules no longer apply; its look, sound and accessibility sections still do. What changed, and why, is in [docs/DECISIONS.md](docs/DECISIONS.md).

## Run

Needs Node 22.

```sh
npm ci
npm run dev        # http://localhost:5173
```

Useful query parameters: `?seed=7` makes the computer repeatable, `?bg=ocean` or `?bg=space` picks a background for one visit, and `?bg=none` shows no scenery (the tests use it).

## Test

```sh
npm test                               # rules and opponent unit tests (Vitest)
npx playwright install chromium        # once
npm run e2e                            # full games, phone view, keyboard, scenery, screenshots (Playwright)
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
src/cube.ts             3D rules and opponents, no browser code
src/classic.ts          nine-square rules and opponent
src/rules.ts            types shared by both games
src/ai/                 opponent names, Web Worker
src/game.ts             controller: turns, undo, save, resume
src/render/             the SVG window, glass, light, motion
src/bg/                 interactive backgrounds: space and ocean
src/audio.ts            synthesized sound
src/ui/                 title, status line, how to play, menu
tests/                  unit tests
e2e/                    Playwright games and screenshots
scripts/                generator for the constellation data
```
