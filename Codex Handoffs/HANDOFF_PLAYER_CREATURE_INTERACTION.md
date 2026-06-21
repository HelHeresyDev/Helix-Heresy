# System Handoff — Player-Creature Interaction

Date: 2026-06-20

## Purpose

This system makes the player/scientist physically interact with containers, slimes, and remains instead of relying entirely on abstract or magical movement.

Before this system:
- Scientist Health existed as a stat but nothing meaningful damaged it.
- Containers, rooms, corpses, pit holes, and hauling existed physically.
- Corpses could remain in containers.
- Containers could be hauled between rooms.
- Pit holes existed as containers.
- But the player could not open a container, handle remains, or transfer a living slime directly.

After this system:
- Opening/closing containers is an explicit direct interaction.
- Handling risk can damage Scientist Health.
- Handling risk respects discovered creature knowledge.
- Handling methods change risk.
- Remains can be dumped/scraped into pit holes.
- Living slimes can be transferred between same-room containers/pit holes.
- The system still avoids full escape, combat, pathfinding, and raids.

## Design principles

### The scientist is physically present

The lab is dangerous because the player/scientist is there in person.

Direct interaction can cause:
- Scientist Health damage
- slime Stress increases
- source/destination contamination
- room contamination
- failed or blocked actions
- run-ending death if Scientist Health reaches 0

### Use existing Scientist Health

Scientist Health already existed before this system.

This system reuses the existing health stat/readout.

It does not add a duplicate `playerHealth` or separate health system.

Confirmed:
- Health readout starts at `100/100`
- Direct handling can reduce Health
- Health reaching `0/100` sets the run-ended/dead state

### No exact predicted damage

Handling risk previews must never show exact predicted damage numbers.

Do not display wording like:
- `12 Scientist Health damage possible`
- `24 damage possible`

Use qualitative harm phrases instead:
- `cannot estimate safely`
- `minor harm possible`
- `minor to moderate harm possible`
- `moderate to serious harm possible`
- `serious harm possible`
- `serious to lethal harm possible`

Actual health can still change numerically because the health readout itself is numeric.

### Knowledge-gated risk

Handling risk previews must respect discovery.

Unknown creature traits should not be revealed by risk text.

If many relevant factors are unknown, the preview should not estimate harm.

Examples:
- `Handling risk: Unknown`
- `Unknown factors: creature behavior, appendages, stability, contact hazards`
- `Possible harm: cannot estimate safely`

With partial knowledge:
- `Handling risk: Uncertain`
- broad harm bands only

With high knowledge or prior injury from that same slime:
- risk can become more informative
- still qualitative
- still no exact predicted damage

### Prior injury is knowledge

If the scientist has been harmed by a particular slime during handling, that specific experience improves future handling-risk confidence for that slime.

Risk preview should surface this as a known factor:
- `prior handling injury from RG-001`

### No escape/combat yet

Direct living slime handling does not add:
- slime escaping
- released-room slime from transfer failure
- combat
- chase
- pathfinding
- raids
- full escape chains

Failed or dangerous handling should remain contained for now:
- health damage
- stress
- contamination
- blocked/failed task
- slime remains in source or destination container depending on successful completion

## Pass 1 — Open/Close Containers + Health Damage

### Implemented behavior

Containers have access state:
- `closed`
- `open`
- `open by design`

Open Dirt Pit is open by design.

The UI shows access state on container cards:
- `access closed`
- `access open`
- `access open by design`

Non-synthesis containers show actions:
- `Open Container`
- `Close Container`

Opening/closing creates queued `containerInteraction` tasks.

Tasks are completed using:
- `Shift + .`

Opening risky occupied containers can:
- damage Scientist Health
- increase slime Stress
- increase active containment pressure

Open containers add active containment pressure:
- `the container is open during direct handling`

Open containers cannot be hauled:
- `Close the container before hauling it.`

If Scientist Health reaches 0:
- run ends
- Health readout shows dead state
- event log includes `The scientist died. Run ended.`

### Pass 1 QC

Result:
- syntax check passed
- smoke test passed
- 26/26 checks passed
- console warnings/errors: 0
- page errors: 0
- no scope creep detected

Confirmed:
- existing Scientist Health was reused
- containers had access state
- handling risk preview appeared
- Open/Close tasks queued and completed
- Health damage occurred
- Stress increased
- open containers added active containment pressure
- open containers blocked hauling
- death ended the run
- no dumping/scraping/tools/PPE/combat/escapes were added

## Pass 2 — Handling Methods + Knowledge-Gated Risk

### Implemented handling methods

Handling method selector added.

Methods:
- Bare hands
- Thick gloves
- Long tongs
- Hook pole

Later, Scraper was added in Pass 3.

Handling method is stored in policy/state:
- `state.policies.handling.method`

Open/Close tasks store:
- `methodId`

Event text names the method used:
- `opened with Thick gloves`
- `closed with Long tongs`

### Method intent

Bare hands:
- fastest/default
- no protection

Thick gloves:
- reduces contact, contamination, and corpse-handling risk
- does not solve every hazard

