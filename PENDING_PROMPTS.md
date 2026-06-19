\# Pending Prompts



This file contains Codex prompts that are waiting to be discussed and eventually implemented.



Remove a prompt after it has been discussed, implemented, tested.



Codex should read `DESIGN\_BIBLE.md` first, then use this file for the current implementation plan.



Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from PENDING_PROMPTS.md automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.


\## Current Priority Order



1\. Environmental feeding effects

2\. Container foundation and synthesis tube

3\. Container materials and passive suitability

4\. Container isolation and environmental exchange

5\. Active behavior risk and containment incidents



\---





\## 1. Environmental Feeding Effects

In addition to the discussion, I don't think the full genetic sequence is important or scannable information. Therefore it does not belong at the top of a creature card. It should be moved to the bottom. 

Also, I think cheats should all live in the cheats tab, so the room cheat should be moved there. 

Design discussion: environmental feeding effects.

Do not make code changes yet.

I want feedback on the design before deciding how environmental feeding should work. Challenge assumptions, identify potential issues, suggest alternatives, and ask clarifying questions.

Assumption:

The Sustenance overhaul has already been designed or implemented.

The first-pass food system has already been designed or implemented.

Rooms and dynamic room attributes have already been designed or implemented.

Environmental feeders exist as a Sustenance category.

Slimes have condition stats such as Nutrition, Current Mass, Division Pressure, Body Integrity, and Stress.

Natural splitting requires full current mass, sustained fullness, stability, and low stress.

Current goal:

Make environmental-feeding slimes interact with room attributes.

Environmental feeders should no longer be treated as having infinite food with no consequences once room attributes exist.

Environmental feeding should generate Nutrition and Current Mass slowly by consuming an actual room condition or resource.

The consumed room condition should change over time, but room conditions should also be replenished by sources such as lights, ventilation, equipment, outside exchange, wards, or other room systems.

Keep this as a first-pass environmental feeding system.

Do not implement container isolation yet unless it is absolutely necessary.

Do not implement full containment incidents yet.

Do not implement complex room construction, HVAC, electrical infrastructure, or equipment networks yet.

Core idea:

Environmental feeders consume something present in their room.

They gain Nutrition and possibly Current Mass from that consumed condition.

The room condition is affected by both sources and drains.

Environmental feeding should be slower than direct material feeding.

Environmental feeding can be useful, harmful, or both depending on the room and other creatures nearby.

Room attributes as dynamic balances:

Room attributes are not static stockpiles.

A room condition should have a current level and may have a baseline or target level.

Sources push the condition upward or toward a target.

Drains pull the condition downward or away from a target.

Recovery or exchange behavior can move the condition back toward baseline over time.

Environmental feeders are drains on specific room conditions.

Room fixtures and outside exchange are sources or stabilizers.

Examples of room sources:

Overhead lights constantly produce Light.

Ventilation circulates outside air and can affect Temperature, Moisture, Contamination, and fumes.

Equipment may generate Heat, Electrical Charge, Contamination, or magical leakage.

Wards, rituals, reagents, or ambient magical saturation may produce Ambient Mana.

Water sources, leaks, wet creatures, or humidifiers may increase Moisture.

Corpses, waste, failed jobs, and accidents may increase Contamination.

Examples of environmental feeding drains:

Heat-feeding slimes remove Heat and lower Temperature.

Light-feeding slimes consume available Light.

Mana-feeding slimes drain Ambient Mana.

Moisture-feeding slimes dry the room.

Electricity-feeding slimes drain Electrical Charge.

Fume-feeding or contamination-feeding slimes may reduce Contamination.

Possible environmental feeding mappings:

Heat feeder consumes room Temperature / Heat and makes the room colder.

Light feeder consumes room Light and makes the room darker.

Mana feeder consumes Ambient Mana and lowers magical saturation.

Moisture feeder consumes Moisture and dries the room.

Electricity feeder consumes Electrical Charge and reduces available charge or instability.

Chemical-fume feeder consumes Contamination or fumes and may clean the room.

Thaumic-radiation feeder consumes magical leakage or arcane contamination if that attribute exists.

Important distinction:

Environmental feeding consumes actual available conditions or resources.

Absence states are not food.

Darkness, cold, silence, and vacuum should not be treated as sustenance sources.

A slime may prefer darkness or cold, but that is environmental preference, not Sustenance.

A frost slime might absorb heat and thereby make the room colder; it does not eat cold.

A shadow slime might prefer darkness, but should still feed on something real such as ambient mana, shadow residue, fear, corpses, psychic energy, or another actual substance.

Room balance examples:

A heat-feeding slime in the Main Lab slowly gains Nutrition and Current Mass while lowering room Temperature.

