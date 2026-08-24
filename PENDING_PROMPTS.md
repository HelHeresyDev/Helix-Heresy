# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should begin only after the design has been discussed and the developer explicitly approves moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, documented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of that implementation. Do not remove a prompt merely because it has been discussed or coding has started.

If a design discussion expands beyond one coherent implementation pass, split it into additional pending prompts before implementation. Prefer a small playable vertical slice over a broad foundation with no player-visible consumer.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

The intended long-term frontend is hybrid. Canvas should render physical and strategic maps, terrain, sprites, animation, lighting, effects, and map overlays. HTML/CSS should continue to render menus, inspectors, records, policies, dialogs, tooltips, and accessibility controls. Simulation state and rules must remain independent of both renderers. Keep the DOM Compatibility Map as a persistent fallback until a future separate removal decision.

## Current Priority Order

1. Execution Day, Physical Death, and Resurrection Handoff
2. Reusable Worlds, Random Names, and Run Separation
3. World Themes and Content Boundaries
4. Hex-Based World Generation Foundation and Strategic Map
5. Global Geography, Biomes, Terrain, and Resources
6. Settlements, Cities, Routes, and Candidate Sites
7. Civilizations, Factions, Institutions, Religions, and Law
8. Historical World Simulation and Playable Year
9. New-Run World Selection, Site Choice, and Scenario Materialization
10. Local Context Mechanics: Environment, Geology, and Travel
11. Penal Legions and Wilderness Service
12. World Integration: Economy and Logistics
13. World Integration: Investigations and Institutional Pressure
14. Lazy Local Detail and World Discovery
15. Roguelike Run Lifecycle, Death, Postmortem, and Restart
16. Campaign Roadmap: From Hidden Laboratory to World Domination
17. New-Run Onboarding and Contextual Tutorial
18. Sound, Notifications, and Accessibility Audit
19. Production Art Pass Using the Sprite Pipeline

## World and Run Guardrails

Apply these rules throughout the world-generation and campaign prompts:

- Follow a Dwarf Fortress-like structure: generate a named, finite world and its history before starting a run, then allow multiple new runs to use that same world.
- Each world has a saved theme. World Theme affects generation, history, available content, narration, and campaign possibilities; it is not a cosmetic toggle that can be switched halfway through a run.
- Madcap Heresy and Grim Heresy worlds must use separately tagged content pools so Grim-only content cannot leak into a Madcap world through an unfiltered random event.
- A world is a persistent reusable template. A run references that world but owns its laboratory, company, actors, discoveries, economy changes, authority state, territorial changes, and other mutable simulation state.
- Runs never write their laboratories, ruins, victories, disasters, creatures, or other outcomes back into the reusable world template. An ended lab must not appear on the world map or in the history of a later run.
- Starting another run in the same world creates an independent branch from the world's canonical generated state. It does not continue the prior run's timeline.
- Keep separate world and run seeds. The world seed controls reusable geography, names, civilizations, and pre-run history; the run seed controls scenario materialization and run-specific outcomes.
- Generate the whole world at strategic resolution before play: its boundaries, major geography, regions, major settlements, powers, broad routes, and historical state must be stable. Generate exact local tiles, minor places, individuals, and encounter detail only when needed.
- Treat advanced science and magic as one unevenly distributed technological landscape. Internet-like networks, aircraft, flying mounts, mechs, holographic systems, wards, and other magitech require physical infrastructure, energy, maintenance, access, and defended connections.
- Most land should be ecologically dominated or seriously contested by mutually hostile magical beasts. Represent territories, migration, threat, and broad populations strategically until a specific encounter needs individual creatures.
- Human control should form fortified cities, defended corridors, and vulnerable satellite settlements rather than continuous safe territory.
- Human states, cities, corporations, religions, and other factions remain powerful but divided. Their conflict and refusal to unite are central reasons beasts retain most territory.
- The world must be finite and enumerable enough for territorial control and world domination to have a real, testable meaning.
- Use stable semantic role keys for mechanics and separate generated instance IDs and display names. Existing systems must not depend on a particular generated proper name.
- Once a generated world is finalized, its canonical facts must not silently reroll. World-generation version changes create a new world rather than rewriting an existing one.
- Keep generation and simulation renderer-neutral. UI previews and maps are projections of authoritative saved state.
- Every implementation pass must include deterministic tests, save/load coverage for its new state, and at least one player-visible or mechanically consumed result.
- Helix Heresy is a roguelike. Ordinary play must be compelling when a run ends in the laboratory or local-power phase; the overwhelming majority of runs should end long before world domination.
- World domination is the rare ultimate accomplishment, not the expected length or balance target of an average run.
- Do not build individual population, dynasty, migration, tactical-war, or global pathfinding simulations until an approved mechanic needs them. Strategic simulation may remain aggregated while still producing causal history.

