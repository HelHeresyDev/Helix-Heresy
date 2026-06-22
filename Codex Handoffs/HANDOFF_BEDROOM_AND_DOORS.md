# System Handoff — Bedroom and Doors

Date: 2026-06-21

## Status

Bedroom + Doors is implemented and accepted through Pass 3.

Accepted passes:
- Pass 1: Bedroom + door foundation
- Pass 2: Door policy UI polish
- Pass 2 Fix 1: Playwright visual-pause timeout fix
- Visual Playwright config: headed visual QC opens on monitor 2 at the intended size
- Pass 3: Door state and door policy tooltips

This handoff should be treated as the current source of truth for the Bedroom + Doors feature.

## Purpose

This system adds a dedicated recovery room and makes room connections physically meaningful.

Before this work:
- Rooms had physical geometry and connected-room movement.
- Free slimes could move through connected rooms because doors/barriers did not exist.
- The scientist could move between connected rooms.
- Container hauling could use room routes.
- Rest quality and Physical State already existed.
- The lab had no private recovery space and no door gates.

After this work:
- Bedroom exists as a real room.
- Doors exist on room connections.
- Closed doors block free slime movement.
- Scientist movement and container hauling can pass through closed doors automatically.
- Door behavior is controlled by policy.
- Door states and policy are explained through UI tooltips.
- Door mechanics preserve observation/awareness rules.

## Core design decisions

### Bedroom connection

Bedroom connects only to Main Lab.

Accepted connection:
- `Bedroom ↔ Main Lab`

Bedroom does not connect directly to:
- Menagerie
- Pits

### Containers in Bedroom

Bedroom allows containers.

Design rule:
- Containers are physical objects.
- All rooms should allow containers unless a specific future system creates a reason to restrict them.
- Bedroom is not a special “no container” zone.

### Door behavior

Doors are real movement gates on room connections.

Accepted default door states:
- `Bedroom ↔ Main Lab`: closed
- `Main Lab ↔ Menagerie`: open
- `Main Lab ↔ Pits`: open

Closed doors block free slime movement immediately.

Closed doors do not block the scientist from moving. Scientist movement automatically uses doors and then applies the Door behavior policy.

Container hauling is player/lab-hand driven and uses the same automatic door behavior as scientist movement.

### Door policy

Door behavior policy controls what happens after scientist movement or container hauling automatically uses a door.

Implemented options:
- Leave as set
- Leave open after use
- Close after use

Default:
- Leave as set

Design meaning:
- Leave as set: doors opened during movement are restored afterward.
- Leave open after use: doors used during movement remain open.
- Close after use: doors used during movement are closed afterward.

## Implemented behavior

### Bedroom room

Bedroom was added as a real room.

Player-facing room identity:
- Name: `Bedroom`
- Role: `Rest and recovery`
- Description: a small private room for sleep, recovery, and keeping the scientist away from the worst lab air.

Mechanical role:
- Connected only to Main Lab.
- Allows containers.
- Has low contamination baseline.
- Supports the existing rest/recovery direction through room conditions and Room Exposure systems.
- Uses the existing room UI, room geometry, room crowding, room connection, room exposure, and scientist-location systems.

### Door data

Door state is tracked for room connections.

Door state values:
- open
- closed

Door state is normalized on load/new runs so the accepted defaults are maintained.

Door state is connection-level, not room-level. The same door is shown from both connected rooms.

### Door UI

Room cards show door controls for connected rooms.

Accepted examples:
- `Bedroom door: Closed`
- `Menagerie door: Open`
- `Pits door: Open`
- `Main Lab door: Closed`

Manual controls exist:
- Open door
- Close door

Door summaries and controls remain compact enough for the current room count.

### Policies panel

Pass 2 moved Door behavior into a dedicated Doors section inside the existing Policies panel.

Accepted UI structure:
- Corpse Processing Targets remains separate.
- Doors has its own section.
- Door behavior is no longer squeezed into corpse/remains controls.
- The policy summary may still mention Door behavior.

### Free slime movement

Free slime movement respects door state.

Closed doors block free slime movement through that connection.

Open doors allow free slime movement through that connection if the slime’s behavior leads it that way.

