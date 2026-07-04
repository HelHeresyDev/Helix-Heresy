# Helix Heresy Design Bible

This document is the living design bible for Helix Heresy. It collects story background, design goals, current prototype notes, future systems, and open questions. It is allowed to be longer and more speculative than the main README.

## Story

Cosmology

The gods are real and can physically manifest, grant blessings, perform miracles, and wage war against one another. Most people believe the gods are eternal beings, but this is false. Every god was originally a mortal creature that accumulated enough worship, belief, and soul influence to ascend beyond mortality. The gods actively suppress this knowledge because widespread awareness of ascension would create countless cults, prophets, and would-be gods.

Divine Power

Gods are not self-sustaining. They constantly expend power simply by existing, and miracles, manifestations, divine servants, celestial realms, and divine wars all consume enormous amounts of energy. Worship is the primary fuel that sustains them. Without worshippers, a god gradually weakens and can eventually cease to exist. Because of this, gods compete relentlessly for worshippers, souls, territory, and influence.

Souls and Heroes

Souls are the foundation of the divine ecosystem. Mortals live, worship, die, and pass through systems controlled by the gods. Exceptional individuals become heroes whose accomplishments attract admiration, loyalty, and worship. That worship further empowers them, allowing them to perform feats beyond normal mortals. After death, gods compete to recruit heroic souls into their service, making them valuable divine assets.

Genetic Engineering

Genetic engineering is outlawed throughout most of the world. Publicly it is condemned as unnatural and dangerous. In reality, the gods oppose it because artificial life threatens the divine economy. Soulless creatures provide no worship, contribute nothing to any god, and exist outside the normal cycle of life and death. The threat becomes even greater when artificial creatures kill mortals, as every dead worshipper represents lost faith, lost descendants, and lost future power for the gods.

Animancy

Animancy is the study and manipulation of souls and is one of the most forbidden fields of knowledge in existence. Most animancers seek to understand souls, while the most dangerous attempt to create, alter, transfer, manufacture, or control them. The gods fear animancy because it interferes directly with the source of divine power. A sufficiently advanced animancer could create artificial worshippers, manufacture loyal souls, establish entirely new religions, and potentially elevate a mortal being into godhood.

The Scientist

The protagonist is not trying to become a god and does not understand how the gods actually function. They are simply an obsessive and brilliant scientist who wants to create increasingly sophisticated organisms. During their research they accidentally invent a machine capable of combining genetic engineering and animancy, allowing artificial creatures to be created with genuine souls. To the scientist this is merely a scientific breakthrough. To the gods it is an existential threat.

Long-Term Story

The laboratory begins as an illegal biotechnology operation focused on creating increasingly sophisticated lifeforms. Over time, creature intelligence increases and some creations become self-aware, form societies, develop cultures, and create belief systems. Many eventually conclude that the being who designed them, created them, and shapes their world must be divine. The scientist never intends to create a religion, but worship from their creations gradually elevates their soul. What begins as a hidden laboratory eventually becomes a rival source of divinity, culminating in a conflict between a self-made god of biotechnology and the existing divine order.

## Slime Biology

All slimes are magical by nature. They are not artificial organisms; outside the laboratory, slimes are one of the most numerous natural organism families in the world. The laboratory does not invent slimes, but synthesizes, studies, modifies, accelerates, and redirects existing slime biology. Elemental affinity is not what makes a slime magical. It is a specialized magical expression within an already magical organism, so a slime with no elemental affinity is still magical.

Slimes are the starter creature family because they are simple, durable, adaptable, and biologically permissive. “Slime” is a broad category, not a single body type. Some are gelatinous, but others may be watery, rubbery, crystalline, tar-like, waxen, clay-like, fibrous, foamy, or stranger forms. Their shape, consistency, appendages, element, sustenance, and behavior determine how they function.

Slimes are asexual scavenger organisms that can consume almost anything, but not necessarily well. Each slime has a primary Sustenance adaptation shaped by natural evolution and reproduction, but mismatched food or resources may digest slowly, injure the slime, leave residue behind, create contamination, or produce low-quality outputs. Specialized slimes are valuable because they perform the same biological work faster, cleaner, and with less risk.

Loose feeding now follows that same Sustenance logic in the prototype. A loose slime can make a good, partial, poor, or harmful match against local residue, loose waste, or accessible remains. Good matches feed and regrow the slime more cleanly, while poor or harmful matches are slower, raise Stress or Body Integrity risk, and can leave contaminated or hazardous feeding residue behind.

A slime’s body is usually distributed and partially replaceable. This makes many slimes resistant to ordinary physical damage, since cutting, crushing, puncturing, melting, or removing part of the body may not kill the creature. The exact form of resilience depends on body consistency. A watery slime, brittle crystalline slime, rubbery slime, and tar-like slime should not all react to damage the same way. Ordinary harm should damage body integrity, reduce efficiency, increase stress, or make jobs harder, but it should not automatically shorten natural lifespan.

Each slime has a core that functions as its vital biological center and animantic anchor. The body can often be damaged or partially destroyed while the slime survives, but destruction of the core kills the creature. The core is also a natural place to connect future systems such as soul imprinting, animancy, necropsy value, core corruption, cloning, mutation instability, and catastrophic job failure.

Slimes reproduce primarily by splitting rather than sexual breeding. A mature slime that consumes enough material can become nutritionally saturated, and sustained fullness creates reproductive pressure. This does not mean a slime instantly splits the moment it eats enough. Instead, the slime must reach full current mass and remain full, fed, stable, and low-stress long enough for Division Pressure to accumulate. Depending on the slime’s traits, reproduction may look like splitting, budding, fracturing, shedding, leaking off daughter masses, or separating into offspring.

A mature slime can only split when it has reached its natural maximum size. The genetic Size trait represents the slime’s target mature size, while Current Mass can temporarily fall below that target after injury, starvation, or reproduction. Nutrition and feeding allow a slime to rebuild toward its natural maximum, but being well-fed is not enough to split if the slime has not fully regrown.

Slime splitting obeys strict mass conservation. A slime does not magically create new biomatter when it divides; it divides its existing body mass between the parent and offspring. Brood Size determines how many offspring a natural split tries to produce, so high-brood slimes create more bodies but each body begins smaller and weaker. After a normal split, the parent is temporarily reduced in size and the offspring begin below full mature size. Both must feed and regrow before they can reach their natural maximum. Because splitting requires full size and sustained fullness, repeated splitting without enough food is impossible rather than merely producing smaller and smaller slimes.

Natural slime reproduction is unstable. Offspring are based mostly on the parent’s genome, but slime biology is highly magically reactive and easy to perturb, so natural splitting should carry a meaningful mutation chance. Traits such as brood size, growth speed, stability, consistency, nutrition, and laboratory conditions can eventually influence how often splitting occurs, how many offspring are produced, and how chaotic the mutations are.

The current breeding concept has been reframed for slimes. Single-parent reproduction is natural splitting for now, with future room for induced splitting, budding, forced mitosis, or consistency-specific separation. Two-parent slime “breeding” is Forced Recombination: laboratory intervention such as core fusion, genome splicing, sample grafting, reagent-mediated recombination, or forced genetic exchange before division. This allows crossbreeding to remain as a mechanic while keeping slime biology distinct.

Mutation should not be pure chaos in every situation. Natural splitting after sustained fullness can have a higher mutation chance, while controlled laboratory splitting can reduce mutation risk at the cost of time, equipment, resources, or skill. Forced recombination can allow two-parent mixing but carry greater instability. This gives the player choices between reliable replication, risky experimentation, and deliberate genetic recombination.

The practical rule for slimes is that they are generalist scavengers by default and specialists by design. Any slime can attempt crude jobs like corpse consumption, waste disposal, hazardous cleanup, or basic production, but traits should determine whether the job is safe, fast, efficient, or useful. Feeding slimes is therefore not just maintenance; it can also create reproductive pressure, storage problems, mutation opportunities, and new resource-management decisions. Sustenance describes the primary pathway a slime uses to turn matter, waste, decay, or environmental resources into Nutrition and Current Mass; environmental sustenance is deliberately slow until room and container resources exist. Slime biology should support the larger game loop: create strange organisms, study their traits, feed and use them, manage the consequences of their reproduction and waste, and breed or engineer better versions.

