# System Handoff — Contamination Cleanup Behavior

Date: 2026-06-22

## Status

Contamination Cleanup Behavior is implemented and accepted through Pass 2.

Accepted related work:
- Contamination Cleanup Use Pass 1: `Use as Cleaner` intended-use suitability
- Contamination Cleanup Behavior Pass 2: Observable Cleanup Tags and Learning

This handoff should be treated as the current source of truth for the contamination cleanup behavior/feedback layer.

Note: Contamination Cleanup Use already has its own handoff. This document focuses on the observable cleanup behavior and learning pass, while restating the key relationship to cleanup use.

## Purpose

This system makes biological contamination cleanup visible and learnable without turning simple slimes into obedient workers.

Before this work:
- Free slimes could already seek contamination, feed on contamination, reduce room contamination, leave residue, and show hunting/roaming behavior through existing out-of-container behavior.
- `Use as Cleaner` existed as an intended use, not an order.
- Doors physically limited where free slimes could roam.
- Prediction Cleanup had already established range + confidence patterns.
- Ongoing cleanup activity could be too hard to understand without event-log spam or omniscient behavior labels.

After this work:
- Observable room cards can show a compact `Biological cleanup active` tag.
- Creature cards can show observed activity tags.
- Cleanup effect is shown as a range + confidence estimate.
- Ambiguous door behavior is shown as observed activity plus possible intent range.
- The scientist gains cleanup knowledge over time by observing cleanup-related behavior.
- Event logs do not spam routine cleanup ticks.
- Event logs only report cleanup completion when room contamination is cleared/reduced to the cleanup floor and awareness rules allow it.

## Core design decisions

### Cleanup is biological, not manual cleaning

Contamination cleanup remains driven by creatures acting on instincts.

Accepted:
- free contamination-eating slimes can reduce contamination through existing behavior
- cleanup is visible through observed room/creature state
- doors control where free creatures can roam
- the player can use slime placement and door states to shape cleanup range

Rejected:
- manual scientist cleaning as the core solution
- janitor/staff cleaning
- cleaning equipment
- cleanup orders
- cleanup room targets
- cleaner pens/zones

### Simple slimes do not obey cleanup orders

Early/simple slimes are instinct-driven.

Accepted:
- `Use as Cleaner` means scientist intended use
- a slime marked for cleanup still follows instincts
- it cannot be assigned to a specific room
- if doors are open, it may follow contamination into connected rooms
- if doors are closed, it is physically limited

Rejected:
- `assigned to clean Main Lab`
- `ordered to clean`
- `clean this room`
- direct room assignment for slimes

### Ongoing cleanup uses tags, not event-log spam

Routine cleanup activity should be shown as current observable state, not repeated event log entries.

Accepted:
- room tags
- creature activity tags
- compact estimate chips
- tooltips/title text for deeper reasoning

Rejected:
- repeated event logs such as `RG-003 cleaned 2 contamination`
- repeated event logs such as `RG-003 is feeding on contamination`
- repeated movement/feeding/residue tick spam

### Completion events are allowed, but only when awareness allows

Event logs are reserved for meaningful state changes.

Accepted:
- a completion event can fire when contamination in an observed room is cleared/reduced to the current cleanup floor
- the event must be awareness-gated
- the event should not fire repeatedly while the room remains at/below the cleanup floor
- if contamination rises above the floor again, a later cleanup completion may be notified again after cleanup clears it

Rejected:
- omniscient cleanup completion in an unobserved room
- ongoing cleanup progress spam
- hidden-room behavior leaks

## Implemented behavior

### Room cleanup tag

Observable room cards can show:

```txt
Biological cleanup active
```

This tag appears only when biological cleanup activity is observable in that room.

Implementation direction:
- `roomBiologicalCleanupTags()` produces the room chip
- `biologicalCleanupActiveInRoom()` identifies active biological cleanup
- unobserved rooms do not reveal active biological cleanup through the tag

### Creature activity tags

Creature cards can show observed activity tags.

Accepted activity examples:
- `Activity: feeding on contamination`
- `Activity: seeking contamination`
- `Activity: cleaning residue, leaving trace slime`
- `Activity: pressing against closed door`

These are observation-based activity descriptions, not commands.

Avoid:
- `Assigned to clean`
- `Following cleanup order`
- `Cleaning assigned room`

### Ambiguous closed-door intent

When a slime is observed near/against a closed door, the UI should describe what the scientist sees and present possible intent as an uncertain interpretation.

Accepted pattern:

```txt
Activity: pressing against closed door
Possible intent: seeking contamination–hunting
Confidence: Rough
```

Design meaning:
- `Activity` describes the observable behavior.
- `Possible intent` is an interpretation/range, not hidden certainty.
- `Confidence` communicates uncertainty.
- The possible intent can narrow as the scientist observes more evidence over time.

Tooltip/title direction:
- explain that this is an interpretation of observed door behavior
- do not imply a command
- do not reveal hidden true motive as certainty

### Cleanup effect estimate

When a free slime is observed performing cleanup-related behavior, creature UI can show a compact cleanup effect estimate.

Accepted visible pattern:

```txt
Cleanup effect: Trace–Good
Confidence: Rough
```

This follows Prediction Cleanup’s range + confidence design.

Main UI should remain compact:
- effect range
- confidence band