This applies to contamination-seeking/free-room movement without adding tile-grid pathfinding.

The system remains abstract:
- no tile grid
- no detailed pathfinding grid
- no doors-as-objects on a map
- no door damage
- no creature door interaction beyond movement being blocked/allowed

### Scientist movement

Scientist movement can use closed doors automatically.

When the scientist moves through a closed door:
1. the door is treated as used for transit
2. the scientist completes the movement task
3. the Door behavior policy decides whether the door is restored, left open, or closed

This preserves convenience while still making doors meaningful for free creature movement.

### Container hauling

Container hauling can use closed doors automatically.

Hauling remains player/lab-hand driven, not slime-driven.

When hauling uses doors:
1. route logic can consider the physical connection
2. closed doors can be passed through by the hauling actor
3. the Door behavior policy applies afterward

Pit-hole hauling restrictions remain unchanged:
- pit holes are fixed room infrastructure and cannot be hauled.

### Door state tooltips

Pass 3 added tooltips/title text to door state labels.

Closed-door tooltip direction:
- closed doors block free creature movement through the connection
- scientist movement and container hauling can still pass through automatically
- automatic door use follows Door behavior policy
- doors currently affect movement only
- doors do not seal air, contamination, sound, or exposure

Open-door tooltip direction:
- open doors allow free creatures, scientist movement, and container hauling to pass through
- free creatures may move through open doors if their behavior leads them that way
- doors currently affect movement only
- doors do not seal air, contamination, sound, or exposure

Door behavior policy tooltip direction:
- explains that the policy controls what happens after scientist movement or container hauling automatically uses a door

## Awareness and hidden-information rules

Door mechanics must respect scientist awareness.

Important accepted rule:
- Event logs must not tell the player about events beyond the scientist’s awareness.

Specifically:
- If a slime in another room is blocked by a closed door, no event should appear just because the simulation knows it happened.
- Door tooltips may explain general mechanics.
- Door tooltips must not reveal that a specific unobserved slime is currently blocked.
- Hidden creature behavior should not be revealed by door UI.

Allowed:
- `Closed doors block free creature movement through this connection.`

Not allowed:
- `RG-004 is blocked by this door.`
- unobserved event logs announcing blocked slime movement in another room

The existing observation-gated philosophy from Room Exposure and free creature pressure should continue to apply.

## Relationship to existing systems

### Physical Rooms

Bedroom + Doors builds on Physical Rooms.

Existing room behavior retained:
- physical room geometry
- spatial feel
- crowding
- connected-room movement
- scientist location
- queued scientist movement
- hauling route text

Doors add a movement-gating layer to the existing connection graph.

### Out-of-Container Slime Behavior

Before doors, free slimes moved through connected rooms because no barriers existed.

After this work:
- free slimes still use room connections
- open doors allow movement
- closed doors block movement
- no attacks, damage, recapture, or full escape behavior is added

### Room Exposure and Rest

Bedroom supports the existing Room Exposure/rest loop.

The system does not add a separate sleep system.

Bedroom’s recovery identity comes from being a cleaner/private room that works with existing:
- Physical State
- room exposure
- rest quality
- unsafe rest confirmation
- current-room observation

### Container Hauling

Container hauling remains physical and queued.

Doors do not prevent hauling forever; they are automatically handled by the hauling actor and then policy is applied.

### UI Cleanup

Door state tooltips follow the existing direction of compact UI labels with explanatory hover/title text.

The tooltips explain general rules without expanding into a full codex/glossary.

## Explicitly not implemented

Bedroom + Doors does not add:

- locks
- keys
- security levels
- door HP
- door durability
- barricades
- door damage
- slimes damaging doors
- slimes opening doors
- slimes squeezing under doors
- sound propagation
- smell propagation
- environmental sealing
- air sealing
- contamination sealing
- exposure sealing
- sensors
- line of sight
- room permissions
- room construction
- room editing
- room upgrades
- furniture placement
- equipment placement
- detailed pathfinding grids
- tile maps
- creature attacks on doors
- attacks
- combat
- injuries from free creatures
- recapture systems
- full escape systems
- raids