Habitat fit is derived from existing biology rather than being its own gene. Element, body consistency, Sustenance, behavior, and stability can make a slime prefer or tolerate certain levels of Temperature, Light, Ambient Mana, Moisture, Contamination, or Electrical Charge. The readout stays broad, such as Ideal, Comfortable, Tolerable, Poor Fit, or Hostile. Known traits explain known supports and concerns; hidden traits remain hidden, but they can still affect the real organism.

Threat response is derived from condition and biology rather than being a separate gene. Stress, Body Integrity, Nutrition, Current Mass, recent injury, containment risk, habitat mismatch, behavior, and stability can make a slime calm, wary, agitated, pained, panicked, or desperate. The UI shows a broad likely action such as watch, hide, freeze, flee, lash out, seek food desperately, recover, or endure. Hidden behavior and stability can still shape the real response, but the readout should list them as unknown factors until discovered instead of revealing the trait.

The first group-behavior foundation treats slime social behavior as proximity biology rather than human-like society. Slimes track current nearby bodies, physical contact, kin, non-kin, hunger, stress, broad behavior, and stability to produce a simple Group Behavior readout. Current stances include isolated, brood cohesion, protective, tolerant, crowded, competing, avoiding, territorial, and hostile. This is a current state, not a separate genetic trait.

Natural splitting and Forced Recombination now preserve lightweight lineage through parent IDs and brood IDs. Parent/offspring and brood siblings recognize one another as protected kin. They may still crowd each other, compete with non-kin nearby, or suffer passive elemental clash damage if their bodies are physically incompatible, but they do not intentionally attack or feed-attack parents, offspring, or brood siblings. Non-kin crowding can create light Stress over time and can push hostile, territorial, avoidant, or competitive behavior depending on current biology and condition.

Elemental damage tags are the shared vocabulary for physical and magical hazards. The prototype currently derives them only from Element, not byproduct: none, stone, metal, and wood are Physical; acid is Corrosive; poison is Toxic; flame is Heat; frost is Cold; storm is Electrical; water is Moisture; wind is Pressure; light is Radiant; shadow is Shadow; dream and ether are Arcane; gravity is Force; null is Arcane and Force. Once Element is discovered, the slime panel shows broad tags and exposure descriptions. Containers and handling tools have broad resistance summaries that current tool durability and future combat, room damage, and containment wear can reuse without exposing exact formulas.

The first combat foundation is map-aware and tick-based rather than a full tactical game. Combat records live in `state.combat.active` and feed the normal incident system. Physical contact currently means released slimes sharing a tile or living slimes sharing the same container; loose slimes can share the scientist's tile for first-pass contact. Opposed elemental contact can create passive clash damage over time. Slime combat behavior now uses a qualitative decision layer instead of a single generic aggression score. Current combat intents include avoid, defend, threaten, attack, feed-attack, panic, flee, and freeze. Hunger, injury, stress, recent pain, pain memory, hunting behavior, stability, target type, contact, and protected kinship shape the intent. Only attack and feed-attack create automatic contact attacks in the first pass; protected kin suppress those automatic attacks. Flee tries to move a loose slime away and grants Evasion practice, while freeze/panic/threaten/defend primarily show posture and activity. If the scientist observes active combat, the game switches to 1x and pauses so the player can respond. The scientist has a basic `Strike` action against an adjacent loose slime or an accessible open container target; it spends Stamina, practices Creature Handling, damages Body Integrity, raises Stress, and uses the normal corpse flow if the target dies. This pass is intentionally a framework for future Combat Analyze, abilities, tools, intruders, room damage, group tactics, and emergency response rather than the final combat design.

Combat and emergency response now have a dedicated Combat map overlay separate from the general Incidents overlay. The Combat overlay shows known active or last-known combat incident tiles and lightly marks known participants when an active observed combat record is still available. Clicking a combat marker selects the combat incident record first, preserving uncertainty and keeping the incident as the response surface. The Selection inspector's Combat Situation section shows status, awareness, last-known tile, summary, known participants, combat type, contact, and response state without revealing hidden fights, exact formulas, or unobserved weaknesses. Responding to a combat incident queues scientist movement toward the last-known incident tile rather than inventing a safest approach. Selecting a living combatant exposes Strike and Combat Analyze through normal contextual commands; Strike remains visible with disabled reasons when the scientist is out of range, the container is closed, the target is unreachable, or stamina/condition blocks the action.

## Natural Byproducts and Collection

A slime’s natural byproduct is part of its biology. It is separate from feeding residue and separate from material harvested from the slime’s body.

Natural byproduct describes what a living specimen naturally leaves behind or emits as part of its ordinary metabolism. Feeding residue describes the mess left because of what the slime ate, such as loose biomatter after corpse consumption. Harvestable material describes what can be extracted from the slime itself, such as tissue, glands, membranes, cores, or other specimen parts. These systems can interact later, but they should not be collapsed into one trait.

Current prototype feeding residue is local mess, not clean inventory. Intended feedstock digestion is tidy and produces no residue. Mismatched or risky manual feeding, uncontrolled loose feeding, corpse consumption, Corpse Processing, and Waste Disposal can leave coarse residue units in the relevant container or room. Current residue categories include loose biomatter, contaminated residue, inert residue, elemental trace residue, slime trace, and hazardous sludge. Residue lightly increases local contamination and is visible in container or room readouts. It is intentionally separate from natural byproducts, Elemental Residue stockpiles, and harvested specimen material.

Current prototype harvesting is an intentional queued procedure. Living specimens can be sampled, partially harvested, or broken down. Sampling and partial harvest recover a small amount of harvested specimen material while reducing Body Integrity, Current Mass, and/or increasing Stress; breaking down a living specimen consumes it completely. Corpses can also be sampled, harvested, or broken down if they have not been ruined by necropsy or another destructive procedure. Corpse freshness affects harvest yield, partial corpse harvest ruins the corpse for further harvest, and corpse breakdown removes the corpse entirely. Harvested materials are stored in the Storage Room ledger under Harvested Specimen Materials with broad material labels and tags, separate from Collected Byproducts and local feeding residue.

Natural byproducts should be biologically coherent. A slime’s element, affinity, body consistency, and physiology constrain what byproducts make sense. Acid slimes should express acid-appropriate outputs, water slimes should express water-appropriate outputs, mineral or earthen slimes should express mineral-appropriate outputs, and so on. Byproducts should not be selected from an unrestricted global list unless a future mutation, hybridization, or unstable-experiment system explicitly justifies the mismatch.

Byproduct genes still matter internally, but player-facing UI should not explain gene-slot mapping. The scientist observes byproduct results, output intensity, and collection fit, not the underlying allele table. The same gene pair should have stable internal meaning, and multiple gene pairs can produce the same apparent byproduct while differing in output intensity.

Natural byproduct output has broad bands: Trace, Low, Moderate, and High. Moderate output is the baseline metabolic demand. Lower output reduces food demand slightly, while higher output increases food demand slightly. Exact scalar values, exact food modifiers, and hidden individual expression rolls should remain hidden during normal play.

The genome defines the possible byproduct and output band, but an individual specimen can still roll a hidden expression value inside that band when created. This supports a creature-hunting loop where a specimen can have good genes and still be more or less exceptional as an individual.

Current biological condition shapes how much of that potential is actually expressed. Nutrition, Current Mass, Body Integrity, Stress, and maturity affect natural byproduct production before collection support is applied. Healthy mature specimens can sustain their baseline potential, while hungry, fragmented, injured, stressed, or immature specimens produce less. Immature slimes can still emit trace output, but should not perform like mature production specimens. The UI should describe this broadly as current expression, such as Dormant, Trace, Suppressed, Weak, Reduced, or Steady, without exposing exact multipliers.

Jobs and intended uses do not determine natural byproducts. Using a slime as a cleaner, corpse processor, waste disposer, or production creature should not rewrite what it naturally leaves behind. A slime’s job may create feeding residue, contamination, waste, or job outputs later, but that is not the same as its natural byproduct.

Collection Bay is the lab space for gathering natural byproducts without dissecting the specimen. It contains grim industrial apparatus such as drain channels, sealed troughs, fume hoods, condensers, collection plates, filters, and catch basins. The room’s apparatus works with containers rather than magically collecting everything.

Collection method should follow byproduct behavior. Dripping or liquid byproducts use drainage channels and specimen containers that can route output into collection receptacles. Sludge, gel, or sticky byproducts use troughs, catch basins, scraper plates, and lined receptacles. Vapor, haze, fume, or mist byproducts use fume hoods and condensers with existing sealed or ventable containers. Dry or particulate byproducts use plates, filters, bags, and scraper trays. Unknown or poorly understood byproducts require observation before the scientist can make reliable collection assumptions.

