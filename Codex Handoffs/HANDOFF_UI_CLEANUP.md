# Helix Heresy — UI Cleanup Handoff

## Status

**UI Cleanup Pass 1 Fix 1 is accepted and ready to commit.**

This was originally discussed during Room Exposure work, but it is a UI cleanup side track. Do not classify it as Room Exposure Pass 3.

## Implemented pass

### UI Cleanup Pass 1 — Keyword Tooltips and Modified Stamina Costs

Accepted after Fix 1.

Core result:
- Reusable keyword tooltip helper exists.
- Repeated game terms can now carry hover/title tooltip explanations.
- Modified stamina costs are rendered as dedicated spans with direction styling.
- Negative modifiers are marked red.
- Positive modifiers are marked green.
- Cost tooltip/title explains the cost breakdown.

## Accepted QC result

Final smoke test passed all checks:
- `node --check app.js` passed.
- Keyword tooltips render.
- Physical State band tooltips work.
- Room exposure band tooltips work.
- Reliability tooltips work.
- Sickened increases physical action stamina costs.
- Worse-than-base costs are marked negative/red.
- High skill can reduce final costs below base and mark them positive/green.
- Cost tooltip includes:
  - Base cost
  - Skill adjustment
  - Physical State adjustment
  - Final cost
- Modified cost display appears on container handling.
- Modified cost display appears on scientist movement.
- Room Exposure Pass 2 still works.
- Physical State Pass 1 still works.
- No forbidden future systems appeared.
- Zero console warnings/errors.
- Zero page errors.

## Implemented UI behavior

### Keyword tooltips

Keyword tooltip support is used for repeated status terms such as:

Physical State bands:
- Steady
- Uneasy
- Queasy
- Sickened
- Toxic
- Failing

Room exposure bands:
- Clear
- Stale
- Tainted
- Fouled
- Hazardous
- Unlivable

Observation reliability bands:
- High
- Fair
- Uncertain
- Poor
- Unknown

Example tooltip behavior:
- Hovering `Sickened` explains that physical actions cost more stamina and rest in a cleaner room is recommended.
- Hovering `Stale` explains the expected Physical State effect.
- Hovering `High` reliability explains that the information is current or dependable.

### Modified stamina cost display

Stamina costs now use a dedicated modified-cost span.

Expected behavior:
- Final cost greater than base = negative/red
- Final cost lower than base = positive/green
- Final cost equal to base = neutral

The cost tooltip/title should include a breakdown like:

```txt
Base cost: 5 STA
Skill adjustment: -1 STA
Physical State: Steady +0 STA
Final cost: 4 STA
```

or:

```txt
Base cost: 5 STA
Skill adjustment: +0 STA
Physical State: Sickened +2 STA
Final cost: 7 STA
```

### Physical State strain

Physical State now modifies physical action stamina costs.

Current strain behavior:
- Steady: no stamina strain
- Uneasy: no stamina strain yet
- Queasy: physical actions cost slightly more stamina
- Sickened: physical actions cost more stamina
- Toxic: physical actions cost much more stamina and Health may suffer over time
- Failing: most risky physical work is extremely difficult

## Applied button/action coverage

Modified stamina cost display was applied to major action buttons, including:

- Scientist movement
- Physical diagnostics
- Synthesis
- Release/contain
- Slime tests
- Breeding
- Container open/close
- Remains dump/scrape
- Living slime transfer
- Move from synthesis tube
- Necropsy

QC specifically verified:
- Container handling shows modified cost spans.
- Scientist movement shows modified cost spans.

## Important implementation note

The existing skill multiplier alone did not reduce small costs after rounding. Fix 1 added an integer high-skill step discount so high skill can visibly reduce low-cost actions.

Accepted behavior:
- With high Slime Handling skill and Steady Physical State, opening a container can show base 5 STA → final 4 STA.
- The cost is marked `positive` and styled green.
- With Sickened Physical State, opening a container can show base 5 STA → final 7 STA.
- The cost is marked `negative` and styled red.

## Scope boundaries

This UI cleanup pass did **not** add:
- treatment systems
- PPE
- disease tracks
- radiation tracks
- magic/mana exposure tracks
- attacks
- combat
- recapture
- full escape systems

Do not expand UI tooltips into a full codex/glossary yet unless explicitly designing a new UI cleanup pass.

## Relationship to Room Exposure

Room Exposure is paused at:

- Pass 1: Physical State + hidden exposure + diagnostics
- Pass 2: Current-room exposure + observation reliability + snapshot-based move warnings

UI Cleanup Pass 1 sits beside those systems and improves readability. It is not a gameplay expansion of Room Exposure.

When returning to Room Exposure, resume with a newly discussed Room Exposure Pass 3 rather than treating tooltip/cost work as that pass.

## Suggested next options

### Option A — Return to Room Exposure Pass 3

Likely next design topic:
- how Physical State affects normal gameplay decisions beyond stamina costs
- current-room exposure consequences
- rest quality and unsafe rest warnings
- possibly action blocking at Failing state

Still avoid:
- disease
- radiation
- magic exposure tracks
- treatment
- PPE
- combat
- attacks
- recapture

### Option B — UI Cleanup Pass 2

Possible UI cleanup topics:
- unify all remaining status terms under tooltip helper
- add visible tooltip affordance styling
- improve mobile/tap behavior for tooltips
- add a compact glossary/index later
- audit old `title` text for consistency
- make modified costs more visually consistent across all button types

Only do this if the user wants to keep polishing UI before returning to gameplay systems.

## Commit recommendation

```powershell
git status
git add .
git commit -m "Add keyword tooltips and stamina cost breakdowns"
git push
```

## Fresh continuation prompt

Use this when starting a new Cline/Codex chat after committing:

```txt
Read CLINE_QC_CONTEXT.md and the handoff docs.

Current status:
- Room Exposure Pass 1 is complete: Physical State, hidden internal exposure, diagnostics, diagnostic confidence.
- Room Exposure Pass 2 is complete: current-room exposure, observation reliability, snapshot-based movement warnings.
- UI Cleanup Pass 1 Fix 1 is complete: keyword tooltips and modified stamina cost breakdowns.

Important classification:
The tooltip/cost work is UI Cleanup, not Room Exposure Pass 3.

Do not code yet. First summarize:
1. What UI Cleanup Pass 1 added.
2. What Room Exposure state we are returning to.
3. What you think the next narrow pass should be.

Then ask any necessary clarifying questions before implementation.
```
