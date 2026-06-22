# System Handoff — Prediction Cleanup

Date: 2026-06-21

## Status

Prediction Cleanup is implemented and accepted through Pass 1 Fix 1.

Accepted work:
- Pass 1: Compact Ranges and Confidence Tooltips
- Pass 1 Fix 1: Playwright selector/test-flow fix

This handoff should be treated as the current source of truth for Prediction Cleanup.

## Purpose

This system reduces false precision in prediction and suitability UI.

Before this work:
- Cleanup suitability and release suitability could show single labels and visible factor lists that felt too certain or too verbose.
- A player could reasonably interpret a single `Good`/`Poor` result, or `likely` phrasing, as the game revealing a definite hidden answer.
- Known/helpful factors, concerns, and unknown factors were often shown directly in the main UI.
- The UI did not consistently separate quick prediction output from deeper reasoning.

After this work:
- Cleanup suitability and release suitability use compact range + confidence wording.
- Detailed reasoning moved into tooltip/title text.
- Predictions can show a range of possible outcomes when confidence is not strong.
- Confidence is influenced by known traits, unknown traits, and relevant skills.
- Skills can narrow confidence/range but do not magically reveal hidden traits.
- Hidden traits remain hidden and are represented as uncertainty.

## Core design decisions

### Predictions should show possibility ranges when uncertain

When the scientist lacks enough information, the UI should not present a single definite result.

Accepted direction:
- show a range of possible outcomes
- show a confidence band
- keep detailed factors in tooltips

Examples:

```txt
Cleanup suitability: Poor–Good
Confidence: Rough
```

```txt
Possible fit after release: Acceptable–Risky
Confidence: Fair
```

A single label should appear only when confidence is strong enough to justify collapsing the range.

Accepted single-label direction:

```txt
Cleanup suitability: Good
Confidence: Strong
```

### Avoid false-certainty wording

Avoid uncertain prediction wording that players may interpret as definite.

Avoid:
- `likely`
- `probably`
- `Expected fit after release`
- exact percentages
- hidden-answer hints

Prefer:
- `Possible fit after release`
- `Cleanup suitability`
- `Poor–Good`
- `Confidence: Rough`
- `Confidence: Fair`
- `Confidence: Strong`

### Main UI should be compact

Visible UI should show only:
- range
- confidence

Details should be available through tooltip/title text.

Accepted visible direction:

```txt
Cleanup suitability: Poor–Good | Confidence: Rough
```

Accepted release warning direction:

```txt
Possible fit after release: Poor–Good
Confidence: Rough
```

Avoid in visible main UI:
- `Known helpful factors: ...`
- `Concerns: ...`
- `Unknown factors: ...`
- long factor lists
- bulky prediction explanations

### Tooltips explain the reasoning

The tooltip/title text should carry the details that used to clutter the main UI.

Tooltip/title can explain:
- helpful known factors
- known concerns
- unknown factors widening the range
- relevant skill levels
- how skill and knowledge affect confidence

Accepted tooltip direction:

```txt
Range factors: known contamination feeding raises the upper end. Unknown seeking behavior, residue risk, and contact hazards keep the lower end poor.
Confidence factors: Slime Handling 1 and Observation 1 are too low to narrow this prediction much.
```

### Skills affect confidence, not omniscience

Relevant skills can improve confidence or narrow the displayed range.

Relevant skills for the first pass:
- Observation
- Ethology
- Slime Handling

Skill effects must not reveal hidden traits as facts.

Accepted:
- higher skill can improve confidence when enough evidence exists
- higher skill can narrow a range
- unknown traits still remain unknown if not discovered
- the tooltip can mention relevant skill levels as confidence factors

Rejected:
- high skill directly revealing hidden genome/trait facts without discovery
- using hidden traits as certain visible concerns
- making confidence imply the UI knows the true answer

## Implemented behavior

### Cleanup suitability compact display

Cleanup suitability visible UI now shows:
- `Cleanup suitability: <range>`
- `Confidence: <band>`

Example:

```txt
Cleanup suitability: Poor–Good | Confidence: Rough
```

The visible cleanup panel no longer displays bulky helpful/concern/unknown factor lists.

Details are moved into titles/tooltips.

### Release suitability compact display

Release warning visible UI now shows:
- `Possible fit after release: <range>`
- `Confidence: <band>`

The confirmation dialog does not show bulky factor lists.

Release button title/tooltip includes the deeper reasoning.

### Prediction ranges

Prediction ranges widen when confidence is lower.

