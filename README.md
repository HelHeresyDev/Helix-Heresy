# Helix Heresy

Helix Heresy is a desktop-focused static browser prototype about forbidden creature genetics, laboratory discovery, and questionable science.

The current build starts with slimes as the simplest creature type. It lets the player edit a 24-base-pair slime genome, synthesize living samples, run timed tests, breed specimens, and build up a scientist through stamina-gated actions and skill XP.

The long-term goal is a discovery-driven creature genetics game where the player experiments with strange life forms, learns what their genes do through observation and testing, and gradually turns messy lab notes into practical breeding knowledge.

## Design Vision

Helix Heresy should feel like running an unsafe little arcane biology lab. The player should not start with a complete wiki. They should learn by making creatures, testing them, comparing notes, and breeding toward goals they only partially understand.

Core design pillars:

- Discovery over disclosure: hidden trait outcomes and gene mappings should be learned through play.
- Strange but readable creatures: generated specimens should be easy to imagine, not just lists of numbers.
- Lab capability matters: skills improve execution, while equipment and resources should eventually unlock what tests are possible.
- Weird biology is allowed: clashing traits can create awkward or weak creatures instead of being forbidden.
- Breeding should feel experimental: the player can aim for known traits, but unusual combinations should remain possible.

## Campaign Vision

The full game should become a browser-based roguelike management game about illegal life creation in a magical world. The prototype is slime-first, but the larger arc is not slime-only: slimes are the first low-gene creature family before stranger, smarter, more dangerous life forms become possible.

The intended long-term loop:

- Experiment on genes and synthesize creatures.
- Observe results through casual inspection, lab tests, and practical use.
- Manage money, biomass, reagents, lab space, equipment, time, secrecy, and heat.
- Hide evidence, contain accidents, and avoid authority attention.
- Assign creatures to jobs, lab areas, disposal tasks, protection, infiltration, production, or sale.
- Visit the black market to sell creatures, byproducts, services, and eventually fulfill commissions.
- Use discoveries, profits, and creatures to expand from a hidden lab into larger operations.

Starting scenarios should define the initial story and resource position. Examples include a protected corporate black-project lab, a legitimate company job hiding secret desert-base construction, and a sewer fugitive start where the authorities are already hunting the player.

Difficulty should be modular rather than a single preset. Settings can affect journal support, gene visibility, authority aggression, resource scarcity, experiment consequences, mutation chaos, and how learnable the DNA puzzle is. Easy settings can be darkly funny and forgiving; hard settings should become tense, secretive, and resource-starved.

Heat is the pressure of being discovered. It should eventually track suspicion, evidence trails, escaped creatures, lab incidents, black market exposure, and direct government attention. On low difficulty it can be background pressure; on high difficulty it should become a constant survival threat.

The black market should grow with reputation. Early sales may be whatever useful creatures or byproducts the player can produce. As reputation rises, customers should commission creatures with specific traits, behaviors, affinities, or jobs.

The late game should escalate from survival and profit into power. The player can recruit people through money or promises, create stronger creatures and eventually intelligent agents, confront the local government, take control of territory, and transition into a global conquest layer. Higher-intelligence creations should be more useful but also more capable of betrayal and non-gene-driven behavior.

## Creature Vision

Creatures should eventually be described as physical beings with form, dimensions, mass, affinity, behavior, and usefulness.

Slimes are the starting point because they are the most basic experimental creature. The broader game should be able to grow into other creature families with their own body plans, constraints, uses, and risks.

Current direction:

- Shape is a genetic trait that describes the creature's body plan.
- Appendages are a genetic trait separate from shape.
- Size describes shape-aware dimensions instead of only total volume.
- Weight is derived, not genetic.
- Density is derived primarily from elemental affinity and affinity strength.
- Movement is derived from shape, appendages, size, weight, and element instead of being directly genetic.

Examples of the intended style:

- `Shape: worm-like`
- `Appendages: grasping pseudopods`
- `Size: 1.8 m long, 12 cm thick`
- `Weight: 34 kg`
- `Movement: pulls itself forward`

Odd combinations are acceptable. A puddle with stub legs or a metal slime with wing-like membranes may become physically awkward, but that awkwardness can later feed into creature stats, mobility, stability, containment difficulty, or combat/work usefulness.

## Future Systems

Likely future systems:

- Starting scenarios with different resources, protection, time pressure, and threats.
- Modular difficulty settings for journal support, heat, resources, mutation, danger, and gene-map complexity.
- Heat, suspicion, evidence, raids, cover stories, and lab secrecy.
- Money, biomass, reagents, lab space, equipment, orders, construction, and black market access.
- Black market reputation, freeform sales, byproduct markets, and commissioned creature requests.
- Equipment and resource-gated testing.
- Test failure or inconclusive results based on skill, equipment, and sample difficulty.
- Mutation as a risk layered on top of deterministic genetics.
- Creature stats derived from physical compatibility, affinity, stability, and biology.
- More meaningful containment, risk, escape, and lab safety systems.
- Breeding goals and practical uses for creatures.
- Creature jobs such as production, hazardous disposal, defense, spying, assassination, construction support, and research assistance.
- Intelligent created species that can act as assistants or agents while carrying betrayal and autonomy risks.
- Recruitment, base expansion, authority conflict, territory control, and eventual world conquest.
- A clearer distinction between casual observation, lab testing, and precise instrument readings.
- A richer journal that helps the player reason from partial discoveries without spoiling hidden mappings.
- Null affinity as active anti-magic, distinct from having no affinity.

Open design questions:

- What starting scenarios should ship first, and which difficulty settings should be separate sliders?
- How should heat be generated, hidden, reduced, or converted into authority actions?
- When should the game transition from lab survival to local-government conflict and then world conquest?
- How much should movement affect future mechanics?
- Should body consistency replace texture entirely, stay implied, or return later as a derived property?
- How should weak or biologically clashing creatures be communicated to the player?
- What jobs or pressures will make creature stats matter?
- How much should the lab economy rely on byproducts, contracts, hazards, or research milestones?

## Current Prototype

- Clickable ASCII DNA helix with paired bases.
- Distinct color coding for A, C, G, and T.
- Seeded procedural gene mapping for repeatable runs.
- Slime synthesis from 24-base genomes.
- Genetic shape and appendage traits.
- Shape-aware size dimensions.
- Derived weight and derived movement.
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
- `package.json` - Node/Playwright metadata for local automation.
- `tests/` - Browser automation experiments and smoke tests.
- `.gitignore` - Local clutter and generated output exclusions.

## Saves

Helix Heresy stores local progress in browser `localStorage`. Saves can also be exported and imported as JSON files from inside the game.

## Development Notes

- Keep the game runtime dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
- Do not update the changelog for every prototype tweak; reserve it for milestone-ready versions.