Specimen Drainage Tanks support drip, sludge, gel, and similar surface or runoff outputs by housing the slime in a container built around channels and catch basins. They do not solve vapor collection. Vapor-producing specimens should instead be staged in sealed or ventable containers under hood and condenser apparatus.

Collection Bay accumulation is station-based. Each staged specimen container acts as a collection station with its own active receptacle, such as a jar, flask, bag, tray, filter, or condenser bottle. Multiple slimes in the same specimen container add their natural output rate together into that station. If different natural byproducts enter the same station, collection does not pause; the station produces mixed collection residue because the scientist chose to run incompatible outputs through one apparatus path. If the active receptacle fills, output can spill into that station's apparatus overflow buffer.

Collected byproducts move into inventory through a queued station-level Transfer Receptacle task. Transfer swaps only the active receptacle into the Storage Room's Collected Byproducts ledger; overflow remains in the Collection Bay apparatus and can flow into the replacement receptacle afterward. Raw byproduct names are preserved until a later processing system changes them, so smoke vapor stays smoke vapor unless it is run through a condenser or another refining procedure later. Routine transfer accounting belongs in inventory item history and tooltips, while the event log should remain for meaningful observations, incidents, and discoveries.

## Room-Local Storage and Hauling

Prototype resources and inventory now have lab-wide totals backed by room-local stockpiles. The global number is a ledger for readability, but physical availability depends on the room where the action happens. Most resources, tools, collected byproducts, and harvested specimen materials default to the Storage Room. Waste defaults to the Pits because it is a problem to manage, not a clean supply shelf.

Room stockpile UI is framed as last-inventoried knowledge rather than perfect omniscience. Prototype counts still update exactly for now, but the player-facing language should support future interference from creatures, incidents, raids, spills, theft, fires, or inaccessible rooms. Selecting a room or in-room tile shows Known Supplies in the Selection inspector, including resources, tools, collected byproducts, harvested specimen materials, and pit contents where relevant. Tools appear in the same physical room supply readout as materials because they are stored objects, not a magical equipment cloud. Waste inside pit containers or the Pits room is displayed as pit contents rather than clean inventory.

Storage capacity is infinite for now. This keeps the first pass focused on location and hauling instead of crate management. Later room upgrades, shelves, drums, cold storage, lockers, hazard cabinets, or black-market packaging can add capacity and storage quality.

Actions consume materials from their action room. If the required material exists elsewhere in the lab, clicking the same action button should queue a material hauling task first, then automatically queue or perform the intended action once the delivery is complete. Command and button descriptions should explain local availability, known lab totals, and the planned haul before the player clicks. Synthesis therefore hauls Biomass to the Synthesis Tube before starting synthesis. Manual feeding hauls feedstock to the slime's room before feeding. Auto-feeding remains local-only for now so automation does not silently move supplies through the lab.

The Resources map overlay is selected-focus only. The player chooses one material or category, such as Biomass, Waste, Tools & Supplies, Collected Byproducts, or Harvested Specimen Materials, and the map highlights rooms with known matching stock or pit contents. The overlay should not show every resource at once; broad all-resource highlighting would become unreadable and would blur the distinction between clean supplies, dirty pit contents, and local mess.

Collection Bay transfer is also queued. The scientist closes the station path, swaps the active receptacle, carries the collected material to the Storage Room ledger, and leaves any apparatus overflow in the Collection Bay to flow into the replacement receptacle.

Cheat commands can place resources and inventory into a specific room with an optional room argument. This is mainly for prototype testing and should make room-local systems easier to inspect without playing through long production chains.

## Lab Blueprint and Physical Pathfinding

The starter laboratory now has a saved physical blueprint instead of only an abstract room list. The map uses 1 meter tiles with fixed first-pass footprints for the Main Lab, Menagerie, Pits, Bedroom, Storage Room, and Collection Bay. Room footprints are stored as walkable cell masks, so rectangular rooms are only the default shape and irregular rooms such as the Pits can be represented without lying to pathfinding. Doors live on shared room edges, and pathfinding moves through floor tiles and valid door crossings rather than assuming all connected rooms are equally distant.

The simulation clock is seconds-based internally. UI speed controls still offer 1x real time, 60x, and faster speeds, but task `createdAt`, `dueAt`, lifespans, decay windows, movement, and passive updates are measured in seconds. Player-facing task definitions may still be authored in minutes where that is the natural design unit, then converted at scheduling boundaries.

The blueprint is a foundation for later construction rather than a full base-builder. Scientist movement, container hauling, and material hauling store room routes plus physical map paths in queued task data. Scientist movement uses a stored movement speed in meters per second, while creature movement profiles derive both a movement style and a physical speed from shape, body consistency, appendages, element, and weight.

Doors are physical constructed objects rather than simple open/closed markers. Each door has a base construction type, material, condition, seal strength, lock strength, and optional wards using the same broad durability language as containers. Current door states include open, closed, locked, sealed, and breached. Ordinary closed unlocked doors block uncontrolled creature movement but can be used by scientist movement, hauling, and material hauling according to door policy. Locked and sealed doors block routing until changed by the player. Sealed doors represent deliberate access and spread control, while breached doors no longer lock or seal and can be passed through. Future construction should allow doors and barriers to be built from materials, upgraded, warded, damaged, repaired, or destroyed by creatures, incidents, raids, and environmental hazards.

Released slimes now act as loose map actors. They are not added to the normal task queue; instead, each loose slime can choose a simple creature activity such as wandering, seeking accessible mess, moving toward contamination, feeding on room residue, feeding on loose waste, feeding on accessible remains, or seeking a better adjacent habitat. They use exact local food targets only when the food is in the same room. Adjacent-room residue, loose waste, exposed remains, sought contamination, or better environmental conditions can create qualitative traces even through closed doors, with trace strength reduced by door state and seal quality. A trace tells the slime that something relevant is nearby, not the exact item, inventory stack, or hidden formula. Slimes can only move toward trace sources if an open or breached route exists; closed, locked, and sealed doors block them, causing blocked-door pressure and possible-intent observations instead. In-flight slime routes are checked against the current door state, so a door closing ahead of a moving slime stops the route rather than letting it pass through. Clean Storage Room supplies are treated as packaged or secured and are not free food or trace sources for loose slimes in this pass.

Map-based incident alerts are now a lightweight spatial emergency layer. Unresolved alerts can be created for observed loose creatures, blocked-door pressure, notable room contamination, feeding residue spills, exposed remains, corpse overflow, compromised or breached containers, breached doors, and observed combat. Alerts store type, severity, source, room, map cell, status, acknowledgement timing, response movement timing, stale timing, manual resolution timing, and urgency timing. The Incident Alerts panel is the always-visible pressure surface; map markers appear through the Incidents overlay or when a specific incident is selected, keeping the blueprint from permanently shouting every known problem. Multiple incidents on one tile stack into one marker with a count, acknowledged incidents become visually quieter, and stale incidents remain as last-known locations until the player checks or clears them. The current response pass lets the player acknowledge an incident, focus its map source, queue a scientist movement task to the alert site, or manually mark the alert resolved. Manual resolution suppresses that exact observation until it materially changes. New serious non-combat incidents reduce time to 1x, and new critical non-combat incidents pause at 1x when discovered. The response system deliberately does not auto-resolve the underlying problem yet: recapture, cleanup, repair, feeding, calming, fighting, sealing, and disposal still use existing or future systems.

Spatial environment propagation has a room-level contamination diffusion foundation. Contamination behaves like a concentration gradient between connected rooms rather than a scripted hazard timer: higher-contamination rooms leak toward lower-contamination rooms over time, scaled by room volume, elapsed time, and the door between the rooms. Open and breached doors allow far more exchange. Closed doors leak according to effective seal quality. Sealed doors block creature/scientist passage but still allow tiny or meaningful contamination leakage depending on door type, condition, and seal-related wards. This pass intentionally covers contamination only; temperature, moisture, fumes, electrical charge, ambient mana, vents, drains, construction materials, and tile-level diffusion should build on the same model later.

Slime habitat response now uses those room and container environment values. Bad habitat gently raises Stress over time, while truly Hostile habitat can reduce natural byproduct expression. Good habitat can slowly calm a stressed slime. Hostile habitat adds a small active containment pressure; Poor Fit becomes a containment issue mainly after Stress has actually built up. This keeps habitat meaningful without creating an instant fail state before the player has full infrastructure controls.

