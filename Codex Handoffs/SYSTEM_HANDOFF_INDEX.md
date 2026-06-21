# Helix Heresy System Handoffs — Index

Date: 2026-06-21

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
   - Current accepted behavior: hauling moves only the container
   - Living slimes and corpses/remains stay inside hauled containers
   - Old magical Pits hauling shortcuts have been removed

8. `HANDOFF_PLAYER_CREATURE_INTERACTION.md`
   - Uses existing Scientist Health for direct handling danger
   - Open/Close container interactions
   - Handling methods and knowledge-gated risk previews
   - Direct corpse/remains Dump/Scrape into pit holes
   - Direct living slime transfer between same-room containers/pit holes
   - Stress, health damage, and contamination consequences
   - No escape/combat/pathfinding systems added yet
   - Current accepted behavior: Pits hauling shortcut removed; direct actions are required to move contents

9. `HANDOFF_OUT_OF_CONTAINER_SLIME_BEHAVIOR.md`
   - Uncontained/free slimes have room location and activity
   - Contained slimes use containment-focused wording
   - Room cards list observed free creatures
   - Contamination-seeking/eating free slimes can move between rooms and reduce contamination
   - Messy free slimes can leave residue and increase contamination
   - Predatory/hunting intent can appear without attacks
   - Free creature pressure is observation-gated and knowledge-gated
   - Unobserved rooms hide names/activities and show `Free creature pressure: Unobserved`

10. `HANDOFF_PHYSICAL_ROOMS.md`
   - Rooms have physical geometry: length, width, height, floor area, volume, shape
   - Floor area and volume are explicit, so irregular rooms work
   - Pits is an irregular pit chamber
   - Room cards show spatial feel, crowding, shape, and connections
   - `Open` spatial feel was replaced with `Comfortable`
   - Room effects scale by floor area/volume
   - Free creatures move through connected rooms
   - Hauling events include route text
   - Scientist has physicalPresence and contributes to crowding
   - Scientist can move between connected rooms with queued `scientistMove` tasks

## Current implementation status

The current accepted implementation is incorporated into the current working `app.js` after applying:

`app_physical_rooms_pass3_fix1_bundle.zip`

Latest accepted feature checkpoint:

`Physical Rooms Pass 3 fix1`

Status:
- syntax check passed
- Physical Rooms Pass 1 smoke test passed
- Physical Rooms Pass 2 smoke test found one test-script assertion bug, app behavior accepted
- Physical Rooms Pass 3 smoke test found one test-script regex bug, app behavior accepted
- Physical Rooms Pass 3 fix1 patched only movement button separators
- console warnings/errors: 0 in QC runs
- page errors: 0 in QC runs
- no scope creep detected
- no doors/locks/construction/pathfinding grid/combat/attacks/recapture/full escape/raids added

Recommended next Git checkpoint:

```powershell
git status
git add .
git commit -m "Add physical room system"
git push
```

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

The current tracked/accepted `app.js` includes accepted work from:
- `app_containment_incidents_big_pass_fix2_bundle.zip`
- `app_corpse_location_pass1_fix1_bundle.zip`
- `app_rooms_menagerie_pits_pass1_fix1_bundle.zip`
- `app_pits_hole_containers_pass1_bundle.zip`
- `app_container_hauling_pass1_fix1_bundle.zip`
- `app_player_creature_interaction_pass1_bundle.zip`
- `app_player_creature_interaction_pass2_fix1_bundle.zip`
- `app_player_creature_interaction_pass3_fix1_bundle.zip`
- `app_player_creature_interaction_pass4_fix1_bundle.zip`
- `app_pits_hauling_shortcut_cleanup_pass1_bundle.zip`
- `app_out_of_container_slime_behavior_pass1_fix1_bundle.zip`
- `app_out_of_container_slime_behavior_pass2_fix1_bundle.zip`
- `app_physical_rooms_pass1_bundle.zip`
- `app_physical_rooms_pass2_bundle.zip`
- `app_physical_rooms_pass3_fix1_bundle.zip`

Intermediate bundles should not be treated as current unless specifically needed for debugging history.
