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

1. Historical World Simulation and Crisis Coalitions
2. Playable-Year Settlement and Route State
3. New-Run World Selection, Candidate Laboratory Sites, and Scenario Materialization
4. Local Context Mechanics: Environment, Geology, and Travel
5. Strategic Survey Operations and Resource Discovery
6. Penal Flights and Beast-Territory Exile
7. Penal Legions and Wilderness Service
8. World Integration: Economy and Logistics
9. World Integration: Investigations and Institutional Pressure
10. Lazy Local Detail and World Discovery
11. Roguelike Run Lifecycle, Death, Postmortem, and Restart
12. Campaign Roadmap: From Hidden Laboratory to World Domination
13. New-Run Onboarding and Contextual Tutorial
14. Sound, Notifications, and Accessibility Audit
15. Production Art Pass Using the Sprite Pipeline

## World and Run Guardrails

Apply these rules throughout the world-generation and campaign prompts:

- Follow a Dwarf Fortress-like structure: generate a named, finite world and its history before starting a run, then allow multiple new runs to use that same world.
- Each world has a saved theme. World Theme affects generation, history, available content, narration, and campaign possibilities; it is not a cosmetic toggle that can be switched halfway through a run.
- Authored content must explicitly declare `shared`, `madcap`, or `grim` compatibility and pass through the central selector. Madcap and Grim use their respective pool plus shared content; Unbound may use all three. Incompatible content must never leak through caller-side random selection.
- A world is a persistent reusable template. A run references that world but owns its laboratory, company, actors, discoveries, economy changes, authority state, territorial changes, and other mutable simulation state.
- Runs never write their laboratories, ruins, victories, disasters, creatures, or other outcomes back into the reusable world template. An ended lab must not appear on the world map or in the history of a later run.
- Starting another run in the same world creates an independent branch from the world's canonical generated state. It does not continue the prior run's timeline.
- Keep separate world and run seeds. The world seed controls reusable geography, names, city polities, non-state networks, and pre-run history; the run seed controls scenario materialization and run-specific outcomes.
- Generate the whole world at strategic resolution before play: major geography, regions, fortified cities, ruling authorities, broad networks, strategic routes, and historical state must be stable. Generate exact local tiles, minor places, individuals, and encounter detail only when needed.
- Treat advanced science and magic as one unevenly distributed technological landscape. Internet-like networks, aircraft, flying mounts, mechs, holographic systems, wards, and other magitech require physical infrastructure, energy, maintenance, access, and defended connections.
- Most land should be ecologically dominated or seriously contested by mutually hostile magical beasts. Represent territories, migration, threat, and broad populations strategically until a specific encounter needs individual creatures.
- Human control should form fortified city cores, nearby controlled approaches, intermittently supported intercity corridors, and vulnerable satellite settlements rather than continuous safe territory.
- States do not exist. Every sovereign anchor city is ruled by an individual or group without outside oversight. Joint route strongholds are the narrow exception: each is a politically dependent fortified settlement sponsored by exactly two sovereign cities, locally administered under a joint code, and incapable of independent diplomacy. Corporations, religions, military forces, research circles, and other networks may cross city lines, but they do not erase anchor-city sovereignty.
- Global internet communication is practical through an orbital satellite constellation with magical relay links; local gateways, power, mana, maintenance, and replacement launches remain necessary. Long-range and long-duration physical logistics are not practical, so worldwide contact creates neither reliable material support nor enforceable authority.
- Rocket spaceflight and orbital infrastructure exist. Rare sufficiently powerful individuals can also travel through space under their own physical, magical, or divine power. Both capabilities remain expensive, capacity-limited facts rather than effortless surface logistics.
- Permanent multi-city alliances are exceptional and unstable. Neighboring cities form event-specific coalitions when the same monster wave or other immediate crisis threatens them, then retain their separate sovereignty.
- Conquest does not merge cities into a durable state. Occupation, tribute, puppet rule, and imposed authorities may connect several cities temporarily, but each conquered city remains a distinct polity and a potential point of revolt or collapse.
- The world must be finite and enumerable enough for territorial control and world domination to have a real, testable meaning.
- The entire campaign world is a seamless geodesic globe. Strategic cells are mostly hexagons with exactly twelve pentagonal anchors; mechanics must use saved graph adjacency and spherical distance rather than assuming a flat axial grid or map-edge boundary.
- New worlds use the current complete generator rather than numbered generator milestones. Do not give implementation passes artificial milestone numbers. Existing technical save-compatibility fields may remain until a dedicated cleanup, and older records may honestly lack newer world facts.
- The current generator preserves causal layers: globe topology and surface, relief, climate, hydrology, biomes, geology, natural and magical hazards, arcane geography, hidden resources and public prospects, fortified cities, strategic intercity corridors, sovereign city polities, beast ecology, city governments, city law codes, directional cross-city recognition, objectively real finite gods, confirmed faith networks, city religious standing, divinely confirmed holy sites, commercial, research, military, transport, media, black-market, and standards networks, city founding purposes and powerful founders, joint route strongholds, dependent satellites, local logistics, and evacuation plans with separate public directories.
- Every city charter is supreme only within its own city jurisdiction. Core and controlled approaches may have continuous jurisdiction; corridor authority requires a specific facility, convoy, or agreement; wilderness has none; internet contact does not create extraterritorial police power.
- Every city government covers the same essential civic responsibilities through stable semantic roles, even when its organization chart combines compatible offices. Temporary jail custody and long-term prison or corrections authority must always remain distinct.
- Every city uses the shared semantic offense catalog but owns its legal status, authorization exceptions, public attitudes, procedure, and punishment policy. World Theme must not act as a legality, competence, or cruelty score.
- Criminal guilt requires proof beyond a reasonable doubt for every published element. Hidden enforcement policy may prioritize supported violations but cannot infer guilt, change the code, or fabricate evidence.
- Life imprisonment does not exist. Finite prison maxima range from three to ten years. Public execution requires a separate reviewed Public Enemy finding; Penal Flight is a distinct non-Public-Enemy condemnation and never means automatic death.
- Foreign warrants never execute themselves. Cross-city custody requires the receiving city's local judicial order, double criminality, supported evidence or a recognized conviction, acceptable punishment, and a feasible physical transfer. Deportation is not extradition; internet notice creates no physical authority; wilderness has no ordinary sovereign jurisdiction.
- Gods objectively exist, routinely communicate through repeatable signatures, and may manifest costly finite avatars. Each god confirms exactly one faith, so same-god doctrinal heresy and schism are not valid categories; different gods and their institutions may still compete, cooperate, or form non-sovereign pantheons.
- Every city publishes an independent standing for every faith or non-theistic movement. Global religious networks communicate over the internet, but physical branches remain locally bound and never override city sovereignty. Major holy sites are physical, causal, divinely confirmed strategic facts; private divine attention and concealed institutional integrity remain hidden from public projections.
- Every city publishes an independent standing for every major non-state network. Public physical branches and contracted assets remain city-local; networks never gain sovereign or automatic enforcement authority and never guarantee long-range delivery. Public records do not expose covert cells, actual capacity or integrity, private priorities, infiltration, or leverage.
- Founding a sovereign city requires extraordinary construction resources and one or more exceptionally powerful people. Most founding powers are chosen representatives, divinely invested champions, or other heroes affiliated with a real god. Almost every city exists to exploit primary and secondary resources; generation ensures all strategic resource families are exploited somewhere and establishes a bounded local endowment when market coverage otherwise lacks a strong source. A self-powered city founded specifically to escape gods and politics is an exceptionally rare support-network exemption.
- Every ordinary sovereign city has at least one physically feasible support partner. Long corridors use locally autonomous but politically dependent strongholds at bounded intervals. Exactly two endpoint cities jointly provide every stronghold's staffing and upkeep; neither has exclusive sovereignty, and no superior state enforces the compact.
- Arable land, exploitable resources, beast pressure, infrastructure, and route position causally determine farm villages, extraction camps, hunting outposts, utility stations, and service towns. Satellites have aggregate carrying capacity and initial population, short physical routes, finite storage, vehicle modes, imports and exports, and evacuation plans that guarantee neither survival nor city-gate admission. Exact added endowment, actual readiness, shortages, deception, and sponsor tension remain hidden.
- The natural beast catalog is a fixed authored list shared by every world. Every species must have at least one living population in every newly generated world; the world seed changes population count, abundance, territory, lairs, overlap, and knowledge rather than species identity.
- Migratory populations follow saved movement-compatible seasonal routes between habitat anchors. Sparse wave profiles require causal ecological, climate, hazard, or arcane facts; they are not assigned merely to give every city a current threat.
- Every sovereign anchor city remains physically attackable through saved land, coastal, or aerial approaches, but a city does not need to lie on a migration route or have a current recurring wave profile. Route strongholds and satellites remain vulnerable according to beast pressure at their actual saved cells.
- Canonical beast populations, lairs, migration paths, and wave causes remain separate from the uncertain public threat atlas. Ordinary UI must not infer exact ecological truth from public reports.
- Use stable semantic role keys for mechanics and separate generated instance IDs and display names. Existing systems must not depend on a particular generated proper name.
- Once a generated world is finalized, its canonical facts must not silently reroll. Generator changes affect newly created worlds rather than rewriting an existing saved world.
- Keep generation and simulation renderer-neutral. UI previews and maps are projections of authoritative saved state.
- Every implementation pass must include deterministic tests, save/load coverage for its new state, and at least one player-visible or mechanically consumed result.
- Helix Heresy is a roguelike. Ordinary play must be compelling when a run ends in the laboratory or local-power phase; the overwhelming majority of runs should end long before world domination.
- World domination is the rare ultimate accomplishment, not the expected length or balance target of an average run.
- Do not build individual population, dynasty, migration, tactical-war, or global pathfinding simulations until an approved mechanic needs them. Strategic simulation may remain aggregated while still producing causal history.

