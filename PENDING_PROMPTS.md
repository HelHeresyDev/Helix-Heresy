# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from PENDING_PROMPTS.md automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Container isolation and environmental exchange

2. Active behavior risk and containment incidents

---

## 1. Container Isolation and Environmental Exchange

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

---

## 2. Active Behavior Risk and Containment Incidents

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