Tooltips/title text should explain:
- observed cleanup time
- observed feeding/residue/door/seeking activity
- known factors
- unknown factors
- relevant skills
- why confidence is rough/fair/strong

### Observation-based learning

The scientist gains cleanup knowledge over time by observing cleanup-related behavior.

Tracked observation/evidence direction:
- total observed cleanup minutes
- feeding minutes
- residue minutes
- door-pressing minutes
- seeking minutes
- cleanup clear events

Observation only accumulates when scientist awareness allows it.

Accepted:
- observation improves performance estimate confidence over time
- observation can narrow possible ranges
- observation can inform tooltips
- observation should not instantly reveal hidden traits as certain facts unless existing discovery rules support it

Rejected:
- learning from unobserved room behavior
- hidden trait leakage
- exact hidden genome/value reveals

### Cleanup completion notification

Cleanup completion can produce an event when contamination is cleared/reduced to the current cleanup floor and the scientist can observe it.

Accepted behavior:
- no repeated cleanup tick logs
- completion event is awareness-gated
- notification state prevents repeated completion spam
- notification can reset if contamination rises above the floor again

## Awareness and hidden-information rules

Contamination cleanup behavior must preserve observation/awareness boundaries.

Accepted:
- room cleanup tags only for observable rooms
- cleanup observation only when the scientist can observe the room
- completion event only when the scientist can observe the room
- activity tags describe observed behavior
- possible intent labels remain interpretations with confidence

Rejected:
- unobserved room cleanup tags
- unobserved cleanup learning
- event logs revealing hidden room behavior
- definite statements about hidden motive
- hidden trait/value leakage

## Relationship to existing systems

### Contamination Cleanup Use

Cleanup behavior builds on `Use as Cleaner`, but does not make it an order.

`Use as Cleaner` remains:
- intended use
- a way to evaluate suitability
- not a room target
- not obedience

### Out-of-Container Slime Behavior

Actual cleanup still comes from free slime instinctive behavior:
- contamination seeking
- contamination feeding
- residue/mess effects
- roaming/hunting/door-blocked behavior

This pass primarily makes the behavior visible and learnable.

### Bedroom + Doors

Doors are the physical control layer for cleaner roaming.

Closed doors block free slime movement.
Open doors allow free slimes to move through connected rooms if behavior leads them there.

Door interactions should remain observation-based:
- `Activity: pressing against closed door`
- possible intent range
- confidence

### Prediction Cleanup

Cleanup effect and possible intent use the range + confidence philosophy:
- compact main UI
- tooltip details
- skill/observation-based confidence
- no false certainty

### Creature Release

Creature Release warns the player before releasing a slime.
Contamination Cleanup Behavior shows what happens after the slime is free and observable.

These systems should not duplicate each other.

## Explicitly not implemented

This pass does not add:
- cleanup orders
- cleanup room targets
- direct room assignment for slimes
- obedience
- manual scientist cleaning
- janitor/staff cleaning
- cleaning equipment
- cleaner pens/zones
- new slime behavior beyond feedback/learning for existing behavior
- attacks
- combat
- injuries from free creatures
- recapture
- full escape systems
- new door mechanics
- slimes opening doors
- slimes damaging doors
- PPE
- treatment systems
- medicine systems
- new skill systems
- exact prediction percentages
- prediction minigames

Do not add those unless a future design discussion explicitly starts that system.

## Tests / QC completed

### Pass 2 QC

Result:
- syntax check passed
- Contamination Cleanup Behavior Pass 2 smoke test passed
- Prediction Cleanup Pass 4 regression test passed
- Prediction Cleanup Pass 3 regression test passed
- Prediction Cleanup Pass 2 regression test passed
- Prediction Cleanup Pass 1 regression test passed
- Creature Release Pass 1 regression test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- room cards show `Biological cleanup active` when observable
- unobserved rooms do not show cleanup activity tags
- creature cards show observed activity tags
- `Activity: feeding on contamination` appears for observed feeding behavior
- `Activity: pressing against closed door` appears for ambiguous closed-door behavior
- `Possible intent: seeking contamination–hunting` appears as an interpretation range
- intent tooltip states this is an interpretation, not a command or hidden certainty
- cleanup effect uses range + confidence
- cleanup effect tooltip includes observed cleanup time and relevant skills
- observation tracking includes total minutes, feeding minutes, residue minutes, door minutes, seeking minutes, and clear events
- observation only records when `scientistObservesRoom(roomId)` is true
- event log does not spam cleanup tick events
- cleanup completion event only fires when contamination is cleared/reduced to the cleanup floor and awareness allows it
- notification state prevents repeated completion spam
- cleanup completion notification can reset after contamination rises above the floor again
- no regressions in Prediction Cleanup or Creature Release
- no forbidden scope creep detected

Third-party QC verdict:
- ACCEPT

## Known limitations / future work

Potential future work:
- tune cleanup effect ranges after playtesting
- add richer observed-behavior learning if it becomes important
- decide whether cleanup completion in an unobserved room should be noticed later when observed
- improve room-level cleanup tags if multiple biological effects occur at once
- add deeper slime knowledge progression only through explicit future design
- continue contamination cleanup behavior only if it preserves instinct-driven creatures and awareness rules

Important future design direction:
Ongoing biological cleanup should primarily be represented as observable state, not event-log spam. Event logs should remain reserved for meaningful observed state changes such as cleanup completion.

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
- `Add observable cleanup activity`
