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

1. Discovery, Motions, and Trial Scheduling
2. Jail Escape and Outside Rescue
3. Trial and Sentencing
4. Prison Foundation and Long-Term Incarceration
5. Prison Breaks, Rescue, and Release
6. Death Row, Appeals, and Execution
7. Reusable Worlds, Random Names, and Run Separation
8. World Themes and Content Boundaries
9. World Generation Foundation and Strategic Map
10. Global Geography, Biomes, Terrain, and Resources
11. Settlements, Cities, Routes, and Candidate Sites
12. Civilizations, Factions, Institutions, Religions, and Law
13. Historical World Simulation and Playable Year
14. New-Run World Selection, Site Choice, and Scenario Materialization
15. Local Context Mechanics: Environment, Geology, and Travel
16. Penal Legions and Wilderness Service
17. World Integration: Economy and Logistics
18. World Integration: Investigations and Institutional Pressure
19. Lazy Local Detail and World Discovery
20. Roguelike Run Lifecycle, Death, Postmortem, and Restart
21. Campaign Roadmap: From Hidden Laboratory to World Domination
22. New-Run Onboarding and Contextual Tutorial
23. Sound, Notifications, and Accessibility Audit
24. Production Art Pass Using the Sprite Pipeline

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
- Human control should form fortified cities, defended corridors, and vulnerable satellite settlements rather than continuous safe territory. Cities need threat-appropriate defenses; towns and villages need warning, evacuation capacity, rapid transport readiness, and reachable refuge.
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

## 1. Discovery, Motions, and Trial Scheduling

Continue the implemented criminal case after charging, representation, privileged consultation, and first appearance. Add evidence discovery, admissibility and custody challenges, bounded defense claims, plea negotiation, custody reconsideration, and a scheduled trial. Consume the exact filed charges, cited support, warrant, raid, seizure, evidence, custody, counsel, release-condition, fugitive, and hearing histories already recorded. Legal outcomes must arise from disclosed evidence and saved procedural actions rather than a generic Suspicion check. Preserve jail and released defendants as physically different states; an escaped scientist remains a fugitive and does not secretly attend court.

Questions for discussion:

- What should discovery disclose?

  Recommended answer: Freeze a served discovery packet containing the prosecution's exact charge-support links, evidence summaries, seizure custody, disclosed witnesses, and known exculpatory material. Preserve undisclosed or privileged knowledge boundaries, deadlines, amendments, and the physical communication or records route used to reach the scientist and counsel.

- Which motions belong in the first pass?

  Recommended answer: Support motions to suppress evidence, dismiss an unsupported charge, compel missing discovery, and reconsider detention, bail, or release conditions. Each motion should cite exact records and save the judge's evidence, procedure, counsel, and narrow-discretion reasons.

- How should defense narratives and negotiation work?

  Recommended answer: Permit bounded factual claims tied to accessible records and testimony. Explicit lies are risky acts that can create contradictions or new charges. Plea offers may resolve supported charges or custody exposure, but cannot invent evidence, erase immutable history, or replace the later trial-and-sentencing system.

- Where should this pass end?

  Recommended answer: End with a saved trial schedule, remaining charges and admissible evidence, counsel preparation state, current custody or release terms, and any unresolved plea offer. Dismissal of every charge may lawfully release the scientist; any plea requiring sentencing should hand off to the separate Trial and Sentencing prompt.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 2. Jail Escape and Outside Rescue

Expand escape from the temporary local jail into a causal physical system and add outside attempts to free the scientist before or during trial. The existing holding-cell security-study escape is a provisional vertical slice to replace or extend. Rescue and escape must use actual jail locations, schedules, doors, security, communication, equipment, injuries, pursuit, and evidence. This prompt does not cover escape from a post-conviction prison; that is a separate later system.

Questions for discussion:

- Which freedom routes should be implemented first?

  Recommended answer: Support one self-engineered jail escape using observed routine and one ally-led extraction initiated through a communication or standing contingency. Add forceful assaults only after ordinary outside actors and the compact jail map can support them.

- How should allies decide whether to help?

  Recommended answer: Use saved loyalty, capability, risk tolerance, resources, communication, and the scientist's prior instructions. No ally should appear solely because an escape meter filled.

