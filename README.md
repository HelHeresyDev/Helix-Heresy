# Helix Heresy

Helix Heresy is a desktop-focused static browser prototype about forbidden creature genetics, laboratory discovery, and questionable science.

The current build starts with slimes as the simplest creature type. Players edit 26-base genomes, synthesize living samples, discover traits through tests, breed specimens, manage corpses and Heat, and assign creatures to early lab jobs.

For story background, long-term systems, current design direction, and open questions, see [DESIGN_BIBLE.md](DESIGN_BIBLE.md).

## Current Prototype

- Clickable ASCII DNA helix and seeded procedural gene mapping.
- Slime synthesis, testing, breeding, lifespan, maturity, and local saves.
- Discoverable physical traits such as shape, body consistency, appendages, color, element, size, weight, and movement.
- Corpse handling with waste drums, decay states, necropsy, dumping, Heat, and Waste Processing jobs.
- Creature Jobs panel with Idle and Waste Processing assignments.
- Scientist stamina, mana, skills, XP, timed tasks, speed controls, skip controls, and keyboard shortcuts.
- Automatic, manual, and disabled journal modes.

Trait outcomes and gene mappings are intentionally hidden during normal play so they can be discovered experimentally.

## Running Locally

No build step is required.

Open `index.html` in a browser:

```powershell
start .\index.html
```

The game is currently designed for desktop play.

## Project Files

- `index.html` - Page structure and UI panels.
- `styles.css` - Visual design, layout, and responsive behavior.
- `app.js` - Game state, genetics, time simulation, saves, tests, breeding, jobs, Heat, corpses, and rendering.
- `DESIGN_BIBLE.md` - Story, design goals, current direction, future systems, and open questions.
- `CHANGELOG.md` - Milestone-level development history.
- `package.json` - Node/Playwright metadata for local automation.
- `tests/` - Browser automation experiments and smoke tests.

## Saves

Helix Heresy stores local progress in browser `localStorage`. Saves can also be exported and imported as JSON files from inside the game.

## Development Notes

- Keep the game runtime dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
- Do not update the changelog for every prototype tweak; reserve it for milestone-ready versions.
