# System Handoff — Active Containment Risk and Minor Incidents

Date: 2026-06-20

## Purpose

This system makes containment depend on more than passive physical fit.

Passive fit asks:
Can the container physically hold the creature?

Environmental isolation asks:
What conditions exist inside the container?

Active containment risk asks:
Is this creature likely to challenge containment right now?

Incidents ask:
What minor consequences happen if high risk is ignored long enough?

## Implemented behavior

### Active containment risk

Contained creatures now receive an active risk evaluation.

Risk uses two broad concepts:

1. Potential
   - How bad things could get if this creature challenges this container.
   - Driven by container mismatch, passive suitability, body form, geometry, gaps, seal, durability, weight, byproduct, and container condition.

2. Pressure
   - How likely the creature is to challenge containment right now.
   - Driven by Stress, Nutrition, Body Integrity, Division Pressure, behavior, stability, damaged containment, and other current-state issues.

Risk bands:
- Stable
- Watch
- Strained
- Dangerous
- Failing

Special synthesis tube state:
- Suppressed by synthesis tube

### Potential / Pressure UI

Selected slime summary and container occupant rows show:
- Active risk band
- Potential score and reasons
- Pressure score and reasons

Formatting uses clear separators:
- `Potential: 5 — reason`
- `Pressure: 0 — reason`
- multiple reasons separated by ` · `

### Container condition

Containers now have condition.

Default:
- 100% intact

Condition states:
- intact
- worn
- damaged
- critical

Container cards show condition.

Container condition affects active risk:
- worn condition adds some potential
- damaged/critical condition adds more potential and pressure
- damaged containment can make incidents more likely

### Minor containment incidents

Sustained Dangerous/Failing active risk can trigger minor incidents over time.

Incident progress accumulates while risk is high and decays when risk drops.

Cooldown prevents spam.

Implemented minor incident types:
- disturbance
- fouling
- leak/seep strain
- structural strain

Possible consequences:
- event log message
- Stress increase
- container condition loss
- container contamination increase
- small room contamination increase from leaks
- tiny Suspicion gain for visible leak/failing cases

### Explicitly not implemented

This system does not include:
- full escapes
- combat
- deaths or injuries
- raids or authorities
- catastrophic breaches
- container destruction
- repair economy
- advanced staff safety
- room pathfinding

## Tests / QC completed

Integrated Containment Incidents baseline smoke test:
- container condition appeared
- active risk / Potential / Pressure still appeared
- minor incident helpers existed
- condition affected risk
- no full escape/combat/raid/death/destruction code detected
- page rendered
- console warnings/errors: 0
- page errors: 0

Targeted containment incident stress retest:
- injected high-risk slime into damaged Open Tray
- active risk showed Failing
- Potential: 154
- Pressure: 134 before time skip
- minor incident triggered after time advance
- event log message:
  `Minor containment incident: RG-001 caused leak/seep strain in Open Tray 7. A small trace reached the room. Suspicion +2.`
- container condition changed 20 → 18
- Stress changed 95 → 100
- room contamination changed 10 → 15
- Suspicion gained +2
- one incident over 720 time units
- console warnings/errors: 0
- page errors: 0
- no full escapes, combat, deaths, raids, catastrophic breaches, or container destruction

## Current accepted bundle at time of this handoff

This system was incorporated into later accepted bundles.

The last standalone accepted incident bundle was:
`app_containment_incidents_big_pass_fix2_bundle.zip`

The later accepted corpse-location bundle includes this system:
`app_corpse_location_pass1_fix1_bundle.zip`

## Known limitations / future work

- No repair system yet.
- No full breach/escape system yet.
- No staff injury/safety system yet.
- No authority/raid system yet.
- Container condition can degrade, but destruction is intentionally not implemented.
- UI may eventually need consolidation as more systems are displayed.
- Incident tuning is first-pass and may need balancing during playtesting.
