# System Handoff — Creature Release

Date: 2026-06-21

## Status

Creature Release is implemented and accepted through Pass 1.

Accepted pass:
- Pass 1: Release Suitability Warning

This handoff should be treated as the current source of truth for the Creature Release feature.

## Purpose

This system improves the decision point where the player releases a contained slime into a room.

Before this work:
- Simple slimes could be released from containment.
- Free slimes followed instinct-driven out-of-container behavior.
- Bedroom + Doors made closed doors block free slime movement.
- Contamination Cleanup Use added intended-use suitability, especially `Use as Cleaner`.
- But the release action itself did not clearly warn the player what releasing a simple instinct-driven creature implied.

After this work:
- Releasing a contained slime shows a suitability warning.
- The warning applies to every contained slime release, regardless of current intended use.
- The warning explains that released simple slimes follow instincts.
- The warning explains that doors limit where released slimes can roam.
- The warning shows the slime's current intended use.
- The warning shows expected fit after release for that intended use.
- The warning can show helpful factors, concerns, and unknown factors.
- Cancelling the warning blocks release and spends no stamina.
- Accepting the warning allows the existing release behavior to proceed.

## Core design decisions

### Release is always a serious ecological decision

Releasing a slime is not just a cleanup action.

Any released slime may:
- roam if doors allow it
- follow its instincts
- interact with room conditions
- clean, wander, leave residue, hunt, or otherwise behave according to known and unknown traits

Therefore, release suitability warnings apply to all releases, not only slimes marked `Use as Cleaner`.

### Simple slimes follow instincts

Early/simple slimes do not understand orders or room assignments.

Accepted wording direction:
- `Released simple slimes follow instincts. Doors limit where they can roam.`
- `Released slimes cannot be commanded or assigned to rooms.`
- `Intended use`
- `Expected fit after release`

Avoid:
- `order slime to clean`
- `send slime to clean`
- `assign release target`
- `release target room`
- `slime obeys`
- any wording implying the slime will follow room-specific instructions

### Intended use is a player plan, not creature obedience

The release warning evaluates how well the slime's likely free behavior fits the current intended use.

Current intended uses may include:
- Idle
- Corpse Processing
- Waste Disposal
- Use as Cleaner
- future intended uses

The warning does not guarantee the slime will perform that use.

Example direction:
- A cleanup-marked slime with contamination feeding and seeking traits may have strong fit.
- A cleanup-marked slime with predatory behavior or residue risk may have poor or risky fit.
- A slime with unknown behavior may show unknown factors rather than revealing hidden traits.

### Doors are the physical control layer

The warning reminds the player that doors limit where released slimes can roam.

This builds on Bedroom + Doors:
- open doors allow free slime movement through connected rooms
- closed doors block free slime movement
- slimes are not assigned to rooms
- the player shapes roaming by physically managing doors

## Implemented behavior

### Release warning

Before releasing a contained living slime, the game builds a multi-line warning.

Accepted warning structure:
- title: `Release warning`
- instinct/door reminder
- current intended use
- expected fit after release
- helpful factors
- concerns
- unknown factors
- confirmation question

Accepted examples:
- `Released simple slimes follow instincts. Doors limit where they can roam.`
- `Intended use: Use as Cleaner`
- `Expected fit after release: Good`
- `Helpful factors: feeds on contamination`
- `Concerns: predatory behavior`
- `Unknown factors: behavior, sustenance`

### Release button tooltip/title

The Release button can show the release suitability warning before the player clicks.

This gives the player a chance to review risk before opening the confirmation.

### Cancel behavior

If the player cancels the release warning:
- the slime remains contained
- release is blocked
- stamina is not spent
- the event log can report the cancellation

Accepted direction:
- release cancellation should not create the release task/effect
- stamina should only be spent after confirmation succeeds

### Accept behavior

