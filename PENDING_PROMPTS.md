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

1. Confirmed Religions, Public Tenets, and Pre-Civic Holy Sites
2. Pre-Urban Humanity, Pristine Beast Ecology, and Monster Faiths
3. The First City and Divine Rivalry
4. City Expansion, Secession, and Support-Network Formation
5. Civilizational Capabilities and Magitech Eras
6. Divine Conflict, Death, Descent, Ascension, and Religious Succession
7. Monster Waves, Network Collapse, and Crisis Coalitions
8. Political and Institutional History
9. Playable-Year Settlement and Route State
10. New-Run World Selection, Candidate Laboratory Sites, and Scenario Materialization
11. Local Context Mechanics: Environment, Geology, and Travel
12. Strategic Survey Operations and Resource Discovery
13. Penal Flights and Beast-Territory Exile
14. Penal Legions and Wilderness Service
15. World Integration: Economy and Logistics
16. World Integration: Investigations and Institutional Pressure
17. Lazy Local Detail and World Discovery
18. Roguelike Run Lifecycle, Death, Postmortem, and Restart
19. Campaign Roadmap: From Hidden Laboratory to World Domination
20. New-Run Onboarding and Contextual Tutorial
21. Sound, Notifications, and Accessibility Audit
22. Production Art Pass Using the Sprite Pipeline

## World and Run Guardrails

Apply these rules throughout the world-generation and campaign prompts:

