# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Structural Materials, Durability, and Breach Resistance
2. Mining, Construction, and Deconstruction Tools
3. Furniture, Fixtures, and Laboratory Equipment Placement
4. Physical Stockpiles, Shelves, Crates, and Accessibility
5. Loose Items, Spills, Waste, and Tile Contents
6. Tile-Level Environmental Fields and Diffusion
7. Ventilation, Drainage, Heating, Lighting, and Mana Infrastructure
8. Visibility, Sound, Scent, and Creature Perception
9. Door Permissions, Restricted Zones, and Creature Access Policies
10. Scalable Pathfinding, Space Sharing, and Movement Reservations
11. Slime Need Priorities, Intent Switching, and Interrupted Actions
12. Creature Job Autonomy and Physical Workplace Interaction
13. Containment Breach Response, Recapture, and Emergency Lockdown
14. Cleaning, Hauling, Maintenance, and Repair Work
15. Tactical Combat Movement, Abilities, and Map Commands
16. Simulation Scheduling and Performance for Hundreds of Actors

---

## 1. Structural Materials, Durability, and Breach Resistance

Design shared material properties for walls, doors, floors, containers, and other structures. Consider durability, seal quality, elemental resistance, insulation, visibility, contamination retention, sound transmission, damage states, repairability, and enchantments.

---

## 2. Mining, Construction, and Deconstruction Tools

Design the physical tools required for excavation, construction, and dismantling. Include picks, axes, hammers, cutting tools, drills, and later explosives; tool materials, quality, durability, damage, repair, replacement, task suitability, required capabilities, and blocked construction orders when no suitable usable tool is available. Replace the current assumed basic construction kit with persistent tools that actors must retrieve and use.

---

## 3. Furniture, Fixtures, and Laboratory Equipment Placement

Design placement, rotation, footprints, access tiles, and interaction points for synthesis equipment, containers, collection stations, workbenches, lights, vents, drains, wards, beds, shelves, and tools. Room function should increasingly emerge from physical equipment rather than abstract room bonuses.

---

## 4. Physical Stockpiles, Shelves, Crates, and Accessibility

Design where resources and tools physically live, how stockpile zones differ from storage furniture, and whether actors can reach the contents. Include capacity, item categories, hauling destinations, last-inventoried knowledge, secured supplies, and protection from loose creatures.

---

## 5. Loose Items, Spills, Waste, and Tile Contents

Design map-level representation of loose materials, dropped tools, filled receptacles, corpses, feedstock, spills, sludge, residue, and other waste. Resolve tile capacity, stacking, contamination, accessibility, cleanup, and how crowded tiles expose the most relevant entity without granting hidden information.

---

## 6. Tile-Level Environmental Fields and Diffusion

Move environmental simulation toward tile-level fields where appropriate. Design realistic diffusion and transfer for contamination, fumes, moisture, temperature, mana, electrical charge, and related hazards through open space, doors, seals, vents, liquids, and porous materials.

---

## 7. Ventilation, Drainage, Heating, Lighting, and Mana Infrastructure

Design infrastructure that creates, routes, removes, blocks, or stabilizes environmental conditions. Include power or operating requirements where useful, physical network layouts, failure states, maintenance, room suitability, and interactions with environmental feeders.

---

## 8. Visibility, Sound, Scent, and Creature Perception

Design a shared perception model for scientists and creatures. Resolve line of sight, lighting, occlusion, sounds through barriers, scent and trace diffusion, skill effects, stale knowledge, investigation behavior, and what normal versus debug map rendering reveals.

---

## 9. Door Permissions, Restricted Zones, and Creature Access Policies

Design actor-specific door permissions, forbidden areas, allowed zones, emergency restrictions, and automatic door behavior. Loose creatures should obey physical barriers and their own capabilities; policies should guide authorized actors without becoming magical walls.

---

## 10. Scalable Pathfinding, Space Sharing, and Movement Reservations

Prepare movement for many simultaneous actors. Resolve path caching, invalidation, occupied destinations, multi-tile bodies, small creatures sharing space, passing in corridors, door interaction time, congestion, reservations, blocked routes, and performance limits.

---

## 11. Slime Need Priorities, Intent Switching, and Interrupted Actions

Design how slime AI chooses among feeding, safety, rest, exploration, aggression, escape, social behavior, reproduction, and tagged jobs. Include hysteresis, commitment, interruption, memory, failed intentions, and readable activity explanations so creatures feel purposeful rather than erratic.

---

## 12. Creature Job Autonomy and Physical Workplace Interaction

Rework jobs as player intentions rather than absolute commands. Design how creatures recognize relevant workplaces and materials, travel or remain in suitable containers and pits, perform work through physical interactions, abandon unsuitable work, and reveal suitability through observed performance.

---

## 13. Containment Breach Response, Recapture, and Emergency Lockdown

Design tools and commands for responding to escapes and dangerous containment failures. Consider recapture, baiting, handling tools, temporary cages, emergency seals, room lockdown, evacuation, containment triage, scientist awareness, and consequences of imperfect responses.

---

## 14. Cleaning, Hauling, Maintenance, and Repair Work

Design routine physical labor for moving materials, replacing receptacles, hauling corpses, cleaning residue, repairing damage, restoring seals, and maintaining equipment. Keep the scientist as the only directly controlled actor while allowing policies and future workers to perform designated labor autonomously.

---

## 15. Tactical Combat Movement, Abilities, and Map Commands

Design map-centric combat interactions for the scientist and creatures. Include movement, targeting, ranges, contact, elemental clashes, abilities, mana use, awareness, time slowdown or pausing, contextual commands, testing through combat, injuries, retreat, and containment during a fight.

---

## 16. Simulation Scheduling and Performance for Hundreds of Actors

Audit and design simulation updates for hundreds of independently acting creatures. Resolve update frequencies, event scheduling, spatial queries, inactive actor simplification, deterministic processing, render separation, profiling, save state, and tests that prevent scaling work from changing game rules.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