- What does failure mean?

  Recommended answer: Failed attempts can increase alert, restrict communication, injure or arrest participants, relocate the scientist, add evidence or charges, and delay proceedings. Failure remains playable unless the scientist dies.

- Should escape return directly to the old laboratory?

  Recommended answer: Only when a real route and safe reception exist. Otherwise place the scientist at the extraction endpoint or a hideout, mark fugitive status, and make returning to a watched or seized laboratory a deliberate risk.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 3. Trial and Sentencing

Design and implement trial resolution, verdicts, sentencing, and the resulting release or transfer order. Continue to consume the exact authority, evidence, jail, and legal record. The scientist remains in jail during trial and briefly after conviction while sentencing and transfer are completed. This pass ends when the scientist is released, placed under a noncustodial sentence, ordered transferred to prison, or ordered transferred to death row; it does not build either destination.

Questions for discussion:

- How should trial be resolved?

  Recommended answer: Resolve contested facts from admissible saved evidence, witnesses, credibility, counsel actions, and jurisdictional rules. Present the decisive causal chain and allow a bounded set of meaningful trial decisions rather than a single hidden roll.

- What verdicts and sentences should the first pass support?

  Recommended answer: Support acquittal, dismissed charges, time served, fines, probation or supervised release, a finite prison sentence, life imprisonment, penal-legion service, and a death sentence where jurisdiction and charges allow them. Fines and restrictions should connect to existing company and authority systems. Penal service creates a military commitment order for its separate wilderness system rather than behaving like prison.

- What happens immediately after conviction?

  Recommended answer: Preserve a short saved jail-to-destination transfer window. An ordinary custodial sentence creates a prison commitment order, penal service creates a military-custody commitment, and a death sentence creates a distinct death-row commitment and provisional execution process. None of these orders ends the run.

- Does a death sentence end the run?

  Recommended answer: No. Sentencing is a legal state, not physical death. The scientist remains alive through transfer, death row, appeals, commutation attempts, rescue, and escape opportunities; only an execution that actually kills the scientist ends the run.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 4. Prison Foundation and Long-Term Incarceration

Design and implement prison as a distinct post-conviction system for finite and life custodial sentences. Prison is a large long-term institution, not an enlarged jail. It should materialize as its own physical site with multiple security zones, a persistent population, staff, routines, relationships, work or program assignments, communication, discipline, transfers, health risks, and outside developments. The scientist's laboratory and campaign state continue while the scientist is imprisoned.

Questions for discussion:

- How much prison should the first pass materialize?

  Recommended answer: Build one coherent playable housing unit plus intake, visitation or communication, medical, work or program, exercise, and staff-controlled circulation areas. Save the larger institution strategically and expand exact local detail only when a mechanic needs it.

- How should prison differ mechanically from jail?

  Recommended answer: Jail emphasizes temporary legal custody and fast hearings. Prison emphasizes months or years, stable populations and factions, long-term relationships, institutional routines, work and programs, discipline, transfers, and time compression between meaningful events.

- How should long sentences remain playable?

  Recommended answer: Let the player advance through selectable routine intervals interrupted by meaningful events, communications, health changes, conflicts, opportunities, outside developments, and sentence milestones. Do not require watching empty real-time days.

- Can loss of the laboratory or life imprisonment end the run?

  Recommended answer: No. Those are severe changes in campaign position. The run remains active while the scientist lives, even when recovery requires long-term legal, social, physical, or outside intervention.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 5. Prison Breaks, Rescue, and Release

Design and implement the ways a scientist can leave an ordinary post-conviction prison: sentence completion, parole or commutation where supported, lawful transfer, self-engineered escape, and outside rescue. Consume the prison's actual routines, relationships, security zones, communications, equipment, staff, population, and outside actors rather than reusing the compact jail-escape rules.

Questions for discussion:

- Which exits should be implemented first?

  Recommended answer: Support sentence completion, one earned or negotiated early-release route, one physical self-escape plan, and one outside-assisted extraction. Preserve distinct preparation, eligibility, route, and consequence records for each.