If ventilation, equipment, lamps, or outside exchange add enough heat, the room may stay near normal.

If the slime consumes heat faster than the room replenishes it, the room becomes cool or cold.

If the room is already cold, the heat-feeding slime has less available heat and feeds more slowly.

A light-feeding slime under strong overhead lights can feed steadily, but may dim the room if consumption exceeds light production.

A mana-feeding slime can survive in a mana-rich room, but may drain Ambient Mana needed for arcane equipment or other creatures.

A moisture-feeding slime may dry a damp room, which can be useful for storage but bad for watery or moisture-loving slimes.

A fume-feeding slime may reduce Contamination, making it useful as a cleanup organism.

Availability and diminishing returns:

Environmental feeding should depend on how much of the relevant room condition is currently available.

If the condition is abundant, the slime feeds faster.

If the condition is low, the slime feeds slowly or stops.

If production exceeds consumption, the room condition should stay stable or recover.

If consumption exceeds production, the room condition should fall.

Environmental feeders should not generate infinite mass from an exhausted room.

A room can recover through its sources, baseline exchange, or future equipment.

Possible first-pass implementation:

Add a periodic environmental feeding update.

For each living slime with an environmental Sustenance tag, check its current room.

Identify the matching room condition.

Determine available supply based on current room level and source/drain balance.

Increase the slime’s Nutrition and/or Current Mass slowly based on available supply.

Apply the slime’s environmental drain to the room condition.

Let existing room recovery/source logic push the condition back toward baseline over time.

If the matching condition is too low, provide little or no gain.

Optionally increase Stress if the slime cannot access its needed sustenance for a long time.

Keep rates slow and easy to tune.

Player communication:

The player should be able to see that an environmental feeder is gaining nutrition from the room.

The player should be able to see that the room condition is changing.

The UI does not need to expose exact formulas.

Event log messages or room/slime status text should make cause and effect clear.

Example: “RG-014 absorbed heat from Main Lab. Temperature dropped to Cool.”

Example: “RG-021 has little light available and is barely feeding.”

Example: “Main Lab lights are keeping up with RG-008’s light absorption.”

Example: “RG-017 is draining Ambient Mana faster than the room recovers.”

Interactions with feeding policy:

Environmental feeders should not consume inventory food when their environmental sustenance is available.

Auto-feeding policy should treat environmental feeding differently from material feeding.

If an environmental feeder is starving because its room condition is depleted, the policy may eventually allow fallback foods, but that does not need to be implemented in the first pass unless simple.

The player should not have to manually feed environmental feeders if the room can support them.

Interactions with other systems:

Environmental feeding should affect Nutrition and Current Mass.

Environmental feeding may eventually affect Division Pressure by helping a slime remain full and at full mass.

Environmental feeding may affect Stress if the room condition is unsuitable or depleted.

Environmental feeding should eventually interact with containers, but container isolation can wait.

Environmental feeding should eventually interact with room specialization, but room construction can wait.

Scope limits:

Do not implement container isolation yet.

Do not implement internal container conditions yet.

Do not implement full containment incidents yet.

Do not implement complex room construction yet.

Do not implement detailed HVAC, lighting infrastructure, generators, mana wells, humidifiers, or equipment networks yet.

Do not add absence-state feeding such as eating darkness or cold.

Do not rebalance every job around environmental feeding unless a small compatibility update is necessary.

Keep this pass focused on making environmental Sustenance interact with dynamic room attributes.

Questions for discussion:

Which environmental Sustenance outcomes should be supported in the first pass?

Which room attributes should be consumed by each environmental sustenance?

Should environmental feeding increase Nutrition, Current Mass, or both?

Should environmental feeding be much slower than inventory-based feeding?

How should diminishing returns work when a room condition gets low?

How should sources and drains be represented in a simple first-pass model?

Should room conditions recover toward baseline every tick, at intervals, or only when affected?

Should depleted environmental food increase Stress, reduce Current Mass recovery, or simply stop feeding?

Should environmental feeders ever consume inventory food as a fallback?

How should automatic feeding policy treat environmental feeders?

Should environmental feeding generate event log messages, status text, or both?

How should environmental feeding affect Division Pressure?

What should be explicitly left out until container isolation and specialized rooms are implemented?

What is the smallest implementation that makes environmental feeding meaningful without overbuilding room simulation?

Design goals:

Make environmental Sustenance outcomes matter.

Let slimes gain Nutrition and Current Mass from room conditions.

Make environmental feeding slow, useful, and consequence-bearing.

Treat room attributes as dynamic balances with sources and drains, not static buckets.

Make room attributes meaningful.

Avoid infinite free growth once room systems exist.

Preserve the distinction between sustenance sources and environmental preferences.

