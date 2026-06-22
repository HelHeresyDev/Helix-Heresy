# System Handoff — Contamination Cleanup Use

Date: 2026-06-21

## Status

Contamination Cleanup Use is implemented and accepted through Pass 1.

Accepted pass:
- Pass 1: Cleanup as an intended use with suitability readout

This feature is complete enough to hand off because the next planned work has been reclassified as a separate system:

- Creature Release Pass 1 — Release Suitability Warning

Creature Release will build on cleanup-use suitability, but it is broader than contamination cleanup and should have its own design discussion and implementation pass.

## Purpose

This system introduces contamination cleanup as an intended use for simple slimes without implying obedience or room-target assignment.

Before this work:
- Free/uncontained slimes could already seek contamination, feed on contamination, reduce room contamination, leave residue, and show hunting intent through existing out-of-container behavior.
- Doors could limit free slime movement between rooms.
- Creature jobs existed for uses such as Corpse Processing and Waste Disposal.
- The player did not have a clear job/use UI way to mark a slime as intended for cleanup or evaluate cleanup suitability.

After this work:
- `Use as Cleaner` exists as a creature job/use option.
- The job/use UI can show cleanup suitability.
- Cleanup suitability explains helpful factors, concerns, and unknown factors.
- The UI explicitly frames cleanup as the scientist's intended use, not a command the slime obeys.
- Simple slimes still follow instincts.
- Doors remain the physical way to limit where a free slime can roam.

## Core design decisions

### Simple slimes do not obey job orders

Early/simple slimes are instinct-driven creatures.

For them, selecting a job/use does not mean the slime understands or obeys an order.

Player-facing meaning:
- `Use as Cleaner` means the scientist intends to use that slime as a cleaner.
- It does not mean the slime has been commanded to clean a room.
- It does not mean the slime will stay in one room.
- It does not override the slime's instincts.

Accepted principle:

```txt
Scientist intent does not equal creature obedience.
```

### Cleanup is not room-targeted

A cleaner slime cannot be assigned to a specific cleanup room.

Rejected directions:
- cleanup target room
- assign cleanup target
- clean this room
- order slime to clean

Accepted behavior:
- The player can physically put or release the slime into a room.
- The player can use doors to limit where the slime can roam.
- If doors are open, a contamination-seeking slime may follow contamination into connected rooms.
- If doors are closed, the slime is physically limited by closed doors.

### Perfect cleaner definition

A strong or ideal cleaning slime is one that:
- seeks contamination
- feeds on contamination
- does not leave residue or mess
- is not predatory
- is calm / low Stress
- is stable
- appears safe enough to release

A risky cleaner may:
- feed on contamination but not seek it
- seek contamination but leave residue
- be predatory or hunting-oriented
- be stressed
- be unstable
- have unknown contact hazards
- be unknown enough that safe deployment cannot be confidently predicted

## Implemented behavior

### Use as Cleaner option

A new job/use option exists:

```txt
Use as Cleaner
```

This option marks the slime as intended for cleanup use.

Accepted wording direction:
- `marked for cleanup use`
- `intended cleanup use`
- `Use as Cleaner`

Avoid:
- `ordered to clean`
- `assigned to clean this room`
- `cleanup target`
- `clean this room`

### Cleanup suitability panel

When a slime is marked for cleanup use, the job/use UI shows cleanup suitability.

Suitability considers known/discovered factors such as:
- sustenance / whether the slime feeds on contamination
- behavior / whether the slime seeks contamination
- byproduct or residue/mess risk
- predatory behavior
- Stress / calm condition
- stability
- unknown sustenance, behavior, byproduct, consistency, stability, or contact hazards

The suitability readout includes:
- suitability band
- helpful factors
- concerns
- unknown factors
- a control note

Accepted suitability direction:
- Poor
- Adequate
- Good
- Hazardous

Exact labels may be adjusted in future passes if needed, but the key intent is that the player sees whether this slime is likely to be useful and safe for cleanup use.

### Control note

The UI includes a control note explaining that simple slimes follow instincts and doors limit roaming.

Accepted direction:

```txt
Simple slimes follow instincts. Use doors to limit where this creature can roam; it will seek contamination wherever it can reach.
```

Important nuance:
- A slime marked for cleanup does not necessarily seek contamination.
- The wording should not imply all cleanup-marked slimes will clean effectively.
- The suitability readout should explain whether the current slime actually appears suited to the intended use.

### Contained cleaner state

A contained slime marked `Use as Cleaner` does not appear to be actively cleaning.