- How should a prison break differ from a jail escape?

  Recommended answer: Require longer preparation across multiple security layers, relationships, tools, schedules, and an outside destination. Prison alert and lockdown should adapt to discovered preparations, while jail escape remains smaller and more immediate.

- What does failure mean?

  Recommended answer: Failure may cause injury, segregation, lost privileges, new charges, a longer sentence, transfer to higher security, or harm to allies. It remains playable unless the scientist dies.

- Where does a successful escape end?

  Recommended answer: At a physically reached extraction endpoint, hideout, or outside route. Returning to the laboratory is a separate journey and may be extremely dangerous if the site is watched, occupied, or seized.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 6. Death Row, Appeals, and Execution

Design and implement death row as a distinct post-sentencing system rather than an ordinary prison term. A death sentence creates a secure custody location, execution date and method, appeal and commutation deadlines, restrictions, staff and outside contacts, and possible rescue or escape opportunities. The sentence itself is never a game-over event.

Questions for discussion:

- When does an execution become scheduled?

  Recommended answer: Create a disclosed provisional date at sentencing, then allow jurisdictional review, appeals, stays, and commutation attempts to change it through saved causal decisions. Do not use a surprise hidden countdown.

- What can prevent execution?

  Recommended answer: Successful appeal, sentence commutation, lawful intervention, self-escape, outside rescue, or a physical disruption of the execution process. Every route should consume actual legal records, relationships, resources, communication, or physical access.

- When does the run end?

  Recommended answer: Only when an execution is physically completed and reduces the living scientist to death, or the scientist dies from another cause. Failed appeals, a final warrant, transfer to the execution chamber, and preparation for execution remain playable states.

- Should execution be abstracted?

  Recommended answer: Preserve a physical, interruptible sequence with staff, restraints, location, timing, and cause of death, while allowing the player to accelerate uneventful waiting between meaningful deadlines.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 7. Reusable Worlds, Random Names, and Run Separation

Design and implement the persistence boundary between reusable generated worlds and disposable roguelike runs.

Add a world library separate from run saves. Each world should have a stable ID, world seed, generation version, deterministic randomly generated name, World Theme, creation settings, canonical playable year, summary, and authoritative generated data. Each run should reference one world ID and have its own run ID, run seed, scenario, site, mutable world-state branch, and save lifecycle.

Questions for discussion:

- Should prior runs change a reused world?

  Recommended answer: No. Every run begins from the selected world's canonical generated state. Prior laboratories and their consequences exist only in their own run save or postmortem record and never appear on the reusable world map.

- How should world names work?

  Recommended answer: Generate a deterministic fantasy world name from the world seed. Allow cycling generated alternatives before finalizing the world, but do not require player naming.

- Can several run saves reference one world?

  Recommended answer: Yes. They are independent branches and cannot observe or affect one another. Deleting or ending one run must not delete its world or other runs.

- Where should the playable year live?

  Recommended answer: Treat the end of generated history and its playable year as part of the world template. Reusing a world begins from that same canonical date. Supporting several historical start snapshots can be a later feature if needed.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 8. World Themes and Content Boundaries

Design and implement the data contract for two selectable World Themes: Madcap Heresy and Grim Heresy. Present the selection under the heading "Choose Your Heresy," save it as `worldTheme`, and use the internal values `madcap` and `grim`.

World Theme should guide world names, historical events, institutional behavior, descriptive language, discoveries, failures, campaign strategies, and victory narratives. Madcap Heresy does not mean consequence-free, and Grim Heresy should be more than swapping ordinary text for gore or profanity. Both themes should use the same core simulation wherever possible while enabling theme-specific content and a limited number of genuinely different strategic routes.

Madcap Heresy examples may include absurd biotech, flamboyant rivals, affectionate created societies, slapstick institutional problems, and a world-unification victory based on engineering catgirls and bringing the world together under catgirl cuteness. Grim Heresy may include slavery, torture, genocide, war crimes, forced experimentation, terror, brutal conquest, and destructive conflict with states and gods.

Questions for discussion:

- Is World Theme chosen for a world or for each run?

  Recommended answer: Choose it when generating the world and store it in the reusable world template. Every run in that world inherits the same theme because its history, factions, laws, and possible campaign arcs were generated under that contract.