Prepare for future container isolation, specialized rooms, room equipment, and lab management.

Keep the first version simple, readable, and easy to tune.

Do not modify files until we have agreed on the design and scope.





\---



\## 2. Container Foundation and Synthesis Tube



Design discussion: container foundation and synthesis tube.

Do not make code changes yet.

I want feedback on the design before deciding how the first container pass should work. Challenge assumptions, identify potential issues, suggest alternatives, and ask clarifying questions.

Assumption:

The game already has living slimes, storage capacity, slime stats, jobs, corpses, waste, resources, time controls, and policies.

The game either has, or will soon have, room foundation and room attributes.

This prompt is only for the first container pass.

Do not implement full material suitability yet.

Do not implement container isolation yet.

Do not implement containment incidents or escape events yet.

Do not implement full room/container environmental simulation yet.

Current issue:

Living slimes currently occupy generic containment/storage slots.

This works for the prototype, but it does not feel like the lab is physically holding dangerous organisms.

The next step should be establishing individual containers as real lab objects.

Before containers have detailed materials, isolation, or danger calculations, the game needs a basic container foundation.

Current goal:

Add a first-pass individual container system.

Add the synthesis tube as a special temporary perfect container.

Newly synthesized slimes should initially appear in the synthesis tube.

The player cannot synthesize another slime while the synthesis tube is occupied.

The player must move the slime out of the synthesis tube before synthesizing again.

Existing generic storage should begin transitioning toward individual containers.

Synthesis tube concept:

The synthesis machine functions like a sci-fi liquid-filled suspension tube.

It is warded against all elements and designed to safely hold newly created organisms.

The synthesis tube is effectively a perfect temporary container.

It is safe for any newly synthesized slime regardless of size, element, behavior, consistency, or body plan.

It allows the scientist to run early tests before committing the slime to a permanent container.

It is not intended to replace normal containment.

It should hold only one slime at a time.

If the synthesis tube is occupied, synthesis should be blocked with a clear UI message.

To synthesize again, the current tube occupant must be assigned to a permanent container, released, sold, disposed of, or otherwise removed from the tube.

Important design direction:

Containers should eventually be individual lab objects.

A slime should have a container assignment or a clear non-container location/status.

The first pass should prioritize data structure, save/load behavior, migration, UI clarity, and basic movement between container states.

Do not try to solve all future containment problems in this pass.

This pass should create the foundation for later container material properties, suitability, isolation, capacity pressure, and containment incidents.

Possible first-pass container states:

Synthesis Tube: special perfect temporary container.

Basic Container: generic permanent container placeholder.

Released: not in a container, present in the room/lab.

Dead: no longer in living containment.

Future states can include sold, transferred, escaped, quarantined, or assigned to specialized rooms.

Possible first-pass rules:

New games start with one synthesis tube.

New games start with a small number of basic permanent containers.

Existing saves should migrate contained living slimes into basic containers.

Existing released slimes should remain released.

Dead slimes should remain corpses/waste-drum specimens and should not occupy containers.

Synthesis should create a slime in the synthesis tube instead of directly adding it to generic storage.

Synthesis is blocked if the synthesis tube is occupied.

Moving a slime from the synthesis tube to a basic container should free the tube.

If no basic container is available, the player must release the slime or otherwise remove it before synthesizing again.

Possible data model:

Add a containers collection to game state.

Each container has an id, name, type, roomId if rooms exist, occupant slime id, and basic status.

The synthesis tube can be represented as a special container type.

Slimes can reference their container id, or containers can reference occupant ids, or both if kept carefully synchronized.

Use helper functions for assigning, moving, and removing slimes from containers.

Avoid scattering raw container edits throughout the code.

Possible UI:

Show the synthesis tube status near the synthesis controls.

If occupied, show the occupant and block the Synthesize button.

Add a basic Containers panel or container summary.

Show each basic container and its occupant.

Let the player move a slime from the synthesis tube to an open basic container.

Let the selected slime panel show where the slime is located.

Use clear messages such as:

“Synthesis tube occupied by RG-014.”

“Move or release the current tube occupant before synthesizing again.”

“RG-014 assigned to Basic Container 2.”

“No open permanent container is available.”

Important scope limits:

Do not implement glass jars, iron tanks, ceramic vessels, or other detailed container types yet unless needed as placeholders.

Do not calculate whether a container is physically suitable for a slime yet.

Do not add material durability, seal quality, leakage, arcane insulation, or element resistance yet.

Do not implement overcapacity from natural splitting yet.

Do not implement container damage yet.

Do not implement escape events yet.

Do not implement container-based environmental isolation yet.

Do not rebalance all jobs around containers yet.

Keep the first pass focused on making containers exist and making the synthesis tube rule work.

