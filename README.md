# Helix Heresy

Helix Heresy is a desktop-focused static browser prototype about forbidden creature genetics, laboratory discovery, and questionable science.

The current build starts with slimes as the simplest creature type. Players edit 26-base genomes, synthesize living samples, discover traits through tests, manage slime reproduction, manage corpses and Suspicion, and assign creatures to early lab jobs.

For story background, long-term systems, current design direction, and open questions, see [DESIGN_BIBLE.md](DESIGN_BIBLE.md). The approved map projection, sprite scale, modular creature assembly, and readability rules live in [VISUAL_LANGUAGE.md](VISUAL_LANGUAGE.md).

## Current Prototype

- Clickable ASCII DNA helix and seeded procedural gene mapping.
- Slime synthesis with Biomass costs, testing, longer lifespans, maturity, current mass, division pressure, condition stats, and local saves.
- Evidence-driven research projects that cite reusable observations, consume physical materials and scientist work, preserve interrupted workpieces, and unlock advanced tests or usable prototypes.
- Core stockpile resources: Biomass, Genetic Material, Elemental Residue, Waste, and broad feedstocks for testing feeding systems.
- Slime reproduction foundation with natural splitting, Forced Recombination, Current Mass, and Division Pressure.
- Discoverable physical traits such as shape, body consistency, appendages, color, element, size, weight, movement, and Sustenance.
- Sustenance traits describe a slime's primary feeding adaptation, with broad material, waste/decay, and slow environmental pathways.
- Manual feeding, best-match feeding after Sustenance discovery, and auto-feeding policies with per-slime automation exclusion.
- Main Lab room foundation with dynamic Temperature, Light, Ambient Mana, Moisture, Contamination, and Electrical Charge.
- Corpse handling with waste drums, decay states, necropsy, dumping, Suspicion, and policy-driven Corpse Processing jobs.
- Creature Jobs panel with Idle, Corpse Processing, and Waste Disposal assignments that can affect slime condition stats.
- Scientist stamina, mana, skills, XP/resource cheats, real-time-paced hands-on tasks, physical trip-and-route hauling, 1x/5x/10x speed controls, manual skip controls, and keyboard shortcuts.
- Icon-based management windows with accessible labels, keyboard shortcuts, and right-click back/dismiss behavior shared with Escape.
- Saved player map knowledge with light-aware line-of-sight perception, a physical carried hand lamp, unexplored darkness, remembered terrain, stale last-known tiers, uncertain incident markers, and Debug-only omniscience.
- Seeded, lazily generated underground geology with distinct rock strata, hidden ore veins and environmental pockets, geology-aware excavation time and tool wear, physical rubble outputs, and derived room-expansion readiness.
- Knowledge-safe physical lighting and selected temperature, humidity, ambient-mana, light, and aggregate airborne-contamination overlays shared by the DOM and Canvas renderers.
- Renderer-neutral ground, world, and alert effects for known spills, structural failures, active abilities, incidents, and actionable task endpoints, with severity-ranked equipment status cues.
- Persistent map accessibility controls for glyph-first rendering, reduced motion, high contrast, effect intensity, readable zoom floors, and scalable markers. Color-independent shapes and glyphs remain active in every mode.
- Automatic, manual, and disabled journal modes.

Trait outcomes and gene mappings are intentionally hidden during normal play so they can be discovered experimentally.

## Running Locally

No build step is required.

Open `index.html` in a browser:

```bash
xdg-open index.html
```

Alternatively, serve the folder from VS Code's integrated Ubuntu terminal:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The game is currently designed for desktop play.

For development and automation on Ubuntu, install a current Node.js LTS release, run `npm install`, and use VS Code's integrated terminal. No VS Code extension is required. Run the Chromium correctness suite and map benchmark with:

```bash
npm run test:smoke
npm test
npm run test:visual
npm run benchmark:map
npm run benchmark:map:full
```