- How different should the mechanics be?

  Recommended answer: Share foundational systems such as genetics, economy, evidence, territory, influence, and conflict. Give each theme distinct event pools, presentation, AI priorities, milestone interpretations, and some exclusive methods or victory expressions rather than maintaining two unrelated games.

- Should Grim Heresy automatically enable every severe subject?

  Recommended answer: No. Show a clear content summary at world creation and support independent exclusions for especially severe categories where practical. World Theme sets the default content pool; explicit exclusions further filter it.

- How should content leakage be prevented?

  Recommended answer: Require narrative definitions, history events, objectives, encounters, and endings to declare theme and content tags. Validate generated selections against the world's theme and exclusions, with neutral content allowed in both themes.

- Can World Theme be changed after world generation?

  Recommended answer: No. Generate a new world to change theme. Editing an existing world's theme would invalidate its name, history, institutions, and causal state.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 9. World Generation Foundation and Strategic Map

Design and implement the smallest complete, deterministic world that can be generated, named, saved, selected, and viewed before a run begins.

The first implementation should create a finite strategic grid or region graph, land and water boundaries, stable region identities, a world center and scale, generation diagnostics, and a simple player-visible world preview. It should establish generator stages, stable IDs, fact provenance, versioning, and deterministic stage-specific random streams so later additions do not unnecessarily reroll unrelated facts.

Questions for discussion:

- Should generation begin with a complete world or only the starting region?

  Recommended answer: Generate the complete world at low strategic resolution. This is necessary for reusable named worlds and eventual conquest. Exact local maps and minor details remain lazy.

- Should the strategic representation use tiles, regions, nodes, or a hybrid?

  Recommended answer: Use a hybrid. Coarse cells describe continuous geography and biome; region, settlement, power, and route records form graphs; the playable laboratory remains an exact tile map.

- What must the first preview show?

  Recommended answer: Show the generated world name, World Theme, seed, playable year, land and water shape, broad region boundaries, generation summary, content notice, and controls to accept or discard the candidate world.

- How should generation changes affect saved worlds?

  Recommended answer: Store a generation version and the finalized facts. Never regenerate an accepted world on load using newer code.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 10. Global Geography, Biomes, Terrain, and Resources

Design and implement coherent world-scale physical geography.

Generate elevation, oceans and coasts, mountains, drainage and major rivers, climate tendencies, biome regions, broad geology, and resource distributions. Geography should constrain later settlement, travel, trade, law, and history rather than being decorative noise. The initial biome set should emphasize mechanically distinct starts, including desert, forest, swamp, mountain, coast, grassland, tundra, and badlands where world conditions support them.

Questions for discussion:

- How detailed should the global terrain be?

  Recommended answer: Use coarse strategic cells with stable continuous fields and derived regions. Do not generate laboratory-scale terrain tiles for the entire world.

- Should all worlds contain every biome?

  Recommended answer: No. World settings and the generated climate should determine available biomes. The world-creation preview must disclose biome availability before acceptance.

- How should global geology connect to existing excavation geology?

  Recommended answer: Save regional geology families and resource tendencies. The existing seeded geology field should derive exact underground cells from the selected site plus those constraints.

- Which world settings belong in the first pass?

  Recommended answer: Begin with world size, climate profile, and history length/playable year, with sensible defaults. Add fine-grained erosion, rainfall, mineral abundance, and similar controls only after their mechanics exist.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 11. Settlements, Cities, Routes, and Candidate Sites

Design and implement the inhabited and connected layer of the generated world.

Generate major settlements and cities in geographically plausible places, connect them with broad land, river, sea, and air routes, and identify candidate laboratory parcels across the world. Human settlement should be concentrated in heavily fortified cities and vulnerable satellite towns or villages surrounded by beast-dominated or contested land. City and site records may include names, population bands, economic roles, route access, water access, public visibility, concealment, freight access, geology hints, fortification, refuge capacity, threat profile, warning coverage, evacuation transport, and compatible distance bands.

Questions for discussion:

- How many settlements need full detail at world creation?

  Recommended answer: Generate stable locations, names, population bands, roles, controlling-power links, fortification bands, recurring beast threats, and evacuation relationships for major settlements. Defer neighborhoods, residents, and exact maps until a run needs them.

