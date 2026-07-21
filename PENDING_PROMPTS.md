# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Vertical Excavation and Z-Layer Map Foundation
2. Saved Map Coordinates, Bookmarks, and Camera Recall
3. Tactical Combat Movement, Abilities, and Map Commands
4. Simulation Scheduling and Performance for Hundreds of Actors

---

## 1. Vertical Excavation and Z-Layer Map Foundation

Extend the underground laboratory map into multiple physical z-layers. Design upward and downward excavation, stairs, ramps, shafts, open space, ceilings, floors, vertical construction, layer navigation, camera controls, multi-level pathfinding, visibility, falling, hauling between levels, and interactions between vertical topology and rooms, utilities, fluids, gases, temperature, mana, containment, and combat. Preserve tile-level physical truth and ensure actors can only cross layers through physically valid connections.

---

## 2. Saved Map Coordinates, Bookmarks, and Camera Recall

Design Dwarf Fortress-style saved map positions for quickly returning to important laboratory locations. Bookmarks should preserve an exact `x,y,z` coordinate and may optionally preserve camera zoom, active overlay, or a player-defined name and hotkey. Distinguish static coordinate bookmarks from tracked rooms, fixtures, creatures, incidents, and other entities that may move or disappear. Include creation, overwrite, rename, reorder, deletion, keyboard recall, management UI, knowledge restrictions, invalid-location handling, save-state persistence, and behavior when the bookmarked layer or location is no longer accessible.

---

## 3. Tactical Combat Movement, Abilities, and Map Commands

Design map-centric combat interactions for the scientist and creatures. Include movement, targeting, ranges, contact, elemental clashes, abilities, mana use, awareness, time slowdown or pausing, contextual commands, testing through combat, injuries, retreat, and containment during a fight.

---

## 4. Simulation Scheduling and Performance for Hundreds of Actors

Audit and design simulation updates for hundreds of independently acting creatures. Resolve update frequencies, event scheduling, spatial queries, inactive actor simplification, deterministic processing, render separation, profiling, save state, and tests that prevent scaling work from changing game rules.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
