# Decisions

Choices made where the spec was open, and places where a later request from the owner overrides the spec.

## Requests that override the spec

1. **Interactive backgrounds.** The spec lists "extra themes" as out of scope and allows no colours outside its tokens. The owner then asked for a Space and an Ocean background, each in a lively and a calm version. They are scenery only and never read or change game state. They use their own colours; the window, text and controls still use only the tokens. The plain "Stone room" from the spec remains a choice. The default is "Space, lively".
2. **Classic tic-tac-toe.** The spec lists "rule variants" as out of scope. The owner asked for nine-square tic-tac-toe as an option. It is a second game on the title screen and uses the same window, opponents, saves and settings.
3. **Colour budget.** Background canvases and the info card picture are the only places with colours outside the tokens.

## Rules and play

4. `GameState` carries one extra field, `first`, so `undo` can replay the history as the contract requires.
5. Classic reuses `GameState` with a single open panel, so one renderer and one controller serve both games. Its rules live in `src/classic.ts`.
6. Classic opponents: Apprentice takes a win and otherwise plays at random. Glazier also blocks, and plays the best move three times in four. Master plays perfectly and cannot lose.
7. Undo against the computer while it is thinking cancels the search and takes back the player's move.
8. Undo is off once a game is over; Rematch and Change opponent take over.
9. A finished game stays saved, so a reload shows the result again. Starting from the title clears it.
10. Coaching counts player turns across games on the device and stops after three.
11. Wins, losses and draws are kept separately for Ninefold and Classic.

## Opponents

12. Apprentice's 40% search uses 150 playouts in the balance script, standing in for 30ms.
13. Search results are the most-visited root move. An immediate game win is taken without searching.
14. Undo or a new game ends the worker and starts a fresh one, so an old search can never delay the next.

## Look and motion

15. The arch is a low pointed curve drawn with two cubic curves. Under 700px tall it becomes a lintel.
16. The name sits in the arch as page text over the glass, so it can follow the type scale exactly.
17. A cross's four arms meet the centre diamond along its edges; the four clear triangles are one clear piece behind them with lead drawn over it.
18. Piece variation is seeded by panel, pane and piece index.
19. Glow is one blurred copy per panel, at 25% for lit clear glass and 60% for won panels.
20. The floor light is a small canvas redrawn after every move, then flipped, stretched 1.6 times, skewed 8 degrees and blurred 28px in CSS. It is drawn at five eighths of the window's height before stretching so it stays on the page.
21. The spark runs from the pane played, along the nearest lead, to the target panel and once round it, in 400ms. The new panel starts to light 250ms after the tap and finishes by 700ms.
22. When a send points at a closed panel, the spark still runs to it, and then every open panel lights.
23. On a free move, the hover preview outlines every panel the opponent could then use.
24. The result rises from the bottom edge as a flat stone strip, so the lit window stays in view.
25. In Classic, the winning three marks pulse and the bar of light joins them; the whole board is always lit.
26. Marks in a drawn panel are a darker grisaille than the glass around them, so shape still reads.

## Phone

27. "Phone" means a viewport under 600px wide. The window is `min(92vw, 56vh)` wide.
28. The turn light also shows as a small roundel beside the name, because the arch leaves the view when zoomed.
29. In whole-window view on a phone, a tap on a lit pane zooms to its panel; the next tap places.
30. "Tap twice to place" in the menu is the tap option: the first tap shows the ghost and the send preview.

## Sound

31. The scale is C major pentatonic. Cobalt starts at C5 and Amber an octave below.
32. A draw plays a short, quiet falling phrase.

## Scenery

33. Reduce motion swaps a lively background for its calm version.
34. Named stars are placed in the open sky around the window, never behind it.
35. Star figures are rounded from published values; several are uncertain by 10% or more, and the card says "about" where it matters.
36. The star picture is drawn from its temperature (colour), with larger convection cells on cool giants, and the Sun to the same scale.
37. A touch has no hover, so a tap on the scenery acts as a pointer resting there for four seconds.
38. The info card never takes pointer events, and it picks a side that keeps it off the window when it can.
39. `?bg=` picks a background for one visit without changing the saved setting. The tests use it.
40. **Constellations.** The owner asked for real constellations in place of the invented lines that joined lit stars. Each one is a real figure: reach any of its stars and its lines draw in, every star in it shines, and its name appears beneath. It lingers a few seconds after the pointer leaves, then fades.
41. Star positions, brightness, colour index and distances for the figures come from the HYG catalogue v4.1 (CC BY-SA 4.0), through `scripts/make-constellations.py`. `src/bg/constellations.ts` is generated and carries that attribution.
42. Which stars are joined is the common stick figure for each constellation, written by hand in the script; the catalogue does not hold lines.
43. Each figure is a flat map of its own patch of sky, scaled to fit its space. Figures are not to scale with each other, and their places on screen do not follow the real sky.
44. Eleven figures are defined. The screen shows as many as fit beside the window, in a fixed order starting with Orion: six lively or four calm at 1440 by 900, one under the window on a phone.
45. Stars that are only in the HYG catalogue have no size on their card, because that catalogue has no radius. The 40 hand-written stars keep full cards.
46. Inside a constellation, a star is named only when the pointer is right on it, so the figure stays readable. Catalogue stars outside the figures are scattered between them.
47. The info card tries to leave the star's whole constellation uncovered.

## 3D tic-tac-toe replaces Ninefold

48. **The game.** The owner asked for 3D tic-tac-toe on three stacked 3 by 3 levels in place of Ninefold. The Ninefold rules, its search engine, the balance script, the send spark, won-panel emblems, coaching, phone zoom and the map are removed. Entries 4 to 14, 21 to 23 and 27 to 30 above describe that earlier game and no longer apply.
49. The name is "3D Tic-Tac-Toe". The spec's sections on rules, opponents and phone zoom are superseded; its look, sound and accessibility sections still guide the build.
50. Rules: 27 squares, any empty square may be played, and the first line of three wins. There are 49 lines: 8 on each level, 9 straight down, and 16 slanting through the levels. A full board with no line would be a draw, but that cannot happen on this board.
51. The first player has a large advantage, above all by taking the very centre. No rule limits that; the first mover alternates on every rematch.
52. Opponents: Apprentice takes a win and otherwise plays at random. Glazier also blocks, looks two moves ahead, and plays at random one time in four. Master blocks and looks up to six moves ahead within half a second.
53. `GameState` is shared with Classic: `panel` is the level (0 at the top) and `pane` the square on it.
54. The three levels are drawn tilted, one above the other, on four posts inside the stone window. Rows are squashed to 60% and lean 30%, which keeps every square at least 44px wide and tall on a 390 by 844 phone.
55. The 3D window is narrower and taller than the Classic one: `min(46vh, 500px)` wide, or `min(92vw, 43vh)` on a phone.
56. Arrow keys walk a grid three squares wide: the rows of the top level, then the middle, then the bottom.
57. Wins, losses and draws are kept separately for 3D and Classic. Saved settings and games from the Ninefold build are not carried over.