- How should a nearest city be determined?

  Recommended answer: Use the saved strategic route graph, not straight-line distance alone. A candidate site should know both physical distance and practical travel access to its actual nearest settlement.

- Should world generation create the Chemistry Front building?

  Recommended answer: No. It creates candidate parcels and context. The chosen starting scenario materializes its authored surface and underground blueprint only after a run begins.

- How should towns and villages survive outside city walls?

  Recommended answer: Give each a saved warning network, delay defenses, evacuation capacity, assigned rapid vehicles or flying mounts, refuge destination, and route. They may fail, become isolated, or be destroyed when threat timing exceeds those real capabilities.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 12. Civilizations, Factions, Institutions, Religions, and Law

Design and implement the powers that inhabit, control, and contest the generated world.

Generate civilizations or states, territorial control, relationships, major non-state factions, religious powers, commercial blocs, military forces, magitech traditions, and local institutional branches. Humanity is powerful enough to contest the beasts but remains divided by politics, religion, class, commerce, historical grievance, and war. Local roles may include city government, commercial registry, environmental/public-health authority, law enforcement, licensed waste carriers, black-market intermediaries, trade guilds, religious authorities, city defense commands, and penal-legion commands.

Questions for discussion:

- How should generated institutions connect to existing systems?

  Recommended answer: Bind generated instances to stable semantic roles. Existing rules continue to ask for roles such as commercial registry or environmental health, while records and UI cite the generated local entity.

- How deep should religions be initially?

  Recommended answer: Generate doctrines, spheres, influence, relationships, and attitudes toward artificial life, animancy, and forbidden research. Defer individual worshippers and divine intervention until campaign systems consume them.

- How should law work?

  Recommended answer: Generate enforceable policy profiles by jurisdiction and era with visible summaries and provenance, including whether penal military service and capital punishment are lawful. Add individual statutes only when inquiries, market restrictions, sentencing, or campaign events can cite them.

- How should technology vary between powers?

  Recommended answer: Share an advanced global baseline while giving powers saved strengths, dependencies, doctrines, and access across mechanical, arcane, biological, animantic, divine, aerial, network, and creature-mounted technologies. Variation should change equipment, infrastructure, defenses, logistics, and strategy rather than simply assigning a higher technology number.

- What strategic state is needed for eventual domination?

  Recommended answer: Save territory ownership, alliances and hostility, institutional reach, religious influence, and broad power projection. Exact victory thresholds belong to the campaign discussion.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 13. Historical World Simulation and Playable Year

Design and implement a bounded pre-run history simulation that advances the generated world to its playable year.

History should change settlements, borders, powers, religions, routes, laws, public attitudes, ruins, and regional conditions through causal events rather than attaching unrelated flavor paragraphs. Candidate events include founding, expansion, war, schism, plague, monster outbreaks, mining booms, alchemical disasters, forbidden-research scandals, registry reforms, environmental disasters, political turnover, and trade-route changes. Event selection and presentation must obey the world's theme and content exclusions while preserving coherent causes and consequences.

Questions for discussion:

- Should history be generated as independent templates or simulated over time?

  Recommended answer: Use an event-driven strategic simulation over bounded time steps. Actors pursue broad pressures and produce causally linked events; do not simulate every individual or battle.

- How is the playable year chosen?

  Recommended answer: Let world-creation settings choose a target year or history length. Simulation advances to that date, and the finalized world reuses that canonical starting state for every run.

- What history should the player see?

  Recommended answer: World creation shows a concise public chronology and current map. Runs begin with only broadly public facts; obscure details require records, rumors, contacts, research, or institutional disclosures.

- Must history produce mechanical consequences?

  Recommended answer: Yes. Every retained event should change a saved world fact, explain a current condition, or create a discoverable hook. Do not generate bulk chronology without consequences.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 14. New-Run World Selection, Site Choice, and Scenario Materialization

Design and implement starting a new independent run inside a selected reusable world.

The player should first choose an existing world or generate a new one, then choose a starting scenario, biome, and distance from a city. Biome and distance choices select among compatible saved candidate sites; they do not reshape or reroll the world. Once selected, the scenario materializes its physical site blueprint, company identity, loadout, liabilities, and run-specific state at that parcel.

