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

5. `HANDOFF_ROOMS_FOUNDATION.md`
   - Main Lab, Menagerie, and Pits added as real rooms
   - UI room names avoid leading "The"
   - Article names exist for event text
   - Menagerie blocks jobs
   - Pits is corpse/corpse-processing themed
   - Containers can be moved between rooms
   - Moving containers updates occupant and local corpse room location

6. `HANDOFF_PITS_HOLE_CONTAINERS.md`
   - Open Dirt Pit, Grated Dirt Pit, and Capped Dirt Pit added as real containers
   - Pit holes start in Pits
   - Corpse handling can target Waste drums or Pit holes
   - Auto-moving local corpses into pit-hole containers works
   - Corpse Processing can target pit-hole corpses
   - Corpse Processing and Waste Disposal require Pits
   - Living creatures can be placed in pit holes and receive active containment risk

7. `HANDOFF_CONTAINER_HAULING.md`
   - Container room changes create hauling tasks instead of instant moves
   - Containers remain in the original room until hauling completes
   - In-transit containers block occupant jobs
   - Hauling adds active containment pressure
   - Pit holes are fixed in Pits and cannot be hauled
   - Testing shortcut unloads contents into pit holes when hauling to Pits
   - Testing shortcut loads contents from pit holes when hauling from Pits

## Current implementation status

The current accepted implementation is incorporated into the tracked project files and has been pushed/should be pushed to `origin/main` after QC.

The latest accepted feature checkpoint at the time of this index was:

`Container Hauling Pass 1 fix1`

Status:
- syntax check passed
- Container Hauling Pass 1 fix1 smoke test passed
- 28/28 checks passed
- console warnings/errors: 0
- page errors: 0
- no scope creep detected

## Workflow recommendation

ChatGPT generates replacement `app.js` bundles when direct patching is safer than asking Cline to code.

Cline is used mainly for:
- `node --check app.js`
- Playwright smoke tests
- visual/browser QC
- qualitative feedback

Cline should generally not edit source files or handoff logs unless explicitly requested.

Git is now the main source of truth and checkpoint mechanism.

Use generated zip bundles only as temporary transfer artifacts.

## Superseded recent transfer bundles

The current tracked `app.js` includes accepted work from:
- `app_containment_incidents_big_pass_fix2_bundle.zip`
- `app_corpse_location_pass1_fix1_bundle.zip`
- `app_rooms_menagerie_pits_pass1_fix1_bundle.zip`
- `app_pits_hole_containers_pass1_bundle.zip`
- `app_container_hauling_pass1_fix1_bundle.zip`

Intermediate bundles should not be treated as current unless specifically needed for debugging history.
