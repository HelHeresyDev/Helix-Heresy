# System Handoff — Container Hauling

Date: 2026-06-20

## Purpose

This system makes room-to-room container movement physical enough for the current prototype.

Before this work, containers could effectively change rooms instantly. That was acceptable when the lab only had one meaningful room, but it became too magical after the implementation of:

- physical corpse locations
- Main Lab / Menagerie / Pits room roles
- pit-hole containers
- room-specific job eligibility

After this work, moving a container between rooms creates a hauling task. The container remains in its original room until the task completes.

## Design rule

Hauling Pass 1 is player/lab-hand driven.

Slimes do not haul.

Current slimes are too simple for hauling work. More intelligent future creatures may eventually unlock hauling labor, but slime hauling should not be implemented for now.

## Implemented behavior

### Container hauling tasks

Changing a permanent container’s room creates a `containerHaul` task.

The container does not move instantly.

While the task is pending:
- the container remains in the original room
- the contained occupants/remains remain in the original room/context
- the container card shows a hauling state
- the room selector is disabled
- the queue/task state indicates hauling
- the occupant cannot work
- active containment pressure increases

Confirmed UI wording:
- `hauling to Pits`
- `Basic Glass Jar 1 is in transit to Pits.`
- `Pressure: 14 — the container is currently being hauled.`

### Completing hauling tasks

Queued haul tasks are completed with the queued-task skip shortcut:

- `Shift + .`

The visible skip-to-next-event button is hidden in a drawer, so tests should use hotkeys rather than trying to click a hidden Finish/skip button.

When the haul task completes:
- the container room updates to the destination room
- occupants/remains inside the container sync to the container’s final room
- the event log reports completion

Example:
`Hauling complete: Basic Glass Jar 1 moved from the Main Lab to the Pits.`

### In-transit job blocking

Slimes inside containers being hauled cannot be assigned jobs.

This is separate from Menagerie job blocking and Pits job requirements.

The job UI reports/communicates that the container is being hauled or in transit.

### Active containment pressure while hauling

A living creature inside a hauled container receives active containment pressure because movement is stressful and risky.

Confirmed wording:
`Pressure: 14 — the container is currently being hauled.`

### Pit holes cannot be hauled

Pit holes are fixed room infrastructure.

The following containers are built into Pits and cannot be moved:
- Open Dirt Pit
- Grated Dirt Pit
- Capped Dirt Pit

Confirmed blocking wording:
`Pit holes are built into the Pits and cannot be hauled.`

## Pits testing shortcut

This pass includes an explicit temporary testing shortcut for Pits interaction.

This shortcut is not the final direct handling model.

### Hauling to Pits

When a non-pit container with contents is hauled to Pits:

1. the haul task completes
2. the hauled container arrives in Pits
3. the contents are unloaded into an available pit-hole container
4. the hauled container becomes empty in Pits

Confirmed event text:
`Testing shortcut: contents were unloaded into Capped Dirt Pit 1.`

Confirmed behavior:
- original container room becomes `pits`
- original container becomes empty
- living/corpse contents move into a pit-hole container
- pit-hole container shows the contents

### Hauling from Pits

When an empty non-pit container is hauled from Pits to another room:

1. the haul task completes
2. contents are loaded from an occupied pit-hole container into the hauled container
3. the hauled container arrives in the destination room with those contents
4. loaded contents inherit the destination room

Confirmed event text:
`Testing shortcut: contents were loaded from Capped Dirt Pit 1.`

Confirmed behavior after fix1:
- original container room becomes `menagerie`
- loaded slime/container room becomes `menagerie`
- pit hole becomes empty
- container and contents end in the same destination room

### Why this shortcut exists

The intended future physical workflow is more detailed:

- move source container to Pits
- open/dump/scrape/siphon contents
- use tools or safety methods
- account for exposure, damage, contamination, and creature interaction
- return or clean the container

Those direct creature/remains-player interactions are not implemented yet.

The temporary shortcut allows testing the Pits workflow without prematurely designing tools, direct handling, injury, or exposure systems.

## Explicitly not implemented

This pass does not add:
- direct corpse hauling
- direct slime/player handling
- dumping or scraping UI
- tools
- gloves/tongs/siphons/etc.
- staff hauling
- intelligent creature hauling
- pathfinding
- carry capacity simulation
- hauling accidents
- injury/exposure systems
- full escapes
- combat
- raids

## Important design intent

Movement should no longer feel like teleportation.

But the first pass should stay simple:
- whole containers move
- hauling takes time
- contents stay with the container unless Pits testing shortcut applies
- slimes do not haul
- pit holes cannot be hauled
- direct handling is delayed until a later system

This system should make the lab feel more physical without building a full logistics or staff simulation yet.

## Tests / QC completed

### Initial Container Hauling Pass 1 smoke test

The first test used a `Finish` button click and failed because the task completion control was not accessible that way.

This was a test-script issue.

### Corrected test using plain `.`

A later test used plain `.` to complete haul tasks, but hauling tasks are queued tasks, so they should be completed with `Shift + .`.

This revealed the distinction:
- `.` = next meaningful event
- `Shift + .` = next queued task completion

### Container Hauling Pass 1 full smoke test

Result:
- syntax check passed
- most checks passed
- 2 issues found

Issues found:
1. Queue/task state existed, but the test was checking only `#taskList` while the queue could be collapsed. Later tests check queue summary/badge/state instead.
2. Return haul loaded contents from Pits into the container but did not update the container’s room to the destination. The slime ended in Menagerie, but the container still showed Pits.

### Container Hauling Pass 1 fix1

Fix:
- Return-haul now updates the container’s room before loading contents from a pit.
- Loaded contents inherit the destination room instead of the old Pits room.
- Added a shared helper to sync occupants/corpses inside the hauled container to the container’s final room.

### Container Hauling Pass 1 fix1 smoke test

Result:
- syntax check passed
- smoke test passed
- 28/28 checks passed
- console warnings/errors: 0
- page errors: 0
- no scope creep detected

Confirmed behaviors:
- Haul task created instead of instant room move.
- Container stayed in Main Lab during haul to Pits.
- Room selector disabled while hauling.
- Queue/task state indicated hauling.
- `Shift + .` completed haul tasks.
- Hauling to Pits unloaded contents into Capped Dirt Pit 1.
- Hauling from Pits loaded contents back into the hauled Basic Glass Jar.
- Container and contents both ended in Menagerie after return haul.
- Pit holes were not haulable.
- In-transit job blocking appeared.
- Active containment pressure appeared.
- No direct handling/tool/staff/pathfinding/combat/escape systems were added.

## Repository / implementation status

This system is incorporated into the current tracked `app.js`.

The project now uses Git as the main checkpoint and restore system.

Current workflow:
- Commit only after syntax checks and smoke/QC tests pass.
- Push accepted checkpoints to `origin/main`.
- Treat generated zip bundles as temporary transfer artifacts, not the long-term source of truth.

Related transfer bundle:
`app_container_hauling_pass1_fix1_bundle.zip`

## Known limitations / future work

- Direct corpse/remains movement is not implemented.
- Direct slime/player handling is not implemented.
- Dumping, scraping, and tool-based handling are not implemented.
- Hauling is abstract player/lab-hand labor.
- Slimes cannot haul.
- Future intelligent creatures may eventually perform hauling.
- No pathfinding or carry-capacity simulation yet.
- No hauling accidents, exposure, or injury systems yet.
- The Pits unload/load behavior is a testing shortcut, not final direct handling.
- Queue UI may eventually need a clearer always-visible task list if the drawer stays collapsed.