Questions for discussion:

Should containers be individual objects, typed slots, or a hybrid?

Should slimes reference containers, containers reference slimes, or both?

How should old saves migrate from generic storage to basic containers?

How many basic permanent containers should a new run start with?

Should basic containers replace the current storage capacity immediately, or coexist with it during migration?

Should the synthesis tube count against storage capacity, or be separate from permanent storage?

Should tests be allowed while a slime is in the synthesis tube?

Should some tests be easier, safer, or faster in the synthesis tube, or should that wait?

What actions should remove a slime from the synthesis tube?

What should happen if there are no open permanent containers?

How should the UI communicate synthesis blocking clearly?

How should released slimes interact with this first-pass container system?

What helper functions are needed to keep container assignment clean?

What should be explicitly left out until the material suitability pass?

What is the smallest implementation that makes containers real without overbuilding containment?

Design goals:

Make the lab feel like it physically holds organisms in containers.

Establish the synthesis tube as a special perfect temporary container.

Prevent synthesis while the synthesis tube is occupied.

Replace or prepare to replace abstract storage slots with individual containers.

Create a clean foundation for later material suitability, container isolation, capacity pressure, and containment incidents.

Keep this pass small, save-safe, readable, and testable.

Do not modify files until we have agreed on the design and scope.







\---



\## 3. Container Materials and Passive Suitability



Design discussion: container materials and passive creature-container suitability.

Do not make code changes yet.

I want feedback on the design before deciding how container materials and passive suitability should work. Challenge assumptions, identify potential issues, suggest alternatives, and ask clarifying questions.

Assumption:

The first container foundation pass has already been designed or implemented.

Individual containers exist or are planned as real lab objects.

The synthesis tube exists as a special perfect temporary container.

Newly synthesized slimes appear in the synthesis tube.

Synthesis is blocked while the synthesis tube is occupied.

Slimes can eventually be moved from the synthesis tube into permanent containers.

This prompt is only for container material properties and passive creature-container suitability.

Do not implement active behavior risk yet.

Do not implement escape events yet.

Do not implement container isolation for room attributes yet.

Do not implement containment incidents yet.

Current issue:

Basic containers establish where slimes are held, but they do not yet care about what they are made of or whether they are appropriate for a specific slime.

Slimes have physical traits such as size, shape, body consistency, appendages, weight, movement, element, stability, behavior, and current mass.

A container should not be good or bad in isolation.

A container should be good or bad for a particular creature.

Current goal:

Add material and structural properties to permanent containers.

Add passive creature-container suitability checks.

Make container choice feel physical and intuitive.

Create warnings or suitability bands that help the player understand when a container is safe, questionable, or unsuitable.

Keep this as a passive suitability pass, not a full containment incident system.

Core idea:

Passive suitability asks whether the container can physically hold the creature under normal conditions.

This should consider the creature’s body, mass, element, consistency, leakage risk, and container structure.

Active behavior risk should be handled later.

Example: a watery slime in an open tray is a problem even if it is docile, because it can leak or flow out without trying.

Example: a heavy metal slime in a fragile glass jar is physically questionable because the container may not tolerate its weight.

Example: an acid slime in a vulnerable material is risky because corrosion may occur.

Example: a docile metal slime may be passively heavy but not actively aggressive; active breach likelihood should wait for the behavior-risk pass.

Possible container properties:

Capacity / maximum safe size

Maximum safe weight

Material

Durability

Fragility

Seal quality

Gap size / leak resistance

Porosity

Ventilation

Visibility / observation quality

Drainage

Ease of cleaning

Physical reinforcement

Element resistance

Corrosion resistance

Puncture resistance

Crush resistance

Basic room assignment if rooms exist

Possible material properties:

Glass: high visibility, fragile, low weight tolerance, poor against impact and some corrosive effects.

Reinforced glass: high visibility, better durability, more expensive.

Iron or steel: durable, opaque or low visibility, strong weight tolerance, conductive, may be vulnerable to rust, acid, storm, or magnetic effects later.

Ceramic: good insulation, good against some corrosion, brittle against impact.

Stone: heavy, durable, low visibility, good for heat or acid depending on final rules.

Warded material: expensive, broadly safer against elemental or magical effects.

Flexible membrane: good for odd shapes, poor against punctures, cutting, corrosion, or sharp crystalline forms.

Open tray: easy access and observation, poor containment for mobile, watery, runny, climbing, or leaking slimes.

Sealed tank: good for watery or runny slimes, may have ventilation or pressure concerns later.

Soft-lined container: useful for brittle, crystalline, fragile, or impact-sensitive slimes.

Possible early container types:

Basic glass jar

Sealed glass tank

