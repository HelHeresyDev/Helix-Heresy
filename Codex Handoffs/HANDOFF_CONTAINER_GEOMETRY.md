# System Handoff — Container Geometry and Dimension-Aware Fit

Date: 2026-06-20

## Purpose

This system moves container size beyond simple volume.

Volume is sufficient for many slimes, but future rigid creatures need actual dimensions:
- length
- width
- height
- diameter
- opening size
- open/closed top
- shape type

This system establishes that foundation.

## Implemented behavior

### Container geometry data

Each base container type now has a `geometry` field.

Geometry can describe:
- shape
- internal dimensions
- opening dimensions
- whether the container has an open top

Examples of shape categories:
- cylinder
- box
- cage
- basin
- tray
- pod
- tube

### Synthesis tube geometry

The synthesis tube has its own fixed geometry.

It is treated separately from normal base container type definitions.

### Geometry helper functions

The system includes helpers for:
- retrieving a container's geometry
- formatting internal dimensions
- formatting opening dimensions
- summarizing geometry for UI
- estimating creature dimensions from slime size/shape
- measuring interior and opening constraints

### UI display

Container cards now show compact interior geometry text.

Existing capacity text remains. Geometry supplements capacity; it does not replace it.

### Dimension-aware passive suitability

Passive container suitability now considers geometry in addition to volume/capacity.

It can warn about dimensional problems such as:
- body dimensions straining the interior
- full-size body outgrowing the container
- opening too narrow for rigid or bulky creatures
- shallow containers creating fit issues
- open-top or gap problems for certain forms

This strengthens future active risk because breach potential now has better physical inputs.

## Important design intent

Slimes should remain permissive starter creatures.

Slime fit is still more volume-tolerant than rigid creature fit.

Geometry should be a foundation for future creature families, not a hard punishment system for slimes.

## Tests / QC completed

Geometry Pass 1 smoke test:
- `node --check app.js` passed
- container list rendered
- Synthesis Tube appeared
- Basic Glass Jar appeared
- existing capacity text still appeared
- new interior geometry text appeared
- cm dimensions appeared
- diameter wording appeared
- box dimensions appeared
- open top / closed wording appeared
- console warnings/errors: 0
- page errors: 0

Geometry Pass 2 smoke test:
- dimension suitability helpers existed
- passive suitability used dimensional concerns
- warning text existed
- page rendered
- container list rendered
- capacity text still appeared
- interior geometry text still appeared
- console warnings/errors: 0
- page errors: 0

## Repository / implementation status

This system is incorporated into the current tracked `app.js`.

The project now uses Git as the main checkpoint and restore system.

Current workflow:
- Commit only after syntax checks and smoke/QC tests pass.
- Push accepted checkpoints to `origin/main`.
- Treat generated zip bundles as temporary transfer artifacts, not the long-term source of truth.


## Known limitations / future work

- Dimension estimates are first-pass approximations.
- Future rigid creature families will likely need stricter shape-specific fit logic.
- UI may need better grouping if many warnings accumulate.
- Capacity values are still hand-authored and were intentionally not changed.
