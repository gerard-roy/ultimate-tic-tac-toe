# Ultimate Tic-Tac-Toe: Devin Build Pack

Nov 18, 2026 · @G

## How to use this pack

Give Devin this whole doc as its spec, then paste the kickoff prompt.
Expect a playable, deployed game from the first session and a finished
one after the three follow-up prompts.

1.  Create an empty GitHub repo named ultimate-tic-tac-toe and give
    Devin access to it.

2.  Export this doc as Markdown and commit it to the repo as
    docs/SPEC.md. Attaching the file to the session also works.

3.  Start a new Devin session on that repo and paste the kickoff prompt
    from the next section.

4.  Read the plan Devin sends back. If it asks for approval, approve it
    when it matches the six milestones.

5.  When Devin reports done, play the live link on a phone and a laptop.

6.  Send the follow-up prompts from the last section, one per session,
    in order.

Every section after the kickoff prompt is reference material for Devin.
You do not need to paste those sections separately.

Ninefold is a working title, for nine panels of nine panes. To rename
the game, change the name throughout this doc before you export it.

## Kickoff prompt

Paste this as the first message of the Devin session. It points Devin at
the spec, sets six milestones, and says what to send back.

You are building Ninefold, a browser game of Ultimate Tic-Tac-Toe that
looks like a stained-glass window. The full spec is in docs/SPEC.md.
Read all of it before you plan.\
\
What I want\
- A finished, deployed game I can play on my phone and my laptop.\
- It must look and feel hand-crafted. The "Look, motion and sound"
section is not optional polish. It is the product.\
- Everything is drawn in code. Do not use image, video or audio files.
Do not use a UI component library.\
\
How to work\
1. Send me a short plan that follows the six milestones below, then
begin.\
2. Commit after every milestone. Deploy to GitHub Pages at the end of
milestone 2 and send me the link. Keep that link working from then on.\
3. When the spec leaves a choice open, make the choice that best serves
the "Design principles" and record it in docs/DECISIONS.md. Do not stop
to ask unless you are blocked.\
4. Verify your own work in a real browser. Play full games at 390x844
and at 1440x900. Take screenshots and compare them with the spec.\
\
Milestones\
1. Rules engine in src/rules.ts with unit tests. No UI.\
2. Plain playable board for two players on one device. Deployed.\
3. Three computer opponents running in a Web Worker, plus the balance
script.\
4. The stained-glass look: window, glass, light, floor light, motion.\
5. Sound, how to play, settings, phone zoom, saved games.\
6. Verification: end-to-end tests, screenshots, and every box in
"Acceptance checklist".\
\
When you finish, reply with\
- The live link and the repo link.\
- The acceptance checklist with each item marked pass or fail, and the
evidence for each.\
- Eight screenshots: title, mid-game, panel won and game won, each at
phone and desktop size.\
- Anything you could not do, and why.

## Game rules

Ninefold uses the standard Ultimate Tic-Tac-Toe rules. A won panel is
closed to further play, and a finished game with no line of three is a
draw.

The spec, the code and the screen all use the same four words.

| Word           | Meaning                                         |
|----------------|-------------------------------------------------|
| Window         | The whole board                                 |
| Panel          | One of the nine small 3 by 3 boards             |
| Pane           | One of the nine cells inside a panel; 81 in all |
| Cross, roundel | Amber's mark (X) and Cobalt's mark (O)          |

Panels are numbered 0 to 8, row by row from the top left. Panes are
numbered the same way inside each panel.

1.  Amber plays crosses and Cobalt plays roundels. They take turns
    placing one mark in an empty pane.

2.  The first move of a game may go in any pane.

3.  The pane you choose decides where your opponent plays next. A mark
    in pane n sends the opponent to panel n.

4.  If that panel is closed, the opponent may play in any open panel.
    This is a free move.

5.  Three of your marks in a line inside a panel wins that panel. Rows,
    columns and both diagonals count.

6.  A won panel is closed. Nobody plays in it again.

7.  A panel with nine marks and no winner is drawn. It is closed and
    counts for neither player.

8.  Three won panels in a line on the window wins the game. The game
    ends at once.

9.  If every panel is closed and nobody has a line, the game is a draw.

