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

1. Obstruction, Forced Entry, and Expanded Searches
2. Law-Enforcement Raids, Arrest, and Run Defeat
3. Reusable Worlds, Random Names, and Run Separation
4. World Themes and Content Boundaries
5. World Generation Foundation and Strategic Map
6. Global Geography, Biomes, Terrain, and Resources
7. Settlements, Cities, Routes, and Candidate Sites
8. Civilizations, Factions, Institutions, Religions, and Law
9. Historical World Simulation and Playable Year
10. New-Run World Selection, Site Choice, and Scenario Materialization
11. Local Context Mechanics: Environment, Geology, and Travel
12. World Integration: Economy and Logistics
13. World Integration: Investigations and Institutional Pressure
14. Lazy Local Detail and World Discovery
15. Roguelike Run Lifecycle, Defeat, Postmortem, and Restart
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
- The world must be finite and enumerable enough for territorial control and world domination to have a real, testable meaning.
- Use stable semantic role keys for mechanics and separate generated instance IDs and display names. Existing systems must not depend on a particular generated proper name.
- Once a generated world is finalized, its canonical facts must not silently reroll. World-generation version changes create a new world rather than rewriting an existing one.
- Keep generation and simulation renderer-neutral. UI previews and maps are projections of authoritative saved state.
- Every implementation pass must include deterministic tests, save/load coverage for its new state, and at least one player-visible or mechanically consumed result.
- Helix Heresy is a roguelike. Ordinary play must be compelling when a run ends in the laboratory or local-power phase; the overwhelming majority of runs should end long before world domination.
- World domination is the rare ultimate accomplishment, not the expected length or balance target of an average run.
- Do not build individual population, dynasty, migration, tactical-war, or global pathfinding simulations until an approved mechanic needs them. Strategic simulation may remain aggregated while still producing causal history.

---

## 1. Obstruction, Forced Entry, and Expanded Searches

Design and implement the physical escalation of an obstructed warrant execution. Continue from the saved issued action, frozen scope, obstruction evidence, visit history, and immutable partial return created by `warrant-executions.js`; do not generate an unrelated second search or silently convert every denied administrative visit into forced entry.

An authorized enforcement team should return with the personnel and tools required to breach only barriers justified by the warrant and later obstruction. Forced entry must operate on actual doors, locks, seals, fixtures, and construction: actors travel to the barrier, perform interruptible work, create noise and visible activity, apply real condition damage, and leave the resulting breached state in the map. The player may unlock, open, comply at the last moment, continue obstruction, barricade, relocate physical subjects, flee, or initiate combat using ordinary mechanics.

Keep original scope distinct from expanded scope. Obvious evidence physically perceived along a lawful route may be documented, but any expansion must record a specific saved justification, new authorized target, time, and source observation. Inaccessible contents remain unknown until officers actually breach and perceive them. Exact seized subjects continue through the existing physical carrying, entrance-transfer, authority-custody, and warrant-return systems.

Questions for discussion:

- Which obstructed warrants should support forced entry first?

  Recommended answer: Start with the implemented Registry records and environmental warrants, using a small law-enforcement escort and shared breach workflow. Keep arrest objectives and full tactical raids for the next prompt.

- Can officers break every barrier on the site?

  Recommended answer: No. They may breach a barrier only when it blocks a frozen or explicitly expanded target. Underground and unrelated rooms remain outside scope unless new physically perceived evidence supports an expansion.

- How should late compliance work?

  Recommended answer: Allow the player to grant access until destructive work actually completes. Officers stop further breach damage, but the earlier obstruction record and any damage already caused remain.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 2. Law-Enforcement Raids, Arrest, and Run Defeat

Design and implement high-severity law-enforcement warrants and tactical raids after forced entry is established. Consume the currently deferred law-enforcement warrant executions rather than using Suspicion alone as a raid roll.