Questions for discussion:

- How should biome selection work when a world lacks that biome?

  Recommended answer: Show only available choices and their candidate counts. Never silently alter the accepted world to satisfy a run choice.

- How should city distance work?

  Recommended answer: Use readable bands—adjacent, close, near, remote, and isolated—derived from saved route travel. Preview broad logistics, market, and authority-response consequences.

- Can a new run choose a site used by an older run?

  Recommended answer: Yes, because runs are independent branches. The older lab never existed in the new run's world state.

- What identifies a run?

  Recommended answer: Save a unique run ID and run seed plus the referenced immutable world ID, generated site ID, scenario revision, and materialized starting facts.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 15. Local Context Mechanics: Environment, Geology, and Travel

Design and implement the first mechanical consequences of the selected world location.

Local context should influence environmental baselines, exact geology inputs, water access, surface concealment, evidence persistence, waste risk, route reliability, legal-cover plausibility, visitor arrival windows, resource availability, and travel. It should modify existing systems through explicit contextual inputs rather than duplicating their simulations.

Questions for discussion:

- Which effects should become mechanical first?

  Recommended answer: Environmental baselines, regional geology constraints, supply access, freight delay, visitor response time, surface visibility, and resource tendencies. Defer detailed weather and seasons.

- How transparent should location difficulty be?

  Recommended answer: Show qualitative advantages and pressures during site selection and in Records. Hidden exact modifiers are acceptable, but no location should surprise the player with an unrelated penalty.

- Does travel require an off-site tactical map?

  Recommended answer: No. Begin with route-based time, reliability, capacity, and risk. Generate exact off-site maps only for later approved encounters or expeditions.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 16. Penal Legions and Wilderness Service

Design and implement penal-legion service as a distinct playable post-conviction path after the strategic world, local travel, and wilderness context exist. A scientist sentenced to penal service remains under military custody but deploys beyond fortified civilization against magical beasts. Consume the saved sentence, jurisdiction, military institution, world geography, settlement threats, routes, creature ecology, transport, equipment, squad, and laboratory-continuity state rather than treating service as a sequence of unrelated combat rolls.

The first legion should be a bounded physical unit, not an entire individual-level national army. Save its command structure, sentenced and regular personnel, transport, supplies, orders, deployment site, mission, casualties, discipline, service-credit rules, communications, and extraction conditions. Missions may include patrol, route clearing, monster extermination, settlement evacuation, recovery, reconnaissance, or a desperate holding action. Service can lead to release, transfer, extended punishment, public recognition, desertion, rescue, or death.

Questions for discussion:

- Is penal service equivalent to a death sentence?

  Recommended answer: No. It is dangerous coercive military punishment with a real completion or release route. Some Grim jurisdictions may deliberately assign near-suicidal operations, but the sentence itself never ends the run and its lethality must arise from the actual mission.

- What should the first playable mission be?

  Recommended answer: Defend and evacuate a vulnerable town after a beast warning. This exercises rapid transport, fortified-city refuge, military custody, civilians, route timing, hostile creatures, retreat, and a meaningful success condition other than killing everything.

- How much control does the player have?

  Recommended answer: Direct the scientist's physical actions and any authority legitimately granted by rank or circumstance. Orders from named commanders constrain movement and objectives; disobedience, persuasion, exceptional performance, desertion, and emergency initiative remain possible with saved consequences.

- How does service end?

  Recommended answer: Use transparent jurisdiction-specific terms such as elapsed service, completed operations, earned credit, pardon, medical discharge, transfer, or political intervention. Escape and rescue remain physical alternatives, while mission failure may add punishment without silently becoming game over.

- What happens to the laboratory?

  Recommended answer: It continues under the same knowledge and communication limits used for jail and prison. Deployment distance, military censorship, route disruption, and beast attacks may make reports even slower or prevent contact entirely.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 17. World Integration: Economy and Logistics

Design and implement effects from generated geography, settlements, routes, resources, powers, laws, and history on lawful trade, black-market access, delivery, and off-site logistics.

This pass should preserve the existing commodity exchange, contract, Loading Bay, and Concealed Exit flows while giving their initial conditions and events a specific world context.