Map object placement is now saved instead of inferred only for display. Containers occupy blocking footprints based on their physical dimensions, with sub-meter equipment rounded up to one 1-meter tile and larger round or pit-like containers occupying square bounds around their diameter. Contained creatures and contained remains do not get separate map cells; the container owns the physical footprint. Loose slimes and loose, drummed, or overflow remains can share cells for now and do not block movement.

Pathfinding treats container footprints as blocked cells and routes controlled movement to usable access cells rather than onto the object tile. Container hauling records the source footprint, destination footprint, adjacent access cells, and physical path. Object placement is automatic for this prototype pass; manual furniture placement and fine-grained room capacity can come later.

The blueprint is inspectable in the first pass. Hovering a tile reports its room, door, object, blocking, and route context. Clicking map cells now selects into the map-side Selection inspector rather than immediately pulling the player into a legacy list panel. Stacked-cell click priority should surface the entity most likely to matter to the player: incidents and the scientist still outrank ordinary objects, occupied container footprints can select their contained slime or contained remains before the container itself, and empty containers remain selectable as physical objects. The map highlights the selected target and only the next queued movement or hauling path to avoid visual clutter.

Construction now begins from the physical blueprint. The player enters Dig Mode, clicks solid-earth tiles on the map to build a draft designation, then confirms that draft into a timed Excavation task. Draft cells are saved as tile sets rather than only rectangles, so irregular room shapes are supported by the same walkable-cell model used by pathfinding. Invalid drafts, such as disconnected cells, overlap, oversized drafts, or drafts that do not touch the existing lab, are shown as draft problems before work can be queued. Planned dig tiles are marked on the blueprint. When the task completes, the dug cells become a rough unassigned room with saved walkable cells and open door links to adjacent rooms. Selecting that rough room on the map exposes room-purpose commands in the Selection inspector, such as Workroom, Containment Room, Corpse Processing Room, Quarters, Storage Room, or Collection Room. This keeps the Dwarf Fortress-style order of operations: dig space first, then define what the room is for.

Future construction, room expansion, damage, sealing, ventilation, drainage, power, and creature movement should extend this physical map model. Room cards remain the detailed management view, while the compact blueprint gives the player a readable sense of where the lab actually is. This first construction pass does not yet model excavation materials, money, noise, secrecy, workers, supports, room equipment, or buildable infrastructure; those should be layered on top of tile designation and room-purpose assignment rather than replacing them.

## Frontend Architecture Direction

Helix Heresy should move toward a map-first management interface similar to Dwarf Fortress. The physical lab blueprint should become the main surface for understanding the lab, inspecting rooms and objects, issuing contextual commands, following movement, reading incidents, and eventually managing combat or larger-scale emergencies. The existing panel-heavy prototype UI is useful scaffolding, but the long-term interface should feel more like a grim laboratory command console than a collection of disconnected web panels.

The first map-first shell pass keeps the old prototype panels reachable while shifting visual hierarchy toward the blueprint. The Rooms/Blueprint panel now spans the workspace first, the main shell has a categorized workspace navigator for Lab, Creatures, Logistics, Records, and Debug surfaces, and selected map targets are primarily inspected through the map-side Selection inspector. This is intentionally a transitional shell rather than the final screen manager: inactive sections remain visible for now so existing workflows and tests stay usable while later inspector and contextual-command passes migrate actions out of permanent panels.

The first screen-manager pass stores the active workspace in `state.ui.activeWorkspaceTab` and treats the map as the home surface. The grouped navigation currently exposes Lab screens such as Map, Foundry, and Tasks; creature screens such as Creatures and Containers; logistics screens such as Resources and Policies; records screens such as Journal and Messages; and a Debug group for Cheats. Escape now backs out in a predictable order: close keyboard help, exit command mode, return from management screens to Map, then clear the current map selection. The old queue drawer has been retired in favor of a full Tasks workspace for scientist-directed work, while the small Tasks tab still shows count and next-task timing. Debug tools are gated behind a Debug toggle that defaults on for prototype testing; turning it off hides Cheats and removes the omniscient Debug map overlay from normal navigation.

The message system now separates urgent recent information from the full observed record. `state.events` stores typed message records with category, severity, compact-feed eligibility, and optional map links. The compact translucent feed shows recent important observed messages such as combat, incidents, critical warnings, and blocked or failed actions, while routine task completions, discoveries, resource accounting, and specimen observations stay out of the compact feed. The Messages workspace tab is the full history surface with category filtering and focus controls for linked known incidents, rooms, or tiles. The Journal remains the scientific reference surface for discovered traits and notes, and routine inventory/resource accounting should continue to live in inventory histories and tooltips unless it becomes unusual, blocked, dangerous, or explicitly noteworthy.

Selection now has a single forward-facing state object that can represent tiles, rooms, doors, containers, living specimens, corpses, incidents, tasks, tools, or resources. The older `selectedSlimeId` and `selectedMapTarget` values are kept as compatibility mirrors while the prototype panels still exist. A temporary Selection inspector near the blueprint uses Summary, Details, Actions, Related, and History tabs so every selected entity has the same basic inspection shape while still showing entity-specific readouts. Map clicks use top-priority selection for stacked cells; the Related tab exposes containers, contained specimens, contained remains, rooms, and other same-location entities without interrupting normal clicks. Container and specimen selections now include a lightweight interior/context section: selected containers list living occupants, remains, containment summary, residue, pit contents, and Collection Bay station state where relevant; selected contained slimes show their actual container, physical fit, compatibility, active risk, residue, and other occupants. If a selected slime dies and creates a corpse, selection follows the corpse automatically.

The first contextual command pass adds a reusable command definition and rendering layer to the Selection inspector's Actions tab. Commands are grouped by purpose, stay visible when disabled, and explain blocked requirements such as stamina, missing containers, route problems, security states, tools, or risk. Opening command mode jumps the inspector to Actions so keyboard-driven play and mouse-driven play share the same command surface. Current first-pass commands cover selected room or tile movement, door open/close/lock/seal controls, incident focus/response/acknowledge actions, corpse necropsy/forensic/harvest/dump actions, slime Analyze/feeding/handling/job/combat/living-harvest actions, and container access/hauling/Collection Bay staging/remains/transfer actions. Permanent prototype panels still exist, but new player actions should increasingly flow through reusable command functions so hotkeys, command modes, inspectors, and future map workflows have a shared foundation.

The first task queue and path visualization pass defines the normal queue as scientist-directed work only. Passive systems, creature autonomy, maturation, and facility background behavior remain simulation state or activity readouts rather than player orders. Queue rows are selectable task entities, task selections use the same inspector tabs as rooms and specimens, and the Actions tab can cancel scientist tasks. Task summaries show status bands such as Active, Queued, Ready, or Blocked; blocked tasks do not pause the game, but they remain in the queue with a visible reason until the obstruction is cleared or the player cancels them. Task route previews are deliberately quiet: movement and hauling paths are painted on the map only while the Movement overlay is active, with a selected task route taking priority over the next generic queued route.

The first keyboard-control pass adds a map cursor and two explicit UI modes. Navigation mode lets the player move the cursor with arrow keys, select the top-priority target under it with Enter, open contextual commands with `A`, clear selection with Escape, and toggle a help legend with `?`. Command mode displays numbered hints on the selected target's contextual commands; `1` through `9` activate those visible commands and Escape returns to navigation. Time controls remain global outside command mode, so `1` through `5` still set time speed unless the player is actively choosing a command.

The first map overlay pass adds a single active overlay selected from the blueprint or cycled with `O` and `Shift+O`. Current overlays are None, Contamination, Movement, Resources, Incidents, Construction, and Debug. Normal overlays must represent what the scientist or player already knows: contamination uses the current room observation or stale remembered observations, movement uses known queued paths, resources use last-inventoried room supplies for one selected material or category, incidents use known unresolved alerts, and construction uses player designations. The Debug overlay is explicitly omniscient for development and can show raw simulation details, including unobserved room conditions and actors. Future overlays should follow the same rule: no free information in normal play, but debug can expose the underlying simulation for testing.

The current browser foundation is still worth keeping for now. HTML and CSS are strong fits for dense management screens, forms, logs, policy tabs, tooltips, inspectors, inventory ledgers, journals, and readable text-heavy UI. A full engine rewrite should not happen unless the project hits a clear technical limit that cannot be solved with better architecture.

