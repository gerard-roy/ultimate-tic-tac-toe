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
34. Named stars are placed in the open sky around the window, never behind it. Lively shows all 40; calm shows 22.
35. Star figures are rounded from published values; several are uncertain by 10% or more, and the card says "about" where it matters.
36. The star picture is drawn from its temperature (colour), with larger convection cells on cool giants, and the Sun to the same scale.
37. A touch has no hover, so a tap on the scenery acts as a pointer resting there for four seconds.
38. The info card never takes pointer events, and it picks a side that keeps it off the window when it can.
39. `?bg=` picks a background for one visit without changing the saved setting. The tests use it.