---

## 1. Execution Day, Physical Death, and Resurrection Handoff

Design and implement the physical process after capital custody reaches its existing `execution process due` boundary. Move the scientist through named staff, medical checks, final counsel and optional spiritual access, nullstone suppression, and the locked execution suite. Use the approved nullstone-assisted alchemical injection method as a staged physical process with interruptible steps. Only completed lethal physiology causes death and game over; a stay, commutation, disruption, escape, rescue, or physical survival can stop the process. On death, hand off to the general death/resurrection systems without duplicating their rules.

Questions for discussion:

- Which execution stages remain interruptible after the scientist enters the suite?

  Recommended answer: Preserve explicit boundaries for final identity check, restraint and suppression verification, line placement, reagent authorization, injection, and lethal physiological resolution; legal intervention can stop all pre-injection stages, while post-injection survival depends on physical treatment or resurrection.

- How should an existing resurrection anchor affect the result?

  Recommended answer: Let the execution create an ordinary physical death record, then allow the later resurrection system to consume it and the saved anchor state. Execution code should not grant special immunity or erase the body.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 2. Reusable Worlds, Random Names, and Run Separation

Design and implement the persistence boundary between reusable generated worlds and disposable roguelike runs.

Add a world library separate from run saves. Each world should have a stable ID, world seed, generation version, deterministic randomly generated name, World Theme, creation settings, canonical playable year, summary, and authoritative generated data. Each run should reference one world ID and have its own run ID, run seed, scenario, site, mutable world-state branch, and save lifecycle.

Questions for discussion:

- Should prior runs change a reused world?

  Recommended answer: No. Every run begins from the selected world's canonical generated state.

- Can several run saves reference one world?

  Recommended answer: Yes. They are independent branches and cannot observe or affect one another.

- Where should the playable year live?

  Recommended answer: Treat the end of generated history and its playable year as part of the world template.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 3. World Themes and Content Boundaries

Design and implement the data contract for two selectable World Themes: Madcap Heresy and Grim Heresy. Present the selection under the heading "Choose Your Heresy," save it as `worldTheme`, and use the internal values `madcap` and `grim`.

World Theme should guide world names, historical events, institutional behavior, descriptive language, discoveries, failures, campaign strategies, and victory narratives. Madcap Heresy does not mean consequence-free, and Grim Heresy should be more than swapping ordinary text for gore or profanity. Both themes should use the same core simulation wherever possible while enabling theme-specific content and a limited number of genuinely different strategic routes.

Questions for discussion:

- Is World Theme chosen for a world or for each run?

  Recommended answer: Choose it when generating the world and store it in the reusable world template.

- How should content leakage be prevented?

  Recommended answer: Require narrative definitions, history events, objectives, encounters, and endings to declare theme and content tags.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 4. Hex-Based World Generation Foundation and Strategic Map

Design and implement the smallest complete deterministic world that can be generated, randomly named, saved, selected, and viewed before a run begins. Represent its strategic geography with a finite hex grid, similar in role to RimWorld's world map, rather than square tiles. Establish stable world and region identities, axial or cube coordinates, world scale, land and water boundaries, neighboring and distance helpers, renderer-neutral diagnostics, and a player-visible preview. Generate the complete low-resolution world before play while leaving exact local maps lazy.

The hex representation should be the shared foundation for later biome regions, routes, settlements, city distance, candidate sites, beast territories, political territories, strategic travel, and campaign expansion.

The playable laboratory map remains its own physical square-tile map. The hex grid is for the strategic world layer and should not replace the lab map, surface parcel map, building maps, local tactical maps, or existing physical tile systems.

Questions for discussion:

- Should the strategic map be hex-based from the first worldgen pass?

  Recommended answer: Yes. Establish hex coordinates before geography, settlements, routes, candidate sites, and world domination rules depend on the strategic representation.

- Which coordinate system should be used?

  Recommended answer: Use a standard axial or cube-coordinate model internally, with helpers for neighbors, distance, rings, region grouping, and renderer projection.

- Should every hex represent the same physical size?

  Recommended answer: Yes for the first pass. Pick a coarse world scale and store it in world-generation metadata so city distance, travel time, route cost, and biome area can be interpreted consistently.