---

## 1. Historical World Simulation and Crisis Coalitions

Design and implement a bounded pre-run history simulation that advances the generated world to its playable year. History should causally change city authorities, settlements, occupations, tribute arrangements, religions, networks, routes, laws, public attitudes, ruins, ecological pressure, and regional conditions. Simulate temporary neighboring-city coalitions around shared monster waves or other concrete crises, with formation, contribution, dispute, outcome, and dissolution; do not turn them into permanent multi-city states. Every retained event must change a saved fact, explain a current condition, or create a discoverable hook.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 2. Playable-Year Settlement and Route State

Resolve retained history into the canonical conditions the player encounters at the playable year: settlement population and crowding bands, defenses, infrastructure, damage, abandonment or occupation, corridor condition, route loss, isolation, and public explanations. This pass should consume saved historical outcomes rather than rolling unexplained present-day conditions, and it must not begin simulating a run or write later run consequences back into the reusable world.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 3. New-Run World Selection, Candidate Laboratory Sites, and Scenario Materialization

Design and implement starting a new independent run inside a selected reusable world. Derive a bounded list of strategic candidate laboratory cells from the playable-year settlement, route, jurisdiction, utilities, legal-cover, secrecy, land-availability, and regional conditions; do not pre-generate thousands of exact parcel maps. The player chooses an existing world or generates a new one, then chooses a starting scenario, biome, and city-distance band from compatible candidates. Each candidate must know straight-line distance and practical route access to its nearest relevant settlement. The chosen candidate and scenario materialize the exact physical site blueprint and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 4. Local Context Mechanics: Environment, Geology, and Travel

