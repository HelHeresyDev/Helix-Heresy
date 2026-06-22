# System Handoff — Prediction Cleanup

Date: 2026-06-22

## Status

Prediction Cleanup is implemented and accepted through Pass 4.

Accepted work:
- Pass 1: Compact Ranges and Confidence Tooltips for cleanup suitability and release suitability
- Pass 1 Fix 1: Playwright selector/test-flow fix
- Pass 2: Active Containment Risk Ranges
- Pass 3: Direct Handling Risk Ranges
- Pass 4: Container Physical Fit Ranges

This handoff should be treated as the current source of truth for Prediction Cleanup.

## Purpose

This system reduces false precision in prediction and suitability UI.

Before this work:
- Cleanup suitability, release suitability, active containment risk, direct handling risk, and container physical fit could appear too precise.
- Some prediction UI showed single labels, exact-looking scores, broad harm phrases, or visible factor lists that felt more certain than the scientist’s knowledge and skill should support.
- A player could reasonably interpret wording like a single `Good`/`Poor` result, exact `Potential`/`Pressure` scores, old container fit labels, or `likely` phrasing as the game revealing a definite hidden answer.
- Known/helpful factors, concerns, unknown factors, and protection/details were often shown directly in the main UI.
- The UI did not consistently separate quick prediction output from deeper reasoning.

After this work:
- Cleanup suitability and release suitability use compact range + confidence wording.
- Active containment risk uses compact range + confidence wording instead of visible exact Potential/Pressure scores.
- Direct handling risk uses compact handling-risk range, possible-harm range, confidence, and method.
- Container physical fit uses compact physical-fit range + confidence.
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

```txt
Active containment risk: Stable–Strained
Confidence: Rough
```

```txt
Handling risk: Low–Severe
Possible harm: No obvious harm–Lethal
Confidence: Rough
```

```txt
Physical fit: Comfortable–Cramped
Confidence: Rough
```

A single label should appear only when confidence is strong enough to justify collapsing the range.

Accepted single-label direction:

```txt
Cleanup suitability: Good
Confidence: Strong
```

```txt
Active containment risk: Watch
Confidence: Strong
```