The likely long-term rendering model is hybrid. The current DOM tile map is acceptable while the lab is small and glyph-based. Canvas should be prepared for, but deferred until the map needs larger spaces, hundreds of actors, smooth animation, sprite rendering, zoom and pan, combat overlays, path previews, or dense environmental visualization. HTML should remain the layer for menus, panels, inspectors, policy screens, and most controls even if the map itself eventually moves to Canvas.

Simulation rules should not depend on either DOM rendering or a future Canvas renderer. Game state should be the source of truth. Rendering should read from state rather than becoming state. Player actions should flow through command functions, simulation should advance through explicit systems, and UI code should display derived view models instead of calculating core rules directly.

Future organization should gradually move toward clear boundaries:

- State: defaults, save data, normalization, migration or reset behavior, and schema-like conventions.
- Systems: time, metabolism, movement, autonomous creature activity, contamination diffusion, jobs, incidents, reproduction, decay, and future AI.
- Commands: player intent such as synthesize, move, feed, assign job, open door, transfer receptacle, designate excavation, harvest, sell, or change policy.
- Selectors and view models: read-only derived data for panels, tooltips, map overlays, warnings, and contextual actions.
- UI: DOM rendering, event binding, panel layout, hotkeys, command menus, and presentation state.
- Map renderer: a replaceable boundary that can use DOM tiles now and Canvas later without rewriting pathfinding, rooms, actors, or simulation logic.

The first architecture pass is intentionally small and practical rather than a sweeping rewrite. The current DOM map now consumes a `buildLabMapView()` model that packages tiles, glyphs, classes, click targets, route highlights, selected state, planned digs, and incident markers before DOM nodes are created. The time update flow now routes through `runSimulationSystems(elapsed)` and `simulationChangeCount(changes)`, making the update pipeline easier to split into standalone systems later. Future passes should continue this direction by extracting command functions, selectors, system modules, and eventually a replaceable Canvas map renderer only when the DOM map becomes a real limit.

## Container Compatibility

Containers are physical lab equipment, not generic storage slots. Current prototype containers have base types with interior dimensions, openings, open or sealed geometry, load limits, durability, comfort, drainage, environment exchange, material resistance, and optional wards. Wards modify specific problems rather than solving all containment.

Container readouts separate three related concepts. Physical Fit estimates whether the specimen's size, shape, weight, opening requirements, and body flexibility make sense in the container. Compatibility estimates material resistance and functional support, such as whether the container resists corrosive, toxic, thermal, cold, electrical, or arcane hazards and whether drainage, sealing, open-top geometry, or collection support suits the specimen. Active Containment Risk combines compatibility, current creature condition, stress, hunger, stability, container condition, handling state, corpses, and other pressure sources into the chance of incidents.

Player-facing compatibility remains discovery-aware. Known traits can produce specific notes such as poor corrosive resistance or lack of drainage. Undiscovered traits widen the assessment without naming hidden hazards. The simulation still uses the real hidden biology, so an undiscovered acid slime can slowly stress a poor glass jar even before the scientist understands why.

Poor compatibility has light first-pass consequences rather than catastrophic container destruction. Over time it can raise specimen Stress, foul the container interior, slightly wear unsuitable materials, and add pressure toward minor containment incidents. This keeps container choice meaningful while leaving full repair, replacement, and equipment crafting for later systems.

Contained slimes now have an active containment-testing behavior layer. A slime can begin probing containment because of hunger, high Stress, hostile habitat, recent pain, poor compatibility, dangerous temperament, crowding, weak seals, bad condition, or similar pressure. The UI shows qualitative escape pressure bands, such as Quiet, Low, Moderate, High, and Critical, plus the observed method when active. Methods include pressing, attacking, seeping, corroding, shocking fittings, climbing or gripping, fouling the interior, waiting for a handling mistake, and using unstable elemental force. This behavior is visible without exposing exact hidden formulas or undiscovered trait names.

Containment testing has gradual consequences. Active testing can build warning signs, increase Stress, foul the interior, damage container condition through the existing damage-type and resistance vocabulary, leak trace contamination into the room in severe cases, and give creatures behavior memory or relevant practice such as Striking or elemental damage-skill practice. A full breach is intentionally rare: it requires critical escape pressure, enough repeated progress, and a container that is already nearly ruined.

Full breaches now resolve through physical outcomes instead of a generic escape. Possible results include a slime seeping through a weak seal, climbing out through openings, forcing a latch, cracking a fragile container, dissolving a wall, tipping or spilling an open vessel, or disrupting fittings with unstable elemental force. Containers record `intact`, `compromised`, or `breached` state plus the last breach summary. A compromised container may remain physically usable when that makes sense, while a breached container is excluded from containment until future repair or replacement. The event log and container card report the breach result, and the loose-slime release path places the escapee near the container on the map.

## Tools and Handling Equipment

Handling tools are reusable physical objects, not permanent abstract toggles. Thick gloves, long tongs, hook poles, and scrapers now have individual durability, broad material notes, damage resistance, and condition bands: Pristine, Worn, Damaged, Failing, and Broken. Broken tools remain cataloged in inventory but cannot be used until future repair or replacement systems exist.

Tool durability currently wears during meaningful hazardous handling rather than every ordinary use. Opening or closing containers with live specimens, moving living slimes, and dumping or scraping remains can damage the selected handling tool based on the exposed damage tags, the tool's resistance profile, the current condition band, and the handling risk. Low condition reduces effective resistance and raises handling risk before the tool fully breaks. Empty safe handling should not grind equipment down just for clicking a button.

The Storage Room inventory ledger shows tool count, usable count, best condition, durability, and material/resistance tooltip details. Handling policy readouts and disabled button reasons distinguish between tools that are not stocked and tools that are stocked but broken. This is a foundation for later repair, replacement, crafting, warded equipment, cleanup tools, combat equipment, and room-object damage.

## Design Vision

Helix Heresy should feel like running an unsafe little arcane biology lab. The player should not start with a complete wiki. They should learn by making creatures, testing them, comparing notes, and steering reproduction or recombination toward goals they only partially understand.

Core design pillars:

- Discovery over disclosure: hidden trait outcomes and gene mappings should be learned through play.
- Strange but readable creatures: generated specimens should be easy to imagine, not just lists of numbers.
- Lab capability matters: skills improve execution, while equipment and resources should eventually unlock what tests are possible.
- Weird biology is allowed: clashing traits can create awkward or weak creatures instead of being forbidden.
- Reproduction and recombination should feel experimental: the player can aim for known traits, but unusual combinations should remain possible.

## Campaign Vision

The full game should become a browser-based roguelike management and simulation game like Dwarf Fortress about illegal life creation in a magical world. The prototype is slime-first, but the larger arc is not slime-only: slimes are the first low-gene creature family before stranger, smarter, more dangerous life forms become possible.

The intended long-term loop:

- Experiment on genes and synthesize creatures.
- Observe results through casual inspection, lab tests, and practical use.
- Manage money, biomass, reagents, lab space, equipment, time, secrecy, and Suspicion.
- Hide evidence, contain accidents, and avoid authority attention.
- Assign creatures to jobs, lab areas, disposal tasks, protection, infiltration, production, or sale.
- Visit the black market to sell creatures, byproducts, services, and eventually fulfill commissions.
- Use discoveries, profits, and creatures to expand from a hidden lab into larger operations.

Starting scenarios should define the initial story and resource position. Examples include a protected corporate black-project lab, a legitimate company job hiding secret desert-base construction, and a sewer fugitive start where the authorities are already hunting the player.

Difficulty should be modular rather than a single preset. Settings can affect journal support, gene visibility, authority aggression, resource scarcity, experiment consequences, mutation chaos, and how learnable the DNA puzzle is. Easy settings can be darkly funny and forgiving; hard settings should become tense, secretive, and resource-starved.

Suspicion is the pressure of being discovered. It should eventually track evidence trails, escaped creatures, lab incidents, black market exposure, and direct government attention. On low difficulty it can be background pressure; on high difficulty it should become a constant survival threat.

The black market should grow with reputation. Early sales may be whatever useful creatures or byproducts the player can produce. As reputation rises, customers should commission creatures with specific traits, behaviors, affinities, or jobs.

The late game should escalate from survival and profit into power. The player can recruit people through money or promises, create stronger creatures and eventually intelligent agents, confront the local government, take control of territory, and transition into a global conquest layer. Higher-intelligence creations should be more useful but also more capable of betrayal and non-gene-driven behavior.