Design and implement the first mechanical consequences of selected world location: environmental baselines, exact geology inputs, water access, surface concealment, evidence persistence, waste risk, route reliability, legal-cover plausibility, visitor arrival windows, resource availability, and travel.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 5. Strategic Survey Operations and Resource Discovery

Design and implement run-owned strategic resource knowledge after site selection and local travel exist. Begin each run with the world's public prospectivity but none of another run's private findings. Add physical survey and prospecting methods, equipment, travel, samples, confidence changes, bounded uncertainty, false negatives, and saved evidence provenance. Survey results may refine strategic estimates and feed authoritative resource context into lazy local maps, but exact veins, pockets, quality, and quantity remain hidden until an appropriate local method exposes them. The overlay must merge public and run-specific knowledge without reading canonical hidden endowment directly.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 6. Penal Flights and Beast-Territory Exile

Design and implement Penal Flight as the non-public-enemy capital punishment after generated beast territories, strategic intercity corridors, routes, and exact local travel exist. Penal Flight is wilderness banishment and presumed death, not a physical execution or automatic game over. The sentence completes only when the living scientist is released in the wild.

Use a saved seven-day dispatch docket. If the scientist is the only real condemned person scheduled in that window, assign a remotely guided one-person Solo Castoff Glider. If two to eight real condemned people are scheduled, assign a larger Mass Castoff Glider; split larger groups across multiple craft and never invent anonymous filler prisoners. Freeze the roster when the flight order is issued.