### Edge cases

- A move can win a panel and also send the opponent to that same panel.
  The opponent then gets a free move.

- A move into the last empty pane of a panel closes it before the next
  target is worked out.

- A drawn panel never counts toward a line, for either player.

- The first mover alternates on every rematch. Marks stay with their
  colours, so Cobalt opens every second game.

- A game cannot continue after it is won, even if open panes remain.

## Product scope

Version 1 is a single-page game with two modes, three computer opponents
and five screens. Nothing needs a server or an account.

| Screen | What it shows | What the player does |
|----|----|----|
| Title | The unlit window with the name in the arch, and the opponent picker | Picks Apprentice, Glazier, Master or Two players, then Play |
| Game | The window, the turn light in the arch, one status line | Places marks, undoes a move, opens the menu |
| How to play | Four rules, each with a small animated panel | Steps through them, then closes |
| Menu | Resume, New game, sound levels, motion and tap options | Changes settings, which save at once |
| Result | The fully lit window, the result, panels won by each side | Rematch, or Change opponent |

### In version 1

- Play against the computer at three levels. The player is Amber.

- Two players on one device.

- Send preview: pointing at an empty pane lights the outline of the
  panel the opponent would be sent to.

- First-game coaching: for the first three turns, the status line says
  why the lit panel is lit.

- Undo. Against the computer it removes the computer's reply and the
  player's move together.

- The game saves after every move and resumes after a reload.

- A win, loss and draw count for each opponent, kept on the device.

- Full keyboard play.

### Not in version 1

Online play, accounts, leaderboards, rule variants, extra themes, and
any generated art, video or music.

### Status line wording

| Moment | Text |
|----|----|
| Player sent to a panel | Your move. Play in the lit panel. |
| Player has a free move | Free move. Play in any lit panel. |
| Coaching, first three turns | Glazier played a top-right pane, so you play in the top-right panel. |
| Computer to move | Glazier is thinking. |
| Two players | Cobalt to move. Play in the lit panel. |
| Game over | You win. / Glazier wins. / Draw. Nobody made a line. |

## Look, motion and sound

Ninefold is a stained-glass window in a dark stone room, and light is
how the game talks. Lit glass means you can play there, and the window
grows brighter as panels are won.

### How it beats the inspiration

