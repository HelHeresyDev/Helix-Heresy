# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Ventilation, Drainage, Heating, Lighting, and Mana Infrastructure
2. Visibility, Sound, Scent, and Creature Perception
3. Door Permissions, Restricted Zones, and Creature Access Policies
4. Scalable Pathfinding, Space Sharing, and Movement Reservations
5. Slime Need Priorities, Intent Switching, and Interrupted Actions
6. Creature Job Autonomy and Physical Workplace Interaction
7. Containment Breach Response, Recapture, and Emergency Lockdown
8. Cleaning, Hauling, Maintenance, and Repair Work
9. Tactical Combat Movement, Abilities, and Map Commands
10. Simulation Scheduling and Performance for Hundreds of Actors

---

## 1. Ventilation, Drainage, Heating, Lighting, and Mana Infrastructure

Design infrastructure that creates, routes, removes, blocks, or stabilizes environmental conditions. Include power or operating requirements where useful, physical network layouts, failure states, maintenance, room suitability, and interactions with environmental feeders.

---

## 2. Visibility, Sound, Scent, and Creature Perception

Design a shared perception model for scientists and creatures. Resolve line of sight, lighting, occlusion, sounds through barriers, scent and trace diffusion, skill effects, stale knowledge, investigation behavior, and what normal versus debug map rendering reveals.

---

## 3. Door Permissions, Restricted Zones, and Creature Access Policies

Design actor-specific door permissions, forbidden areas, allowed zones, emergency restrictions, and automatic door behavior. Loose creatures should obey physical barriers and their own capabilities; policies should guide authorized actors without becoming magical walls.

---

## 4. Scalable Pathfinding, Space Sharing, and Movement Reservations

Prepare movement for many simultaneous actors. Resolve path caching, invalidation, occupied destinations, multi-tile bodies, small creatures sharing space, passing in corridors, door interaction time, congestion, reservations, blocked routes, and performance limits.

---

## 5. Slime Need Priorities, Intent Switching, and Interrupted Actions

Design how slime AI chooses among feeding, safety, rest, exploration, aggression, escape, social behavior, reproduction, and tagged jobs. Include hysteresis, commitment, interruption, memory, failed intentions, and readable activity explanations so creatures feel purposeful rather than erratic.

---

## 6. Creature Job Autonomy and Physical Workplace Interaction

Rework jobs as player intentions rather than absolute commands. Design how creatures recognize relevant workplaces and materials, travel or remain in suitable containers and pits, perform work through physical interactions, abandon unsuitable work, and reveal suitability through observed performance.

---

## 7. Containment Breach Response, Recapture, and Emergency Lockdown

Design tools and commands for responding to escapes and dangerous containment failures. Consider recapture, baiting, handling tools, temporary cages, emergency seals, room lockdown, evacuation, containment triage, scientist awareness, and consequences of imperfect responses.

---

## 8. Cleaning, Hauling, Maintenance, and Repair Work

Design routine physical labor for moving materials, replacing receptacles, hauling corpses, cleaning residue, repairing damage, restoring seals, and maintaining equipment. Keep the scientist as the only directly controlled actor while allowing policies and future workers to perform designated labor autonomously.

---

## 9. Tactical Combat Movement, Abilities, and Map Commands

Design map-centric combat interactions for the scientist and creatures. Include movement, targeting, ranges, contact, elemental clashes, abilities, mana use, awareness, time slowdown or pausing, contextual commands, testing through combat, injuries, retreat, and containment during a fight.

---

## 10. Simulation Scheduling and Performance for Hundreds of Actors

Audit and design simulation updates for hundreds of independently acting creatures. Resolve update frequencies, event scheduling, spatial queries, inactive actor simplification, deterministic processing, render separation, profiling, save state, and tests that prevent scaling work from changing game rules.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
