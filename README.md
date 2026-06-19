# Helix Heresy

Helix Heresy is a desktop-focused static browser prototype about forbidden creature genetics, laboratory discovery, and questionable science.

The current build starts with slimes as the simplest creature type. Players edit 26-base genomes, synthesize living samples, discover traits through tests, manage slime reproduction, manage corpses and Suspicion, and assign creatures to early lab jobs.

For story background, long-term systems, current design direction, and open questions, see [DESIGN_BIBLE.md](DESIGN_BIBLE.md).

## Current Prototype

- Clickable ASCII DNA helix and seeded procedural gene mapping.
- Slime synthesis with Biomass costs, testing, longer lifespans, maturity, current mass, division pressure, condition stats, and local saves.
- Core stockpile resources: Biomass, Genetic Material, Elemental Residue, Waste, and broad feedstocks for testing feeding systems.
- Slime reproduction foundation with natural splitting, Forced Recombination, Current Mass, and Division Pressure.
- Discoverable physical traits such as shape, body consistency, appendages, color, element, size, weight, movement, and Sustenance.
- Sustenance traits describe a slime's primary feeding adaptation, with broad material, waste/decay, and slow environmental pathways.
- Manual feeding, best-match feeding after Sustenance discovery, and auto-feeding policies with per-slime automation exclusion.
- Main Lab room foundation with dynamic Temperature, Light, Ambient Mana, Moisture, Contamination, and Electrical Charge.
- Corpse handling with waste drums, decay states, necropsy, dumping, Suspicion, and policy-driven Corpse Processing jobs.
- Creature Jobs panel with Idle, Corpse Processing, and Waste Disposal assignments that can affect slime condition stats.
- Scientist stamina, mana, skills, XP/resource cheats, timed tasks, speed controls, skip controls, and keyboard shortcuts.
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
- `app.js` - Game state, genetics, time simulation, saves, tests, slime reproduction, jobs, Suspicion, rooms, corpses, and rendering.
- `DESIGN_BIBLE.md` - Story, design goals, current direction, future systems, and open questions.
- `CHANGELOG.md` - Milestone-level development history.
- `package.json` - Node/Playwright metadata for local automation.
- `tests/` - Browser automation experiments and smoke tests.

## Saves

Helix Heresy stores local progress in browser `localStorage`. Launching the game opens a new/load choice instead of automatically loading the last save. Saves can also be exported and imported as JSON files from inside the game.

## Development Notes

- Keep the game runtime dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
- Do not update the changelog for every prototype tweak; reserve it for milestone-ready versions.