Questions for discussion:

- Which integrations should ship first?

  Recommended answer: Raw-material availability, lawful market baselines, delivery timing, black-market contact origins, pickup timing, route disruptions, tariffs, and jurisdictional restrictions.

- Should generated context directly control prices?

  Recommended answer: Set bounded starting baselines and shock tendencies, then let the existing saved supply-and-demand market evolve within the run.

- How should the player understand differences?

  Recommended answer: Cite relevant causes in market and logistics UI, such as coastal trade access, an isolated route, a regional shortage, war damage, or a guild restriction, without exposing hidden formulas.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 18. World Integration: Investigations and Institutional Pressure

Design and implement world-context effects on company plausibility, inspections, investigations, religious scrutiny, escalation, and authority response.

Generated institutions, jurisdictions, laws, travel times, religious attitudes, histories, and political relationships should make the existing evidence-to-consequence chain specific to the selected world and site. Context may alter priorities, schedules, thresholds, and available actions, but it must not invent player guilt.

Questions for discussion:

- Which integrations should ship first?

  Recommended answer: Generated institution identities, jurisdiction, inspection cadence, arrival timing, cover-company plausibility, local policy profiles, and religious scrutiny of animancy-related evidence.

- Can world context create evidence by itself?

  Recommended answer: No. It can create scrutiny, reporting opportunities, or lower tolerance, but consequences still require saved actions, evidence, reports, findings, obstruction, or missed obligations.

- Should harsh worlds merely increase hidden difficulty?

  Recommended answer: No. Pressure should come from named institutions, known rules, routes, and history. Show qualitative reasons and preserve strategies that can mitigate disadvantages.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 19. Lazy Local Detail and World Discovery

Design and implement deterministic elaboration of the already generated strategic world when a run encounters it.

The world's major geography, powers, settlements, routes, and history already exist. Lazy generation fills in minor places, institution branches, contacts, local histories, individuals, encounters, and exact maps when a mechanic needs them. New details must respect all canonical world facts and the current run's independent state.

Questions for discussion:

- What may be generated lazily?

  Recommended answer: Detail below the world's strategic resolution. Never lazily invent a new continent, major civilization, or contradictory capital after world finalization.

- Where are generated details saved?

  Recommended answer: Save canonical elaborations that merely reveal the world's baseline in a world detail cache; save details caused by player actions only in that run. If clean separation is difficult, prefer keeping all elaboration run-local.

- How should contradictions be prevented?

  Recommended answer: Derive candidates from the world seed plus stable parent IDs, validate against saved constraints, and commit accepted facts before showing them.

- What should the player see?

  Recommended answer: Reveal places and facts through discovery, records, rumors, trade, travel, or campaign contact rather than presenting perfect omniscience at run start.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 20. Roguelike Run Lifecycle, Death, Postmortem, and Restart

Design and implement the complete loop for beginning, losing, reviewing, and replacing a run without altering its reusable world.

Most runs should end during laboratory survival or early local conflict. Death should be common enough to define the game, but fair enough that the player can identify the decisions, risks, and causal chain that ended the run. Arrest, temporary jail custody, conviction, a prison sentence, life imprisonment, penal-legion service, a death sentence, loss of the laboratory, and other severe setbacks remain playable while the scientist lives. A postmortem may preserve a read-only summary outside the world simulation; it must not add the old laboratory to future world maps or histories.

Questions for discussion:

- What ends a run?

  Recommended answer: Only the scientist's death. Arrest, jail, prison, penal military service, a death sentence awaiting execution, destruction or seizure of every power base, and similar catastrophes must change the playable situation rather than silently become defeat screens.

- How should saving work in a roguelike?

  Recommended answer: Use automatic and manual continuation saves during an active run, but mark a dead run complete so it cannot simply resume from after death. Decide strict ironman and backup behavior separately before deleting or overwriting any save data.

- What belongs in the postmortem?

  Recommended answer: World name, run seed, site and scenario, elapsed time, discoveries, created lineages, campaign phase, major decisions, evidence chain, cause of death, major setbacks survived, and highest achieved milestones.