Long tongs:
- adds distance from contact/strikes
- can be awkward for crowded contents and deep pits

Hook pole:
- useful for pit covers, grates, and awkward reach
- clumsy for ordinary containers

### Knowledge-gated display

Risk preview uses:
- visible risk band
- known factors
- unknown factors
- protection/method notes
- qualitative possible harm

Examples:
- `Handling risk: Unknown. Method: Thick gloves. Known factors: container condition is critical. Unknown factors: creature behavior, appendages, stability, contact hazards. Protection: gloves reduce contact and contamination risk. Possible harm: cannot estimate safely.`
- `Handling risk: Uncertain. ... Possible harm: moderate to serious harm possible.`
- `Handling risk: Dangerous. ... Possible harm: serious harm possible.`

### Prior injury fix

Initial Pass 2 QC found that prior injury was tracked but not surfaced in risk preview.

Fix 1 prioritized prior injury in known factors so it remains visible even when many other known factors exist.

### Pass 2 fix1 QC

Result:
- syntax check passed
- smoke test passed
- all checks passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- all four methods appeared
- method selection updated state/UI
- risk preview changed with method
- unknown traits produced unknown/cannot-estimate risk
- partial knowledge produced broad qualitative harm bands
- full knowledge gave informative qualitative risk
- prior injury improved confidence and appeared in known factors
- exact predicted damage numbers were absent
- Scientist Health could still be damaged
- no tool inventory/durability/dumping/scraping/siphoning/live-transfer/combat/escapes were added

## Pass 3 — Direct Corpse/Remains Handling

### Scope

Pass 3 added direct handling for corpse/remains only.

Corpses can be anywhere:
- Main Lab
- Menagerie
- Pits
- synthesis tube
- normal containers
- pit-hole containers

Pass 3 does not assume corpses start in Menagerie.

### Added handling method

Scraper was added.

Scraper:
- best for stuck, spoiled, ruined, or residue-like remains
- improves control over corpse residue
- poor for live creature handling
- still exposes the scientist to splash/fumes/contamination

### Implemented actions

Actions:
- `Dump Remains into Pit`
- `Scrape Remains into Pit`

Both create queued `containerInteraction` tasks.

Task data includes:
- source container
- action
- methodId
- corpseIds
- destinationPitId

### Requirements

Dump/Scrape require:
- source container is in Pits
- source container is open
- source container contains corpse remains
- source container is not a pit hole
- available pit-hole capacity exists
- scientist is alive

Blocked title/event wording:
- `Haul this container to Pits before handling remains.`
- `Open the container before handling remains.`
- `No pit hole has room for these remains.`
- `Pit holes are already the destination for remains.`

### Effects on completion

On completion:
- corpse/remains move from source container into destination pit hole
- source container corpse count becomes 0
- source container contamination increases
- Pits contamination increases
- Scientist Health can be damaged
- event names method, source, and destination

Example events:
- `1 corpse remain scraped from Basic Glass Jar 1 into Capped Dirt Pit 1 with Scraper.`
- `1 corpse remain dumped from Basic Glass Jar 1 into Grated Dirt Pit 1 with Thick gloves.`

### Important hauling shortcut cleanup

Before Pass 3, hauling to Pits could magically unload contents into pit holes for testing.

After Pass 3:
- corpse/remains are no longer auto-unloaded by the Pits hauling shortcut
- corpse/remains movement requires direct Dump/Scrape interaction
- the shortcut remains only for living contents/testing

New shortcut wording:
- `Testing shortcut: living contents were unloaded into ...`
- `Testing shortcut: living contents were loaded from ...`

Old corpse-applicable shortcut wording was removed:
- `Testing shortcut: contents were unloaded into ...`
- `Testing shortcut: contents were loaded from ...`

### Pass 3 fix1 QC

Initial Pass 3 QC found:
1. Disabled Dump/Scrape buttons worked but title text showed method description instead of blocking reason.
2. Direct remains handling did not damage Scientist Health in the low-risk fresh-corpse test scenario.

Fix 1:
- disabled Dump/Scrape buttons preserve blocking reason in title
- direct remains handling has at least minimal health risk when remains are actually handled

Result:
- syntax check passed
- smoke test passed
- all checks passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- Scraper appeared
- Dump/Scrape buttons existed
- blocked buttons explained why
- hauling to Pits did not auto-unload corpse
- Dump/Scrape enabled when in Pits and open
- tasks stored correct data
- `Shift + .` completed tasks
- remains moved to pit holes
- source contamination increased
- Pits contamination increased
- Health was damaged
- event text named method/source/destination
- no tool durability/siphon/hand-transfer/combat/escapes added

## Pass 4 — Direct Living Slime Transfer

### Scope

Pass 4 added direct living slime transfer.

This covers:
- normal container to pit-hole transfer
- pit-hole to normal container extraction
- same-room normal container to normal container transfer if destination is valid

It still does not add:
- slime escaping
- full escape
- released-room slime from failed transfer
- combat
- chase/pathfinding
- raids

