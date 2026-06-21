# Helix Heresy — Room Exposure Handoff

## Status

**Room Exposure Pass 4 Fix 2 is accepted and ready to commit.**

Room Exposure is now complete enough to hand off and pause before moving to another system.

## Implemented passes

### Pass 1 — Physical State + Hidden Exposure + Diagnostics

Implemented and accepted.

Core result:
- Scientist has a hidden internal exposure track.
- Player-facing state is shown as first-person/body-feeling bands instead of exact numbers.
- Exact exposure value is hidden unless revealed by sufficiently good testing.
- Exposure increases over time in contaminated rooms.
- Exposure naturally recovers in cleaner rooms.
- Rest accelerates recovery.
- High exposure can damage Health and Stamina over time.
- Diagnostic tests report results with confidence.
- Diagnostics can report likely source of the problem, such as contamination exposure.
- Diagnostic quality and scientist skill affect accuracy.

Accepted UI wording examples:
- `Physical State: Queasy`
- `Latest test: moderate contamination exposure likely`
- `Confidence: fair`

Important naming decision:
- Do **not** use player-facing names like `Contamination Burden` or `Internal Contamination`.
- The hidden numeric exposure track can exist in state, but UI should be body-feeling based.

### Pass 2 — Current-Room Exposure + Observation Reliability

Implemented and accepted.

Core result:
- Current room shows room exposure information.
- Non-current rooms use observation snapshots rather than live omniscient data.
- Never-observed rooms show unknown information.
- Previously observed rooms show snapshot wording such as:
  - `Information: Previously observed`
  - `Room exposure then: ...`
  - `Reliability: ...`
  - `Known factors then: ...`
  - `Uncertain factors: ...`
  - `Reliability factors: ...`
- Move warnings use previous observation reliability, not live current conditions.
- Rough time-since-observed labels were rejected.
- Reliability style was chosen instead of exact/rough time labels.

Accepted reliability direction:
- Information reliability can be affected by multiple factors, not just time.
- Factors can include room volatility, creature movement, contamination changes, observation quality, and scientist skill.

Do not use rough labels such as:
- `less than 3 minutes ago`
- `over 1 hour ago`
- `over 6 hours ago`

Preferred structure:
- `Information: Current observation`
- `Information: Previously observed`
- `Information: No observation`
- `Reliability: High/Fair/Uncertain/Poor/Unknown`

### Pass 3 — Rest Quality + Unsafe Rest Confirmation

Implemented and accepted.

Core result:
- Rest quality bands exist:
  - Good
  - Poor
  - Unsafe
- Main UI shows only the compact rest quality band.
- Details are hidden in the tooltip/title.
- Unsafe rest requires a confirmation popup before starting rest.
- Cancelling unsafe rest prevents task creation.
- Confirming unsafe rest creates the rest task and logs the warning once.
- Rest task stores:
  - `roomId`
  - `restQuality`
  - `exposureBandAtStart`
  - `expectedEffect`
- Rest completion mentions rest quality or unsafe conditions.

Important UI decision:
Main UI should be compact:

```txt
Rest quality: Good
```

Do **not** show this inline every time:

```txt
Known factors: cleaner air · low room exposure
Expected effect: Physical State may improve
```

Those details belong in the tooltip.

Unsafe confirmation wording direction:

```txt
Resting here is unsafe.
Physical State may continue worsening.

Continue resting?
```

Only **Unsafe** rest requires confirmation. Poor rest does not require confirmation.

### Pass 4 — Toxic/Failing Action Gates

Implemented and accepted after Fix 2.

Core result:
- Toxic Physical State requires confirmation before risky physical actions.
- Cancelling Toxic confirmation blocks task creation.
- Accepting Toxic confirmation creates the task.
- Toxic confirmation logs once.
- Failing Physical State blocks risky direct containment work.
- Failing blocks container hauling.
- Rest remains allowed while Failing.
- Scientist movement remains allowed while Failing.
- Physical diagnostics remain allowed while Failing.
- Toxic and Failing tooltips reflect this behavior.
- Room Exposure Passes 1–3 still work.
- UI Cleanup Pass 1 still works.
- No forbidden future systems or console/page errors were detected.

Accepted Toxic dialog example:

```txt
The scientist is Toxic.
opening Basic Glass Jar 1 may worsen their condition or cause injury.

Continue?
```

Accepted Failing block direction:

```txt
The scientist is Failing.
They cannot safely perform opening Basic Glass Jar 1.
Rest, move, or run a diagnostic first.
```

Allowed while Failing:
- rest
- scientist movement
- physical diagnostics

Blocked while Failing:
- risky direct containment work
- container open/close
- living slime transfer
- remains dump/scrape
- moving a slime from synthesis tube
- container hauling

## Relationship to UI Cleanup

A UI cleanup side track was completed between Room Exposure Pass 2 and Pass 3.

### UI Cleanup Pass 1 Fix 1

Implemented and accepted:
- Keyword tooltips for repeated game terms.
- Modified stamina cost spans.
- Negative/worse-than-base costs are red.
- Positive/better-than-base costs are green.
- Cost tooltip shows:
  - Base cost
  - Skill adjustment
  - Physical State adjustment
  - Final cost