A raid should have saved objectives, named physical actors, roles, entry plan, authorized scope, target actors or subjects, equipment, communication state, and retreat or completion conditions. Raiders use ordinary movement, perception, doors, injuries, incapacitation, death, carrying, and combat. Surrender, arrest, escape, concealment, resistance, and lethal force must be distinct physical outcomes. Arrest should require officers to reach and control an actor rather than changing a status remotely.

Run defeat may follow the scientist's death or completed arrest when no supported continuity remains. It must come after the visible institutional chain and playable physical encounter. Do not implement courts, prisons, or a general criminal-justice simulation in this pass; preserve a clear raid record and hand the result to the later roguelike postmortem system.

Questions for discussion:

- What should the first raid objective be?

  Recommended answer: Execute one high-severity search-and-arrest warrant naming the scientist, with seizure of responsive evidence as a secondary objective. This exercises tactical entry, surrender, arrest, escape, and defeat without building several raid types at once.

- When is lethal force authorized?

  Recommended answer: Begin with arrest and site-security rules. Escalate to lethal force only in response to an immediate serious threat, violent resistance, or dangerous uncontrolled creatures; preserve the causal trigger in the raid record.

- Can the player survive arrest through another body or successor?

  Recommended answer: Not in this pass unless an already-implemented continuity mechanic provides a living controllable successor. Otherwise completed arrest or death ends the run and records the exact cause for the later postmortem system.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 3. Reusable Worlds, Random Names, and Run Separation

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

## 4. World Themes and Content Boundaries

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

## 5. World Generation Foundation and Strategic Map

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

## 6. Global Geography, Biomes, Terrain, and Resources

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

## 7. Settlements, Cities, Routes, and Candidate Sites

Design and implement the inhabited and connected layer of the generated world.

Generate major settlements and cities in geographically plausible places, connect them with broad land, river, and sea routes, and identify candidate laboratory parcels across the world. City and site records may include names, population bands, economic roles, route access, water access, public visibility, concealment, freight access, geology hints, and compatible distance bands.

Questions for discussion:

- How many settlements need full detail at world creation?

  Recommended answer: Generate stable locations, names, population bands, roles, and controlling-power links for major settlements. Defer neighborhoods, residents, and exact maps until a run needs them.

- How should a nearest city be determined?

  Recommended answer: Use the saved strategic route graph, not straight-line distance alone. A candidate site should know both physical distance and practical travel access to its actual nearest settlement.

- Should world generation create the Chemistry Front building?

  Recommended answer: No. It creates candidate parcels and context. The chosen starting scenario materializes its authored surface and underground blueprint only after a run begins.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 8. Civilizations, Factions, Institutions, Religions, and Law

Design and implement the powers that inhabit, control, and contest the generated world.

Generate civilizations or states, territorial control, relationships, major non-state factions, religious powers, commercial blocs, and local institutional branches. Local roles may include city government, commercial registry, environmental/public-health authority, law enforcement, licensed waste carriers, black-market intermediaries, trade guilds, and religious authorities.

Questions for discussion:

- How should generated institutions connect to existing systems?

  Recommended answer: Bind generated instances to stable semantic roles. Existing rules continue to ask for roles such as commercial registry or environmental health, while records and UI cite the generated local entity.

- How deep should religions be initially?

  Recommended answer: Generate doctrines, spheres, influence, relationships, and attitudes toward artificial life, animancy, and forbidden research. Defer individual worshippers and divine intervention until campaign systems consume them.

- How should law work?

  Recommended answer: Generate enforceable policy profiles by jurisdiction and era with visible summaries and provenance. Add individual statutes only when inquiries, market restrictions, or campaign events can cite them.

- What strategic state is needed for eventual domination?

  Recommended answer: Save territory ownership, alliances and hostility, institutional reach, religious influence, and broad power projection. Exact victory thresholds belong to the campaign discussion.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 9. Historical World Simulation and Playable Year

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

## 10. New-Run World Selection, Site Choice, and Scenario Materialization

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

