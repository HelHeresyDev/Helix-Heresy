# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Active behavior risk and containment incidents

---

## 1. Active Behavior Risk and Containment Incidents

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