Important classification:
- Tooltip/modified-cost work is **UI Cleanup**, not Room Exposure.
- Room Exposure now depends on that tooltip system for compact Rest quality and status terms.

## Current accepted system behavior

The Room Exposure system now supports this loop:

1. The scientist spends time in a contaminated room.
2. Hidden exposure rises.
3. Physical State worsens through visible body-feeling bands.
4. Diagnostics can identify likely contamination exposure with confidence.
5. Current room exposure can be assessed directly.
6. Other rooms use previous observation snapshots, not live omniscient data.
7. Rest quality tells the player whether recovery is likely to help.
8. Unsafe rest requires confirmation.
9. Toxic condition requires confirmation for risky physical actions.
10. Failing condition blocks risky work but still allows rest, movement, and diagnostics.

## Accepted player-facing bands

### Physical State

- Steady
- Uneasy
- Queasy
- Sickened
- Toxic
- Failing

### Room Exposure

- Clear
- Stale
- Tainted
- Fouled
- Hazardous
- Unlivable

### Observation Reliability

- High
- Fair
- Uncertain
- Poor
- Unknown

### Rest Quality

- Good
- Poor
- Unsafe

## Scope boundaries

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

Do not add those unless explicitly starting a new, separate design discussion.

## Known testing notes

### Avoid brittle exposure values

Tests should not assume a specific numeric exposure always maps to a specific band. Use rendered UI band detection when testing Toxic/Failing behavior.

Better approach:
- mutate exposure candidate value
- reload
- read `Physical State` panel
- continue only when rendered band matches target

### Avoid broad forbidden-word runtime regexes

Do not use broad `/PPE/i` matching over all body text. It can false-positive on normal words. Prefer:
- static source checks for forbidden identifiers
- visible UI/event checks for specific phrases such as `treatment station`, `radiationDose`, `diseaseProgress`, `combat`, `recapture`, `full escape`

### Previously observed exposure bands

Do not hardcode that contamination 82 must show `Hazardous`. The app may correctly classify the total room exposure as `Unlivable` depending on computed score. Pass 2 should test structure, not an overly specific band:
- `Information: Previously observed`
- `Room exposure then: Hazardous|Unlivable`
- `Reliability: ...`

## Recent accepted QC summary

### Pass 4 Fix 2 final smoke test

Final result:
- `node --check app.js` passed.
- Smoke test passed.
- Toxic confirmation appeared for risky container handling.
- Toxic cancel blocked task creation.
- Toxic accept created task.
- Toxic confirm/cancel logged once.
- Failing blocked risky container handling.
- Failing blocked container hauling.
- Rest remained allowed while Failing.
- Scientist movement remained allowed while Failing.
- Physical diagnostics remained allowed while Failing.
- Toxic/Failing tooltips mention new behavior.
- Room Exposure Passes 1–3 still work.
- UI Cleanup Pass 1 still works.
- No forbidden future systems appeared.
- Zero console/page errors.

## Commit recommendation

```powershell
git status
git add .
git commit -m "Add physical state risk gates"
git push
```

If the handoff docs are added in a separate commit:

```powershell
git status
git add .
git commit -m "Add room exposure handoff"
git push
```

## Suggested next options

### Option A — Move to contamination cleanup system

This was previously discussed as a likely next major system.

Important design direction:
- The ideal contamination cleanup method is not a simple cleaning action.
- The player should be able to create slimes that seek and eat contamination.
- Non-aggressive contamination-eating slimes can be released into a room to clean it.
- Aggressive/predatory creatures are dangerous to release and may hunt whatever they can sense, not only the scientist.
- Released/free state is expected to become common later, especially for intelligent creatures.
- Use `Contained in [container]` language for contained creatures; do not call contained creatures roaming.

### Option B — Continue Room Exposure later

Possible future extensions, not recommended immediately:
- multi-source Physical State issues, such as disease/radiation/magic
- treatment and medicine systems
- PPE/protection systems
- long-term injury consequences

These should be separate discussions because they expand scope significantly.

### Option C — UI Cleanup Pass 2

Possible topics:
- hover affordance styling
- mobile/tap tooltip behavior
- tooltip consistency audit
- eventual glossary/codex

## Fresh continuation prompt

Use this when starting a new Cline/Codex chat:

```txt
Read CLINE_QC_CONTEXT.md and the handoff docs.

Current status:
- Room Exposure Pass 1 is complete: Physical State, hidden exposure, diagnostics, diagnostic confidence.
- Room Exposure Pass 2 is complete: current-room exposure, observation reliability, snapshot-based movement warnings.
- Room Exposure Pass 3 is complete: Rest quality and unsafe rest confirmation.
- Room Exposure Pass 4 Fix 2 is complete: Toxic/Failing action gates.
- UI Cleanup Pass 1 Fix 1 is complete: keyword tooltips and modified stamina cost breakdowns.

Important classification:
Tooltip/cost work is UI Cleanup, not Room Exposure.

Do not code yet. First summarize:
1. What Room Exposure currently does.
2. Which systems it intentionally does not include.
3. What you think the next narrow pass should be.

Then ask any necessary clarifying questions before implementation.
```
