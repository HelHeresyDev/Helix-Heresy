# System Handoff — Physical Rooms

Date: 2026-06-21

## Purpose

This system makes rooms physically meaningful instead of treating them as abstract labels.

Before this system:
- Rooms existed as named areas: Main Lab, Menagerie, Pits.
- Containers and corpses could be assigned to rooms.
- Free/uncontained slimes had room location and room activity.
- Observation-gated free creature pressure depended on the scientist's room.
- But rooms had no physical geometry, no spatial feel, no crowding based on space, and no player-facing movement between rooms.

After this system:
- Rooms have physical geometry.
- Rooms have player-facing spatial feel and crowding.
- Rooms have connections/adjacency and an abstract room map.
- Room geometry affects contamination/residue behavior.
- Free slimes move through connected rooms instead of teleporting.
- Hauling events include route text.
- The scientist has physical presence and contributes to room crowding.
- The scientist can move between connected rooms with queued tasks.

## Design principles

### Rooms should be physical but not overexposed

The simulation should know room measurements, but the player should usually see readable room-feel descriptions.

Internally:
- length
- width
- height
- floor area
- volume
- shape

Player-facing:
- spatial feel
- crowding
- shape
- connected rooms
- current scientist location

Do not make raw dimensions the primary UI.

Good:
- `Size: Confined`
- `Crowding: Busy`
- `Shape: Irregular pit chamber`
- `Connected to: Main Lab`

Avoid as primary UI:
- `12m × 10m · 120 m²`
- `Volume: 360 m³`

### Floor area and volume are explicit

Area specifically means floor area.

Not all rooms are rectangles. Some may have weird geometry.

Therefore:
- `floorAreaM2` should be explicit
- `volumeM3` should be explicit
- they should not always be derived from length × width × height
- length/width can be approximate or bounding dimensions for irregular rooms

### Room size bands should be atmospheric

The user disliked `Open` as a size/feel label because it overlaps with open/closed containers and feels too plain.

Current accepted spatial feel bands:
- `Cramped`
- `Confined`
- `Serviceable`
- `Comfortable`
- `Expansive`
- `Cavernous`

Do not use:
- `Tiny`
- `Small`
- `Medium`
- `Large`
- `Huge`
- `Open` as a room spatial-feel label

### Scientist is physical

The scientist is not a ghost camera.

The scientist has:
```js
scientist.physicalPresence = {
  heightM: 1.75,
  shoulderWidthM: 0.55,
  floorLoadM2: 1.0
}
```

Normal player-facing UI should not show the exact body measurements.

Instead, show:
- `Current location: Main Lab`
- `Scientist present`
- `Scientist absent`

The scientist's `floorLoadM2` contributes to room crowding.

## Pass 1 — Room Geometry, Spatial Feel, Crowding, and Connections

### Implemented behavior

Rooms now have geometry:

```js
geometry: {
  shape,
  lengthM,
  widthM,
  heightM,
  floorAreaM2,
  volumeM3
}
```

Every room has:
- positive `lengthM`
- positive `widthM`
- positive `heightM`
- positive `floorAreaM2`
- positive `volumeM3`
- `shape`

Room geometry is normalized by:
- `normalizeRoomGeometry`

### Explicit floor area and volume

Floor area and volume are explicit fields.

Pits demonstrates irregular geometry:
- shape: `irregular pit chamber`
- floor area does not equal length × width
- volume does not equal floor area × height

This proves the system supports weird room geometry.

### Spatial feel

Player-facing size uses spatial feel labels.

Current accepted labels:
- `Cramped`
- `Confined`
- `Serviceable`
- `Comfortable`
- `Expansive`
- `Cavernous`

Pass 1 originally used `Open`; Pass 2 replaced it with `Comfortable`.

### Crowding

Rooms show crowding labels.

Crowding uses room floor area and room load.

Room load includes:
- containers
- free/uncontained creatures
- local corpses/remains
- scientist after Pass 3

Crowding labels:
- `Clear`
- `Lightly occupied`
- `Busy`
- `Crowded`
- `Overpacked`

Crowding changes when floor area/load changes.

Example accepted QC:
- shrinking Pits to 12 m² and moving 19 containers there showed `Crowding: Overpacked` and `Size: Cramped`

### Connections / adjacency

Rooms have symmetric connections.

Current accepted map:
- Menagerie ↔ Main Lab ↔ Pits

Main Lab connects to:
- Menagerie
- Pits

Menagerie connects to:
- Main Lab

Pits connects to:
- Main Lab

Room summary shows abstract map:
- `Room map: Menagerie ↔ Main Lab ↔ Pits`