Accepted direction:
- Rough confidence may show a wider range.
- Fair confidence may show a narrower range.
- Strong confidence may show a single band.

The exact tuning can change later, but the design rule is that uncertainty should be represented as a range rather than false certainty.

### Confidence bands

Implemented confidence direction:
- Unknown
- Rough
- Fair
- Strong

Confidence is influenced by:
- number/importance of unknown factors
- number/importance of known factors
- relevant skill levels
- whether the system has enough knowledge to narrow the range

### Tooltip/title details

Tooltip/title text now carries:
- helpful factors
- concerns
- unknown factors
- relevant skill summary
- confidence influences

Accepted examples:
- `Unknown factors widening the range: behavior, byproduct`
- `Relevant skills: Observation 1 · Ethology 0 · Slime Handling 1`

### Existing cleanup/release behavior retained

This pass changes prediction presentation only.

It does not change:
- slime behavior
- cleanup behavior
- release behavior
- door behavior
- observation/awareness behavior

## Awareness and hidden-information rules

Prediction Cleanup must preserve hidden-information boundaries.

Accepted:
- unknown relevant traits can appear as unknown factors
- known or discovered traits can affect visible range and tooltip details
- relevant skills can affect confidence/range
- tooltips can explain general uncertainty

Rejected:
- hidden traits revealed as definite facts
- direct hidden genome/value leaks
- omniscient prediction text
- predictions that imply the UI knows the true future outcome while the scientist does not

## Relationship to existing systems

### Contamination Cleanup Use

Prediction Cleanup updates cleanup-use suitability presentation.

Cleanup use remains:
- an intended use, not an order
- not room-targeted
- based on instinctive free-slime behavior
- physically controlled by doors when the slime is free

### Creature Release

Prediction Cleanup updates release warning presentation.

Creature release remains:
- a general release warning system
- applicable to all contained slime releases
- based on intended use and possible free behavior
- not a room-target assignment
- not obedience

### UI Cleanup

Prediction Cleanup follows the UI Cleanup philosophy:
- compact main UI
- explanatory hover/title text
- avoid cluttering repeated panels with long explanations

### Skill / knowledge systems

Prediction Cleanup uses relevant skills and known/unknown factors to shape confidence.

This is not a new skill system.

## Explicitly not implemented

This pass does not add:
- new slime behavior
- new cleanup mechanics
- release target rooms
- cleanup target rooms
- direct room assignment for released slimes
- obedience
- commands
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
- a new skill system
- exact prediction percentages
- prediction minigames

Do not add those unless a future design discussion explicitly starts that system.

## Tests / QC completed

### Pass 1 QC

Initial result:
- syntax check passed
- creature release regression test passed
- app implementation was judged correct
- one prediction-cleanup test failed due to a test-script selector bug

Confirmed app behavior:
- cleanup suitability visible UI shows compact range + confidence
- release warning visible UI shows compact possible fit range + confidence
- helpful factors, concerns, unknown factors, and skill factors moved into tooltips/title text
- confidence is influenced by known traits, unknown traits, and relevant skills
- skills narrow confidence/range but do not reveal hidden traits
- hidden traits are not revealed as definite facts
- no forbidden scope creep detected

Issue found:
- `tests/prediction-cleanup-pass1.spec.js` used the display name `RG-001` where the data attributes used internal slime id `slime-1`
- job select was also disabled while slime remained in synthesis tube, so test flow needed to release before assigning cleanup use

Classified as:
- test-script bug
- not an app bug

### Pass 1 Fix 1 QC

Result:
- syntax check passed
- prediction cleanup smoke test passed
- creature release regression test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Fix:
- updated prediction cleanup test selectors to use internal slime id `slime-1`
- restructured test flow to inspect release title before release, then release slime before assigning cleanup use

Confirmed:
- only `tests/prediction-cleanup-pass1.spec.js` changed
- `app.js` was not modified in Fix 1
- selector issue fixed
- safe to commit

## Known limitations / future work

Potential future work:
- extend compact range + confidence pattern to container fit predictions
- extend compact range + confidence pattern to active containment risk predictions where appropriate
- review genome/synthesis predictions for false precision
- review handling risk predictions for consistency
- tune confidence/range math after more playtesting
- add richer skill-specific confidence tooltips if needed

Important future design direction:
Prediction UI should distinguish facts from uncertain assessments. Physical facts can stay direct. Future outcomes, behavior predictions, safety predictions, and suitability predictions should use range + confidence unless the scientist has strong support for a single assessment.

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
- `Add compact prediction ranges`
