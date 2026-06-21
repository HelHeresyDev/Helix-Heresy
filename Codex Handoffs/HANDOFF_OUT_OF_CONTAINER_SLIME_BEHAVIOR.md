# System Handoff — Out-of-Container Slime Behavior

Date: 2026-06-21

## Purpose

This system starts turning free/uncontained creatures into room-level actors instead of treating them as accidents or purely contained specimens.

The long-term design goal is that contamination cleanup should be creature-driven:
- The player designs or discovers slimes that seek contamination.
- If those slimes are not too dangerous, the player can let them loose in the lab.
- They roam, feed, and alter room conditions.
- This creates a biological solution to contamination instead of a simple janitor button.

Before this system:
- Containers, rooms, hauling, pit holes, corpse handling, and direct living slime transfer existed.
- Slimes could be released, but out-of-container behavior was not meaningfully modeled.
- Contamination could rise from multiple systems, but cleanup was not yet creature-driven.

After this system:
- Free/uncontained slimes have room location and activity.
- Contained slimes use containment-focused UI language.
- Free slimes can move between rooms because early-game doors are not implemented.
- Contamination-seeking/eating free slimes can reduce room contamination.
- Messy free slimes can leave residue and increase room contamination.
- Predatory/hunting free slimes can show hunting intent without attacks.
- Free creature pressure is observation-gated and knowledge-gated.

## Core language rules

### Do not present free creatures as abnormal by default

Out-of-container/free creatures will eventually be common, especially for intelligent creatures.

Avoid player-facing language like:
- `Released in Pits`
- `Released in Main Lab`

Use:
- `Location: Pits`
- `Location: Main Lab`
- `Activity: feeding on contamination`
- `Activity: hunting sensed prey`

Internal state may still use `status: "released"` for implementation convenience, but UI should emphasize room/location/activity.

### Contained creatures should not show roaming activity

Contained creatures are physically constrained.

Contained creature UI should use containment language:
- `Contained in Basic Glass Jar 1`
- `Room: Main Lab`
- `Activity: contained`
- `Activity: feeding in containment`
- `Activity: straining containment`
- `Activity: in transit`
- `Activity: Corpse Processing`
- `Activity: Waste Disposal`

Contained creatures must not show:
- `Activity: Roaming`

### Free creatures use room behavior language

Free/uncontained creature UI should use:
- `Location: Pits`
- `Activity: seeking contamination`
- `Activity: feeding on contamination`
- `Activity: leaving residue`
- `Activity: hunting sensed prey`
- `Activity: exploring`

## Pass 1 — Room Location + Contamination Seeking/Feeding + Hunting Intent

### Implemented behavior

Pass 1 added basic out-of-container room behavior.

Free/uncontained slimes:
- have `roomId`
- have `roomActivity`
- appear in room UI
- can move between rooms because no doors/barriers exist yet
- can seek contamination
- can feed on contamination
- can reduce room contamination
- can show hunting intent without attacking

Contained slimes:
- show `Contained in [container]`
- do not show roaming
- keep container-bound activity labels

Room cards:
- list free creatures currently in the room
- show each observed free creature with activity

Example room row:
- `RG-CLEAN — Activity: feeding on contamination`
- `RG-PRED — Activity: hunting sensed prey`

### Contamination-seeking / contamination-eating

Free slimes with contamination-seeking/eating behavior can:
- move toward the dirtiest room
- feed on contamination there
- reduce room contamination over time
- gain nutrition from the reduction
- slightly reduce stress while feeding

The current model assumes no doors:
- all rooms are reachable
- movement is abstract
- no pathfinding grid exists

Example event:
- `RG-001 moved from Main Lab to Pits, following contamination.`
- `RG-001 fed on contamination in Pits. Contamination dropped to Low.`

### Predatory/hunting intent

Predatory/hunting creatures can show intent:
- `Activity: hunting sensed prey`

This does not currently resolve into attacks.

Important rule:
- aggressive/predatory creatures do not specifically target the scientist
- later, they should hunt whatever they can sense, including other creatures or valid prey
- Pass 1 only displays intent; it does not implement attacks, damage, prey death, or combat

### Pass 1 fix1

Initial QC found that an explicit predator test creature still displayed contamination-feeding behavior because trait-derived contamination behavior overrode explicit room behavior hints.

Fix 1:
- explicit `roomBehavior` flags now override trait-derived contamination behavior
- `roomBehavior.seeksContamination = false` prevents contamination seeking
- `roomBehavior.eatsContamination = false` prevents contamination feeding
- hunting intent can surface through explicit behavior hints
- no attacks/combat/escape/pathfinding added

### Pass 1 fix1 QC

Result:
- syntax check passed
- smoke test passed
- all 16 checks passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- contained slime UI avoids roaming
- contained slime UI says `Contained in [container]`
- free slime UI uses `Location` + `Activity`
- room cards list free creatures
- contamination-seeking/eating free slime moved toward contaminated room
- free slime reduced room contamination
- predatory/hunting intent appeared without attacks
- no `Released in [room]` wording appeared
- no doors/pathfinding/combat/attacks/escape/recapture systems appeared

## Pass 2 — Observed Room Pressure + Residue Effects

### Design correction before implementation

Free creature pressure must not be omniscient.

There are two conceptual values:
- actual hidden pressure
- observed pressure shown to the player

The UI should only show what the scientist can plausibly know.

Rules:
- If the scientist is not in/observing a room, do not reveal exact pressure.
- If traits are unknown, do not reveal trait-derived reasons.
- Unless trait knowledge is complete or relevant skill is high enough, show an estimate or uncertainty.
- Known and unknown factors must be separated.

### Scientist room location

Pass 2 added a basic scientist room location.

Current behavior:
- `state.scientist.roomId`
- defaults to `mainLab`

