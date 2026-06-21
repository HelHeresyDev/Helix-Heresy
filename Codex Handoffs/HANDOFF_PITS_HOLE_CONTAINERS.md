# System Handoff — Pits Hole Containers

Date: 2026-06-20

## Purpose

This system makes the Pits physically meaningful by treating each pit hole as an actual container.

Before this work, Pits existed as a room foundation with corpse/corpse-processing theme, but corpse storage inside the Pits was still not represented as physical container infrastructure.

After this work, Pits contains special early-game dirt-hole containers:

- Open Dirt Pit
- Grated Dirt Pit
- Capped Dirt Pit

These are literal dirt holes with different cover types. They support corpse storage, corpse workflow, and containment risk through the existing container systems.

## Implemented container types

### Open Dirt Pit

Theme:
- literal open dirt hole
- easiest to access
- worst containment
- highest exposure/odor/contamination feel

Design role:
- access over safety

### Grated Dirt Pit

Theme:
- literal dirt hole with a metal grate
- balanced access and containment
- still vulnerable to oozing, vapor, appendages, or small/mobile creatures

Design role:
- balanced early corpse pit

### Capped Dirt Pit

Theme:
- literal dirt hole with a heavy cover/cap
- safest of the early pit options
- hardest to work through

Design role:
- safety over access

## Implemented behavior

### Pit holes are real containers

The three pit variants are implemented as actual container types.

They have container metadata, geometry, room assignment, capacity, condition, and active containment risk support.

They start in the Pits room.

Confirmed starter containers:
- Open Dirt Pit 1
- Grated Dirt Pit 1
- Capped Dirt Pit 1

### Pit holes show on container cards

Pit holes appear in the container list like other containers.

They show:
- name
- room assignment
- geometry/interior information
- condition
- corpse capacity / pit corpse support
- active risk when a living creature is inside

### Corpse destination policy

Corpse handling now has a destination selector.

Implemented destinations:
- Waste drums
- Pit holes

The policy can move local corpses into available pit-hole containers when destination is set to Pit holes.

Waste drums remain available and were not removed.

### Auto-moving corpses into pit holes

When corpse auto-move is enabled and destination is Pit holes:
- local corpses can move into available pit-hole containers
- the corpse record becomes `storage: "container"`
- the corpse `containerId` becomes the selected pit-hole container
- the corpse list shows the pit-hole location
- the pit-hole container card shows the corpse

Confirmed test example:
- RG-001 initially stayed in `basic-1` in Main Lab
- auto-move destination was set to Pit holes
- RG-001 moved to `basic-12`, Capped Dirt Pit 1 in Pits

### Corpse Processing candidates

Corpse Processing can now target:
- waste-drum corpses
- pit-hole corpses

Pit-hole corpses are eligible because they are inside special pit-hole containers.

This does not make all container corpses valid for Corpse Processing. Normal container corpses still need local eating, manual future hauling, or policy movement before formal Pits work can use them.

### Pits job requirement

Corpse Processing and Waste Disposal now require the worker to be in Pits.

When outside Pits:
- Corpse Processing option is disabled
- Waste Disposal option is disabled
- job UI references the need to move to Pits

When inside Pits:
- Corpse Processing becomes available if otherwise valid
- Waste Disposal becomes available if otherwise valid

### Living creatures in pit holes

Living creatures can be placed in pit holes.

Pit holes are not safe deletion zones. They participate in active containment risk like other containers.

Pit-specific risk wording exists, including:
- `crude dirt-hole containment site`
- `pit-hole covers can be challenged by living creatures`

This supports the design that pit holes are useful for corpses/waste but risky for living creatures.

### Corpse eating remains general

Corpse eating is not Pits-only.

Corpses can still be eaten anywhere when compatible creatures share access to the corpse. Pits are where formal corpse-processing and waste-disposal jobs happen, not the only place corpse consumption can occur.

## Explicitly not implemented

This pass does not add:
- full escapes
- manual hauling UI
- room construction
- room upgrades
- pit upgrades
- corpse rendering products
- staff injury
- raids
- combat systems

## Important design intent

The Pits should not be magic corpse storage.

The Pits are a dirty physical room containing crude corpse/waste infrastructure.

Each pit hole is a container. That keeps the model consistent:

- jar = container
- cage = container
- synthesis tube = container
- pit hole = container

The cover type should define the tradeoff:
- Open Dirt Pit: easiest access, worst containment
- Grated Dirt Pit: balanced
- Capped Dirt Pit: safest, least convenient

Pits jobs happen in Pits. Corpse eating can happen anywhere.

Pit holes should create interesting choices around:
- corpse storage
- corpse processing
- waste disposal
- contamination
- active containment risk
- living-creature danger

## Tests / QC completed

### Pits Hole Containers Pass 1 smoke test

Result:
- syntax check passed
- smoke test passed
- 28/28 checks passed
- console warnings/errors: 0
- page errors: 0
- no scope creep detected

Confirmed behaviors:
- Open Dirt Pit, Grated Dirt Pit, and Capped Dirt Pit exist as real container types.
- All three appear in Pits.
- Corpse policy shows `Corpse destination`.
- Destination options include `Waste drums` and `Pit holes`.
- Auto-move destination `Pit holes` works.
- A local corpse can move into a pit-hole container.
- Corpse list shows Dirt Pit location after move.
- Container card shows corpse in pit hole.
- Corpse Processing can target pit-hole corpses.
- Corpse Processing and Waste Disposal are disabled outside Pits.
- Corpse Processing and Waste Disposal become available in Pits.
- Living slime in pit hole shows active risk.
- Pit active risk wording appears.
- No construction/upgrades/manual hauling/full escapes/combat/raids/staff injury systems were added.

## Repository / implementation status

This system is incorporated into the current tracked `app.js`.

The project now uses Git as the main checkpoint and restore system.

Current workflow:
- Commit only after syntax checks and smoke/QC tests pass.
- Push accepted checkpoints to `origin/main`.
- Treat generated zip bundles as temporary transfer artifacts, not the long-term source of truth.

Related transfer bundle:
`app_pits_hole_containers_pass1_bundle.zip`

## Known limitations / future work

- No manual hauling system yet.
- Corpse movement is still policy-driven rather than physically assigned as haul tasks.
- Slimes/containers can still appear to move too magically between rooms and containers.
- No pit upgrades yet.
- No formal cover-specific work-speed tuning yet.
- No corpse rendering products yet.
- No full escape system yet.
- No staff injury/safety system yet.
- No room construction or expansion system yet.

## Recommended next system

Hauling / physical movement should come next.

Reason:
- the project now has multiple rooms
- containers can move between rooms
- corpses can move between containers/pit holes/drums
- slimes still effectively relocate too magically

A first hauling pass should make movement feel physical without adding complex staff logistics.