```txt
Physical fit: Strained
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
- guaranteed injury/escape language
- active-risk labels for physical fit

Prefer:
- `Possible fit after release`
- `Cleanup suitability`
- `Active containment risk`
- `Handling risk`
- `Possible harm`
- `Physical fit`
- `Poor–Good`
- `Stable–Strained`
- `Low–Severe`
- `Comfortable–Cramped`
- `Confidence: Rough`
- `Confidence: Fair`
- `Confidence: Strong`

### Main UI should be compact

Visible UI should show only:
- range
- confidence
- method when relevant

Direct handling also shows possible harm because harm and risk are meaningfully different.

Accepted visible directions:

```txt
Cleanup suitability: Poor–Good | Confidence: Rough
```

```txt
Possible fit after release: Poor–Good
Confidence: Rough
```

```txt
Active containment risk: Stable–Strained | Confidence: Rough
```

```txt
Handling risk: Low–Severe
Possible harm: No obvious harm–Lethal
Confidence: Rough
Method: Thick gloves
```

```txt
Physical fit: Comfortable–Cramped
Confidence: Rough
```

Avoid in visible main UI:
- `Known helpful factors: ...`
- `Known factors: ...`
- `Concerns: ...`
- `Unknown factors: ...`
- `Protection: ...`
- exact `Potential: 55`
- exact `Pressure: 36`
- exact injury damage predictions
- old fit labels such as `Good Fit`, `Poor Fit`, `Questionable`, or `Unsuitable`
- long factor lists
- bulky prediction explanations

### Tooltips explain the reasoning

The tooltip/title text carries the details that used to clutter the main UI.

Tooltip/title can explain:
- helpful known factors
- known concerns
- unknown factors widening the range
- relevant skill levels
- method/protection factors
- physical fit factors
- how skill and knowledge affect confidence
- that exact internal scores/damage are not shown as precise predictions
- that physical fit is not escape risk

Accepted tooltip directions:

```txt
Range factors: known contamination feeding raises the upper end. Unknown seeking behavior, residue risk, and contact hazards keep the lower end poor.
Confidence factors: Slime Handling 1 and Observation 1 are too low to narrow this prediction much.
```

```txt
Active containment risk range: Stable–Strained.
Unknown factors widening the range: behavior, stability.
Relevant skills: Observation 1 · Ethology 0 · Slime Handling 1.
Internal Potential and Pressure scores still drive incidents, but exact scores are not shown as precise predictions.
```

```txt
Handling risk range: Low–Severe.
Possible harm range: No obvious harm–Lethal.
Unknown factors widening the range: behavior, appendages.
Relevant skills: Observation 1 · Slime Handling 0 · Physiology 1.
Exact injury damage is not shown as a precise prediction.
```

```txt
Physical fit range: Comfortable–Cramped.
Physical fit estimates size, shape, space, opening, weight, and comfort. It is not escape risk.
Unknown factors widening the range: adult size, body shape.
Relevant skills: Observation 1 · Slime Handling 0 · Physiology 1 · Materials Analysis 0.
```

### Skills affect confidence, not omniscience

Relevant skills can improve confidence or narrow the displayed range.

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

### Pass 1 — Cleanup and release suitability ranges

Cleanup suitability visible UI now shows:
- `Cleanup suitability: <range>`
- `Confidence: <band>`

Release warning visible UI now shows:
- `Possible fit after release: <range>`
- `Confidence: <band>`

The visible cleanup panel and release confirmation no longer display bulky helpful/concern/unknown factor lists.

Details are moved into titles/tooltips.

Release button title/tooltip includes the deeper reasoning.

Relevant skills for this pass include:
- Observation
- Ethology
- Slime Handling

### Pass 1 Fix 1 — Test selector/test-flow fix

The initial app implementation was accepted, but one test failed because it used the display name `RG-001` where the app used the internal slime id `slime-1` in data attributes.

The fix:
- updated prediction cleanup test selectors to use internal slime id `slime-1`
- restructured test flow to inspect release title before release, then release slime before assigning cleanup use
- did not modify `app.js`

### Pass 2 — Active containment risk ranges

Active containment risk visible UI now shows:
- `Active containment risk: <range>`
- `Confidence: <band>`

Exact visible Potential and Pressure scores are hidden from the main UI.

Internal Potential and Pressure still exist and still drive incidents.

Tooltip/title text explains:
- known influences
- concerns
- unknown factors widening the range
- relevant skill levels
- that internal Potential/Pressure scores still drive incidents but are not shown as exact predictions

Relevant skills for this pass:
- Observation
- Ethology
- Slime Handling

Important terminology:
- Physical fit is size/shape/geometry.
- Active containment risk is risk of active trouble from a contained creature, driven by Potential and Pressure.
- Pass 2 addressed active containment risk, not passive physical fit.

### Pass 3 — Direct handling risk ranges

Direct handling risk visible UI now shows:
- `Handling risk: <range>`
- `Possible harm: <range>`
- `Confidence: <band>`
- `Method: <handling method>`

The main UI no longer shows long factor lists for:
- known factors
- unknown factors
- protection/method details

Tooltip/title text explains:
- handling risk range
- possible harm range
- known influences
- handling method/protection factors
- unknown factors widening the range
- relevant skill levels
- that exact injury damage is not shown as a precise prediction

Relevant skills for this pass:
- Observation
- Slime Handling
- Physiology

Important terminology:
- Active containment risk = risk from a contained creature challenging containment.
- Direct handling risk = risk to the scientist when physically opening/closing/transferring/handling a container or contents.
- Pass 3 addressed direct handling risk, not active containment risk or physical container fit.

### Pass 4 — Container physical fit ranges

Container physical fit visible UI now shows:
- `Physical fit: <range>`
- `Confidence: <band>`

Physical fit uses physical terminology, not active-risk terminology.

Accepted physical fit bands:
- Comfortable
- Serviceable
- Tight
- Cramped
- Strained
- Overfilled

Visible UI should not show old labels such as:
- Good Fit
- Poor Fit
- Questionable
- Unsuitable

Visible UI should not use active-risk labels for physical fit:
- Dangerous
- Failing

Tooltip/title text explains:
- physical fit range
- physical-fit meaning
- known fit factors
- fit concerns
- unknown factors widening the range
- relevant skill levels
- that physical fit is not escape risk

Relevant skills for this pass:
- Observation
- Slime Handling
- Physiology
- Materials Analysis

Important terminology:
- Physical fit = size, shape, space, opening, weight, and comfort.
- Active containment risk = risk of active trouble from a contained creature.
- Direct handling risk = risk to the scientist during physical handling.
- Pass 4 addressed physical container fit, not escape risk.

### Prediction ranges

Prediction ranges widen when confidence is lower.

Accepted direction:
- Unknown confidence may show the widest/full range.
- Rough confidence may show a wide range.
- Fair/Reasonable/Informed confidence may show narrower ranges.
- Strong confidence may show a single band.

The exact tuning can change later, but the design rule is that uncertainty should be represented as a range rather than false certainty.

### Confidence bands

The core design uses qualitative confidence bands.

Accepted confidence direction:
- Unknown
- Rough
- Fair / Reasonable
- Informed
- Strong

Exact label names may vary by sub-system if already implemented, but they should remain qualitative and not numeric percentages.

Confidence is influenced by:
- number/importance of unknown factors
- number/importance of known factors
- relevant skill levels
- whether the system has enough knowledge to narrow the range

### Existing behavior retained

Prediction Cleanup changes prediction presentation only.

It does not change:
- slime behavior
- cleanup behavior
- release behavior
- door behavior
- observation/awareness behavior
- containment incident mechanics
- direct handling injury mechanics
- physical fit mechanics

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
- exact future injury/escape predictions
- physical fit revealing unrevealed size/shape/consistency as definite facts

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

### Active Containment Risk and Minor Incidents

Prediction Cleanup updates active containment risk presentation.

Internal Potential and Pressure still exist and still drive minor incidents.

Exact Potential/Pressure scores are no longer shown as precise visible predictions in the main UI.

### Player-Creature Interaction

Prediction Cleanup updates direct handling risk presentation.

Handling still works through existing systems:
- open/close containers
- handling methods
- direct remains handling
- living slime transfer
- Scientist Health damage
- run-ending death if health reaches 0

This pass does not add new handling mechanics.

### Container Geometry / Physical Fit

Prediction Cleanup updates physical fit presentation.

Physical fit remains separate from:
- active containment risk
- direct handling risk
- escape risk

Physical fit estimates size, shape, space, opening, weight, and comfort.

### UI Cleanup

Prediction Cleanup follows the UI Cleanup philosophy:
- compact main UI
- explanatory hover/title text
- avoid cluttering repeated panels with long explanations

### Skill / knowledge systems

Prediction Cleanup uses relevant skills and known/unknown factors to shape confidence.

This is not a new skill system.

## Explicitly not implemented

This feature does not add:
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
- new containment incidents
- full escape systems
- recapture
- attacks
- combat
- injuries from free creatures
- new injury mechanics
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

### Pass 2 QC

Result:
- syntax check passed
- Prediction Cleanup Pass 2 smoke test passed
- Prediction Cleanup Pass 1 regression test passed
- Creature Release regression test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- active containment risk visible UI shows range + confidence
- single-label risk appears only when range collapses
- exact Potential and Pressure scores are not shown in visible UI
- tooltips explain factors, unknowns, skills, and internal-score disclaimer
- hidden traits are not revealed
- no regressions in cleanup suitability or creature release
- no forbidden scope creep detected

Note:
- `activeContainmentRiskDetailsEl()` remained as dead code but was not called by render flow
- classified as future cleanup fodder, not a blocker

### Pass 3 QC

Result:
- syntax check passed
- Prediction Cleanup Pass 3 smoke test passed
- Prediction Cleanup Pass 2 regression test passed
- Prediction Cleanup Pass 1 regression test passed
- Creature Release regression test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- direct handling risk visible UI shows compact risk range, possible harm range, confidence, and method
- visible UI no longer shows bulky known/unknown/protection factor lists
- button titles/tooltips include full handling risk details
- tooltips explain factors and skills without revealing hidden traits as facts
- confidence is influenced by Observation, Slime Handling, and Physiology
- ranges widen/narrow based on confidence
- exact injury damage is not shown as a precise prediction
- no regressions in earlier Prediction Cleanup or Creature Release behavior
- no forbidden scope creep detected

Regression test count reported:
- 44/44 tests passed across Pass 1, Pass 2, Pass 3, and Creature Release tests

### Pass 4 QC

Result:
- syntax check passed
- Prediction Cleanup Pass 4 smoke test passed
- Prediction Cleanup Pass 3 regression test passed
- Prediction Cleanup Pass 2 regression test passed
- Prediction Cleanup Pass 1 regression test passed
- Creature Release regression test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- physical fit bands use physical terms: Comfortable, Serviceable, Tight, Cramped, Strained, Overfilled
- physical fit visible UI shows compact range + confidence
- single-label fit appears only with strong confidence
- old fit labels are not visible
- physical fit does not use Dangerous or Failing
- tooltip explains that physical fit estimates size, shape, space, opening, weight, and comfort
- tooltip says physical fit is not escape risk
- tooltip explains known factors, concerns, unknown factors, confidence, and relevant skills
- relevant skills are Observation, Slime Handling, Physiology, and Materials Analysis
- hidden size, shape, and consistency values are not revealed unless revealed/known
- no regressions in earlier Prediction Cleanup or Creature Release behavior
- no forbidden scope creep detected

Regression test count reported:
- 10/10 tests passed across Pass 4, Pass 3, Pass 2, Pass 1, and Creature Release tests

## Known limitations / future work

Potential future work:
- review genome/synthesis predictions for false precision
- review room exposure diagnostics/rest predictions for consistency if needed
- tune confidence/range math after more playtesting
- add richer skill-specific confidence tooltips if needed
- remove dead prediction/detail helper code if it remains unused after multiple passes
- broader intended-use suitability for non-cleanup uses
- better fit tuning for release warnings

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

Suggested commits for accepted work:
- `Add compact prediction ranges`
- `Add active containment risk ranges`
- `Add direct handling risk ranges`
- `Add container physical fit ranges`