The 14-test smoke command is the quick cross-system check for routine iteration. The 150-test correctness command is the focused Chromium regression suite and uses four workers to avoid overcommitting the Ubuntu desktop. Run the full suite before publishing substantial changes. The visual command checks committed Ubuntu/Chromium baselines without changing them; use `npm run test:visual:update` only after deliberately reviewing an intended rendering change. The quick benchmark is intended for iteration; the full mode takes more samples. Timing budgets are advisory across different computers, while visible-count and idle-frame invariants fail the command.

## Project Files

- `index.html` - Page structure and UI panels.
- `styles.css` - Visual design, layout, and responsive behavior.
- `app.js` - Game state, genetics, time simulation, saves, tests, slime reproduction, jobs, Suspicion, rooms, corpses, and rendering.
- `geology-field.js` - Deterministic coordinate-based strata, mineral deposits, excavation hazards, exposed-face knowledge, and physical mining yields.
- `research-system.js` - Deterministic research project definitions, evidence requirements, saved project records, and technology-unlock evaluation.
- `terrain-connectivity.js` - Renderer-neutral terrain adjacency, edge relations, door framing, ramp segments, and deterministic visual variation.
- `actor-visual-state.js` - Renderer-neutral four-way facing, canonical pose precedence, semantic activity families, condition cues, and sprite-key candidates derived from simulation state.
- `animation-clock.js` - Presentation-only game-time sampling plus normalized motion/action timelines; it never advances simulation.
- `map-knowledge.js` - Sparse saved cell observations, light-aware same-layer perception queries, last-observed age tiers, and knowledge records for current, stale, unknown, and Debug map presentation.
- `map-visual-state.js` - Versioned renderer-neutral map scenes, unique entities, effect planes, severity-ranked status cues, knowledge-filtered lighting/environment state, animation timelines, capped presentation-time feedback, interactions, overscan, pre-normalization culling, optional chunked spatial queries, and schema validation.
- `map-render-order.js` - Shared semantic render passes, stable depth ordering, crowded-target priority, tall-layer slicing, and occlusion policy.
- `sprite-asset-manifest.js` - Stable semantic map-sprite keys, source and logical dimensions, tile anchors, transform capabilities, aliases, and category fallbacks.
- `sprite-asset-loader.js` - Asynchronous image loading, shared atlas-source caching, validation, status diagnostics, and nonfatal fallback resolution.
- `assets/sprites/` - Generated individual and atlas-based development placeholders plus asset-maintenance notes.
- `canvas-map-renderer.js` - Primary Canvas map renderer with deterministic passes, physical lighting, airborne and hazard treatment, semantic status markers, occlusion handling, anchored multi-tile sprites, complete glyph-first rendering, knowledge-safe movement interpolation, semantic transient action feedback, accessibility presentation options, cached viewport draw plans, invalidation diagnostics, and conditional animation-frame redraws.
- `map-renderer-parity.js` - Deterministic renderer fixtures and zero-tolerance semantic parity reports shared by the actual DOM adapter and Canvas draw path.
- `map-population-benchmark.js` and `benchmarks/` - Deterministic representative, dense, and mostly-offscreen population fixtures measured in a real browser Canvas.
- `scripts/run-map-benchmark.js` - Quick/full benchmark CLI with stage timings, advisory budgets, and structural invariant checks.
- `RENDERER_PROMOTION_CHECKLIST.md` - Automated, human-review, and release gates retained as the completed promotion record and ongoing regression policy.
- `DESIGN_BIBLE.md` - Story, design goals, current direction, future systems, and open questions.
- `VISUAL_LANGUAGE.md` - Approved map projection, sprite scale, modular creature rendering, palette, and readability contract.
- `CHANGELOG.md` - Milestone-level development history.
- `package.json` - Node/Playwright metadata for local automation.
- `tests/` - Tagged Playwright smoke coverage and focused browser regression suites.

## Saves

Helix Heresy stores local progress in browser `localStorage`. Launching the game opens a new/load choice instead of automatically loading the last save. Saves can also be exported and imported as JSON files from inside the game.

## Development Notes

- Keep the game runtime dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
- Do not update the changelog for every prototype tweak; reserve it for milestone-ready versions.