- Follow a Dwarf Fortress-like structure: generate a named, finite world and its history before starting a run, then allow multiple new runs to use that same world.
- Begin relevant civilization history at Year 0 with the first enduring fortified city. Geography, resources, arcane conditions, hazards, gods, beasts, and dispersed pre-urban humans already exist; present-day cities, routes, institutions, and infrastructure must become historical outcomes rather than unexplained simultaneous facts.
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
- The current generator preserves causal layers: globe topology and surface, relief, climate, hydrology, biomes, geology, natural and magical hazards, arcane geography, hidden resources and public prospects, pre-civic canonical divinity, fortified cities, strategic intercity corridors, sovereign city polities, beast ecology, city governments, city law codes, directional cross-city recognition, confirmed faith networks, city religious standing, divinely confirmed holy sites, commercial, research, military, transport, media, black-market, and standards networks, city founding purposes and powerful founders, joint route strongholds, dependent satellites, local logistics, and evacuation plans with separate public directories.
- Every city charter is supreme only within its own city jurisdiction. Core and controlled approaches may have continuous jurisdiction; corridor authority requires a specific facility, convoy, or agreement; wilderness has none; internet contact does not create extraterritorial police power.
- Every city government covers the same essential civic responsibilities through stable semantic roles, even when its organization chart combines compatible offices. Temporary jail custody and long-term prison or corrections authority must always remain distinct.
- Every city uses the shared semantic offense catalog but owns its legal status, authorization exceptions, public attitudes, procedure, and punishment policy. World Theme must not act as a legality, competence, or cruelty score.
- Criminal guilt requires proof beyond a reasonable doubt for every published element. Hidden enforcement policy may prioritize supported violations but cannot infer guilt, change the code, or fabricate evidence.
- Life imprisonment does not exist. Finite prison maxima range from three to ten years. Public execution requires a separate reviewed Public Enemy finding; Penal Flight is a distinct non-Public-Enemy condemnation and never means automatic death.
- Foreign warrants never execute themselves. Cross-city custody requires the receiving city's local judicial order, double criminality, supported evidence or a recognized conviction, acceptable punishment, and a feasible physical transfer. Deportation is not extradition; internet notice creates no physical authority; wilderness has no ordinary sovereign jurisdiction.
- Gods objectively exist, routinely communicate through repeatable signatures, and may manifest costly finite avatars. Each living god confirms exactly one faith, so same-god doctrinal heresy and schism are not valid while direct correction continues. A dead god's last confirmed doctrine remains historical fact, but surviving institutions may develop unconfirmed successor traditions after divine replies cease.
- Gods extract power from faithful humans and beasts. Model an innate divine core, finite reserves and sustainable capacity, follower-derived income, and expenditures for communication, miracles, avatars, protection, city investment, and combat. Devotion, organization, ritual infrastructure, offerings, holy sites, and the god's receiving capacity matter in addition to follower count; exact reserves and attention remain hidden.
- Mere factual belief in an objectively proven god yields no meaningful power. Coerced ritual yields reduced but nonzero power. Losing every follower causes reversible descent rather than death: the former god loses active divinity but remains the same living, extraordinarily powerful individual. Life state, divinity state, and uncertain public status are separate facts.
- Gods vary independently by historically mutable major or minor status, follower capacity and organization, domains and objectives, investment willingness, and urban interest. Only a qualified minority responds to the first city's success by attempting first-era divine origin cities; a powerful chaotic god may reject city-building, while an exceptionally organized minor god may rarely succeed.
- Gods can force rivals into descent or kill them through causal combat, and humans or beasts can transcend mortal limits to become gods. Divine death is permanent by default: a victor may capture part of the victim's power, sites, infrastructure, or following but never automatically absorbs its identity or complete religion, and continued worship alone does not reconstruct the dead personality. Extraordinary humans and beasts may also force descent or kill gods at appropriate historical or campaign scales.
- The traditional nine-alignment grid may exist only as hidden authoring metadata. Ordinary mechanics must consume explicit tenets, commandments, prohibitions, objectives, acceptable methods, attitudes, and observed divine conduct. Never expose an alignment label to players or infer a concrete action from alignment alone.
- Every city publishes an independent standing for every faith or non-theistic movement. Global religious networks communicate over the internet, but physical branches remain locally bound and never override city sovereignty. Major holy sites are physical, causal, divinely confirmed strategic facts; private divine attention and concealed institutional integrity remain hidden from public projections.
- Every city publishes an independent standing for every major non-state network. Public physical branches and contracted assets remain city-local; networks never gain sovereign or automatic enforcement authority and never guarantee long-range delivery. Public records do not expose covert cells, actual capacity or integrity, private priorities, infiltration, or leverage.
- Founding a sovereign city requires extraordinary construction resources and one or more exceptionally powerful people. Most founding powers are chosen representatives, divinely invested champions, or other heroes affiliated with a real god. Almost every city exists to exploit primary and secondary resources; generation ensures all strategic resource families are exploited somewhere and establishes a bounded local endowment when market coverage otherwise lacks a strong source. A self-powered city founded specifically to escape gods and politics is an exceptionally rare support-network exemption.
- First-era divine origin cities begin in separate physical support components without intercity forts; the first city and other origin cities are historical bootstrap exceptions. Later ordinary foundations connect to a practical support component, and expansion may bridge previously disconnected components. A surviving ordinary city should have a feasible support partner by the playable year unless history records an explicit extraordinary exception.
- Founding lineage records demographic and material origin, never allegiance. A daughter city may arise from secession, exile, defeat, oppression, or direct factional hostility and becomes sovereign when viable. Founding lineage, resource dependency, support connectivity, stronghold responsibility, diplomacy, military hostility, and religion are separate relationships.
- Long corridors use locally autonomous but politically dependent strongholds at bounded intervals. Exactly two endpoint cities jointly provide every stronghold's staffing and upkeep; neither has exclusive sovereignty, and no superior state enforces the compact. Hostile cities may build and maintain a corridor for trade, evacuation, warning, or mutual survival without forming an alliance or ending their conflict.
- Connecting two support components never merges their founding lineages or creates a state, alliance, federation, common religion, or shared government. Oceans, distance, terrain, beasts, failed expansion, and destroyed frontier projects may leave multiple disconnected support components at the playable year despite global internet contact.
- Arable land, exploitable resources, beast pressure, infrastructure, and route position causally determine farm villages, extraction camps, hunting outposts, utility stations, and service towns. Satellites have aggregate carrying capacity and initial population, short physical routes, finite storage, vehicle modes, imports and exports, and evacuation plans that guarantee neither survival nor city-gate admission. Exact added endowment, actual readiness, shortages, deception, and sponsor tension remain hidden.
- The natural beast catalog is a fixed authored list shared by every world. Every species must have at least one living population in every newly generated world; the world seed changes population count, abundance, territory, lairs, overlap, and knowledge rather than species identity.
- Beast populations may worship gods through organized religion, sacred migrations, offerings, dominance structures, or instinctive divine bonds appropriate to their intelligence and social organization. Gods may have human followers, beast followers, or both; ascended beasts may become gods. Monster gods and holy sites can exist canonically without appearing in human public records until actually discovered.
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

