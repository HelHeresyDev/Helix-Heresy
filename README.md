# Helix Heresy

Helix Heresy is a desktop-focused static browser prototype about forbidden creature genetics, laboratory discovery, and questionable science.

The current build starts with slimes as the simplest creature type. Players edit 26-base genomes, synthesize living samples, discover traits through tests, manage slime reproduction, manage corpses and Suspicion, and assign creatures to early lab jobs.

For story background, long-term systems, current design direction, and open questions, see [DESIGN_BIBLE.md](DESIGN_BIBLE.md). The approved map projection, sprite scale, modular creature assembly, and readability rules live in [VISUAL_LANGUAGE.md](VISUAL_LANGUAGE.md).

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

## Ubuntu and VS Code Setup

The project is now developed on Ubuntu in Visual Studio Code. It requires Node.js
20 or newer and npm for the automated tests; the game itself remains a static
browser application with no build step.

From the repository directory:

```bash
code .
npm ci
npx playwright install --with-deps chromium
```

The final command installs Chromium and the Ubuntu system libraries used by the
default local test suite. It may ask for the Ubuntu account password through
`sudo`. To run the optional Firefox and WebKit projects too, install every
Playwright browser with:

```bash
npx playwright install --with-deps
```

No VS Code extension is required. VS Code's built-in JavaScript, terminal, Git,
and debugging support are sufficient. A Playwright testing extension is
optional if a graphical test explorer is preferred.

## Running Locally

For the quickest launch, open the static page in the Ubuntu default browser:

```bash
xdg-open index.html
```

Alternatively, serve the directory from the VS Code terminal:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The local-server option is useful when
testing browser features that are more restricted on `file://` pages. Stop the
server with `Ctrl+C`.

The game is currently designed for desktop play.

## Testing

Run the normal 31-test Chromium smoke suite:

```bash
npm test
```

Local Playwright runs use up to four workers so the simulation-heavy browser
tests do not overwhelm the development machine. CI runs them serially.

Run the complete 182-test Chromium regression suite before a major feature is
merged:

```bash
npm run test:regression
```

The smoke tier covers simulation scheduling, map navigation, renderer-neutral
scene state, Canvas behavior, terrain connectivity, and UI-state persistence.
The regression tests remain in the repository because most protect distinct
game systems; they are no longer part of every development check.

Other useful commands are:

```bash
npm run test:smoke
npm run test:headed
npm run test:ui
npm run test:all
npm run test:report
```

`test:all` runs the complete suite in Chromium, Firefox, and WebKit and is
reserved for cross-browser or milestone validation.

Pass a smoke test filename after `--` to run a focused smoke check:

```bash
npm test -- tests/canvas-map-renderer.spec.js
```

Use `test:regression` to focus a test outside the smoke tier:

```bash
npm run test:regression -- tests/access-control.spec.js
```

The tests resolve `index.html` from the repository directory with portable Node
paths, so they do not depend on a Windows drive letter or a particular Linux
mount point.

## Project Files

- `index.html` - Page structure and UI panels.
- `styles.css` - Visual design, layout, and responsive behavior.
- `app.js` - Game state, genetics, time simulation, saves, tests, slime reproduction, jobs, Suspicion, rooms, corpses, and rendering.
- `terrain-connectivity.js` - Renderer-neutral terrain adjacency, edge relations, door framing, ramp segments, and deterministic visual variation.
- `map-visual-state.js` - Versioned renderer-neutral map scenes, unique entities, knowledge state, interactions, overscan, and schema validation.
- `canvas-map-renderer.js` - Optional Canvas 2D map prototype with semantic styling, viewport culling, high-DPI output, and event-driven redraws.
- `DESIGN_BIBLE.md` - Story, design goals, current direction, future systems, and open questions.
- `VISUAL_LANGUAGE.md` - Approved map projection, sprite scale, modular creature rendering, palette, and readability contract.
- `CHANGELOG.md` - Milestone-level development history.
- `package.json` - Node/Playwright metadata for local automation.
- `playwright.smoke.config.js` - Fast everyday Chromium test selection.
- `tests/` - Browser automation experiments and smoke tests.

## Saves

Helix Heresy stores local progress in browser `localStorage`. Launching the game opens a new/load choice instead of automatically loading the last save. Saves can also be exported and imported as JSON files from inside the game.

Browser-local saves from the former Windows installation do not automatically
appear in a different Ubuntu browser profile. Use the game's JSON export on
Windows and Import on Ubuntu if an old prototype save needs to be transferred.

## Development Notes

- Keep the game runtime dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
- Do not update the changelog for every prototype tweak; reserve it for milestone-ready versions.
- Linux paths are case-sensitive. Keep filename capitalization identical between
  manifests, HTML references, JavaScript imports, and files on disk.