- How should routes work on a hex map?

  Recommended answer: Routes should be graph records anchored to hexes, not just decorative lines.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 5. Global Geography, Biomes, Terrain, and Resources

Design and implement coherent world-scale physical geography: elevation, oceans, coasts, mountains, drainage, rivers, climate tendencies, biome regions, broad geology, and resource distributions. Geography should constrain settlement, travel, trade, law, history, and site choice rather than being decorative noise.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 6. Settlements, Cities, Routes, and Candidate Sites

Design and implement major cities, vulnerable towns and villages, defended corridors, transport hubs, frontier sites, candidate laboratory parcels, and route networks. Candidate sites should know both straight-line distance and practical route access to their nearest settlement.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 7. Civilizations, Factions, Institutions, Religions, and Law

Design and implement the powers that inhabit, control, and contest the generated world: states, territorial control, relationships, factions, religious powers, commercial blocs, military forces, magitech traditions, and local institutional branches. Bind generated instances to stable semantic roles used by existing systems.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 8. Historical World Simulation and Playable Year

Design and implement a bounded pre-run history simulation that advances the generated world to its playable year. History should causally change settlements, borders, powers, religions, routes, laws, public attitudes, ruins, and regional conditions. Every retained event should change a saved fact, explain a current condition, or create a discoverable hook.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 9. New-Run World Selection, Site Choice, and Scenario Materialization

Design and implement starting a new independent run inside a selected reusable world. The player chooses an existing world or generates a new one, then chooses a starting scenario, biome, and city-distance band from compatible saved candidate sites. The chosen scenario materializes the physical site blueprint and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 10. Local Context Mechanics: Environment, Geology, and Travel

Design and implement the first mechanical consequences of selected world location: environmental baselines, exact geology inputs, water access, surface concealment, evidence persistence, waste risk, route reliability, legal-cover plausibility, visitor arrival windows, resource availability, and travel.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 11. Penal Legions and Wilderness Service

Design and implement penal-legion service as a distinct playable post-conviction path. Consume sentence, jurisdiction, military institution, world geography, settlement threats, routes, creature ecology, transport, equipment, squad, and laboratory-continuity state. The first mission should be a bounded physical operation rather than an abstract combat roll.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 12. World Integration: Economy and Logistics

Design and implement effects from generated geography, settlements, routes, resources, powers, laws, and history on lawful trade, black-market access, delivery, and off-site logistics. Preserve existing commodity exchange, contract, Loading Bay, and Concealed Exit flows while giving them specific world context.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 13. World Integration: Investigations and Institutional Pressure

Design and implement world-context effects on company plausibility, inspections, investigations, religious scrutiny, escalation, and authority response. Context may alter priorities, schedules, thresholds, and available actions, but must not invent player guilt.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 14. Lazy Local Detail and World Discovery

Design and implement deterministic elaboration of the already generated strategic world when a run encounters it. Lazy generation may fill minor places, institution branches, contacts, local histories, individuals, encounters, and exact maps while respecting canonical world facts and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 15. Roguelike Run Lifecycle, Death, Postmortem, and Restart

Design and implement the loop for beginning, losing, reviewing, and replacing a run without altering its reusable world. Only the scientist’s death ends a run; arrest, jail, prison, penal service, death sentence, loss of laboratory, and similar catastrophes remain playable while the scientist lives.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 16. Campaign Roadmap: From Hidden Laboratory to World Domination

Design the complete campaign progression against the generated strategic world, then implement only the campaign framework and first coherent playable phase. The final campaign goal is rare world domination, but early hidden-laboratory survival must remain a complete roguelike experience.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 17. New-Run Onboarding and Contextual Tutorial

Design and implement optional contextual guidance after world selection, site selection, and the early campaign loop are stable. Teach discovery, containment, map, task, research, company, economy, secrecy, and defeat/restart loops without turning the campaign into a rigid tutorial script.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 18. Sound, Notifications, and Accessibility Audit

Design and implement restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard coverage, screen-reader coverage, and a complete accessibility review. Treat sound as an additional cue rather than the only carrier of state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 19. Production Art Pass Using the Sprite Pipeline

Use the existing sprite manifest, loader, atlas workflow, semantic keys, and development sprites to establish and replace assets with a coherent first production-quality set, including title-screen key art. Preserve footprint anchors, transforms, renderer-neutral semantic keys, DOM glyph fallbacks, accessibility modes, and the approved visual language. Keep this prompt last because world generation and campaign work may introduce new visuals.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