## 1. Confirmed Religions, Public Tenets, and Pre-Civic Holy Sites

Refactor confirmed faith identity into a pre-civic layer while preserving later city-local standing and branch projections. Give each living god exactly one confirmed faith with player-facing core tenets, commandments, prohibitions, promises, acceptable methods, treatment of outsiders, civic and urban teachings, and verified conduct. Mechanics consume stable semantic facts rather than display prose or alignment. A dead god's last confirmed doctrine remains historical, but later unconfirmed successor traditions may disagree after routine correction ceases.

Generate holy sites before cities from arcane, geological, hydrological, terrain, and divine-domain causes so later settlement history can respond to them. Major gods usually have one or more major sites while minor gods may have one or none; routine communication does not require a strategic manifestation anchor. Separate global god and faith identity from later temples, city standing, adherent bands, and institutional networks, and never expose exact divine reserves or undiscovered monster gods through the public religion directory.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 2. Pre-Urban Humanity, Pristine Beast Ecology, and Monster Faiths

Establish compact strategic records for dispersed pre-urban humans and the ecology that exists before urban displacement. Humans already have agriculture, literacy, metalworking, established magic, religious communities, and mobile populations, but not the complete modern infrastructure. Generate beast populations and territories from physical and arcane habitat before applying city exclusion, corridor resistance, or human control; later history must cause those pressures and displacements.

Assign human and beast worship to real physical populations. Sapient or reasoning beasts may maintain doctrine, clergy, temples, relics, and organized worship, while other species may express sacred migrations, offerings, dominance structures, or instinctive divine bonds. A god may have human followers, beast followers, or both. Preserve canonical monster gods, ascended-beast possibilities, and beast holy sites even when human public knowledge has not discovered them; human-facing projections may show only supported reports.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 3. The First City and Divine Rivalry

Begin civilization history at Year 0 with the first successful enduring fortified city. Select its patron, exceptional founder or founding circle, population, material inputs, resource purpose, and site from pre-civic facts; divine aid may protect, teach, coordinate, or accelerate construction but never removes physical labor, food, population, or resource requirements.

The first city's success provokes jealousy and competition, but only a qualified minority of gods attempts first-era divine origin cities. Power alone is insufficient: follower organization, urban interest, investment willingness, geography, resources, and a viable founder all matter. Origin cities begin as separate physical support components without intercity forts or strongholds. Allow bounded failed attempts only when they leave a causal ruin or another retained consequence. Produce a player-visible origins chronology while keeping canonical motives and public accounts separate.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 4. City Expansion, Secession, and Support-Network Formation

Simulate later sovereign city foundations expanding from divine origin cities for resources, agriculture, crowding relief, strategic reach, exile, escape from oppression, political secession, defeat, or hostility between powerful groups. A daughter city records demographic and material lineage only and receives no automatic allegiance, alliance, tribute duty, jurisdiction, or religious loyalty. It may be hostile to its parent from foundation.

Construct practical corridors and jointly maintained route strongholds only after their endpoint cities and material prerequisites exist. Keep founding lineage, resource dependency, current support component, stronghold responsibility, diplomacy, military hostility, and religion as separate relationships. When frontier expansion places cities from different components within feasible support distance, create a bridge compact without creating peace or shared government. Hostile sponsors may use divided facilities, separate contingents, inspections, restricted passage, neutral local administration, or rotating command. Preserve disconnected support components where oceans, distance, terrain, beasts, or failed expansion prevent contact, and expose the resulting lineage and connectivity history to players without leaking hidden operational state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 5. Civilizational Capabilities and Magitech Eras

Advance the historically generated city networks through broad saved capability eras from established pre-urban magic and metalworking to industrial magitech, aircraft and flying-mount infrastructure, mechs and holographic systems, global data networks, rockets, the orbital-arcane internet, and rare individual spaceflight. Capabilities require causal institutions, resources, defended sites, power or mana, expertise, maintenance, and communication rather than isolated invention rolls or effortless global logistics.

Retain only milestones that enable or alter saved infrastructure, institutions, settlement functions, route capabilities, public knowledge, or later historical events. Different support components may reach or adopt capabilities through different histories, but every playable-year world must satisfy the setting's established modern and orbital baselines without pretending that worldwide communication creates worldwide material support.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 6. Divine Conflict, Death, Descent, Ascension, and Religious Succession