### Room cards

Room cards show:
- spatial feel
- crowding
- shape
- connected rooms

Example:
- `Size: Serviceable`
- `Crowding: Lightly occupied`
- `Shape: Irregular pit chamber`
- `Connected to: Main Lab`

Room cards intentionally avoid raw dimensions as the primary display.

### Pass 1 QC

Result:
- syntax check passed
- smoke test passed
- all 19 checks passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- every room has geometry
- floor area is specifically tracked as `floorAreaM2`
- irregular geometry supported
- Pits is irregular pit chamber
- room connections are symmetric
- abstract room map appears
- room cards show spatial feel labels
- room cards avoid raw dimensions as primary UI
- room cards show crowding
- crowding changes with floor area/load
- room cards show connected rooms
- no doors/construction/pathfinding/combat/recapture/full escape/raids added

## Pass 2 — Geometry-Aware Room Effects

### Implemented behavior

Pass 2 made room geometry mechanically relevant.

Implemented:
- `Open` spatial feel label replaced with `Comfortable`
- crowding contributes to observed free creature pressure
- room floor area/volume scales contamination cleaning and residue effects
- contamination-seeking free slimes move through connected rooms
- hauling event text includes route information

### `Comfortable` replaces `Open`

Old:
- `Open`

New:
- `Comfortable`

Reason:
- `Open` is too plain
- `Open` overlaps with container open/closed state

Accepted label set:
- `Cramped`
- `Confined`
- `Serviceable`
- `Comfortable`
- `Expansive`
- `Cavernous`

### Crowding affects free creature pressure

Observed free creature pressure now includes crowding influence.

Crowded or overpacked rooms increase pressure.

If the scientist observes the room, crowding can appear as a known factor.

Examples:
- `room is busy`
- `room is crowded`
- `room is overpacked`

This still respects the existing observation/knowledge-gated pressure system:
- unobserved rooms remain `Unobserved`
- unknown traits are still not revealed
- known/unknown factors remain separated

### Floor area and volume scale room effects

Room effect scaling uses:
- floor area
- volume

Smaller/tighter rooms:
- show stronger contamination/residue changes

Larger/cavernous rooms:
- dilute room effects

Accepted QC example:
- Main Lab at 20 m² changed contamination more strongly than Pits at 300 m² under equivalent cleaner conditions

### Connected-room movement

Contamination-seeking free slimes no longer teleport directly to the dirtiest room.

They move through room connections.

Example:
- Menagerie → Main Lab when target is beyond Main Lab

Current behavior is still abstract:
- no tile grid
- no pathfinding grid
- no doors
- no locks
- no barriers

But movement respects the room graph.

Event text:
- `RG-ROUTE moved from Menagerie to Main Lab, following contamination through connected rooms.`

### Hauling route text

Hauling event text now includes route information.

Example:
- `Hauling complete: Basic Glass Jar 1 moved from the Menagerie to the Pits via Menagerie → Main Lab → Pits.`

This prepares for future doors/barriers without implementing them yet.

### Pass 2 QC

Result:
- syntax check passed
- smoke test reported 13/14 checks passed
- 1 failure was a test-script assertion bug, not an app bug
- console warnings/errors: 0
- page errors: 0

The failed check expected:
- `roomActivity.targetRoomId === "mainLab"`

Actual app behavior:
- slime moved correctly from Menagerie to Main Lab through connected rooms
- event log confirmed connected-room movement
- `roomActivity.roomId === "mainLab"`

Accepted as functionally sound.

Confirmed:
- `Comfortable` replaces `Open`
- geometry from Pass 1 still works
- Pits irregular geometry still works
- crowding contributes to observed free creature pressure
- crowding appears as a known pressure factor
- small-room and large-room contamination effects differ
- contamination-seeking slime movement uses room connections
- hauling route text works
- no forbidden systems added

## Pass 3 — Scientist Physical Presence + Room Movement

### Implemented behavior

Pass 3 made the scientist physically present in rooms.

Added:
- scientist physical presence data
- scientist floor load contribution to room crowding
- current location UI
- scientist present/absent room card UI
- connected-room scientist movement
- queued `scientistMove` tasks
- movement stamina cost
- observation pressure updates after movement

### Scientist physicalPresence

Default:

```js
scientist.physicalPresence = {
  heightM: 1.75,
  shoulderWidthM: 0.55,
  floorLoadM2: 1.0
}
```

Normalized by:
- `normalizeScientistPhysicalPresence`

Used by:
- `scientistFloorLoadM2`
- room crowding load

Player-facing UI should not show exact measurements by default.

