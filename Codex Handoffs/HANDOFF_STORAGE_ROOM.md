# System Handoff — Storage Room

Date: 2026-06-22

## Status

Storage Room is implemented and accepted through Pass 1.

Accepted work:
- Storage Room Pass 1: Room Foundation

This handoff should be treated as the current source of truth for the Storage Room feature.

## Purpose

This system adds a real physical storage space to the lab before the inventory/material ledger system is implemented.

Before this work:
- The lab had several physical rooms, including Main Lab, Bedroom, Menagerie, and Pits.
- Doors existed on room connections.
- Bedroom + Doors established that rooms and doors are meaningful physical spaces.
- Inventory was not implemented yet.
- A future inventory system risked feeling like a floating magic backpack unless it had a physical storage context.

After this work:
- Storage Room exists as a real room.
- Storage Room is connected only to Main Lab.
- Storage Room door defaults closed.
- Storage Room allows containers like other normal rooms.
- Storage Room has a material-storage role and label.
- Scientist movement through the closed Storage Room door works using existing door policy.
- No inventory, crafting, storage capacity, item logistics, or material ledger has been added yet.

## Core design decisions

### Storage Room comes before inventory

The Storage Room was added before inventory so future material systems have a physical facility context.

Accepted direction:
- inventory can later be presented as a Storage Room ledger
- Pass 1 only adds the room foundation
- no material ledger or item system is included yet

### Storage Room is a normal physical room

Storage Room is a real room in the room graph.

Accepted:
- connected only to Main Lab
- supports existing room geometry/conditions systems
- supports existing door systems
- supports existing scientist movement systems
- allows containers

Rejected:
- special abstract inventory screen with no room grounding
- storage as a magical backpack
- storage as a hidden off-map space

### Storage Room door defaults closed

Accepted default:
- Storage Room ↔ Main Lab door defaults closed

Design reason:
- Storage should feel controlled.
- The player can open/close the door using existing door controls.
- Scientist movement can pass through automatically using existing door behavior policy.
- Closed doors continue to block free slime movement.

### Storage Room allows containers

Containers are physical objects, not special-case room features.

Accepted:
- Storage Room allows containers like other rooms
- no room-specific container restriction is added

## Implemented behavior

### Room definition

Storage Room was added as a real room.

Accepted room identity:
- id: `storageRoom`
- name: `Storage Room`
- role: `materialStorage`
- role label: `Materials storage`

Expected player-facing identity:
- a controlled room for storing lab materials, supplies, containers, and future inventory resources

### Room connection

Storage Room connects only to Main Lab.

Accepted connection:
- `Storage Room ↔ Main Lab`

Storage Room does not connect directly to:
- Bedroom
- Menagerie
- Pits

Main Lab includes Storage Room as a connected room.

### Door default

The Storage Room door defaults closed.

Accepted default:
- `Storage Room ↔ Main Lab`: closed

This follows the controlled-room logic used by Bedroom, while Menagerie/Pits defaults remain unchanged.

### Door behavior

Storage Room uses the existing door system.

Accepted:
- closed door blocks free slime movement
- scientist movement can automatically pass through the closed door
- container hauling can use existing automatic door behavior
- Door behavior policy still applies after movement/hauling

No new door mechanics were added.

### Scientist movement

The scientist can move from Main Lab to Storage Room.

Movement through the closed Storage Room door uses existing automatic door behavior/policy.

No special movement rule was added.

### Container support

Storage Room allows containers.

No inventory, item, or storage-capacity behavior was added.

## Relationship to existing systems

### Physical Rooms

Storage Room builds on Physical Rooms.

Existing room features retained:
- room geometry
- room role/label
- room description
- room connections
- room sorting/display
- scientist movement
- container compatibility
- room card rendering

### Bedroom + Doors

Storage Room uses Bedroom + Doors foundations.

Relevant inherited behavior:
- door controls on room cards
- door default state
- closed doors block free slime movement
- scientist movement and hauling can use closed doors automatically
- Door behavior policy applies after movement/hauling

### Contamination Cleanup / Free Slimes

Closed Storage Room door can limit where free slimes roam.

No new slime behavior was added.

### Inventory

Inventory is not implemented in this pass.

Storage Room is intended to ground a future inventory/material ledger system.

Future inventory direction:
- Inventory may be presented as a Storage Room ledger.
- Pass 1 inventory can still be mechanically lab-wide.
- Future room-local storage/hauling/capacity should require separate design discussion.

## Explicitly not implemented

This pass does not add:
- inventory ledger
- material ledger
- crafting
- vendors
- shops
- buying/selling
- item rarity
- equipment
- storage capacity
- room-local material piles
- hauling inventory between rooms
- item decay
- container repair
- recipes
- research costs
- auto-loot
- new slime behavior
- new door mechanics
- attacks
- combat
- injuries from free creatures
- recapture
- full escape systems
- PPE
- treatment systems
- medicine systems

Do not add those unless a future design discussion explicitly starts that system.

## Tests / QC completed

### Storage Room Pass 1 QC

Result:
- syntax check passed
- smoke test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- Storage Room exists as a room
- room id is `storageRoom`
- name is `Storage Room`
- role is `materialStorage`
- role label is `Materials storage`
- Storage Room is connected only to Main Lab
- Main Lab connects to Storage Room
- Storage Room appears in room sort order last
- Storage Room door defaults closed
- Storage Room allows containers
- scientist movement from Main Lab to Storage Room works through the closed door using existing door policy
- existing room/door UI still renders
- all five rooms are active
- no inventory/crafting/material system appeared
- no forbidden scope creep detected

Third-party QC verdict:
- ACCEPT

## Known limitations / future work

Potential future work:
- Inventory Pass 1 — Storage Room Ledger Foundation
- lab-wide material ledger fictionally stored in Storage Room
- future room-local storage if explicitly designed later
- storage capacity, item decay, recipes, repair, crafting, vendors, or hauling logistics only after design discussion

Likely next inventory direction:
- add an Inventory / Storage Ledger panel
- treat inventory as lab-wide for now
- label it as a Storage Room ledger
- no room-local hauling, capacity, crafting, or recipes in first inventory pass

## Repository / workflow notes

This system is expected to be incorporated into the current tracked source files.

Project workflow reminders:
- Use fresh prompts for new Cline/Codex chats.
- Each Cline chat has no prior context; prompts must be self-contained.
- Cline should be used for QC/testing/visual inspection/reporting, not coding, unless explicitly requested.
- The assistant should generate implementation files/patch bundles directly when asked.
- Discuss each pass before coding.
- Run syntax checks and smoke/QC tests before committing.
- Use `git add .` for staging unless there is a specific reason not to.
- Do not create handoff docs until all passes for a feature are accepted.

Suggested commit for accepted work:
- `Add storage room foundation`