- What happens next?

  Recommended answer: Offer a new run in the same world, a run in another saved world, or world generation. Reusing the world begins from its canonical state with no prior lab.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 21. Campaign Roadmap: From Hidden Laboratory to World Domination

Design the complete campaign progression against the generated strategic world, then implement only the campaign framework and first coherent playable phase. Add separate pending prompts for later phases identified during discussion rather than attempting the entire conquest arc in one implementation.

The final campaign goal is world domination, but reaching it should be extraordinarily rare. The progression should connect hidden-laboratory survival to local power, territorial expansion through beast-dominated regions, conflict with fortified cities, states, and religions, intelligent created societies, apotheosis, divine conflict, and eventual global control. The early game must remain a complete roguelike experience rather than a prologue balanced around an endgame most runs will never see.

World Theme changes the routes and meaning of domination. A Madcap Heresy campaign might unite the world through engineered catgirls, cultural enthusiasm, absurd diplomacy, or benevolent created societies under the banner of catgirl cuteness. A Grim Heresy campaign may reach control through enslavement, torture, genocide, war crimes, forced transformation, terror, conquest, or similarly brutal methods. Neutral strategies may exist in either theme, but victory text and event framing must honor the selected world.

Questions for discussion:

- What should the campaign phases be?

  Recommended answer: Hidden Laboratory, Local Power, Regional Expansion, Rival Sovereignty, Divine Conflict, and World Domination. Treat them as overlapping progression bands rather than hard chapter locks.

- What should the first implementation include?

  Recommended answer: Build a data-driven milestone framework and the Hidden Laboratory phase, including several early ambitions and defeat paths. End the first phase with a durable foothold beyond the starting site, then add separate prompts for later phases.

- Should objectives be a fixed quest chain?

  Recommended answer: Use milestone groups with prerequisites and several qualifying strategies. Preserve authored revelations while allowing different creatures, businesses, alliances, subversion, worship, and force to satisfy strategic requirements.

- How should campaign pacing reflect expected failure?

  Recommended answer: Put meaningful discoveries, hard choices, emergent stories, and achievable run goals in the first hours. Later phases expand possibility rather than withholding the game's payoff until conquest.

- What makes world domination complete?

  Recommended answer: Require durable control or submission of the generated world's major territories and powers plus resolution of divine opposition. Do not equate victory with one battle or an abstract progress bar.

- Should the two themes have entirely separate endings?

  Recommended answer: Share the strategic definition of domination but provide theme-specific routes, milestone interpretations, consequences, and ending narratives. This keeps one coherent campaign model while allowing victories to feel fundamentally different.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 22. New-Run Onboarding and Contextual Tutorial

Design and implement optional contextual guidance after world selection, site selection, and the early campaign loop are stable.

Teach the core discovery, containment, map, task, research, company, economy, secrecy, and defeat/restart loops by responding to player actions and blockers. Guidance should point toward real controls without obscuring the map or turning the campaign into a rigid tutorial script.

Recommended scope: a dismissible first-run checklist, contextual hints with cooldowns, a way to review prior guidance, separate enable/disable settings, and a concise explanation that worlds retain their theme and generated baseline but prior laboratories do not persist. Preserve keyboard and screen-reader access.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 23. Sound, Notifications, and Accessibility Audit

Design and implement restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard coverage, screen-reader coverage, and a complete accessibility review.

Treat sound as an additional cue rather than the only carrier of state. Audit notification duplication and prioritization before adding more alerts. Keep independent controls for music, ambient sound, effects, and urgent cues if those categories exist. Theme-specific presentation must preserve the same accessibility and urgency semantics.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 24. Production Art Pass Using the Sprite Pipeline

Use the existing sprite manifest, loader, atlas workflow, semantic keys, and development sprites to establish and replace assets with a coherent first production-quality set.

This is an art-direction and asset-production pass, not another renderer or sprite-pipeline implementation. Preserve footprint anchors, transforms, renderer-neutral semantic keys, DOM glyph fallbacks, accessibility modes, and the approved visual language. Continue creating coherent development assets when new semantic map objects need them; do not begin the final replacement pass merely because the placeholder set expands.

This prompt remains intentionally last because world generation and campaign work may introduce new terrain, civilization, travel, combat, and event visuals.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
