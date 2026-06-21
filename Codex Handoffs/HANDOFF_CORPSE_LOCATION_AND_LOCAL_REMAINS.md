# System Handoff — Corpse Location and Local Remains

Date: 2026-06-20

## Purpose

This system changes corpse handling from abstract teleportation to physical location.

Before this work:
- a slime died
- its corpse effectively appeared in waste/corpse storage automatically

After this work:
- a slime dies where it is
- its remains stay in that container or room by default
- corpse storage/waste drums only receive corpses through policy or later movement systems

This makes future rooms such as Menagerie and Pits mechanically meaningful.

## Implemented behavior

### Corpse location

Corpse records now track physical location.

Supported corpse storage/location states:
- `container`
- `room`
- `drum`
- `overflow`

A corpse can include:
- `containerId`
- `roomId`
- `storage`

### Death behavior

When a slime dies in a container:
- the corpse remains in that container

When a slime dies loose in a room:
- the corpse remains in that room

The death event reports the physical location.

Example:
`RG-001 collapsed from body integrity failure; remains are now in Synthesis Tube.`

### Container corpse display

Container cards now show corpse remains when a corpse is inside.

Example display:
- `RG-001`
- `Fresh corpse`
- `fresh for 2h 51m`

Containers with corpse remains are not treated as open/empty.

### Synthesis tube blocking

A corpse in the synthesis tube blocks new synthesis.

The synthesize button is disabled and provides a clear reason.

Example:
`Synthesis tube blocked by RG-001 remains.`

When the corpse is moved out, the synthesis tube becomes usable again.

### Corpse list location display

The corpse list now shows physical location.

Example:
- `RG-001 remains`
- `Fresh`
- `Synthesis Tube`
- `fresh for 2h 51m`
- `died Day 1 01:48`

### Corpse handling policy

A new policy exists:

`Auto-move local corpses to waste drums`

Default:
- off

When off:
- corpses remain where they fall

When on:
- local corpses in containers/rooms move to waste drums if space is available

The move is evented.

Example:
`RG-001 remains moved from Synthesis Tube to a waste drum.`

### Waste/readout updates

Corpse/waste readouts can distinguish:
- waste drum corpses
- local corpses
- overflow corpses

### Local corpse contamination

Local corpses affect the environment where they are located.

Observed test result:
- a corpse in Synthesis Tube raised tube contamination slightly after one minute
- example value: about `10.000555%`

This confirms local decay effects are active and small.

### Same-container corpse feeding hooks

Same-container living slimes can feed on corpse remains when compatible.

Compatibility is based on sustenance tags such as:
- corpse
- decay
- organic
- waste/contaminated for spoiled/ruined remains

Feeding can:
- increase nutrition
- increase current mass slightly
- reduce stress slightly
- increase corpse consumed progress
- eventually consume the remains

This establishes the hook for emergent corpse-eating behavior, though the main smoke test focused on location and policy behavior.

### Corpse Processing scope

Corpse Processing still targets waste-drum corpses only.

This is intentional for now.

Local corpses must be moved to waste drums by policy or future manual movement before normal corpse processing applies.

## Explicitly not implemented

This pass does not add:
- Menagerie room
- Pits room
- corpse bins/pits as rooms
- manual hauling
- manual corpse movement UI
- combat
- raids
- injuries
- escape systems

## Important design intent

Corpses should feel physically present.

Dead creatures should not teleport into abstract storage.

Corpse storage and corpse rooms should matter because corpses now have locations.

Leaving remains in a container should have consequences:
- blocked container use
- contamination
- possible feeding by compatible occupants
- future risk/incident interactions

Corpse auto-move should feel like a policy, not the default law of the universe.

## Tests / QC completed

Initial smoke test encountered a test-script bug:
- attempted to click disabled `#synthesizeBtn`
- Playwright timed out because the button was correctly disabled

This was not an app bug.

Corrected smoke test:
- syntax check passed
- corrected smoke test passed
- 23/23 checks passed
- console warnings/errors: 0
- page errors: 0
- no scope creep detected

Confirmed behaviors:
- RG-001 died in `synthesisTube`
- corpse record had `storage: "container"` and `containerId: "synthesisTube"`
- corpse list showed `Synthesis Tube`
- Synthesis Tube container card showed RG-001 as a fresh corpse
- synthesize button disabled with `Synthesis tube blocked by RG-001 remains.`
- enabling `autoMoveToDrums` moved the corpse to `drum`
- `drummedCount: 1`
- `localCount: 0`
- Synthesis Tube then showed empty and was no longer blocked
- corpse list showed waste drum after auto-move
- no Menagerie/Pits rooms were added in this pass
- no combat/raids/injuries/escape systems were added

## Repository / implementation status

This system is incorporated into the current tracked `app.js`.

The project now uses Git as the main checkpoint and restore system.

Current workflow:
- Commit only after syntax checks and smoke/QC tests pass.
- Push accepted checkpoints to `origin/main`.
- Treat generated zip bundles as temporary transfer artifacts, not the long-term source of truth.


## Known limitations / future work

- No manual corpse movement yet.
- No room-specific corpse storage yet.
- Menagerie and Pits are implemented by the later Rooms Foundation system.
- No corpse pit upgrades yet.
- No hauling/staff logistics.
- Corpse Processing still only uses waste-drum corpses.
- Same-container corpse feeding needs broader playtesting with compatible sustenance traits.
- UI may need consolidation if corpse rows, risk details, and environment warnings become too dense.
