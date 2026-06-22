# Helix Heresy — System Handoff Index

Use this index to find the current handoff document for each implemented or actively designed system.

## Current handoffs

| Area | Handoff file | Status |
|---|---|---|
| Physical Rooms | `HANDOFF_PHYSICAL_ROOMS.md` | Implemented through Physical Rooms Pass 3 |
| Room Exposure | `HANDOFF_ROOM_EXPOSURE.md` | Implemented through Room Exposure Pass 4 Fix 2 |
| UI Cleanup | `HANDOFF_UI_CLEANUP.md` | Implemented through UI Cleanup Pass 1 Fix 1 |
| Bedroom + Doors | `HANDOFF_BEDROOM_AND_DOORS.md` | Implemented through Bedroom + Doors Pass 3 |

## Current working state

Room Exposure is complete enough to pause or move on:
- Pass 1: Physical State + hidden exposure + diagnostics
- Pass 2: Current-room exposure + observation reliability + snapshot-based move warnings
- Pass 3: Rest quality + unsafe rest confirmation
- Pass 4: Toxic/Failing action gates

UI Cleanup side track is complete:
- UI Cleanup Pass 1 Fix 1: keyword tooltips and modified stamina cost breakdowns

Bedroom + Doors is complete enough to hand off:
- Pass 1: Bedroom + door foundation
- Pass 2: Door policy UI polish
- Pass 2 Fix 1: Playwright visual-pause timeout fix
- Visual Playwright config: headed visual QC opens on monitor 2 at the intended size
- Pass 3: door state and door policy tooltips

Treat tooltip/cost work as **UI Cleanup**, not Room Exposure.

Treat visual Playwright monitor placement as **QC/tooling**, not gameplay.

## Current accepted design boundaries

Bedroom + Doors currently does **not** include:
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
- sound/smell propagation
- environmental sealing
- sensors
- line of sight
- room permissions
- room construction
- room editing
- furniture/equipment placement
- detailed pathfinding grids
- attacks
- combat
- injuries from free creatures
- recapture
- full escape systems
- raids

Room Exposure currently does **not** include:
- treatment systems
- medicine
- PPE
- disease tracks
- radiation tracks
- magic/mana exposure tracks
- creature attacks
- combat
- recapture
- full escape systems

## Likely next design directions

Potential next topics:
- Contamination cleanup / cleaner slime role
- Bedroom rest/recovery identity polish, if the Bedroom does not feel special enough in play
- Door UI compaction later if the number of rooms/connections grows

Do not implement any next topic without a design discussion first.

## Global workflow notes

- Use fresh prompts for new Cline/Codex chats.
- Each Cline chat has no prior context; prompts must be self-contained.
- Use `git add .` for staging unless there is a specific reason not to.
- Continue to keep implementation passes narrow.
- Discuss design before coding.
- Smoke tests should check both behavior and scope discipline.
- If a pass introduces UI wording, include qualitative QC for readability, repetition, and scope creep.
- Do not create handoff docs until all passes for a feature are accepted.
