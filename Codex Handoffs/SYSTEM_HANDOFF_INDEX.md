# Helix Heresy — System Handoff Index

Use this index to find the current handoff document for each implemented or actively designed system.

## Current handoffs

| Area | Handoff file | Status |
|---|---|---|
| Physical Rooms | `HANDOFF_PHYSICAL_ROOMS.md` | Implemented through Physical Rooms Pass 3 |
| Room Exposure | `HANDOFF_ROOM_EXPOSURE.md` | Implemented through Room Exposure Pass 4 Fix 2 |
| UI Cleanup | `HANDOFF_UI_CLEANUP.md` | Implemented through UI Cleanup Pass 2 Fix 1 |
| Bedroom + Doors | `HANDOFF_BEDROOM_AND_DOORS.md` | Implemented through Bedroom + Doors Pass 3 |
| Storage Room | `HANDOFF_STORAGE_ROOM.md` | Implemented through Storage Room Pass 1 |
| Inventory | `HANDOFF_INVENTORY.md` | Implemented through Inventory Pass 6 |
| Contamination Cleanup Use | `HANDOFF_CONTAMINATION_CLEANUP_USE.md` | Implemented through Contamination Cleanup Pass 1 |
| Contamination Cleanup Behavior | `HANDOFF_CONTAMINATION_CLEANUP_BEHAVIOR.md` | Implemented through Contamination Cleanup Behavior Pass 2 |
| Creature Release | `HANDOFF_CREATURE_RELEASE.md` | Implemented through Creature Release Pass 1 |
| Prediction Cleanup | `HANDOFF_PREDICTION_CLEANUP.md` | Implemented through Prediction Cleanup Pass 4 |

## Current working state

Room Exposure is complete enough to pause or move on:
- Pass 1: Physical State + hidden exposure + diagnostics
- Pass 2: Current-room exposure + observation reliability + snapshot-based move warnings
- Pass 3: Rest quality + unsafe rest confirmation
- Pass 4: Toxic/Failing action gates

UI Cleanup side track:
- UI Cleanup Pass 1 Fix 1: keyword tooltips and modified stamina cost breakdowns
- UI Cleanup Pass 2 Fix 1: policy panel layout fix for corpse-processing controls

Bedroom + Doors is complete and handed off:
- Pass 1: Bedroom + door foundation
- Pass 2: Door policy UI polish
- Pass 2 Fix 1: Playwright visual-pause timeout fix
- Visual Playwright config: headed visual QC opens on monitor 2 at the intended size
- Pass 3: door state and door policy tooltips

Storage Room is complete and handed off:
- Pass 1: room foundation
- Storage Room connects only to Main Lab
- Storage Room door defaults closed
- Storage Room allows containers

Inventory is complete and handed off through Pass 6:
- Pass 1: Storage Room ledger foundation
- Pass 1 Fix 1: inventory cheat button and Enter key fix
- Pass 2: Materials + Tools & Supplies catalog
- Pass 2 Fix 1: strict-mode selector fix
- Pass 3: starter stock
- Pass 4: inventory-aware handling UI, no gates
- Pass 5: tool requirement preview warnings, no gates
- Pass 6: tool requirement gates
- inventory is lab-wide for now and fictionally stored in Storage Room
- tools are reusable and not consumed
- missing required tools disable relevant handling action buttons
- no crafting, recipes, durability, storage capacity, room-local piles, or vendors are implemented

Contamination Cleanup Use is complete and handed off:
- Pass 1: cleanup as an intended use with suitability readout
- `Use as Cleaner` does not mean the slime obeys an order
- simple slimes still follow instincts
- doors physically limit where free slimes can roam

Contamination Cleanup Behavior is complete and handed off:
- Pass 2: observable cleanup tags and learning
- room cards can show `Biological cleanup active` when observable
- creature cards show observed activity tags and cleanup effect estimates
- ambiguous door behavior uses possible intent range + confidence
- cleanup observation improves confidence over time
- event logs do not spam routine cleanup ticks
- cleanup completion event is awareness-gated

