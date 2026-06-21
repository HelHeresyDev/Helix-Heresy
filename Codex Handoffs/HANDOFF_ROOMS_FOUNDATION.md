# System Handoff — Rooms Foundation

Date: 2026-06-20

## Purpose

This system establishes the first real room-role foundation for Helix Heresy.

Before this work, the prototype effectively used one functional room. The design direction already treated rooms as a core planned facility concept, but the implementation did not yet support meaningful room identity beyond the initial lab area.

After this work, the game has three named rooms with distinct roles:

- Main Lab
- Menagerie
- Pits

This lays the foundation for future room-specific systems such as living specimen storage, corpse pits, corpse processing, and room-aware containment.

## Implemented room names

Player-facing room titles intentionally avoid leading "The" so lists, cards, dropdowns, and sorting stay readable.

Displayed room names:
- `Main Lab`
- `Menagerie`
- `Pits`

The rooms also have article names for generated prose/event text:

- `the Main Lab`
- `the Menagerie`
- `the Pits`

Example event text:
`Basic Glass Jar 1 moved from the Main Lab to the Menagerie.`

## Implemented room roles

### Main Lab

Role:
- Active lab

Purpose:
- Synthesis
- Testing
- Active experiments
- Day-to-day lab work

The Main Lab remains the starting active workspace and was not renamed.

### Menagerie

Role:
- Living specimen storage

Purpose:
- Stored living creatures
- Shelved containers
- Quiet observation
- Containment collection feel

Design intent:
- The Menagerie should feel like a mad scientist's living collection.
- Creatures can be admired, stored, and contained there.
- It is not an active work room.

Mechanical rule:
- Slimes stored in the Menagerie cannot be assigned jobs.

UI wording confirmed:
- `Living specimen storage · stored creatures cannot work`
- `Shelved containers and quiet observation. Stored creatures here cannot work jobs.`
- Job selector tooltip:
  `Specimens stored in the Menagerie cannot be assigned jobs.`

### Pits

Role:
- Corpse storage and processing

Purpose:
- Remains
- Decay
- Disposal
- Corpse work
- Future corpse pit mechanics

Design intent:
- Early game version is crude deep pits.
- The name `Pits` can survive future upgrades because the room may later contain better corpse-processing infrastructure.
- The room should not be called `The Pits` in UI titles/dropdowns, but event prose may say `the Pits`.

UI wording confirmed:
- `Corpse storage and processing · corpse work`
- `Deep crude pits for remains, decay, disposal, and corpse work.`

## Implemented behavior

### Rooms exist in state

The room list now includes:
- `mainLab`
- `menagerie`
- `pits`

Each room has:
- `id`
- `name`
- `articleName`
- `role`
- `roleLabel`
- `description`
- room environmental attributes

### Room UI

Room cards show:
- room name
- container count
- living creature count
- corpse count
- role label
- room-specific description
- environmental attribute bands

Example occupancy format:
`3 containers; 1 living; 0 corpses`

### Starter container layout

New runs place containers across rooms:

- Synthesis Tube: Main Lab
- First two basic containers: Main Lab
- Open Tray: Pits
- Sealed Drainage Tank: Pits
- Other permanent containers: Menagerie

This creates immediate use for all three rooms without adding room construction yet.

### Container room assignment

Permanent container cards now show room assignment.

Permanent containers have room selector dropdowns with:
- Main Lab
- Menagerie
- Pits

The synthesis tube remains in the Main Lab and is not moved by this pass.

### Moving containers between rooms

Moving a container updates:
- the container's `roomId`
- contained slime `roomId`
- local corpse `roomId` for corpses inside that container

The move is evented.

Example:
`Basic Glass Jar 1 moved from the Main Lab to the Menagerie.`

### Menagerie job blocking

If a slime is stored in the Menagerie, it cannot be assigned jobs.

This applies even if the slime would otherwise be eligible.

When a container is moved into the Menagerie:
- occupant slime `roomId` updates to `menagerie`
- job selector becomes disabled
- tooltip explains the block
- job remains or becomes idle

When moved back to Main Lab:
- occupant slime `roomId` updates to `mainLab`
- job selector becomes available again if the slime is otherwise eligible

### Job UI room context

Job rows show each slime's effective room.

This helps the player understand why a slime is or is not eligible to work.

## Explicitly not implemented

This pass does not add:
- room construction
- room upgrades
- manual hauling
- full corpse pit mechanics
- corpse pit storage behavior beyond room identity
- Menagerie-specific observation bonuses
- staff pathfinding
- combat
- raids
- injuries
- escape systems

## Important design intent

Rooms should make the lab feel more physical.

A room should not just be a category label. It should affect what creatures and containers can do.

The Menagerie is for storage and observation, not labor.

The Pits are the future home of corpse storage and corpse processing mechanics, but this pass only establishes the room foundation.

The UI should use short names:
- Main Lab
- Menagerie
- Pits

Generated prose can use articles:
- the Main Lab
- the Menagerie
- the Pits

## Tests / QC completed

Initial Rooms Pass 1 smoke test:
- syntax check passed
- most functional checks passed
- one app bug found
- one minor UI bug found

Issues found:
1. `CONTAINER_ENVIRONMENT_EXCHANGE_PER_HOUR` was undefined during time skip.
2. Room meta chips concatenated in `innerText`:
   - `Living specimen storagestored creatures cannot work`
   - `Corpse storage and processingcorpse work`

Rooms Pass 1 fix1:
- defined `CONTAINER_ENVIRONMENT_EXCHANGE_PER_HOUR`
- added separators between room meta chips

Corrected display examples:
- `Living specimen storage · stored creatures cannot work`
- `Corpse storage and processing · corpse work`

Corrected Rooms Pass 1 smoke test:
- syntax check passed
- corrected smoke test passed
- 22/22 checks passed
- console warnings/errors: 0
- page errors: 0
- no scope creep detected

Confirmed behaviors:
- Main Lab, Menagerie, and Pits render correctly.
- Room UI avoids leading `The`.
- `articleName` values are used naturally in event prose.
- Menagerie blocks jobs.
- Pits reads as corpse/corpse-processing themed.
- Container room selectors work.
- Moving a container to Menagerie updates container and slime room IDs.
- Job selector disables in Menagerie with a clear reason.
- Moving the container back to Main Lab re-enables jobs if otherwise eligible.
- Room occupancy counts update.
- No construction/upgrades/manual hauling/full corpse mechanics were added.
- No combat/raids/injuries/escape systems were added.

## Repository / implementation status

This system is incorporated into the current tracked `app.js`.

The project now uses Git as the main checkpoint and restore system.

Current workflow:
- Commit only after syntax checks and smoke/QC tests pass.
- Push accepted checkpoints to `origin/main`.
- Treat generated zip bundles as temporary transfer artifacts, not the long-term source of truth.


Related transfer bundle:
`app_rooms_menagerie_pits_pass1_fix1_bundle.zip`

## Known limitations / future work

- Pits currently has room identity and atmosphere but not full corpse pit mechanics.
- Menagerie blocks jobs but does not yet provide observation/storage bonuses.
- There is no manual hauling system yet.
- There is no room construction or upgrade system yet.
- Room UI may need grouping/polish as more room-specific mechanics are added.
- Container room selectors on every permanent container are functional but may eventually need batch movement or a cleaner management UI.