## Creature Vision

Creatures should eventually be described as physical beings with form, dimensions, mass, affinity, behavior, and usefulness.

Slimes are the starting point because they are the most basic experimental creature. The broader game should be able to grow into other creature families with their own body plans, constraints, uses, and risks.

Current direction:

- Shape is a genetic trait that describes the creature's body plan.
- Body consistency is a genetic trait that describes how the creature holds together physically.
- Appendages are a genetic trait separate from shape.
- Size describes shape-aware dimensions instead of only total volume.
- Weight is derived, not genetic.
- Density is derived primarily from elemental affinity and affinity strength.
- Movement is derived from shape, appendages, size, weight, and element instead of being directly genetic.
- Natural byproduct is a genetic/biological output constrained by element and physiology, not by job assignment.
- Natural output intensity affects metabolism through broad hidden bands rather than exact player-facing numbers.

Examples of the intended style:

- `Shape: worm-like`
- `Body Consistency: elastic gel`
- `Appendages: grasping pseudopods`
- `Size: 1.8 m long, 12 cm thick`
- `Weight: 34 kg`
- `Movement: pulls itself forward`
- `Byproduct: corrosive slime`
- `Natural output: Moderate`
- `Metabolic demand: Baseline`

Odd combinations are acceptable. A puddle with stub legs or a metal slime with wing-like membranes may become physically awkward, but that awkwardness can later feed into creature stats, mobility, stability, containment difficulty, or combat/work usefulness.

## Slime AI Direction

Slimes now have a first-pass AI record stored on each living specimen as `slime.ai`. This is a shared behavior-state wrapper, not full intelligence yet. The record stores broad state, intent, target, reason, urgency, path, next decision time, current combat decision, and last update time. Current broad states include contained, idle, moving, seeking, feeding, working, blocked, combat, stressed, and dead.

Slimes also have first-pass drive records stored at `slime.ai.drives`. Current drive categories are Hunger, Regrowth, Injury, Stress, Containment, Work, and Reproduction. Each drive is shown as a broad band (`none`, `low`, `moderate`, `high`, or `critical`) with a short reason, and `slime.ai.dominantDrive` records the strongest active pressure. These readouts should remain qualitative; exact thresholds and hidden weights are not normal player-facing information.

Drives are intentionally lightweight in this pass. They can raise urgency and nudge broad intent, such as hunger or regrowth producing `seekFood`, injury producing `rest`, assigned work producing `continueJob`, and containment or stress producing `endureContainment`. They do not yet execute full behavior, perceive distant targets, or override active movement/feeding/blockage states. Needs and drives describe what the slime wants; later perception, movement, feeding, habitat, threat, containment, and work-autonomy systems decide what it can actually do.

Slimes now have first-pass current perception stored at `slime.ai.perception`. Perception is local and qualitative. Loose slimes can perceive same-room stimuli such as notable environment bands, feeding residue, local corpses, waste, nearby free creatures, the scientist, and open-door air from adjacent rooms. They can also perceive qualitative food and habitat traces drifting from adjacent rooms, including through closed doors when the door and seal allow enough leakage. These traces expose broad cues such as carrion, organic residue, hazardous sludge, contamination, or different room air; they do not reveal exact hidden resources or formulas. Contained slimes primarily perceive their own container interior, container-local residue/corpses/other occupants, containment strain, and only limited room cues when the container seal/visibility allows it. Sealed containers should block or muffle room cues rather than granting omniscient awareness. This record is current awareness only, not long-term memory; combat decisions and work autonomy should target perceived, contacted, or remembered things instead of global resources.

The current implementation deliberately mirrors existing `roomActivity`, `autonomousMovement`, job, container, and containment-risk behavior instead of replacing those systems all at once. This keeps loose movement, blocked-door pressure, feeding behavior, cleanup observations, and incident alerts working while giving future systems a consistent place to read and write intent. `slime.autonomousMovement` is the current route execution record for loose slimes; it stores intent, target, path, target cell, route distance, movement speed, condition modifiers, start time, and arrival time. Movement speed is derived from physical movement biology and then modified by current maturity, mass, Body Integrity, and Stress.

Player-facing AI readouts remain broad and readable, such as `AI: Moving - seeking loose biomatter` or `AI: Blocked - blocked from Loose biomatter`. The selected slime card includes an Activity panel that explains broad state, intent, target, urgency, observed pressures, path status, next decision timing, and unknown-factor warnings without exposing exact hidden weights. The Cheat panel contains a Slime AI Debug readout for the currently selected slime; this development-only view exposes raw AI state, intent, target data, path length, drive bands, perception entries, response scores, combat decision scores, social context, room activity, movement record, and containment testing state. Normal player UI should stay qualitative, while debug readouts can be exact enough to diagnose stuck pathing, invalid targets, and unexpected behavior.

Future slime AI passes should build on this foundation in order: needs and drives choose intent, perception discovers possible targets, autonomous movement executes map goals, feeding consumes local resources, habitat response adjusts comfort and movement, stress/threat response changes behavior under pressure, and containment/combat/job/social behavior can then use the same shared state model.

## Adaptive Skills and Abilities

Skills are practiced domains. They represent something a creature, scientist, or other actor can actively practice, apply, refine, or perform. They are not passive biology and they are not every derived gameplay result.

Stats describe hidden biological capacity. Traits describe biological identity. Skills describe practiced capability. Abilities describe specific actions, techniques, procedures, or maneuvers made possible by skills. Outcomes describe what happens when traits, hidden stats, skills, current condition, equipment, and environment interact.

A skill should be something the actor can practice. An ability should be something the actor can do. An outcome should be something the game calculates.

Level 0 skills should not appear on character sheets. If an actor has not reached level 1 in a skill, that skill does not exist for that actor in player-facing UI. Practice below level 1 can exist as hidden progress, but the sheet should only populate once a skill becomes an Initiate skill.

Skills now use a shared curve with an effective cap of level 320. Tiers are Initiate 1-50, Novice 51-100, Adept 101-150, Master 151-200, Heroic 201-250, Legendary 251-300, and Divine 301-320. Breakthroughs happen automatically at 0 -> 1 and every 50-level tier boundary after that. A breakthrough costs the normal level cost from 20 levels higher; for example, 0 -> 1 uses the normal 20 -> 21 cost, and 50 -> 51 uses the normal 70 -> 71 cost. Overflow XP does not carry through a breakthrough, so crossing into a new tier starts clean at 0 XP toward the next level. Breakthrough progress decays only while the actor is sitting at a breakthrough threshold: after 24 in-game hours without practicing that skill, stored threshold progress decays by 10% of the current breakthrough requirement per in-game day. Earned levels do not decay. Failed or low-confidence actions can still teach, but they award reduced XP; the current prototype uses full XP for success, half XP for partial results, one-quarter XP for failure, and no XP for cancelled actions.

Base skills should be broad world-scale domains, not narrow lab job titles. The current prototype scientist skill domains are:

- Analysis
- Perception
- Creature Handling
- Fabrication
- Husbandry
- Alchemy
- Materials Science
- Creature Lore
- Medicine

These names should make sense beyond the starting scientist. Hunters, soldiers, nobles, monsters, assistants, and future non-slime creatures should be able to use the same system. More specialized names belong at higher tiers or after lived specialization. For example:

- Fabrication can later evolve into Biofabrication, Container Fabrication, Warded Fabrication, or Ritual Fabrication.
- Alchemy can later evolve into Arcane Chemistry, Toxic Alchemy, Reagent Alchemy, or Elemental Reagents.
- Creature Handling can later evolve into Containment Handling, Predator Handling, Slime Handling, or another creature-family specialty.
- Husbandry can later evolve into Slime Husbandry, Brood Husbandry, Monstrous Husbandry, or other care/reproduction specialties.
- Analysis can later evolve into Combat Analysis, Surgical Analysis, Creature Analysis, or another reading specialty.
- Perception can later evolve into Threat Perception, Arcane Sense, Tracking, or another awareness specialty.

Examples of creature or combat skills:

- Toughness
- Striking
- Grappling
- Evasion
- Guarding
- Perception
- Thermal
- Electrical
- Corrosive
- Toxic
- Arcane
- Blades
- Axes
- Firearms
- Surgery
- Animancy

Examples of abilities:

