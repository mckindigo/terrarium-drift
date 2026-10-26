# Terrarium Drift

A calm, solo idle game: a sealed glass terrarium that grows, drifts and sometimes collapses, even while you're away.
Single page, plain HTML/CSS/JS, no dependencies, no build step, no external assets (everything is drawn on canvas).

**Play:** open `index.html` in a browser (works from `file://`).

## Layout
- `index.html`, `src/style.css`
- `src/data.js` species, insects, soils, biomes, upgrades, morphs, pairs, balance constants
- `src/sim.js` the ecosystem simulation (DOM-free), actions, offline progress, save/export/import
- `src/plants.js` procedural plant drawing; `src/render.js` jar, soil, insects, spores, glass
- `src/ui.js` panels, input, game loop (2 Hz logic, ~30 fps drawing, paused when hidden), autosave
- `tools/test.py` headless-Chrome verification (Playwright), `tools/bot.js` balance bot, `tools/art.py` art preview

## Run the checks
```
/workspace/.venv-pw/bin/python tools/test.py   # needs playwright + google-chrome
node tools/bot.js                               # prints a pacing timeline
```