Reinforced tank

Iron cage or frame

Ceramic vessel

Stone basin

Warded containment pod

Soft-lined containment box

Open tray

Sealed drainage tank

Passive compatibility factors:

Size: can the creature physically fit?

Current Mass: is the creature currently small enough, even if it may regrow later?

Natural Maximum Size: will the creature outgrow this container?

Weight: can the container support the creature safely?

Shape: does the body plan fit the container?

Body Consistency: can the creature leak, seep, shatter, flow, cling, or deform?

Appendages: can appendages slip through gaps, catch on surfaces, or require extra room?

Movement: can the creature climb, squeeze, fly, crawl, or push through openings?

Element: does the creature’s affinity threaten the material?

Byproduct: does the creature produce substances that damage, clog, contaminate, or leak from the container?

Stability: does the creature create passive biological risk even before behavior is considered?

Natural splitting and capacity awareness:

This pass does not need to implement natural-splitting incidents.

However, container suitability should be designed with future splitting pressure in mind.

A container that safely holds one full-sized slime may become unsafe if that slime later splits and both parent and offspring regrow.

The system should eventually distinguish current fit from future capacity risk.

For now, consider whether containers should display current capacity and potential capacity warnings.

Important distinction:

Passive suitability means “Can this container physically hold this slime under ordinary conditions?”

Active behavior risk means “Is this slime likely to challenge the container?”

This pass should focus on passive suitability.

Behavior, Stress, and active escape attempts can be handled in a later containment-risk pass.

However, the data model should not block behavior from being added later.

Possible suitability display:

Safe

Questionable

Poor Match

Unsuitable

Unknown / Not Evaluated

Possible warning examples:

“Too heavy for fragile glass.”

“Runny body may leak through poor seals.”

“Acidic affinity may corrode this material.”

“Open tray cannot contain watery forms.”

“Container is safe for current mass but may be too small after regrowth.”

“High visibility, good for observation.”

“Low visibility, tests may be less informative later.”

Possible implementation approach:

Add container type definitions with material and structural properties.

Add a function that evaluates passive suitability between a slime and a container.

Show suitability bands and short warning text in the UI.

Let the player assign slimes to questionable containers if desired.

Do not immediately cause failures or incidents in this pass.

Save/load container type and assignment data.

Keep exact formulas hidden or broad to preserve discoverability.

Questions for discussion:

What container properties are necessary for the first material-suitability prototype?

Which early container types should exist first?

Should every container type be an individual object, or should identical containers stack as inventory until assigned?

Should the player start with a few basic containers?

How should suitability be shown to the player?

Should suitability use exact numbers, broad bands, warning text, or a mix?

Should the player be allowed to place a slime in a bad container?

Should unsuitable containers block assignment, or only warn the player?

How should current mass differ from natural maximum size in suitability checks?

Should the system warn about future regrowth or only current fit?

How should body consistency affect suitability?

How should element and byproduct affect material compatibility?

Should visibility affect observation or testing in this pass, or wait until later?

Should containers have durability now, or only later when incidents exist?

What should be explicitly left out until active behavior risk, isolation, and containment incidents are implemented?

What is the smallest implementation that makes container choice feel physical without overbuilding the system?

Design goals:

Make containers feel like physical lab equipment.

Give creature traits practical containment consequences.

Create intuitive creature-container matchups.

Separate passive physical suitability from active behavior risk.

Prepare for future container isolation, behavior risk, overcapacity, escape events, and lab safety incidents.

Keep this pass simple, readable, save-safe, and testable.

Do not modify files until we have agreed on the design and scope.







\---



\## 4. Container Isolation and Environmental Exchange



Design discussion: container isolation and environmental exchange.

Do not make code changes yet.

I want feedback on the design before deciding how container isolation should work. Challenge assumptions, identify potential issues, suggest alternatives, and ask clarifying questions.

Assumption:

Container Pass 1 has established individual containers and the synthesis tube.

Container Pass 2 has established container materials and passive creature-container suitability.

Rooms and dynamic room attributes exist or are planned.

Environmental feeding exists or is planned.

This prompt is only for container isolation and environmental exchange.

Do not implement containment incidents yet.

Do not implement active behavior escape risk yet.

Do not implement full room construction or advanced equipment networks yet.

Current issue:

Environmental feeders interact with room conditions such as Temperature, Light, Ambient Mana, Moisture, Contamination, and Electrical Charge.

Containers should determine whether a slime affects the room directly or only affects the container interior.

A container should not only hold a creature physically; it should also control environmental exchange.

Current goal:

Add isolation/exchange properties to containers.

Decide how containers interact with room attributes.

Decide whether containers should have their own internal conditions or whether they should use simplified isolation modifiers.