There is no scientist movement UI yet.

The field exists so room pressure can be observation-gated.

### Observation-gated pressure

Observed room:
- the scientist is in that room
- room pressure can be displayed based on observed factors and known traits

Unobserved room:
- the scientist is not in that room
- UI should not reveal free creature names or activities
- UI should not reveal exact pressure
- UI should show unobserved state

Unobserved room display:
- `Free creature pressure: Unobserved`
- `Unknown factors: scientist is not in this room`
- `Estimate: cannot assess from here`
- `Unobserved from current location.`

### Knowledge-gated pressure

Pressure display includes:
- pressure label
- known factors
- unknown factors
- estimate

Examples:
- `Free creature pressure: Unknown`
- `Known factors: 2 uncontained creatures observed · RG-CLEAN appears highly stressed`
- `Unknown factors: RG-CLEAN behavior, RG-CLEAN appendages, RG-CLEAN contact hazards`
- `Estimate: cannot assess safely`

With high relevant skill or sufficient trait knowledge:
- the display can become more confident
- trait-derived factors can be named if known
- pressure should not be labeled as estimated when enough knowledge is available

Relevant skills currently checked:
- Observation
- Ethology
- Slime Handling

Current high-skill threshold:
- `FREE_CREATURE_PRESSURE_HIGH_SKILL = 4`

High skill example:
- `Free creature pressure: Severe`
- known factors may include hunting behavior or residue risk if the scientist could plausibly infer/know it

### Residue effects

Pass 2 added a simple negative room effect for messy free slimes.

Messy/residue-spreading free slimes can:
- display `Activity: leaving residue`
- increase room contamination over time
- create throttled observed events if the scientist is observing the room

Example:
- `RG-MESS left residue across Main Lab.`

Residue can be trait-derived or explicit:
- `roomBehavior.leavesResidue = true`
- `roomBehavior.spreadsContamination = true`
- byproduct/consistency/stability may imply residue or contamination spread

Explicit room behavior can override trait-derived behavior:
- `leavesResidue: false`
- `spreadsContamination: false`

### Cleaner behavior still works

Cleaner free slimes still:
- seek contamination
- move toward dirty rooms
- feed on contamination
- reduce contamination
- show contamination activity

### Event gating

Movement/feeding/residue event text should not become an omniscient alert feed.

Current implementation gates some free-creature behavior events by scientist observation:
- movement events are only reported if the scientist observes the source or destination room
- contamination feeding events are only reported if the scientist observes the room
- residue events are only reported if the scientist observes the room

### Room UI separator fix

Pass 2 fix1 corrected a minor UI wording issue.

Before:
- `RG-CLEANActivity: feeding on contamination`

After:
- `RG-CLEAN — Activity: feeding on contamination`

### Pass 2 fix1 QC

Initial Pass 2 smoke test had a test-script bug:
- it used `.` to advance time
- `.` skipped to the next major event, which was slime lifespan end
- all test slimes died before behavior could be evaluated

Corrected script:
- used the skip-time button for fixed time advancement
- used long test lifespans

Pass 2 fix1 result:
- syntax check passed
- smoke test passed
- all 17 checks passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- scientist room defaults to Main Lab
- observed room pressure appears in the scientist's room
- unobserved rooms show `Free creature pressure: Unobserved`
- unobserved rooms avoid revealing free creature names/activities
- unknown traits produce unknown/estimated pressure
- high skill improves pressure confidence
- known and unknown factors are separated
- messy free slimes can leave residue/increase contamination
- cleaner free slimes still reduce contamination
- predatory/hunting intent appears without attacks
- free creature rows have readable separators
- no doors/sensors/combat/pathfinding/recapture/full escape/raids added

## Current accepted system status

Out-of-Container Slime Behavior:
- Pass 1 complete
- Pass 2 complete

Latest accepted implementation bundle:
- `app_out_of_container_slime_behavior_pass2_fix1_bundle.zip`

Latest accepted QC:
- Out-of-Container Slime Behavior Pass 2 Fix 1 smoke test
- all 17 checks passed
- 0 console warnings/errors
- 0 page errors

## Explicitly not implemented

Still not implemented:
- doors
- room barriers
- sensors
- scientist movement UI
- attacks
- combat
- prey death
- slime-vs-slime hunting resolution
- recapture system
- full escape from the facility
- pathfinding
- raids
- detailed target selection
- injuries from free creatures
- restraints/sedation
- lures/bait
- orders/commanding intelligent creatures

## Known limitations / future work

Potential next systems:
- scientist room movement UI
- observation/sensor tools
- recapture or containment recovery
- doors/barriers/room permissions
- explicit room-to-room routes
- hunting target selection and non-combat stalking
- later actual attacks/combat/prey resolution
- free creature interaction with corpses/remains
- free creature interaction with other contained creatures
- better activity history per free creature
- gradual player-facing discovery of room pressure signs
- room pressure memory/last known state

## Testing notes for future agents

Use fixed time advancement for out-of-container behavior tests.

Do not use `.` for behavior ticks unless the test specifically wants to skip to the next major event. `.` may skip to slime lifespan end.

Use `Shift + .` only for queued task completion.

Useful selectors:
- `#roomList`
- `#slimeList`
- `#selectedSlimeSummary`
- `[data-free-creature-pressure-room="<roomId>"]`
- `#skipAmountInput`
- `#skipTimeBtn`

Important test setup notes:
- Give artificial test slimes very long `deathAt` values.
- Set `state.scientist.roomId` intentionally.
- Use explicit `roomBehavior` flags to avoid relying on random genome traits.
- Use revealed traits and/or skill XP to test confidence changes.
- Verify unobserved rooms do not leak names/activities.
- Verify no forbidden system terms appear when not in scope.