Accepted direction:
- contained cleaner UI can say `Activity: contained; intended cleanup use`
- contained cleaner UI should not say the slime is cleaning the room
- the slime must be free/uncontained to roam and act on room contamination through existing behavior

### Free cleaner behavior

Free cleaners continue to use existing instinct-driven out-of-container behavior.

This pass does not add new movement logic.

Existing behavior remains the source of actual cleanup:
- contamination-seeking/eating slimes can move toward contamination
- open doors allow movement through room connections
- closed doors block movement
- suitable free slimes can feed on contamination and reduce room contamination
- messy slimes can leave residue or worsen contamination
- predatory/hunting slimes may show hunting intent without attacks

## Awareness and hidden-information rules

Cleanup suitability should respect the game's knowledge/discovery direction.

The UI may show known, discovered, or inferred factors.

The UI should not reveal hidden traits as definite facts if they have not been discovered or otherwise made knowable.

Event logs must not become omniscient.

Accepted:
- suitability can show unknown factors
- observed free slime behavior can produce observed events when the scientist is aware
- unobserved room behavior should not generate omniscient event logs

Rejected:
- event logs revealing hidden slime behavior outside scientist awareness
- door/cleanup UI revealing that a specific unobserved slime is blocked or cleaning elsewhere
- cleanup suitability revealing undiscovered traits as certain facts

## Relationship to existing systems

### Out-of-Container Slime Behavior

Contamination Cleanup Use builds directly on out-of-container behavior.

Actual cleaning is still performed by instinctive free creature behavior, not by obeyed job orders.

### Bedroom + Doors

Doors are the physical control layer for cleaner roaming.

Examples:
- Put a cleaner in Bedroom and close the Bedroom door to keep it there.
- Open Main Lab ↔ Pits if the player wants a cleaner to be able to follow contamination into Pits.
- Keep Bedroom closed to prevent free cleaners or dangerous creatures from wandering into the recovery space.

### Creature Jobs / Use UI

This system uses the existing job/use UI pattern, but player-facing wording must avoid implying obedience for simple slimes.

The internal job ID may be implementation convenience. The player-facing idea is intended use.

### Room Exposure

Cleanup use supports the broader exposure loop:
- contaminated rooms worsen scientist Physical State over time
- cleaner slimes can help reduce contamination if their instincts and traits support it
- doors and Bedroom provide ways to manage recovery and exposure risk

## Explicitly not implemented

This pass does not add:
- cleanup room targets
- assign cleanup target
- direct room assignment for cleanup
- order slime to clean
- manual scientist cleaning
- janitor cleaning
- staff cleaning
- cleaning equipment
- room upgrades
- cleaning room upgrades
- contained-container room cleaning
- cleaner pens
- cleaner zones
- new cleanup movement logic
- new door mechanics
- slimes opening doors
- slimes damaging doors
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

### Pass 1 QC

Result:
- syntax check passed
- normal smoke test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- `Use as Cleaner` exists in the job/use definitions
- selecting cleanup marks the slime for cleanup use
- event text says the slime was marked for cleanup use and will still follow instincts
- contained cleanup slime shows intended cleanup use, not active cleaning
- free cleanup slime continues to use instinctive behavior
- cleanup suitability panel appears in the job/use details area
- suitability considers contamination feeding, contamination seeking, residue risk, predatory behavior, Stress, stability, and unknown traits
- option tooltip includes helpful factors, concerns, unknowns, and control note
- Door policy UI remains visible and functional
- Bedroom + Doors behavior is not broken
- no cleanup room target assignment exists
- no forbidden scope creep detected

Third-party QC verdict:
- ACCEPT

## Known limitations / future work

Potential future systems:
- Creature Release Pass 1: general release suitability warning for all released slimes
- more detailed release warnings based on intended use
- broader intended-use suitability for other uses besides cleanup
- future creature families that can actually understand orders
- later cleaner containment/deployment tools, if explicitly designed
- future room or door systems that shape where cleaners can roam

Important next design decision:
Creature Release is broader than cleanup. Release warnings should evaluate how well a slime's likely free behavior matches its current intended use, regardless of whether that use is cleanup, idle, corpse work, waste disposal, or a future role.

## Repository / workflow notes

This system is expected to be incorporated into the current tracked source files.

Project workflow reminders:
- Use fresh prompts for new Cline/Codex chats.
- Each Cline chat has no prior context; prompts must be self-contained.
- Discuss each pass before coding.
- Run syntax checks and smoke/QC tests before committing.
- Use `git add .` for staging unless there is a specific reason not to.
- Do not create handoff docs until all passes for a feature are accepted.

Suggested commit for accepted work:
- `Add cleanup use suitability`