- Analyze
- Flame Jet
- Shock Arc
- Acid Spit
- Locking Grapple
- Crushing Grip
- Wall Cling
- Emergency Clamp
- Sterile Incision
- Suppressive Fire
- Axe Hook

Examples of outcomes:

- containment pressure
- job suitability
- collection rate
- combat damage
- escape risk
- tool wear
- room contamination
- market value

Byproduct production is not a skill. A slime does not train byproduct control simply by existing and producing its natural output. Natural byproduct production is biology and condition-driven output. Skills may influence related procedures or active abilities, but routine production itself is not a skill.

Movement is not a skill as a broad category. Specific practiced forms such as climbing, swimming, burrowing, squeezing, dodging, or pouncing can be skills if they matter mechanically and can improve through use.

The current first-pass creature skill foundation stores slime skill practice hidden from the normal specimen sheet until Analyze exists. Slimes can currently gain hidden practice from meaningful actions such as perceiving stimuli, surviving combat damage, striking, elemental clashes, elemental attacks, and fleeing from remembered danger. Level 0 practice remains invisible and does not count as an existing displayed skill. Normal sustenance, digestion, passive byproduct production, and generic movement are not skills.

Basic tools such as gloves, tongs, hook poles, scrapers, trays, clamps, and simple restraints can belong under broad world skills such as Creature Handling, Fabrication, or future tool-family skills. More complex, dangerous, or specialized tools and weapons can have their own skill families, such as Blades, Axes, Firearms, Surgery, Animancy, or specialized machinery.

Elemental skill names should remain flexible. The tier should be metadata, not forced grammar. Skills should be displayed as a skill name with a tier tag, such as Flame [Initiate], Smoldering Flame [Novice], Electricity [Initiate], Arcing Current [Adept], Acid [Initiate], or Corrosive Acid [Novice]. This avoids trapping all skills into a rigid Initiate-of-X naming pattern.

Specific elemental techniques such as Flame Jet, Shock Arc, Acid Spit, or Heat Pulse are abilities derived from elemental skills, not the skills themselves. A creature might have Flame [Initiate] and later evolve it into Smoldering Flame [Novice], gaining or improving abilities such as Smoke Vent, Ember Cloud, or Choking Heat. Another creature might evolve the same initial skill into a different Novice form and fight very differently.

Skills should evolve based on use, pressure, and lived experience. Two creatures with similar species, genes, or starting skills can become different because they practiced different things, survived different situations, or were shaped by different environments. The goal is that the same monster type should not always imply the same fight.

Skill tiers are Initiate, Novice, Adept, Master, Heroic, Legendary, and Divine. Each tier represents both advancement and increasing specialization. Higher-tier skill names should reflect the path that shaped them, not only numerical improvement.

Analysis is the parent skill for interpreting practiced capability. Analyze is the base magical ability derived from Analysis. All magical abilities should consume Mana and be basically instant unless a specific ability has a charge-up, ritual, or wind-up reason.

The scientist starts with Analysis [Initiate], level 1, which grants base Analyze. Base Analyze can be used on a living specimen in the lab UI. It costs Mana immediately and reveals only practiced creature capabilities that already exist at level 1 or above, plus broad learned behavior memories. Base Analyze shows skill name and tier, such as Toughness [Initiate], but not exact levels. It does not reveal level 0 practice, raw XP, stats, genes, hidden biological traits, exact formulas, hidden output values, weaknesses, or compatibility formulas.

Analyze output is ability-defined, not continuously determined by the current level of Analysis. At the Novice breakthrough, level 51, Analysis evolves based on how its XP was earned during the previous tier. Creature-focused practice evolves it into Creature Analysis, which grants Advanced Analyze. Combat-shaped practice evolves it into Combat Analysis, which grants Combat Analyze. Necropsy, diagnostic, corpse, tissue, and evidence work evolves it into Forensic Analysis, which grants Forensic Analyze. Material and tool-heavy practice can evolve it into Material Analysis as a future path. The evolved name is displayed as the skill name, while the broad parent remains Analysis internally.

Advanced Analyze costs Mana and reveals exact levels only for skills that base Analyze has already identified; it does not discover new hidden skills by itself. Combat Analyze costs Mana and reads a living target's broad combat intent, threat band, target/action, and observed or obvious damage tags without revealing genes, hidden stats, formulas, or exact weaknesses. Forensic Analyze costs Mana and reads corpse evidence: broad cause, tissue state, harvest/evidence usefulness, and storage risk. Later Analysis evolutions can add Deep Analyze, material reads, ability hints, or evolution-path reads. Base Analyze should remain a stable, simple read.

Creature skill evolution now happens immediately at tier breakthrough. The game chooses an evolved display label from the skill's practice tags, such as Lashing Strikes for combat-shaped Striking, Prying Strikes for containment-shaped Striking, Scarred Toughness for injury-shaped Toughness, or Dissolving Touch for containment-shaped Corrosive practice. The parent skill ID remains broad internally, so systems can still reason about Striking, Toughness, Corrosive, and similar domains without treating passive biology as fake skills.

The player may eventually see information like:

- Toughness [Initiate]
- Toughness [Initiate], level 3 after Advanced Analyze
- Pouncing [Novice]
- Corrosive [Initiate]
- Combat Analysis [Novice], level 61

The player should not see information like:

- Strength: 18
- acid potency: 1.34
- hidden stress value
- genetic byproduct slot
- weak to mineral solvents
- container compatibility multiplier

Genes and traits define biological possibility. Hidden stats define capacity. Skills define practiced capability. Abilities define specific actions. Outcomes are produced when all of those things interact with the world.

## Future Systems

Likely future systems:

- Starting scenarios with different resources, protection, time pressure, and threats.
- Modular difficulty settings for journal support, Suspicion, resources, mutation, danger, and gene-map complexity.
- Suspicion, evidence, raids, cover stories, and lab secrecy.
- Money, biomass, reagents, lab space, equipment, orders, construction, and black market access.
- Black market reputation, freeform sales, byproduct markets, and commissioned creature requests.
- Equipment and resource-gated testing.
- Test failure or inconclusive results based on skill, equipment, and sample difficulty.
- Adaptive skill evolution where practiced skills evolve into specialized forms based on use, pressure, biology, environment, and lived experience.
- Abilities derived from skills, such as Flame Jet from a fire-related skill or Locking Grapple from a grappling-related skill.
- Analyze-style abilities for combat appraisal, forensic reads, ability hints, and skill evolution paths without revealing stats, genes, biological traits, weaknesses, or hidden formulas. Exact creature skill levels require Advanced Analyze and only apply to skills already identified by base Analyze.
- Mutation as a risk layered on top of deterministic genetics.
- Creature stats derived from physical compatibility, affinity, stability, and biology.
- More meaningful containment, risk, escape, and lab safety systems.
- Reproduction goals, recombination goals, and practical uses for creatures.
- Creature jobs such as production, hazardous disposal, defense, spying, assassination, construction support, and research assistance.
- Intelligent created species that can act as assistants or agents while carrying betrayal and autonomy risks.
- Advanced corpse harvesting for biomass, organs, genetic samples, elemental residue, remaining byproducts, reagents, or contaminated waste beyond the current broad harvested-material ledger.
- Corpse disposal and processing chains using equipment, facilities, or living creatures such as acid slimes.
- Deeper processing chains that can turn local feeding residue and harvested specimen materials into useful or dangerous outputs without overwriting natural byproduct identity.
- Natural byproduct collection through Collection Bay stations, including Specimen Drainage Tanks for drip/sludge/gel routing, station receptacles for accumulated material, per-station overflow buffers, and hood/condenser workflows for vapor/haze/fume/mist outputs.
- Inventory outputs from collected byproducts, recorded through inventory history/tooltips instead of event-log accounting spam.
- Map-first contextual command UI with inspectors, hotkeys, menus, overlays, and management panels organized around the physical lab.
- A gradual frontend architecture split between state, systems, commands, selectors/view models, UI rendering, and a replaceable map renderer.
- Hybrid rendering with HTML/CSS for management UI and a future Canvas map layer if actor count, sprites, animation, zoom/pan, or combat visualization outgrow DOM tiles.
- Necropsy research should eventually improve effectiveness analysis for living specimens and pre-synthesized genome predictions.
- Recruitment, base expansion, authority conflict, territory control, and eventual world conquest.
- A clearer distinction between casual observation, lab testing, and precise instrument readings.
- A richer journal that helps the player reason from partial discoveries without spoiling hidden mappings.
- Null affinity as active anti-magic, distinct from having no affinity.

