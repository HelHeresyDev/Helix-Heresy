# Helix Heresy

Helix Heresy is a desktop-focused static browser prototype about forbidden slime genetics, laboratory discovery, and questionable science.

The current build lets the player edit a 24-base-pair slime genome, synthesize living samples, run timed tests, breed specimens, and build up a scientist through stamina-gated actions and skill XP.

## Current Prototype

- Clickable ASCII DNA helix with paired bases.
- Distinct color coding for A, C, G, and T.
- Seeded procedural gene mapping for repeatable runs.
- Slime synthesis from 24-base genomes.
- Observable traits with scientist estimate ranges.
- Timed tests that can reveal more precise trait information.
- Breeding and crossbreeding between mature samples.
- Lifespan, maturity, living sample storage, release, and containment states.
- Scientist stat sheet with health, stamina, mana, and individual skills.
- Stamina costs, passive regeneration, and queued rest actions.
- XP cheat command for testing skill progression.
- Collapsible time queue drawer with skip controls.
- Automatic, manual, and disabled journal modes.
- Local save, import, export, and save-to-folder support.

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
- `app.js` - Game state, genetics, time simulation, saves, tests, breeding, and rendering.
- `.gitignore` - Local clutter and generated output exclusions.

## Saves

Helix Heresy stores local progress in browser `localStorage`. Saves can also be exported and imported as JSON files from inside the game.

## Development Notes

- Keep the prototype dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
