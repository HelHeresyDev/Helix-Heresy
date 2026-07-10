# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Room Enclosure, Room Detection, and Room Ownership
2. Construction Designations and Build/Dig Workflow
3. Wall, Door, and Floor Materials
4. Room Purpose, Zoning, and Room Requirements
5. Furniture, Fixtures, and Lab Equipment Placement
6. Environmental Infrastructure: Ventilation, Heat, Light, Mana, and Moisture
7. Creature Movement, Door Policies, and Restricted Zones
8. Containment Emergency Response and Recapture Tools
9. Cleaning, Hauling, Maintenance, and Repair Jobs
10. Black Market Commissions and External Pressure

---

## 1. Room Enclosure, Room Detection, and Room Ownership

Design discussion: room enclosure, room detection, and room ownership.

Do not make code changes yet.

Focus on how the game should decide what counts as a room after walls and one-tile doors exist.

Questions to resolve include automatic room detection, player room assignment, rough excavated space, enclosed vs unenclosed areas, room labels, room ownership of objects, room boundaries, and how changing walls or doors should update rooms.

Do not modify files until we have agreed on the design and scope.

---

## 2. Construction Designations and Build/Dig Workflow

Design discussion: construction designations and build/dig workflow.

Do not make code changes yet.

Focus on the player workflow for digging, building walls, placing doors, creating floors, confirming designations, queueing work, canceling designations, and showing invalid construction plans.

This should build toward a colony-sim style workflow without overbuilding a full construction economy yet.

Do not modify files until we have agreed on the design and scope.

---

## 3. Wall, Door, and Floor Materials

Design discussion: wall, door, and floor materials.

Do not make code changes yet.

Focus on materials as physical properties for constructed map elements: durability, seal quality, resistance, visibility, insulation, contamination retention, sound leakage, creature damage resistance, and future repair/replacement.

Keep this separate from full crafting or supply chains unless absolutely necessary.

Do not modify files until we have agreed on the design and scope.

---

## 4. Room Purpose, Zoning, and Room Requirements

Design discussion: room purpose, zoning, and room requirements.

Do not make code changes yet.

Focus on how the player designates room roles such as Main Lab, Menagerie, Storage, Pits, Collection Bay, Quarters, Containment Room, Workroom, Morgue, or future specialized rooms.

Resolve whether room purpose is a label, a ruleset, a zoning tool, an equipment requirement, or a combination.

Do not modify files until we have agreed on the design and scope.

---

## 5. Furniture, Fixtures, and Lab Equipment Placement

Design discussion: furniture, fixtures, and lab equipment placement.

Do not make code changes yet.

Focus on physical placement of synthesis equipment, containers, shelves, pits, collection stations, workbenches, lights, vents, drains, wards, beds, tool lockers, and future lab equipment.

The goal is to make rooms function through placed objects rather than abstract room bonuses.

Do not modify files until we have agreed on the design and scope.

---

## 6. Environmental Infrastructure: Ventilation, Heat, Light, Mana, and Moisture

Design discussion: environmental infrastructure.

Do not make code changes yet.

Focus on how built infrastructure should create, drain, route, block, or stabilize Temperature, Light, Ambient Mana, Moisture, Contamination, fumes, and Electrical Charge.

This should connect physical room geometry, doors, walls, vents, lights, wards, drains, containers, environmental feeders, and room suitability.

Do not modify files until we have agreed on the design and scope.

---

## 7. Creature Movement, Door Policies, and Restricted Zones

Design discussion: creature movement, door policies, and restricted zones.

Do not make code changes yet.

Focus on how loose creatures interact with physical doors, walls, room zones, access restrictions, door policies, traces, blocked-door pressure, and containment boundaries.

The goal is to make creature movement readable and dangerous without turning every loose slime into constant micromanagement.

Do not modify files until we have agreed on the design and scope.

---

## 8. Containment Emergency Response and Recapture Tools

Design discussion: containment emergency response and recapture tools.

Do not make code changes yet.

Focus on what the player can do after a containment breach, loose creature alert, blocked-door pressure, or combat incident.

Possible systems include recapture tasks, baiting, sealing rooms, emergency door control, tool-based handling, temporary cages, sedation, lures, emergency cleanup, and risk-aware response commands.

Do not modify files until we have agreed on the design and scope.

---

## 9. Cleaning, Hauling, Maintenance, and Repair Jobs

Design discussion: cleaning, hauling, maintenance, and repair jobs.

Do not make code changes yet.

Focus on making routine lab upkeep explicit: moving materials, cleaning residue, hauling corpses, transferring receptacles, repairing doors/containers/tools, replacing broken equipment, and maintaining rooms.

This should support the map-first design without overwhelming the player.

Do not modify files until we have agreed on the design and scope.

---

## 10. Black Market Commissions and External Pressure

Design discussion: black market commissions and external pressure.

Do not make code changes yet.

Focus on the next economy step after basic byproduct sales: commissions, requested traits, dangerous buyers, reputation growth, delivery risk, scams, exposure, Suspicion pressure, deadlines, and rewards that push the player to design specific creatures or byproducts.

Do not modify files until we have agreed on the design and scope.
