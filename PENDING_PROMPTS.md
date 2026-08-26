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

1. Civilizations, Factions, Institutions, Religions, and Law
2. Satellite Settlements, Transport Hubs, and Evacuation Networks
3. Historical World Simulation and Playable Year
4. Playable-Year Settlement and Route State
5. New-Run World Selection, Candidate Laboratory Sites, and Scenario Materialization
6. Local Context Mechanics: Environment, Geology, and Travel
7. Strategic Survey Operations and Resource Discovery
8. Penal Flights and Beast-Territory Exile
9. Penal Legions and Wilderness Service
10. World Integration: Economy and Logistics
11. World Integration: Investigations and Institutional Pressure
12. Lazy Local Detail and World Discovery
13. Roguelike Run Lifecycle, Death, Postmortem, and Restart
14. Campaign Roadmap: From Hidden Laboratory to World Domination
15. New-Run Onboarding and Contextual Tutorial
16. Sound, Notifications, and Accessibility Audit
17. Production Art Pass Using the Sprite Pipeline

## World and Run Guardrails

Apply these rules throughout the world-generation and campaign prompts:

- Follow a Dwarf Fortress-like structure: generate a named, finite world and its history before starting a run, then allow multiple new runs to use that same world.
- Each world has a saved theme. World Theme affects generation, history, available content, narration, and campaign possibilities; it is not a cosmetic toggle that can be switched halfway through a run.
- Authored content must explicitly declare `shared`, `madcap`, or `grim` compatibility and pass through the central selector. Madcap and Grim use their respective pool plus shared content; Unbound may use all three. Incompatible content must never leak through caller-side random selection.
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
- The entire campaign world is a seamless geodesic globe. Strategic cells are mostly hexagons with exactly twelve pentagonal anchors; mechanics must use saved graph adjacency and spherical distance rather than assuming a flat axial grid or map-edge boundary.
- Generation-version-three worlds preserve generation version two's canonical land/ocean mask and add compact saved tectonic plates, boundary forces, elevation, bathymetry, relief, and coast classifications. Surface, Elevation, and Tectonics are player-visible globe layers; older generation-version-two worlds retain their surface globe and honestly report that detailed relief is unavailable.
- Generation-version-four worlds add saved axial tilt, climate normals, circulation, ocean-current tendencies, conditioned drainage, watersheds, major lakes and rivers, wetlands, and terrestrial and marine biomes without changing generation version three's relief. Older generation-version-three worlds retain their relief layers and honestly report that climate, hydrology, and biomes are unavailable.
- Generation-version-five worlds add saved contiguous geological provinces, crust, bedrock, surface deposits, tectonic regimes, physical-property tendencies, and causal natural-hazard baselines without changing generation version four's environment. Older generation-version-four worlds retain their environment layers and honestly report that geology and natural hazards are unavailable.
- Generation-version-six worlds add saved mana concentration and flow, aspects, ley structures, natural null zones, arcane stability, and magical-hazard baselines without changing generation version five's geology. Older generation-version-five worlds retain their geology layers and honestly report that arcane geography and magical hazards are unavailable.
- Generation-version-seven worlds add hidden canonical resource endowment and separate knowledge-safe public prospectivity without changing generation version six's arcane geography. Older generation-version-six worlds retain their Arcane layer and honestly report that resource potential is unavailable.
- Generation-version-eight worlds add geography-driven fortified cities and land-only primary defended corridors without assigning faction ownership or rewriting generation version seven's resource geography. Older generation-version-seven worlds retain public Resource Prospects and honestly report that human geography is unavailable.
- Use stable semantic role keys for mechanics and separate generated instance IDs and display names. Existing systems must not depend on a particular generated proper name.
- Once a generated world is finalized, its canonical facts must not silently reroll. World-generation version changes create a new world rather than rewriting an existing one.
- Keep generation and simulation renderer-neutral. UI previews and maps are projections of authoritative saved state.
- Every implementation pass must include deterministic tests, save/load coverage for its new state, and at least one player-visible or mechanically consumed result.
- Helix Heresy is a roguelike. Ordinary play must be compelling when a run ends in the laboratory or local-power phase; the overwhelming majority of runs should end long before world domination.
- World domination is the rare ultimate accomplishment, not the expected length or balance target of an average run.
- Do not build individual population, dynasty, migration, tactical-war, or global pathfinding simulations until an approved mechanic needs them. Strategic simulation may remain aggregated while still producing causal history.

---

## 1. Civilizations, Factions, Institutions, Religions, and Law

Design and implement the powers that inhabit, control, and contest the generated world: states, territorial control, relationships, factions, religious powers, commercial blocs, military forces, magitech traditions, and local institutional branches. Let civilizations form around and contest the saved fortified-city and corridor network rather than rerolling its physical placement. Bind generated instances to stable semantic roles used by existing systems.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 2. Satellite Settlements, Transport Hubs, and Evacuation Networks

Design and implement vulnerable towns, villages, frontier outposts, agriculture and extraction satellites, transport hubs, secondary routes, and emergency evacuation dependencies after civilizations establish territorial and infrastructure capabilities. Satellite settlements should serve concrete economic or strategic functions, know their practical route and evacuation access to a fortified city, and remain sparse enough that most land is wilderness. Do not generate candidate laboratory parcels in this pass.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 3. Historical World Simulation and Playable Year

Design and implement a bounded pre-run history simulation that advances the generated world to its playable year. History should causally change settlements, borders, powers, religions, routes, laws, public attitudes, ruins, and regional conditions. Every retained event should change a saved fact, explain a current condition, or create a discoverable hook.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 4. Playable-Year Settlement and Route State