Both variants must physically move through a fortified penal-flight depot, restraint and suppression inspection, launch, remote flight beyond supported intercity corridors, landing, and release. The craft gathers reconnaissance and carries minimal survival tools, suppression collars, and tracking beacons, but provides no extraction. It lands rather than deliberately crashing. Every mass-flight passenger is a named persistent actor with crimes, skills, injuries, affiliations, and a relationship to the scientist; landing together does not make them allies.

Survivors remain playable and legally banished. Returning to protected human territory creates a new causal violation and physical response. Keep Penal Flight distinct from penal-legion service: legionaries receive command, equipment, objectives, logistics, and a possible lawful return, while castoffs receive none.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 7. Penal Legions and Wilderness Service

Design and implement penal-legion service as a distinct playable post-conviction path. Consume sentence, jurisdiction, military institution, world geography, settlement threats, routes, creature ecology, transport, equipment, squad, and laboratory-continuity state. The first mission should be a bounded physical operation rather than an abstract combat roll.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 8. World Integration: Economy and Logistics

Design and implement effects from generated geography, settlements, routes, resources, powers, laws, and history on lawful trade, black-market access, delivery, and off-site logistics. Preserve existing commodity exchange, contract, Loading Bay, and Concealed Exit flows while giving them specific world context.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 9. World Integration: Investigations and Institutional Pressure

Design and implement world-context effects on company plausibility, inspections, investigations, religious scrutiny, escalation, and authority response. Context may alter priorities, schedules, thresholds, and available actions, but must not invent player guilt.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 10. Lazy Local Detail and World Discovery

Design and implement deterministic elaboration of the already generated strategic world when a run encounters it. Lazy generation may fill minor places, institution branches, contacts, local histories, individuals, encounters, and exact maps while respecting canonical world facts and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 11. Roguelike Run Lifecycle, Death, Postmortem, and Restart

Design and implement the loop for beginning, losing, reviewing, and replacing a run without altering its reusable world. Only the scientist’s death ends a run; arrest, jail, prison, penal service, death sentence, loss of laboratory, and similar catastrophes remain playable while the scientist lives.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 12. Campaign Roadmap: From Hidden Laboratory to World Domination

Design the complete campaign progression against the generated strategic world, then implement only the campaign framework and first coherent playable phase. The final campaign goal is rare world domination, but early hidden-laboratory survival must remain a complete roguelike experience.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 13. New-Run Onboarding and Contextual Tutorial

Design and implement optional contextual guidance after world selection, site selection, and the early campaign loop are stable. Teach discovery, containment, map, task, research, company, economy, secrecy, and defeat/restart loops without turning the campaign into a rigid tutorial script.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 14. Sound, Notifications, and Accessibility Audit

Design and implement restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard coverage, screen-reader coverage, and a complete accessibility review. Treat sound as an additional cue rather than the only carrier of state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 15. Production Art Pass Using the Sprite Pipeline

Use the existing sprite manifest, loader, atlas workflow, semantic keys, and development sprites to establish and replace assets with a coherent first production-quality set, including title-screen key art. Preserve footprint anchors, transforms, renderer-neutral semantic keys, DOM glyph fallbacks, accessibility modes, and the approved visual language. Keep this prompt last because world generation and campaign work may introduce new visuals.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