### Scientist contributes to crowding

Room crowding load now includes scientist load if the scientist is in that room.

Room load now includes:
- containers
- free creatures
- local corpses/remains
- scientist floorLoadM2 if present

Accepted QC:
- with Main Lab floor area set to 4 and scientist `floorLoadM2` set to 2.8, Main Lab showed `Overpacked`

### Current location UI

Room summary now shows:
- `Current location: Main Lab`
- `Current location: Menagerie`
- etc.

Room cards show:
- `Scientist present`
- `Scientist absent`

### Scientist movement

Scientist can move only to connected rooms.

From Main Lab:
- movement buttons show Menagerie and Pits

Movement UI:
- `Move to: Menagerie · Pits`

Pass 3 fix1 added the separator.

Movement is queued:
- task type: `scientistMove`
- label: `Move scientist to [room]`
- data includes:
  - `fromRoomId`
  - `toRoomId`
  - `staminaCost`

Movement costs stamina and completes with `Shift + .`.

On completion:
- `state.scientist.roomId` updates
- event log says:
  - `Scientist movement started: Main Lab to Menagerie.`
  - `Scientist arrived in Menagerie.`

### Observation after movement

Free creature pressure depends on scientist location.

Accepted behavior:
- before moving to Menagerie, Menagerie pressure can be `Unobserved`
- after moving to Menagerie, Menagerie pressure becomes observed
- room cards update `Scientist present` / `Scientist absent`

### Pass 3 QC

Result:
- syntax check passed
- smoke test reported 16/17 checks passed
- 1 failure was a test-script regex bug, not an app bug
- console warnings/errors: 0
- page errors: 0

The failed check used greedy regex:
- `/Menagerie[\s\S]*Free creature pressure:\s*Unobserved/i`

It matched from the Menagerie header down into the Pits card.

Actual behavior:
- pressure correctly changed from Unobserved to observed after scientist moved
- `roomId` updated from `mainLab` to `menagerie`

Minor polish issue:
- `Move to: MenageriePits` lacked a separator

### Pass 3 fix1

Fix:
- movement buttons now have separators:
  - `Move to: Menagerie · Pits`

Result:
- node syntax check passed
- full smoke rerun was not needed because functionality had already passed and fix was UI polish only

## Current accepted system status

Physical Rooms:
- Pass 1 complete
- Pass 2 complete
- Pass 3 fix1 complete

Latest accepted implementation bundle:
- `app_physical_rooms_pass3_fix1_bundle.zip`

Latest accepted QC:
- Physical Rooms Pass 3 smoke test functionally passed
- Pass 3 fix1 node syntax passed
- movement separator fixed
- no full rerun required

## Explicitly not implemented

Still not implemented:
- doors
- locks
- room barriers
- construction
- room editing
- tile grid
- pathfinding grid
- line of sight
- sensors
- combat
- attacks
- recapture
- full escape
- raids
- scientist injury from free creatures
- room equipment/furniture placement
- room subdivisions
- detailed route costs
- blocked routes
- room permissions

## Known limitations / future work

Potential next systems:
- doors/barriers
- scientist movement risk in dangerous rooms
- recapture or containment recovery
- scientist movement through rooms with dangerous free creatures
- route costs based on room crowding and hazards
- contamination spread between connected rooms
- doors/sensors/observation tools
- room equipment/furniture/load
- room construction/upgrades
- line-of-sight or local observation zones
- creature target selection and hunting resolution
- actual attacks/combat/prey death later

## Testing notes for future agents

General:
- Use `Shift + .` for queued task completion.
- Use fixed time advancement for room/free creature behavior tests.
- Avoid `.` for behavior ticks unless intentionally skipping to the next major event.
- Do not use greedy regex across the entire `#roomList` when testing a single room card.
- Prefer card-specific selectors or state snapshots.

Useful selectors:
- `#roomSummary`
- `#roomList`
- `[data-room-geometry-summary="<roomId>"]`
- `[data-free-creature-pressure-room="<roomId>"]`
- `[data-scientist-location-panel="<roomId>"]`
- `[data-scientist-move-room-id="<roomId>"]`
- `#taskList`
- `#eventLog`

Important test setup notes:
- Give artificial test slimes long lifespans.
- Set `state.scientist.roomId` intentionally.
- Use explicit `roomBehavior` flags for free creature behavior tests.
- Use high skill XP and revealed traits when testing confident pressure text.
- Use low skill and hidden traits when testing unknown/estimated pressure text.
- Use small/large room geometry to verify effect scaling.
- Use connected-room layouts to verify movement does not teleport.