Open design questions:

- What starting scenarios should ship first, and which difficulty settings should be separate sliders?
- How should Suspicion be generated, hidden, reduced, or converted into authority actions?
- When should the game transition from lab survival to local-government conflict and then world conquest?
- How much should movement affect future mechanics?
- How should weak or biologically clashing creatures be communicated to the player?
- What jobs or pressures will make creature stats matter?
- How much should the lab economy rely on byproducts, contracts, hazards, or research milestones?
- How should natural byproduct collection become economically useful without turning every specimen into a passive money printer?
- When should observation/testing reveal output quality hints while still hiding exact rolls and gene mappings?
- How should adaptive skill evolution avoid creating fake skills for passive biology or derived outcomes?
- How visible should skill levels be before the player has enough Analysis or direct observation to read them confidently?

## Current Prototype

- Clickable ASCII DNA helix with paired bases.
- Distinct color coding for A, C, G, and T.
- Seeded procedural gene mapping for repeatable runs.
- Slime synthesis from 26-base genomes with a Biomass cost.
- Core stockpile resources: Biomass, Genetic Material, Elemental Residue, Waste, and broad feedstock resources.
- Passive prototype feedstock income for basic material feedstocks, plus generated Carrion Feedstock and Contaminated Feedstock from relevant systems.
- Slime condition stats for Body Integrity, Nutrition, Current Mass, Division Pressure, and Stress.
- Genetic shape and appendage traits.
- Genetic body consistency.
- Shape-aware size dimensions.
- Derived weight and derived movement.
- Discovered-trait identity strip with color, element, shape, and byproduct slots.
- Broad category icons for discovered shape and byproduct outcomes.
- Element-compatible and physiology-compatible natural byproducts.
- Natural output intensity bands with hidden rolled expression values, broad metabolic demand labels, and condition-shaped current expression.
- Observable traits with scientist estimate ranges.
- Sustenance outcomes have hidden categories that can support job suitability, future feedstocks, environmental feeding, and room/container systems.
- Manual feeding can restore Nutrition and Current Mass, while bad matches can create Stress, Waste, or Body Integrity damage.
- Loose autonomous feeding can consume local residue, loose waste, or accessible remains, using Sustenance match quality to determine speed, Nutrition, Current Mass, Stress, Body Integrity risk, and whether messy residue is left behind.
- Loose slimes can follow qualitative adjacent-room food traces through the map, but only exact same-room targets can be directly consumed.
- Derived slime Habitat fit based on discovered and hidden biology, with selected-slime readouts for known supports, known concerns, and unknown factors.
- Habitat effects gently change Stress, natural byproduct expression, active containment pressure, and loose-slime room seeking.
- Loose slimes can follow qualitative adjacent-room environmental traces when a nearby room is substantially better habitat.
- Selected slime Activity panel and Cheat-panel Slime AI Debug readout for broad player-facing behavior state plus deeper development inspection of drives, perception, pathing, responses, combat decisions, and blockers.
- Derived slime threat response with calm, wary, agitated, pained, panicked, and desperate bands, recent-injury memory, selected-slime readouts, and light loose-slime idle reactions when food and habitat are not already driving behavior.
- First-pass Group Behavior readout for nearby slimes, contact, kin, non-kin, crowding, competition, territorial pressure, and protected kin attack suppression.
- Element-derived damage tags and broad resistance readouts for discovered slimes, containers, and handling tools; byproducts do not contribute damage tags in this first pass.
- Best-match feeding is available once a slime's Sustenance is discovered.
- Main Lab room foundation with dynamic Temperature, Light, Ambient Mana, Moisture, Contamination, and Electrical Charge.
- Additional room foundations including Menagerie, Pit, Bedroom, Storage Room, and Collection Bay.
- Collection Bay station readout for natural byproduct collection methods, condition-shaped production, receptacle fill levels, and per-station overflow.
- Specimen Drainage Tank foundation for drip/sludge/gel specimen housing and output routing.
- Hood venting readout and condenser-flask receptacles for vapor/haze/fume/mist byproduct support.
- Room attributes have current values, baselines, passive recovery, and descriptive player-facing bands.
- Timed tests that can reveal more precise trait information.
- Natural splitting from sustained full mass, with Brood Size controlling offspring count and strict mass division across parent and offspring.
- Forced Recombination as the current two-parent lab intervention, with parent and offspring mass shared instead of free full-sized copies.
- Parent IDs and brood IDs for new offspring, supporting protected parent/offspring and sibling recognition.
- Lifespan, maturity, living sample storage, release, and containment states.
- Active containment testing that can produce physical breach outcomes such as seeped seals, forced openings, cracked containers, dissolved walls, overturned spills, and fitting failures.
- Container breach states that distinguish compromised-but-usable containers from breached containers that cannot hold specimens until future repair or replacement.
- Deceased specimens move out of living storage and into waste drums.
- Corpse states include fresh, decaying, spoiled, ruined, and overflow pressure.
- Fresh corpse necropsy reveals remaining unknown genetic traits for that specimen.
- Necropsy produces an effectiveness report and ruins the corpse without disposing of it.
- Fresh necropsy recovers a small amount of Genetic Material.
- Dumping corpses outside removes them from waste drums while increasing Suspicion.
- Suspicion is shown as a status band, with hidden exact values, delayed passive decay, and a floor based on the highest band reached.
- Dedicated Policies panel for automation rules, including Corpse Processing target states and configurable auto-feeding behavior.
- Individual slimes can be excluded from global automation for testing or deliberate starvation/growth control.
- Creature Jobs panel with idle assignment, Corpse Processing, and Waste Disposal.
- Pit holes behave as large dirt containment containers, not loose rooms; contained slimes and contained corpses can share the same pit interior.
- Corpse Processing requires the worker slime and target corpse to be in the same pit container, then turns policy-approved remains into Biomass, Carrion Feedstock, and pit-local tagged Waste while affecting slime condition.
- Waste Disposal requires an assigned slime in a pit container with pit-local Waste, then reduces that interior Waste over time with small Elemental Residue output, condition-stat effects, and suitability learned through observed speed, exposure, and contamination.
- Visible job suitability stays unknown unless discovered traits provide an obvious positive or negative signal; hidden biology can still affect actual job performance.
- Scientist stat sheet with health, stamina, mana, and learned skills only; level 0 practice stays off the sheet until a skill reaches Initiate.
- First-pass adaptive skill foundation with world-scale domains such as Analysis, Creature Handling, Fabrication, Husbandry, Alchemy, Materials Science, Creature Lore, and Medicine.
- Analysis specialization at Novice based on dominant practice history, currently supporting Creature Analysis with Advanced Analyze, Combat Analysis with Combat Analyze, and Forensic Analysis with corpse evidence reads.
- Creature skill evolution labels at breakthrough based on practiced use, while parent skill IDs remain broad internally.
- Stamina costs, passive regeneration, and queued rest actions.
- XP, resource, room, and inventory cheat commands for testing skill progression, resource-gated systems, room conditions, and inventory state.
- Storage Room ledger with Materials and Tools & Supplies categories.
- Inventory item history tooltips for routine accounting changes instead of event-log spam.
- Reusable handling tools including Thick gloves, Long tongs, Hook pole, and Scraper, with individual durability, condition bands, usable/broken gating, broad resistance readouts, and hazardous handling wear.
- Paused start with selectable time speeds from real-time through accelerated waits.
- Collapsible time queue drawer with manual skip, next-event skip, and next-queue skip controls.
- Keyboard shortcuts: Space pauses, 1-5 select speeds, [ and ] step speed, . skips to next event, Shift+. skips to the next queued task, O cycles map overlays, and Shift+O cycles overlays backward.
- Automatic, manual, and disabled journal modes.
- Local save, import, export, and save-to-folder support.

Trait outcomes and gene mappings are intentionally hidden during normal play so they can be discovered experimentally.

## Development Notes

- Keep the game runtime dependency-free unless a feature clearly needs a library.
- Preserve the discovery loop by avoiding public documentation of exact trait outcomes or hidden gene mappings.
- Favor small commits after meaningful feature passes or bug fixes.
- This is a prototype, so systems may be renamed or reshaped as the design becomes clearer.
- Prefer gradual architecture refactors over a full engine rewrite unless the browser foundation reaches a clear technical limit.
- Do not update the changelog for every prototype tweak; reserve it for milestone-ready versions.