Simulate bounded divine history after mortal populations, faiths, cities, infrastructure, and capability eras exist. Gods may gain or lose worship, change between major and minor status, descend when worship vanishes, reascend after rebuilding their core and worship, contest holy sites, spend power through avatars or direct action, ally, fight, force rivals into descent, kill weaker gods, or be killed by extraordinary humans and beasts. Descent leaves the same extraordinarily powerful individual alive; only an actual killing causes permanent death. Resolve every conflict from saved reserves, income, innate capacity, domains, environmental affinity, sites, allies, preparation, surprise, and manifestation cost rather than a rank-only roll.

Generate rare human or beast ascensions only from physical, arcane, worship, identity, and survival prerequisites. Track divine remains, relics, captured power, follower redistribution, lost communication, dead-faith continuity, unconfirmed successor traditions, and claims of inheritance without recreating a dead identity or granting a victor the victim's complete religion. Retain only events that change a saved divine, religious, ecological, settlement, or institutional fact or create a discoverable hook.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 7. Monster Waves, Network Collapse, and Crisis Coalitions

Simulate bounded historical monster waves and other concrete ecological crises from canonical populations, migrations, hazards, and pressure. Apply causal consequences to cities, satellites, corridors, strongholds, ruins, ecological pressure, and support-component connectivity. A destroyed bridge city or route may split a formerly connected component.

Neighboring threatened cities may form temporary crisis coalitions with explicit formation, contribution, command, warning, dispute, outcome, debt, grievance, and dissolution. Physical support connectivity may enable cooperation but never implies friendship; hostile cities may cooperate against the same wave and resume conflict afterward. Do not create permanent alliances or multi-city states, and retain an event only when it changes a saved fact, explains a current condition, or creates a discoverable hook.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 8. Political and Institutional History

Advance city authorities, occupations, tribute arrangements, puppet rulers, revolts, religions, non-state networks, laws, public attitudes, and major institutions through the already generated physical and crisis history. Conquest never merges sovereign city identities into durable states. Founding lineage and support connectivity never determine allegiance, and same-god institutional conflict must not become a doctrinal heresy that the communicating god could simply correct.

Use aggregated institutions and strategically significant named actors rather than general population, dynasty, or tactical-war simulation. Every retained event must identify stable participants, location, prerequisites, causes, consequences, resulting saved facts, and any public account or discoverable contradiction.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 9. Playable-Year Settlement and Route State

Resolve retained history into the canonical conditions the player encounters at the playable year: surviving and ruined cities, founding lineages, current support components, settlement population and crowding bands, defenses, infrastructure, damage, abandonment or occupation, corridor and stronghold condition, route loss, isolation, and public explanations. Preserve multiple disconnected physical networks when history never connected them or later severed their bridges.

This pass must consume saved historical outcomes rather than rolling unexplained present-day conditions. It must produce at least one viable run-start region without erasing near-collapse worlds, must not begin simulating a run, and must never write later run consequences back into the reusable world.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 10. New-Run World Selection, Candidate Laboratory Sites, and Scenario Materialization

Design and implement starting a new independent run inside a selected reusable world. Derive a bounded list of strategic candidate laboratory cells from the playable-year settlement, route, jurisdiction, utilities, legal-cover, secrecy, land-availability, and regional conditions; do not pre-generate thousands of exact parcel maps. The player chooses an existing world or generates a new one, then chooses a starting scenario, biome, and city-distance band from compatible candidates. Each candidate must know straight-line distance and practical route access to its nearest relevant settlement. The chosen candidate and scenario materialize the exact physical site blueprint and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 11. Local Context Mechanics: Environment, Geology, and Travel

Design and implement the first mechanical consequences of selected world location: environmental baselines, exact geology inputs, water access, surface concealment, evidence persistence, waste risk, route reliability, legal-cover plausibility, visitor arrival windows, resource availability, and travel.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 12. Strategic Survey Operations and Resource Discovery