Resolve retained history into the canonical conditions the player encounters at the playable year: settlement population and crowding bands, defenses, infrastructure, damage, abandonment or occupation, corridor condition, route loss, isolation, and public explanations. This pass should consume saved historical outcomes rather than rolling unexplained present-day conditions, and it must not begin simulating a run or write later run consequences back into the reusable world.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 5. New-Run World Selection, Candidate Laboratory Sites, and Scenario Materialization

Design and implement starting a new independent run inside a selected reusable world. Derive a bounded list of strategic candidate laboratory cells from the playable-year settlement, route, jurisdiction, utilities, legal-cover, secrecy, land-availability, and regional conditions; do not pre-generate thousands of exact parcel maps. The player chooses an existing world or generates a new one, then chooses a starting scenario, biome, and city-distance band from compatible candidates. Each candidate must know straight-line distance and practical route access to its nearest relevant settlement. The chosen candidate and scenario materialize the exact physical site blueprint and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 6. Local Context Mechanics: Environment, Geology, and Travel

Design and implement the first mechanical consequences of selected world location: environmental baselines, exact geology inputs, water access, surface concealment, evidence persistence, waste risk, route reliability, legal-cover plausibility, visitor arrival windows, resource availability, and travel.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 7. Strategic Survey Operations and Resource Discovery

Design and implement run-owned strategic resource knowledge after site selection and local travel exist. Begin each run with the world's public prospectivity but none of another run's private findings. Add physical survey and prospecting methods, equipment, travel, samples, confidence changes, bounded uncertainty, false negatives, and saved evidence provenance. Survey results may refine strategic estimates and feed authoritative resource context into lazy local maps, but exact veins, pockets, quality, and quantity remain hidden until an appropriate local method exposes them. The overlay must merge public and run-specific knowledge without reading canonical hidden endowment directly.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 8. Penal Flights and Beast-Territory Exile

Design and implement Penal Flight as the non-public-enemy capital punishment after generated beast territories, defended corridors, routes, and exact local travel exist. Penal Flight is wilderness banishment and presumed death, not a physical execution or automatic game over. The sentence completes only when the living scientist is released in the wild.

Use a saved seven-day dispatch docket. If the scientist is the only real condemned person scheduled in that window, assign a remotely guided one-person Solo Castoff Glider. If two to eight real condemned people are scheduled, assign a larger Mass Castoff Glider; split larger groups across multiple craft and never invent anonymous filler prisoners. Freeze the roster when the flight order is issued.

Both variants must physically move through a fortified penal-flight depot, restraint and suppression inspection, launch, remote flight beyond defended corridors, landing, and release. The craft gathers reconnaissance and carries minimal survival tools, suppression collars, and tracking beacons, but provides no extraction. It lands rather than deliberately crashing. Every mass-flight passenger is a named persistent actor with crimes, skills, injuries, affiliations, and a relationship to the scientist; landing together does not make them allies.

Survivors remain playable and legally banished. Returning to protected human territory creates a new causal violation and physical response. Keep Penal Flight distinct from penal-legion service: legionaries receive command, equipment, objectives, logistics, and a possible lawful return, while castoffs receive none.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 9. Penal Legions and Wilderness Service

Design and implement penal-legion service as a distinct playable post-conviction path. Consume sentence, jurisdiction, military institution, world geography, settlement threats, routes, creature ecology, transport, equipment, squad, and laboratory-continuity state. The first mission should be a bounded physical operation rather than an abstract combat roll.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 10. World Integration: Economy and Logistics

Design and implement effects from generated geography, settlements, routes, resources, powers, laws, and history on lawful trade, black-market access, delivery, and off-site logistics. Preserve existing commodity exchange, contract, Loading Bay, and Concealed Exit flows while giving them specific world context.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 11. World Integration: Investigations and Institutional Pressure

Design and implement world-context effects on company plausibility, inspections, investigations, religious scrutiny, escalation, and authority response. Context may alter priorities, schedules, thresholds, and available actions, but must not invent player guilt.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 12. Lazy Local Detail and World Discovery

Design and implement deterministic elaboration of the already generated strategic world when a run encounters it. Lazy generation may fill minor places, institution branches, contacts, local histories, individuals, encounters, and exact maps while respecting canonical world facts and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 13. Roguelike Run Lifecycle, Death, Postmortem, and Restart

Design and implement the loop for beginning, losing, reviewing, and replacing a run without altering its reusable world. Only the scientist’s death ends a run; arrest, jail, prison, penal service, death sentence, loss of laboratory, and similar catastrophes remain playable while the scientist lives.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 14. Campaign Roadmap: From Hidden Laboratory to World Domination

Design the complete campaign progression against the generated strategic world, then implement only the campaign framework and first coherent playable phase. The final campaign goal is rare world domination, but early hidden-laboratory survival must remain a complete roguelike experience.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 15. New-Run Onboarding and Contextual Tutorial

Design and implement optional contextual guidance after world selection, site selection, and the early campaign loop are stable. Teach discovery, containment, map, task, research, company, economy, secrecy, and defeat/restart loops without turning the campaign into a rigid tutorial script.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 16. Sound, Notifications, and Accessibility Audit

Design and implement restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard coverage, screen-reader coverage, and a complete accessibility review. Treat sound as an additional cue rather than the only carrier of state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 17. Production Art Pass Using the Sprite Pipeline

Use the existing sprite manifest, loader, atlas workflow, semantic keys, and development sprites to establish and replace assets with a coherent first production-quality set, including title-screen key art. Preserve footprint anchors, transforms, renderer-neutral semantic keys, DOM glyph fallbacks, accessibility modes, and the approved visual language. Keep this prompt last because world generation and campaign work may introduce new visuals.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