### Implemented action

Action:
- `Transfer Living Slime`

Creates queued `containerInteraction` task.

Task data includes:
- source container
- action: `transferLivingSlime`
- methodId
- slimeId
- destinationContainerId
- staminaCost

### Requirements

Transfer requires:
- scientist is alive
- source is not synthesis tube
- source is not being hauled
- source is open, or source is a pit hole/extraction site
- source contains exactly one living slime
- source contains no corpse remains
- source is not already being handled
- destination is same-room
- destination is empty
- destination is open or open by design
- pit-hole destinations can be selected even if covered, because the cover/site can be worked during the transfer task

Blocked wording:
- `Open the source container before transferring a living slime.`
- `No open same-room destination container is available.`
- `Direct living transfer requires a same-room destination.`
- `Remove corpse remains before transferring a living slime.`
- `Separate crowded contents before direct living transfer.`
- `Open the destination container before transfer.`
- `[destination] is not empty.`

### Effects on completion

On completion:
- slime moves from source to destination
- source becomes empty
- slime `containerId` becomes destination container ID
- slime `roomId` matches destination room
- slime job resets to idle
- slime Stress increases
- Scientist Health can be damaged
- source contamination increases
- destination contamination increases
- prior handling injury experience can increase
- event names slime, source, destination, and method

Example events:
- `RG-001 transferred from Basic Glass Jar 1 to Capped Dirt Pit 1 with Long tongs.`
- `RG-001 transferred from Capped Dirt Pit 1 to Sealed Glass Tank 2 with Long tongs.`
- `Scientist hurt during handling: low living transfer while moving RG-001 from Basic Glass Jar 1 to Capped Dirt Pit 1 with Long tongs.`

### Pass 4 fix1

Initial Pass 4 QC found a real bug:
- covered pit holes were filtered out of live-transfer destination options because they were not already marked open
- the selector existed but did not include the expected pit destination

Fix 1:
- pit holes can appear as live-transfer destinations even if their cover state is closed
- covered pits are treated as destination sites that can be opened/worked during the transfer task
- when a slime is transferred into a covered pit, the pit is marked open afterward so extraction can proceed
- a slime already in a pit hole can be extracted without requiring the pit to behave like a normal open container

### Pass 4 fix1 QC

Result:
- syntax check passed
- smoke test passed
- all checks passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- Transfer Living Slime action appeared
- transfer blocked while source closed with explanatory title
- transfer created queued task with correct data
- `Shift + .` completed tasks
- normal container to pit-hole transfer worked
- pit-hole to normal container extraction worked
- source became empty
- slime moved correctly
- slime room matched destination room
- slime Stress increased
- Scientist Health was damaged
- source/destination contamination increased
- event text named slime/source/destination/method
- releasedCount stayed 0
- no escape/combat/pathfinding/full escape/raid systems appeared

## Current accepted system status

Player-Creature Interaction system:
- Pass 1 complete
- Pass 2 complete
- Pass 3 complete
- Pass 4 complete

Latest accepted implementation bundle:
- `app_player_creature_interaction_pass4_fix1_bundle.zip`

Latest accepted QC:
- Player-Creature Interaction Pass 4 smoke test
- all checks passed
- 0 console warnings/errors
- 0 page errors

## Explicitly not implemented

Still not implemented:
- slime escaping
- full containment escape chains
- combat
- chase/pathfinding
- raids
- staff systems
- tool inventory
- tool durability
- siphoning
- cleaning fouled containers
- PPE equipment slots
- sedation/restraint systems
- live transfer failure tables
- detailed injuries/body parts
- permanent injury mechanics

## Known limitations / future work

Potential next systems:
- remove or replace remaining living-content Pits hauling shortcut once direct living transfer is stable enough
- cleaning fouled containers
- tool inventory and durability
- PPE/equipment slots
- sedation/restraint systems
- full containment breach/escape system
- combat or emergency response
- injuries/status effects beyond simple Health loss
- better UI grouping for direct interaction actions
- destination selection improvements if many containers exist
- separate handling risk previews per action type, not just current container access action

## Testing notes for future agents

Use `Shift + .` for queued task completion.

Do not click hidden queue drawer buttons.

For direct handling tests:
- set up deterministic localStorage state
- use opened/closed containers intentionally
- use exact data attributes for buttons/selectors
- verify no console warnings/errors
- verify no page errors
- verify no scope creep strings for escape/combat/pathfinding/raid systems unless that feature is explicitly being implemented

Useful selectors:
- `[data-handling-method-select]`
- `[data-open-container-id="<containerId>"]`
- `[data-close-container-id="<containerId>"]`
- `[data-remains-container-id="<containerId>"][data-remains-action="dumpRemains"]`
- `[data-remains-container-id="<containerId>"][data-remains-action="scrapeRemains"]`
- `[data-live-transfer-select="<containerId>"]`
- `[data-live-transfer-container-id="<containerId>"]`

Important hotkeys:
- `Shift + .` completes queued tasks
- `.` skips to the next normal event