Make containers matter for environmental feeders without overbuilding a full simulation.

Core idea:

A slime’s immediate environment is either its container interior or the room itself.

If the container isolates the relevant condition, the slime affects the container interior first.

If the container leaks or does not isolate that condition, the slime affects the room.

If the slime is released, it affects the room directly.

Container isolation should make environmental feeding more interesting and more controllable.

Possible isolation properties:

Thermal isolation: controls heat exchange with the room.

Light access / opacity: controls whether light reaches the creature.

Mana warding: controls ambient mana exchange.

Moisture sealing: controls humidity and water vapor exchange.

Air exchange / ventilation: controls fumes, contamination, oxygen, and odor exchange.

Electrical grounding / insulation: controls electrical charge exchange.

Filtration: controls whether contamination or fumes pass between container and room.

Arcane shielding: controls unusual magical leakage or elemental radiation.

Examples:

Heat feeder in an insulated sealed tank: cools the tank interior first; the room is mostly unaffected.

Heat feeder in an open cage: cools the room directly.

Light feeder in an opaque sealed box: starves unless there is an internal light source.

Light feeder in a glass tank under overhead lights: feeds from room light.

Mana feeder in a warded vessel: drains internal mana first; room mana is protected.

Mana feeder in an unwarded container: drains room Ambient Mana.

Moisture feeder in a sealed humid tank: dries the tank interior before affecting the room.

Fume feeder in a ventilated container: may clean fumes passing through it.

Electricity feeder in a grounded container: may be safely fed or may drain charge through the grounding path depending on design.

Important design distinction:

Passive suitability asks whether the container can physically hold the slime.

Isolation asks how the container exchanges conditions with the room.

Behavior risk asks whether the slime will actively challenge containment.

Incidents ask what happens when containment fails.

This pass should focus only on isolation and environmental exchange.

Possible implementation models:

Option A: Simple isolation modifiers

Containers do not track separate internal conditions yet.

Each container modifies how strongly the creature can access room conditions.

Example: glass tank allows light access but reduces moisture exchange.

Simpler, easier to implement, less realistic.

Option B: Container interior conditions

Each container has internal Temperature, Light, Mana, Moisture, Contamination, and Charge.

These exchange with the room based on isolation properties.

Environmental feeders consume from the container interior first.

More flexible, but much more complex.

Option C: Hybrid

Only track internal conditions for containers where it matters.

Most containers use simple modifiers.

Specialized containers can have internal condition values later.

This may be the best prototype path.

Important design direction:

The synthesis tube should remain a perfect temporary container.

It is fully warded and safe for initial testing.

It should probably isolate dangerous effects from the room.

However, the synthesis tube should not become a permanent infinite-use containment solution.

Normal containers should have tradeoffs.

Good isolation can protect the room but may starve environmental feeders.

Poor isolation can feed environmental slimes but may let them affect the room.

Tradeoff examples:

A sealed insulated tank protects the room from heat drain, but a heat-feeding slime may exhaust the tank interior and stop growing.

A glass tank gives good light access but may be fragile or poor against certain slimes.

A warded pod protects room mana but may starve mana-feeding slimes unless supplied internally.

A ventilated cage allows air and fumes to circulate but may spread contamination.

A sealed container prevents fumes from escaping but may accumulate contamination inside.

Player communication:

The player should understand whether a container gives the slime access to its sustenance.

The player should understand whether the container protects the room from the slime’s environmental effects.

The UI should avoid exact formulas unless needed.

Useful warning examples:

“Container blocks most light; light-feeding slime may starve.”

“Poor thermal isolation; heat drain will affect the room.”

“Strong mana warding protects the room but limits mana feeding.”

“Ventilated container allows fumes to spread.”

“Sealed container may trap contamination inside.”

Interactions with environmental feeding:

Environmental feeders should consume from their immediate environment.

If the container provides access to the relevant room condition, feeding can occur.

If the container blocks access, feeding should slow or stop unless the container has an internal source.

If the container partially isolates the condition, some effect should hit the container and some should leak to the room.

This should make container choice matter for environmental sustenance types.

Interactions with room attributes:

Room conditions remain dynamic balances with sources and drains.

Containers can act as barriers, filters, or exchange modifiers between slimes and room conditions.

Container isolation should not replace room systems.

It should determine how strongly slimes inside containers interact with rooms.

Scope limits:

Do not implement containment incidents yet.

Do not implement active escape attempts yet.

Do not implement container durability loss from behavior yet.

Do not implement full specialized equipment like heaters, lamps, mana batteries, filters, or humidifiers unless needed as placeholders.

Do not implement full room construction.

Do not rebalance all feeding and job systems unless small compatibility changes are needed.

