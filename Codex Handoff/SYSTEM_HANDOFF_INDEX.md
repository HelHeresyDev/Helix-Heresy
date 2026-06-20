# Helix Heresy System Handoffs — Index

Date: 2026-06-20

These handoff files summarize implemented systems as standalone references for future Codex/Cline/ChatGPT work.

Use these files as system-specific summaries instead of asking an agent to read the full chat history or the full raw handoff log.

## Current implemented system handoffs

1. `HANDOFF_CONTAINER_ISOLATION.md`
   - Container interiors
   - Environmental exchange
   - Environmental feeding source awareness
   - Container UI interior warnings

2. `HANDOFF_CONTAINER_GEOMETRY.md`
   - Container dimensions
   - Interior/opening geometry
   - Dimension-aware passive suitability
   - Geometry UI

3. `HANDOFF_CONTAINMENT_RISK_AND_INCIDENTS.md`
   - Active containment risk
   - Potential / Pressure explanations
   - Container condition
   - Minor containment incidents
   - Stress/contamination/Suspicion consequences

4. `HANDOFF_CORPSE_LOCATION_AND_LOCAL_REMAINS.md`
   - Corpses stay where the slime died
   - Corpse records track physical location
   - Containers can contain corpse remains
   - Synthesis tube can be blocked by remains
   - Auto-move corpse policy
   - Local corpse contamination and corpse feeding hooks

## Current workflow recommendation

ChatGPT generates replacement `app.js` bundles.

Cline is used mainly for:
- `node --check app.js`
- Playwright smoke tests
- visual/browser QC
- qualitative feedback

Cline should generally not edit source files or handoff logs unless explicitly requested.

## Current good final implementation state

The latest accepted bundle at the time of this index was:

`app_corpse_location_pass1_fix1_bundle.zip`

Status:
- syntax check passed
- corrected corpse location smoke test passed
- 23/23 checks passed
- console warnings/errors: 0
- page errors: 0
- no scope creep detected

## Superseded recent bundles

The latest accepted bundle includes previous accepted work from:
- container isolation
- container geometry
- active containment risk
- minor containment incidents
- corpse location/local remains

Earlier intermediate bundles should not be treated as current unless specifically needed for debugging history.