Creature Release is complete and handed off:
- Pass 1: release suitability warning
- release warnings apply to contained slime release generally, regardless of intended use
- warnings explain that released simple slimes follow instincts
- warnings evaluate possible fit after release for the current intended use
- cancelling release spends no stamina and keeps the slime contained

Prediction Cleanup is complete and handed off:
- Pass 1: compact ranges and confidence tooltips for cleanup suitability and release suitability
- Pass 1 Fix 1: test selector/test-flow fix
- Pass 2: active containment risk ranges
- Pass 3: direct handling risk ranges
- Pass 4: container physical fit ranges
- predictions show possibility ranges when uncertain
- main UI shows range + confidence, plus method/possible harm where relevant
- detailed factors live in tooltips/title text
- skills can improve confidence/range without revealing hidden traits

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

Storage Room currently does **not** include:
- storage capacity
- room-local material piles
- hauling inventory between rooms
- item decay
- container repair
- recipes
- research costs
- auto-loot

Inventory currently does **not** include:
- crafting
- recipes
- vendors/shops
- buying/selling
- item rarity
- equipment slots
- tool durability
- tool contamination
- tool consumption
- storage capacity
- room-local material piles
- hauling inventory between rooms
- item decay
- container repair
- research costs
- auto-loot
- gameplay material sources
- corpse processing outputs
- cleanup outputs
- new slime behavior
- new door mechanics
- new injury mechanics

Contamination Cleanup systems currently do **not** include:
- cleanup room targets
- assign cleanup target
- order slime to clean
- direct room assignment for slimes
- obedience
- manual scientist cleaning
- janitor/staff cleaning
- cleaning equipment
- cleaning room upgrades
- contained-container room cleaning
- cleaner pens/zones
- new slime behavior beyond feedback/learning for existing behavior
- attacks/combat
- injuries from free creatures
- recapture
- full escape systems
- PPE
- treatment/medicine systems
- new skill systems
- exact prediction percentages
- prediction minigames

Creature Release currently does **not** include:
- release target rooms
- cleanup target rooms
- direct room assignment for released slimes
- obedience
- commands
- order slime to clean behavior
- manual scientist cleaning
- janitor/staff cleaning
- cleaning equipment
- cleaner pens/zones
- attacks/combat
- injuries from free creatures
- recapture
- full escape systems
- slimes opening doors
- slimes damaging doors
- new door mechanics
- PPE
- treatment/medicine systems

Prediction Cleanup currently does **not** include:
- new slime behavior
- new cleanup mechanics
- release target rooms
- cleanup target rooms
- obedience/commands
- attacks/combat
- injuries from free creatures
- recapture/full escape systems
- new door mechanics
- PPE/treatment/medicine systems
- a new skill system
- exact prediction percentages
- prediction minigames

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
- Inventory Pass 7 — one narrow gameplay source for inventory materials, probably corpse/remains processing output
- decide whether corpse processing should produce Biomass, Ruined organic matter, Preserved tissue, or another material
- add inventory source/discovery messages
- tune contamination cleanup behavior after playtesting
- review genome/synthesis predictions for false precision
- broader intended-use suitability for non-cleanup uses
- better fit tuning for release warnings
- door UI compaction later if the number of rooms/connections grows

Do not implement any next topic without a design discussion first.

## Global workflow notes

- Use fresh prompts for new Cline/Codex chats.
- Each Cline chat has no prior context; prompts must be self-contained.
- Cline should be used for QC/testing/visual inspection/reporting, not coding, unless explicitly requested.
- The assistant should generate implementation files/patch bundles directly when asked.
- When replacement-file bundles are created, provide only the `.zip` link by default.
- Do not add manifest files to normal zips unless explicitly needed.
- Use `git add .` for staging unless there is a specific reason not to.
- Continue to keep implementation passes narrow.
- Discuss design before coding.
- Smoke tests should check both behavior and scope discipline.
- If a pass introduces UI wording, include qualitative QC for readability, repetition, and scope creep.
- Do not create handoff docs until all passes for a feature are accepted.