Keep this pass focused on environmental exchange between creature, container, and room.

Questions for discussion:

Should this pass use simple isolation modifiers, internal container conditions, or a hybrid?

Which isolation properties are necessary for the first version?

Should containers have internal conditions now, or should that wait?

How should containers determine whether environmental feeders can access room conditions?

How should partial isolation work?

Should the synthesis tube fully isolate all environmental effects?

Should isolated containers require internal sources for light, heat, mana, moisture, or air?

Should poor isolation allow environmental feeders to affect the room directly?

How should the UI explain whether a container supports or blocks a slime’s sustenance?

Should isolation affect observation or testing?

Should sealed containers increase internal contamination or stress if poorly matched?

What should be explicitly left out until containment incidents and active behavior risk are implemented?

What is the smallest implementation that makes container isolation meaningful without overbuilding simulation?

Design goals:

Make containers matter for environmental feeders.

Connect creature Sustenance, room attributes, and containment equipment.

Let players choose between protecting the room and feeding the creature.

Prepare for future specialized containers, internal fixtures, containment incidents, and room management.

Keep the first version simple, readable, save-safe, and testable.

Do not modify files until we have agreed on the design and scope.







\---



\## 5. Active Behavior Risk and Containment Incidents



Design discussion: active behavior risk and containment incidents.

Do not make code changes yet.

I want feedback on the design before deciding how active containment risk and lab safety incidents should work. Challenge assumptions, identify potential issues, suggest alternatives, and ask clarifying questions.

Assumption:

Container Pass 1 has established individual containers and the synthesis tube.

Container Pass 2 has established container materials and passive creature-container suitability.

Container Pass 3 has established container isolation and environmental exchange.

Rooms and room attributes exist or are planned.

Environmental feeding exists or is planned.

Slimes have condition stats such as Body Integrity, Nutrition, Current Mass, Division Pressure, and Stress.

Slimes have traits such as behavior, stability, size, weight, shape, body consistency, appendages, movement, element, byproduct, and sustenance.

This prompt is about active behavior risk and containment incidents.

Do not redesign containers from scratch.

Do not build a full combat system yet.

Do not build raids, authorities, or world-map consequences yet.

Current issue:

Passive suitability can tell whether a container physically fits a slime.

Isolation can tell whether a container blocks or leaks environmental effects.

But containment still needs to account for what the slime actually does.

A slime that could damage a container is not necessarily dangerous if it is docile and stable.

A slime that seems physically manageable may become dangerous if it is territorial, predatory, panicked, stressed, or constantly testing its container.

Core idea:

Physical traits define breach potential.

Behavior, Stress, and Stability define breach likelihood.

Containment incidents happen when breach potential and breach likelihood combine badly enough over time.

Incidents should feel like consequences of risky lab management, not random punishment.

Passive risk vs active risk:

Passive suitability asks: Can this container physically hold this slime under normal conditions?

Isolation asks: How does this container exchange heat, light, mana, moisture, air, fumes, or contamination with the room?

Active behavior risk asks: Is this slime likely to challenge, damage, escape, hide, contaminate, or misuse its container?

Incidents ask: What actually happens when risk becomes a problem?

Behavior examples:

Docile / placid / dormant slimes should be less likely to challenge containment.

Territorial, predatory, nervous, erratic, hungry, swarming, hiding, vibration-hunting, heat-seeking, or light-seeking slimes may create higher active risk depending on their container and room.

A docile metal slime may be acceptable in a glass container if it is calm and unlikely to ram or stress the walls.

A territorial or vibration-hunting metal slime in the same glass container is a much greater danger.

A watery slime in a poor-seal container may be passively risky even if it is not actively trying to escape.

A climbing or squeezing slime may repeatedly test gaps, vents, or weak seals.

A hiding slime may not break containment, but it may be harder to observe or detect during incidents.

Stress and stability:

Stress should increase active containment risk.

Stability should modify how predictable or safe the slime is.

A normally docile slime under high Stress may become dangerous.

A volatile or erratic slime may have incident risk even in a decent container.

Poor feeding, bad environment, unsuitable containment, overcapacity, injuries, repeated testing, or nearby hazards may increase Stress.

Good containment, correct environment, adequate feeding, and compatible container choice should reduce or stabilize risk.

Natural splitting and overcapacity:

Slime splitting should create containment pressure.

If a slime splits inside a container, the container may suddenly hold multiple bodies.

Immediately after splitting, the bodies may be undersized because mass was divided.

As parent and offspring feed and regrow toward natural maximum size, the container may become overcrowded.

Overcapacity should increase Stress, passive suitability problems, active behavior risk, contamination risk, and possible breach events.

The player should receive warnings before regrowth turns a safe container into a dangerous one when possible.