## 11. Local Context Mechanics: Environment, Geology, and Travel

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

## 12. World Integration: Economy and Logistics

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

## 13. World Integration: Investigations and Institutional Pressure

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

## 14. Lazy Local Detail and World Discovery

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

## 15. Roguelike Run Lifecycle, Defeat, Postmortem, and Restart

Design and implement the complete loop for beginning, losing, reviewing, and replacing a run without altering its reusable world.

Most runs should end during laboratory survival or early local conflict. Defeat should be common enough to define the game, but fair enough that the player can identify the decisions, risks, and causal chain that ended the run. A postmortem may preserve a read-only summary outside the world simulation; it must not add the old laboratory to future world maps or histories.

Questions for discussion:

- What ends a run?

  Recommended answer: Player death without an established continuity method, capture with no viable escape or successor, destruction or seizure of every viable power base, or another explicit irreversible state. Individual setbacks should not masquerade as defeat when recovery is physically possible.

- How should saving work in a roguelike?

  Recommended answer: Use automatic and manual continuation saves during an active run, but mark a defeated run complete so it cannot simply resume from after defeat. Decide strict ironman and backup behavior separately before deleting or overwriting any save data.

- What belongs in the postmortem?

  Recommended answer: World name, run seed, site and scenario, elapsed time, discoveries, created lineages, campaign phase, major decisions, evidence chain, cause of defeat, and highest achieved milestones.

- What happens next?

  Recommended answer: Offer a new run in the same world, a run in another saved world, or world generation. Reusing the world begins from its canonical state with no prior lab.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 16. Campaign Roadmap: From Hidden Laboratory to World Domination

Design the complete campaign progression against the generated strategic world, then implement only the campaign framework and first coherent playable phase. Add separate pending prompts for later phases identified during discussion rather than attempting the entire conquest arc in one implementation.

The final campaign goal is world domination, but reaching it should be extraordinarily rare. The progression should connect hidden-laboratory survival to local power, territorial expansion, conflict with states and religions, intelligent created societies, apotheosis, divine conflict, and eventual global control. The early game must remain a complete roguelike experience rather than a prologue balanced around an endgame most runs will never see.

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

## 17. New-Run Onboarding and Contextual Tutorial

Design and implement optional contextual guidance after world selection, site selection, and the early campaign loop are stable.

Teach the core discovery, containment, map, task, research, company, economy, secrecy, and defeat/restart loops by responding to player actions and blockers. Guidance should point toward real controls without obscuring the map or turning the campaign into a rigid tutorial script.

Recommended scope: a dismissible first-run checklist, contextual hints with cooldowns, a way to review prior guidance, separate enable/disable settings, and a concise explanation that worlds retain their theme and generated baseline but prior laboratories do not persist. Preserve keyboard and screen-reader access.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 18. Sound, Notifications, and Accessibility Audit

Design and implement restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard coverage, screen-reader coverage, and a complete accessibility review.

Treat sound as an additional cue rather than the only carrier of state. Audit notification duplication and prioritization before adding more alerts. Keep independent controls for music, ambient sound, effects, and urgent cues if those categories exist. Theme-specific presentation must preserve the same accessibility and urgency semantics.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

## 19. Production Art Pass Using the Sprite Pipeline

Use the existing sprite manifest, loader, atlas workflow, semantic keys, and development sprites to establish and replace assets with a coherent first production-quality set.

This is an art-direction and asset-production pass, not another renderer or sprite-pipeline implementation. Preserve footprint anchors, transforms, renderer-neutral semantic keys, DOM glyph fallbacks, accessibility modes, and the approved visual language. Continue creating coherent development assets when new semantic map objects need them; do not begin the final replacement pass merely because the placeholder set expands.

This prompt remains intentionally last because world generation and campaign work may introduce new terrain, civilization, travel, combat, and event visuals.

Do not modify files until the design has been discussed and the developer explicitly approves implementation.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