[Captain's
Gambit](https://vincedelatorre.github.io/battleship-claude-higgsfield-devin/)
wins on spectacle: a live 3D storm sea, generated portraits and a
walkable deck. Ninefold does not try to out-render it. It aims to be
better designed: one idea carried through every pixel, built for a
phone, and loaded in about a second.

|  | Captain's Gambit | Ninefold |
|----|----|----|
| Atmosphere | A 3D storm sea behind the chart | Light through glass that changes with every move |
| Source of the art | Portraits, clips and models generated in Higgsfield | Everything drawn in code |
| Download | About 15.5 MB page plus 7.4 MB of music | Under 250 KB compressed |
| Needs | WebGL 2 with float render targets | Any current browser, no WebGL |
| Controls | Documented for keyboard and mouse | Touch first, with full keyboard and mouse play |
| Type and colour | IM Fell English; brass and sailcloth on storm grey | Federo and Alegreya Sans; amber and cobalt on violet stone |

In that project Claude wrote the game, Higgsfield made the art, and
Devin verified and published it, according to its
[repo](https://github.com/vincedelatorre/battleship-claude-higgsfield-devin).
Here Devin does the whole build, so nothing in the look depends on
generated art.

### Design principles

1.  Light is the interface. Lit glass is the only signal for a legal
    move.

2.  Lead shows structure. Thin lead separates panes, thick bars separate
    panels, and stone frames the window.

3.  One spectacle. The window carries all the drama, and every control
    around it stays flat and quiet.

4.  No two pieces of glass alike. Each piece shifts slightly in colour,
    as real glass does.

5.  Every move explains itself. The path from the pane played to the
    panel lit is always shown.

### Colour

| Token | Hex | Use |
|----|----|----|
| --nave | \#12101B | Page background |
| --stone | \#231F33 | Window frame and control surfaces |
| --stone-edge | \#3B3552 | Borders, dividers, disabled controls |
| --lead | \#08070C | Lead lines |
| --lead-shine | \#4A4560 | 1px highlight on the top-left edge of lead |
| --limewash | \#F1ECE1 | Primary text |
| --dust | \#A79FB5 | Secondary text |
| --sun | \#FFF1C2 | Focus ring, hover light, spark, Play button |
| --amber-lit, --amber-deep, --amber-unlit | \#FFB23E, \#E0701A, \#7A4A1C | Crosses |
| --cobalt-lit, --cobalt-deep, --cobalt-unlit | \#4D8DFF, \#1F4FD1, \#24386E | Roundels |
| --clear-lit, --clear-unlit | \#D9EADF, \#343B47 | Empty glass |
| --grisaille-lit, --grisaille-unlit | \#8E8A99, \#45424F | Drawn panels |

Controls are flat stone: --stone fill, a 1px --stone-edge border and 2px
corners. Only the Play button is filled, with --sun and --nave text. No
control has a gradient, shadow or glow; glow belongs to glass.

### Type

| Role | Face | Size |
|----|----|----|
| Name in the arch | Federo 400, letter-spacing 0.04em | clamp(44px, 9vw, 96px) |
| Screen titles and the result | Federo 400 | 40px, 28px on phones |
| Status line | Alegreya Sans 500 | 21px, 17px on phones |
| Buttons | Alegreya Sans 700 | 17px |
| Body text | Alegreya Sans 400, line height 1.5 | 17px, at most 60 characters a line |
| Small print | Alegreya Sans 400 in --dust | 14px |

All text is sentence case, with no all-caps labels and no monospace.
Fallbacks are Optima then Candara for Federo, and Gill Sans then
Trebuchet MS for Alegreya Sans.

### The window

Measurements use a unit in which one pane is 100 wide.

- Thin lead between panes is 5. A panel is three panes and two leads, so
  310 wide.

- Thick bars between panels are 14 and the stone frame is 30. The square
  window is 1018 across.

- A pointed arch 240 tall sits on top. It holds the name on the title
  screen and the turn light during play.

- The turn light is a roundel of radius 70 that glows amber or cobalt
  for the side to move.

- An empty pane is one piece of clear glass.

- A cross is two diagonal bars 24 wide, inset 10 from the corners. They
  form four arms in --amber-lit and a centre diamond in --amber-deep,
  with four clear triangles between.

- A roundel is a ring of outer radius 38 and inner radius 20 in
  --cobalt-lit, around a disc in --cobalt-deep. Four clear corner pieces
  surround it.

- Lead between the pieces inside a pane is 3 wide.

- A won panel re-leads into one large cross or roundel across the whole
  panel, inside a border band 12 wide in the deep colour.

- A drawn panel keeps its marks as shapes, and all of its glass turns
  grisaille.

- Each piece varies by up to 5% in lightness and 3 degrees in hue. The
  variation is seeded by position, so it never flickers.

- One 256px noise texture, generated at start, tiles over all glass at
  6% opacity with overlay blending.

- Each piece has an inner edge 1.5 wide in --lead at 35% opacity, so it
  sits in the lead.

### Light

- Every glass colour has a lit and an unlit value. Panels where the next
  player may move are lit.

- Won panels sit 70% of the way from unlit to lit, so the score always
  reads. Drawn panels stay unlit.

- Lit coloured glass casts a blurred copy of itself: 12px blur, 60%
  opacity, screen blending. Lit clear glass glows at 25%.

- Floor light: a copy of the window falls on the floor below it. It is
  flipped, 1.6 times taller, skewed 8 degrees, blurred 28px, at 35%
  opacity, and fades out downward.

- The floor light redraws after every move. It is Ninefold's answer to
  the storm sea: scenery painted by the game itself.

- Forty dust motes drift through the light on one canvas. They are 1 to
  2px wide and move under 8px a second.

- The brightest point of the light crosses the lit panel once every 80
  seconds, as a radial gradient at 12% strength.

### Layout

The window sits on the centre line and takes most of the screen. There
are no side panels and no cards.

Desktop, 900px wide and up\
\
+----------------------------------------------+\
\| Ninefold \[?\] \[sound\] \[menu\] \|\
\| \|\
\| /\\ \|\
\| /()\\ turn light \|\
\| +-----------+ \|\
\| \| \# \| \# \| \# \| \|\
\| \|---+---+---\| \|\
\| \| \# \| \# \| \# \| the window \|\
\| \|---+---+---\| \|\
\| \| \# \| \# \| \# \| \|\
\| +-----------+ \|\
\| \|\
\| Your move. Play in the lit panel. \|\
\| \[Undo\] \|\
\| ~ floor light ~ \|\
+----------------------------------------------+\
\
Phone, under 600px wide\
\
+------------------------+\
\| Ninefold \[menu\] \|\
\| /()\\ \[map\] \|\
\| +--------------------+ \|\
\| \| \| \|\
\| \| the lit panel \| \|\
\| \| fills 78% of the \| \|\
\| \| width; its \| \|\
\| \| neighbours peek \| \|\
\| \| in at the edges \| \|\
\| \| \| \|\
\| +--------------------+ \|\
\| Your move. Play in \|\
\| the lit panel. \|\
\| \[Undo\] \|\
\| ~ floor light ~ \|\
+------------------------+

- On desktop the window is a square of min(72vh, 640px), with the arch
  above it.

- Between 600px and 900px wide, the window is min(90vw, 72vh).

- When the viewport is under 700px tall, the arch flattens to a lintel
  80 tall that still holds the turn light.

- The three top-right controls are How to play, Sound and Menu. Each is
  a 44px target with an icon drawn in SVG.

### Phone zoom

A pane is about 36px wide when a phone shows the whole window, which is
too small to tap. On phones the view moves instead.

- Sent to a panel: the view glides until that panel fills 78% of the
  width. Panes are then about 94px wide on a 390px screen.

- Free move: the view shows the whole window. A tap on a lit panel zooms
  to it, and a second tap places the mark.

- A 64px map of the whole window sits at the top right. Tapping it
  switches between the whole window and the zoomed view.

- Pressing a pane shows the send preview on the map. Lifting places the
  mark, and sliding off cancels.

### Motion

| Moment | What happens | Timing |
|----|----|----|
| Mark placed | Pieces scale from 0.9 to 1 and flash to 160% brightness, and the lead draws in | 240ms, cubic-bezier(.2, .9, .3, 1.2) |
| Send | A --sun spark runs along the lead from the pane played to the target panel. The old panel dims and the new one lights | Spark 400ms, dim 300ms, light 450ms |
| Phone zoom | The view glides to the lit panel, starting with the spark | 450ms, cubic-bezier(.3, 0, .2, 1) |
| Panel won | Panes fade in a 40ms stagger, the emblem's lead draws, colour floods from the centre, then one bloom pulse | 1100ms in all |
| Game won | The three winning emblems pulse in order, a bar of light joins them, the whole window lights and the floor light doubles | 2400ms, then the result rises in 300ms |
| Computer thinking | The turn light breathes between 70% and 100% | 1600ms loop |
| Pointer or focus on a legal pane | A ghost of the mark at 35%, and a --sun outline on the target panel | 120ms |
| Reduce motion on | No glide, spark, bloom or motes. States cross-fade | 150ms |

### Sound

Every sound is synthesized with the Web Audio API. There are no audio
files and no music track.

| Sound | Recipe |
|----|----|
| Mark placed | A glass tap: a sine tone with a short noise burst, 90ms. Pitch comes from a pentatonic scale by pane number, and Amber plays an octave below Cobalt |
| Panel won | Three notes of the same scale as a soft bell chord, 900ms |
| Game won | Five notes rising with a long tail, 2.5s. A loss plays them falling and quieter |
| Illegal tap | A dull knock, 60ms, while the lit panel pulses once |
| Room tone | Filtered noise at 4% volume, with one shared reverb on every effect |

Sound starts on the first tap. The menu has levels for master, effects
and room tone, and the M key mutes.

## Computer opponents

The three opponents share one search engine. They differ in thinking
time and in how often they pick a weaker move.

| Opponent | Line in the picker | How it chooses | Strength target |
|----|----|----|----|
| Apprentice | Still learning. Plays fast and misses traps. | Takes a panel win when one is on offer. Otherwise 60% a random legal move, 40% a 30ms search | Meant to lose to a careful beginner |
| Glazier | Steady hands. Takes what you give away. | A 250ms search | Beats Apprentice in at least 85 games of 100 |
| Master | Plans many moves ahead. Rarely forgives. | A 1200ms search, 800ms on phones | Beats Glazier in at least 70 games of 100 |

### Engine

- Monte Carlo tree search with UCT and an exploration constant of 1.4.

- Playouts take a game-winning move when one exists, and avoid a move
  that hands over an immediate game win. Otherwise they play at random.

- The search runs in a Web Worker, so the page never drops a frame while
  it thinks.

- Every computer move takes at least 700ms on screen, so the player can
  follow the send.

- A seed makes the search repeatable in tests.

- npm run balance plays 100 games for each pairing, swaps the first
  mover each game, and prints the win rates.

- The balance script uses fixed search sizes so results repeat: 1,500
  playouts a move for Glazier and 12,000 for Master. It is not part of
  CI.

## Technical spec

Ninefold is a static site built with Vite and TypeScript and drawn in
SVG. It has no framework, no server and no asset files.

| Area | Choice |
|----|----|
| Build | Vite with TypeScript in strict mode |
| Drawing | One SVG for the window, one canvas for the motes, CSS for the controls |
| State | A pure rules engine, one game controller, and localStorage for saves and settings |
| Computer opponents | A Web Worker |
| Sound | Web Audio, synthesized |
| Tests | Vitest for rules and search; Playwright for full games and screenshots |
| Deploy | GitHub Pages through GitHub Actions on every push to main |
| Fonts | Google Fonts: Federo 400 and Alegreya Sans 400, 500 and 700, with display=swap |

### Files

docs/SPEC.md this document\
docs/DECISIONS.md choices Devin made where the spec was open\
src/rules.ts rules engine, no browser code\
src/ai/mcts.ts search\
src/ai/worker.ts Web Worker wrapper\
src/ai/opponents.ts Apprentice, Glazier, Master\
src/game.ts controller: turns, undo, save, resume\
src/render/window.ts the SVG window, with panes as buttons\
src/render/glass.ts piece shapes, colour variation, texture\
src/render/light.ts lit states, glow, floor light, motes\
src/render/motion.ts every timed animation and the reduce-motion switch\
src/audio.ts synthesized sound\
src/ui/ title, status line, how to play, menu, result\
src/styles/tokens.css the colour and type tokens from this spec\
tests/ rules and search tests\
e2e/ Playwright games and screenshots\
scripts/balance.ts opponent win rates\
.github/workflows/pages.yml

### Rules engine contract

type Player = 'amber' \| 'cobalt';\
type PanelState = 'open' \| 'amber' \| 'cobalt' \| 'drawn';\
type Move = { panel: number; pane: number }; // each 0 to 8\
\
interface GameState {\
panes: (Player \| null)\[\]; // 81 entries, index = panel \* 9 + pane\
panels: PanelState\[\]; // 9 entries\
next: Player;\
target: number \| null; // panel the next player must use; null = free
move\
result: 'playing' \| Player \| 'draw';\
history: Move\[\];\
}\
\
newGame(first: Player): GameState\
legalMoves(state: GameState): Move\[\]\
play(state: GameState, move: Move): GameState // pure; throws on an
illegal move\
undo(state: GameState): GameState // replays history minus one move

### Budgets and support

- All JavaScript and CSS together stay under 250 KB compressed.

- No long task runs over 50ms during play, measured in Chrome with 4x
  CPU slowdown.

- Lighthouse on the live page scores at least 90 for performance and 95
  for accessibility.

- The game runs in current Chrome, Firefox and Edge, and in Safari on
  macOS and iOS.

### Accessibility

- Each pane is a button. Its label gives the panel, the pane, what it
  holds and where it sends. Example: "Top-left panel, centre pane,
  empty. Sends Cobalt to the centre panel."

- Arrow keys move across all 81 panes. Enter or Space places a mark.

- U undoes, M mutes, Esc opens the menu and ? opens How to play.

- A live region announces every move, every panel won and the result.

- The focus ring is 2px of --sun with a 2px --nave gap.

- The game honours the system's reduce-motion setting and offers the
  same switch in the menu.

- Crosses and roundels differ in shape. Lit and unlit glass differ in
  brightness by at least 3 to 1. Colour is never the only signal.

## Acceptance checklist

The game is done when all 23 items pass. Devin marks each one pass or
fail with evidence, and you tick the box once you have seen it on the
live link.

### Rules

- [ ] Unit tests cover every rule and every edge case in "Game rules",
  and all pass.

- [ ] A scripted test plays 1,000 random games to the end with no
  illegal state and no crash.

- [ ] The target panel is correct after a move that wins or fills the
  panel it points to.

### Play

- [ ] A full game against each opponent finishes with the right result.

- [ ] Two-player mode, undo, rematch and resume after reload all work.

- [ ] The balance script meets both strength targets.

- [ ] No computer move freezes the page, and none appears in under
  700ms.

### Look

- [ ] Colours and type match the tokens exactly, with no other colours
  or fonts on the page.

- [ ] Only lit glass can be played, and nothing but light marks a legal
  move.

- [ ] The spark shows the path of every send.

- [ ] A won panel becomes one large emblem.

- [ ] The floor light changes after every move.

- [ ] No image, video or audio file ships with the site.

### Phone

- [ ] At 390 by 844, every pane is at least 44px wide whenever the
  player must choose one.

- [ ] The view glides to the lit panel, and the map switches to the
  whole window and back.

- [ ] Nothing scrolls sideways, and nothing sits under the notch or the
  home bar.

### Access and speed

- [ ] A full game can be played with the keyboard alone.

- [ ] A screen reader hears every move and the result.

- [ ] Reduce motion removes the glide, spark, bloom and motes.

- [ ] Lighthouse scores at least 90 for performance and 95 for
  accessibility.

- [ ] JavaScript and CSS total under 250 KB compressed.

### Delivery

- [ ] The live link serves the latest commit, and CI runs the tests
  before every deploy.

- [ ] The README says how to run, test and deploy the game, and
  docs/DECISIONS.md lists every open choice Devin made.

## Follow-up prompts

Send these three prompts after the first build, one session each and in
this order. Each one names its own finish line.

### 1. Design review

Send this when the live link works but does not yet look like the spec.

Do a design review of Ninefold against docs/SPEC.md, section "Look,
motion and sound".\
\
1. Take screenshots of the title, a mid-game position, a panel being won
and a game being won, at 390x844 and at 1440x900.\
2. Compare each one with the spec, token by token and measurement by
measurement. List the ten largest gaps, worst first.\
3. Fix all ten. Do not add anything the spec does not ask for.\
4. Check the five design principles one by one. For each, say where the
build breaks it, then fix that.\
5. Reply with before and after screenshots for every fix.

### 2. Feel

Send this when the game looks right but playing it feels flat.

Tune how Ninefold feels to play. Change timing, easing and sound only.
Do not change the layout, colours or rules.\
\
1. Record 30 seconds of play at phone size and at desktop size.\
2. Check every row of the Motion table and the Sound table in
docs/SPEC.md against the recordings. Fix any that are missing, late or
too long.\
3. Make sure no animation blocks input. A player who taps quickly must
never wait.\
4. Make sure the tap sound, the spark and the new panel lighting happen
in that order and finish within 700ms.\
5. Reply with the new recordings and a list of every value you changed.

### 3. Hardening

Send this last.

Harden Ninefold for release.\
\
1. Run every item in "Acceptance checklist" in docs/SPEC.md again and
fix each failure.\
2. Test in Chrome, Firefox and Safari, and on a phone-sized touch
screen. Fix what differs.\
3. Play ten full games against each opponent while watching the console.
Fix every error and warning.\
4. Try to break it: tap during animations, resize mid-game, reload
mid-move, switch sound on and off, and change tabs while the computer
thinks.\
5. Reply with the checklist, pass or fail for each item with evidence,
and a list of every bug you found and fixed.

To give the game a different look later, replace the "Look, motion and
sound" section and send prompt 1 again. The rules, opponents and code
structure do not depend on the theme.