If the player accepts the warning:
- the existing release behavior proceeds normally
- the slime becomes free/released into the appropriate room
- existing out-of-container behavior governs future movement/activity
- no new obedience or room-target system is added

### Intended-use fit

The warning evaluates expected fit after release based on current intended use.

Accepted fit labels:
- Excellent
- Good
- Acceptable
- Poor
- Unknown

Exact tuning may change later, but the warning should stay conservative and knowledge-gated.

Examples:
- Cleanup use can delegate to existing cleanup-use suitability.
- Idle use may be uncertain if the slime's free behavior is unknown.
- Corpse Processing or Waste Disposal can include caveats that formal work depends on reachable remains, room conditions, and existing job requirements.

### Knowledge gating

The warning should respect trait discovery and observation rules.

Known factors can be shown when known/discovered/inferable.

Unknown factors should be shown as unknown rather than revealed as facts.

Accepted:
- `Unknown factors: behavior, sustenance`
- `Concerns: predatory behavior` only if that is known/discovered/inferable
- conservative `Unknown` or `Poor` fit when too much is unknown

Rejected:
- revealing undiscovered genome/trait values
- saying an unobserved slime is definitely hunting/cleaning elsewhere
- omniscient release predictions based on hidden traits

## Awareness and hidden-information rules

Creature Release warnings must not leak hidden information.

The warning may explain general mechanics:
- released slimes follow instincts
- doors limit roaming
- current intended use
- known helpful factors
- known concerns
- unknown factors

The warning must not reveal:
- hidden traits as certain facts
- unobserved room behavior
- unobserved slime positions
- unobserved blocked-door behavior
- exact hidden genome or internal values

Event logs should not become omniscient.

## Relationship to existing systems

### Contamination Cleanup Use

Creature Release builds on cleanup-use suitability.

When a slime is marked `Use as Cleaner`, the release warning can evaluate whether the slime is likely to be a good cleaner once free.

However:
- cleanup use is still an intended use, not an order
- no cleanup target room is added
- no cleanup obedience is added

### Bedroom + Doors

Doors are central to release consequences.

The release warning reminds the player that doors limit where released slimes can roam.

This connects the release decision to:
- Bedroom protection
- free slime movement
- contamination cleanup range
- lab safety

### Out-of-Container Slime Behavior

After release, existing out-of-container behavior remains responsible for actual free slime activity.

The pass does not add new free-slime movement logic.

### Creature Jobs / Use UI

Creature Release interprets job/use as intended use when evaluating fit.

This makes the release warning broader than cleanup:
- future uses can be evaluated at release time
- current job/use can provide context without implying obedience

## Explicitly not implemented

This pass does not add:
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
- attacks
- combat
- injuries from free creatures
- recapture
- full escape systems
- slimes opening doors
- slimes damaging doors
- new door mechanics
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
- release warning appears before release
- warning applies to contained slime release generally
- warning explains released simple slimes follow instincts
- warning explains doors limit where released slimes can roam
- warning shows current intended use
- warning shows expected fit after release
- warning can show helpful factors, concerns, and unknown factors
- Release button tooltip/title shows the warning before click
- cancelling leaves slime contained
- cancelling spends no stamina
- accepting proceeds with existing release behavior
- warning does not imply obedience or room targeting
- warning is knowledge-gated
- existing cleanup-use UI remains intact
- existing Bedroom + Doors UI remains intact
- no forbidden scope creep detected

Third-party QC verdict:
- ACCEPT

## Known limitations / future work

Potential future work:
- broader intended-use suitability for non-cleanup uses
- improved fit tuning for Idle, Corpse Processing, and Waste Disposal
- future release warnings for more advanced creature families that may understand commands
- future recapture, escape, attack, or injury systems only if explicitly designed later
- future door/security systems only if explicitly designed later

Important future design note:
Creature Release is now the general place for warning the player about what happens when a creature leaves containment. Cleanup-specific systems should not duplicate this warning; they should feed intended-use suitability into it.

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
- `Add release suitability warning`