Design and implement run-owned strategic resource knowledge after site selection and local travel exist. Begin each run with the world's public prospectivity but none of another run's private findings. Add physical survey and prospecting methods, equipment, travel, samples, confidence changes, bounded uncertainty, false negatives, and saved evidence provenance. Survey results may refine strategic estimates and feed authoritative resource context into lazy local maps, but exact veins, pockets, quality, and quantity remain hidden until an appropriate local method exposes them. The overlay must merge public and run-specific knowledge without reading canonical hidden endowment directly.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 13. Penal Flights and Beast-Territory Exile

Design and implement Penal Flight as the non-public-enemy capital punishment after generated beast territories, strategic intercity corridors, routes, and exact local travel exist. Penal Flight is wilderness banishment and presumed death, not a physical execution or automatic game over. The sentence completes only when the living scientist is released in the wild.

Use a saved seven-day dispatch docket. If the scientist is the only real condemned person scheduled in that window, assign a remotely guided one-person Solo Castoff Glider. If two to eight real condemned people are scheduled, assign a larger Mass Castoff Glider; split larger groups across multiple craft and never invent anonymous filler prisoners. Freeze the roster when the flight order is issued.

Both variants must physically move through a fortified penal-flight depot, restraint and suppression inspection, launch, remote flight beyond supported intercity corridors, landing, and release. The craft gathers reconnaissance and carries minimal survival tools, suppression collars, and tracking beacons, but provides no extraction. It lands rather than deliberately crashing. Every mass-flight passenger is a named persistent actor with crimes, skills, injuries, affiliations, and a relationship to the scientist; landing together does not make them allies.

Survivors remain playable and legally banished. Returning to protected human territory creates a new causal violation and physical response. Keep Penal Flight distinct from penal-legion service: legionaries receive command, equipment, objectives, logistics, and a possible lawful return, while castoffs receive none.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 14. Penal Legions and Wilderness Service

Design and implement penal-legion service as a distinct playable post-conviction path. Consume sentence, jurisdiction, military institution, world geography, settlement threats, routes, creature ecology, transport, equipment, squad, and laboratory-continuity state. The first mission should be a bounded physical operation rather than an abstract combat roll.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 15. World Integration: Economy and Logistics

Design and implement effects from generated geography, settlements, routes, resources, powers, laws, and history on lawful trade, black-market access, delivery, and off-site logistics. Preserve existing commodity exchange, contract, Loading Bay, and Concealed Exit flows while giving them specific world context.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 16. World Integration: Investigations and Institutional Pressure

Design and implement world-context effects on company plausibility, inspections, investigations, religious scrutiny, escalation, and authority response. Context may alter priorities, schedules, thresholds, and available actions, but must not invent player guilt.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 17. Lazy Local Detail and World Discovery

Design and implement deterministic elaboration of the already generated strategic world when a run encounters it. Lazy generation may fill minor places, institution branches, contacts, local histories, individuals, encounters, and exact maps while respecting canonical world facts and run-specific state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 18. Roguelike Run Lifecycle, Death, Postmortem, and Restart

Design and implement the loop for beginning, losing, reviewing, and replacing a run without altering its reusable world. Only the scientist’s death ends a run; arrest, jail, prison, penal service, death sentence, loss of laboratory, and similar catastrophes remain playable while the scientist lives.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 19. Campaign Roadmap: From Hidden Laboratory to World Domination

Design the complete campaign progression against the generated strategic world, then implement only the campaign framework and first coherent playable phase. The final campaign goal is rare world domination, but early hidden-laboratory survival must remain a complete roguelike experience.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 20. New-Run Onboarding and Contextual Tutorial

Design and implement optional contextual guidance after world selection, site selection, and the early campaign loop are stable. Teach discovery, containment, map, task, research, company, economy, secrecy, and defeat/restart loops without turning the campaign into a rigid tutorial script.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 21. Sound, Notifications, and Accessibility Audit

Design and implement restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard coverage, screen-reader coverage, and a complete accessibility review. Treat sound as an additional cue rather than the only carrier of state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 22. Production Art Pass Using the Sprite Pipeline

Use the existing sprite manifest, loader, atlas workflow, semantic keys, and development sprites to establish and replace assets with a coherent first production-quality set, including title-screen key art. Preserve footprint anchors, transforms, renderer-neutral semantic keys, DOM glyph fallbacks, accessibility modes, and the approved visual language. Keep this prompt last because world generation and campaign work may introduce new visuals.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