Do not add those unless a future design discussion explicitly starts that system.

## Tests / QC completed

### Pass 1 QC

Result:
- syntax check passed
- smoke test passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- Bedroom exists as a real room
- Bedroom connects only to Main Lab
- Bedroom allows containers
- accepted default door states exist
- door UI appears on room cards
- Door behavior policy exists
- manual door buttons work
- closed doors block free slime movement
- scientist movement auto-uses doors
- container hauling auto-uses doors
- routes remain abstract
- no forbidden scope creep detected

Third-party design feedback:
- Bedroom role is clear enough as rest/recovery
- containers in Bedroom are consistent with “containers are just objects”
- closed doors blocking slimes is understandable
- scientist auto-open/reclose is convenient
- door policy wording is clear
- door controls are acceptable at current room scale

### Pass 2 QC

Result:
- syntax check passed
- smoke test passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- Policies panel has a separate Doors section
- Door behavior is absent from the Corpse Processing Targets control row
- Door behavior selector is visible and understandable
- policy summary still makes sense
- room-card door controls remain readable
- no forbidden scope creep detected

Issue found:
- headed visual pause test timed out when `VISUAL_PAUSE_MS=8000` because 4 pauses exceeded Playwright’s default 30-second timeout

Classified as:
- test-script configuration bug
- not an app bug

### Pass 2 Fix 1 QC

Result:
- syntax check passed
- normal smoke test passed
- headed visual run passed
- console warnings/errors: 0
- page errors: 0

Fix:
- Playwright test timeout now scales when `VISUAL_PAUSE_MS` is set

Confirmed:
- all 4 visual pauses complete successfully
- no gameplay code changed for the fix
- safe to commit

### Visual Playwright config QC

A visual-QC Playwright config update was accepted.

Purpose:
- headed Chromium visual tests can open on monitor 2 at the intended size

Accepted behavior:
- `VISUAL_MONITOR=2` opens the headed test window on the right monitor
- window opens at the right size
- config strips `deviceScaleFactor` when using `viewport: null`, avoiding Playwright’s `deviceScaleFactor` + `null viewport` error

This is QC tooling, not gameplay.

### Pass 3 QC

Result:
- syntax check passed
- normal smoke test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- closed-door tooltip explains movement blocking and Door behavior policy
- open-door tooltip explains movement allowance
- tooltips clarify that doors affect movement only
- tooltips clarify that doors do not seal air, contamination, sound, or exposure
- Door behavior policy has tooltip/title text
- no event logs reveal unobserved blocked slime behavior
- tooltips explain general mechanics only
- no hidden creature behavior is revealed
- no forbidden scope creep detected

Verdict:
- Pass 3 accepted

## Known limitations / future work

Potential future systems, not implemented yet:
- locks
- door durability
- door damage
- slimes opening or damaging doors
- highly mobile/oozing creatures bypassing certain doors
- door-based room permissions
- sound/smell/air/environment transmission
- true environmental sealing
- security systems
- sensors
- line of sight
- room construction/upgrades
- bedroom-specific furniture or recovery upgrades

Possible near-future polish:
- better Bedroom rest/recovery identity if the room does not feel special enough in play
- more compact door UI if the number of room connections grows
- clearer event text for scientist or hauling door use, as long as it does not reveal hidden creature behavior

## Repository / workflow notes

This system is expected to be incorporated into the current tracked source files.

Project workflow reminders:
- Use fresh prompts for new Cline/Codex chats.
- Each Cline chat has no prior context; prompts must be self-contained.
- Discuss each pass before coding.
- Run syntax checks and smoke/QC tests before committing.
- Use `git add .` for staging unless there is a specific reason not to.
- Do not create handoff docs until all passes for a feature are accepted.

Suggested commit history for accepted work:
- `Add bedroom and door foundation`
- `Polish door policy UI`
- `Add visual Playwright window config`
- `Add door state tooltips`

## Suggested index update

Add this system to `SYSTEM_HANDOFF_INDEX.md` after the handoff is accepted:

| Bedroom + Doors | `HANDOFF_BEDROOM_AND_DOORS.md` | Implemented through Bedroom + Doors Pass 3 |