Possible incident types:

Minor disturbance: noise, shaking, escaped droplets, small mess, Stress increase.

Container fouling: contamination increases inside container or room.

Leak/seep event: runny or watery slime leaks material into the room.

Corrosion event: acid, poison, chemical, or byproduct damages container condition.

Impact event: heavy, dense, metallic, or aggressive slime cracks or dents container.

Escape attempt: slime partially or fully leaves containment.

Exposure event: scientist or nearby creatures take damage, Stress, contamination, or other negative effects.

Room condition event: heat drain, light drain, mana drain, fumes, moisture, or charge spreads into the room.

Evidence event: strange noises, smells, leaks, or escaped slime traces increase Suspicion.

Catastrophic breach: rare severe event from ignored high-risk containment.

First-pass incident scope:

Start with simple incident categories.

Use broad risk bands rather than exposed formulas.

Incidents should be periodic checks, not constant spam.

Minor incidents should be more common than severe incidents.

Severe incidents should usually require obvious unresolved risk.

The player should be able to understand why an incident happened.

Do not create complicated chain reactions yet.

Possible containment risk bands:

Stable

Watch

Strained

Dangerous

Failing

Possible warning text:

“High Stress is making this slime restless.”

“Container is physically weak for this slime’s weight.”

“Poor seal quality may allow seepage.”

“This behavior pattern may test containment.”

“Offspring regrowth may exceed container capacity.”

“Room conditions are worsening containment stress.”

“Container isolation is trapping contamination inside.”

Suspicion interaction:

Not every incident should increase Suspicion.

Internal messes may only increase contamination or Stress.

Visible, noisy, smelly, or escaped incidents should increase Suspicion.

Dumping evidence outside already increases Suspicion; containment breaches should be another natural Suspicion source.

Suspicion gain should depend on severity and whether the incident leaves evidence outside the lab or draws attention.

Room interaction:

Incidents should occur in rooms.

Room contamination, light, temperature, moisture, mana, and electrical charge can eventually affect incident risk.

A contaminated room may make slimes more stressed or unhealthy.

A cold room may help preserve corpses but harm heat-reliant creatures.

A high-mana room may empower or destabilize some slimes.

This pass should only implement room interactions if the foundation already exists and the scope stays small.

Container condition:

Containers may need condition/durability once incidents exist.

Damage should reduce container condition.

A damaged container should become less suitable and more incident-prone.

Repair does not need to be fully implemented in this pass unless simple.

If repair is not implemented, damage should be limited enough to avoid soft-locking the player.

Player actions:

Move slime to a better container.

Release slime into a room, if intentionally risky.

Feed slime to reduce hunger-related Stress.

Rest or pause testing to reduce Stress later.

Dump, sell, process, or dispose of unwanted creatures later.

Repair or replace containers later.

Improve room conditions later.

For the first pass, only include actions that already exist or are easy extensions.

Important scope limits:

Do not implement full combat.

Do not implement authority raids.

Do not implement staff casualties beyond simple placeholder effects unless agreed.

Do not implement complex AI behavior.

Do not implement multi-room pathfinding.

Do not implement advanced repairs, construction, or equipment networks unless necessary.

Do not make containment so punishing that early experimentation becomes annoying.

Keep this pass focused on making risky containment produce readable consequences.

Questions for discussion:

What should active containment risk mean in the first prototype?

Which traits should contribute most to breach potential?

Which traits should contribute most to breach likelihood?

How should Behavior, Stress, and Stability interact?

Should risk be checked continuously, periodically, or only when conditions change?

What incident types should exist in the first pass?

Which incidents should increase Suspicion?

Should minor incidents mostly affect Stress, contamination, or container condition?

Should containers have durability/condition in this pass?

Should damaged containers be repairable now or later?

How should natural splitting and offspring regrowth affect containment risk?

How should overcapacity be communicated to the player?

Should bad containment ever be allowed intentionally?

Should the synthesis tube be completely immune to incidents?

How should the UI distinguish passive mismatch, isolation problems, behavior risk, and actual incidents?

What should be explicitly left out until later lab safety, authority, combat, or room-construction passes?

What is the smallest implementation that makes containment feel dangerous without becoming tedious?

Design goals:

Make creatures feel physically present and potentially dangerous.

Make Behavior, Stress, Stability, and container choice matter.

Separate passive containment mismatch from active behavior risk.

Make bad containment create readable consequences.

Connect containment risk to Suspicion, contamination, room conditions, and container damage.

Make natural splitting create meaningful containment pressure.

Avoid random-feeling punishment.

Avoid constant micromanagement.

Keep the first incident system simple, readable, save-safe, and expandable.

Do not modify files until we have agreed on the design and scope.





