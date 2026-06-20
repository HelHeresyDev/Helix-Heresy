# System Handoff — Container Isolation and Environmental Exchange

Date: 2026-06-20

## Purpose

This system separates room conditions from container interiors.

Before this work, containers were effectively just holders. Environmental feeders and room attributes did not meaningfully distinguish between a slime being loose in a room and a slime inside a sealed or partially sealed container.

After this work, containers have their own interior environment and exchange environmental attributes with their room over time.

## Implemented behavior

### Container interiors

Each container has an interior environment with the same core attributes as a room:

- Temperature
- Light
- Ambient Mana
- Moisture
- Contamination
- Electrical Charge

The synthesis tube also has its own contained environment.

### Environmental exchange

Containers exchange environmental attributes with their room.

The rate depends on container type.

Examples:
- Open containers and cages exchange heavily with the room.
- Sealed containers exchange slowly.
- The synthesis tube is treated as strongly isolated.

### Environmental feeding source awareness

Environmental sustenance checks the slime’s immediate source:

- A contained slime feeds from its container interior.
- A released slime feeds from its room.
- Synthesis tube occupants are treated as temporarily stabilized and isolated.

This prevents a sealed container slime from freely feeding directly from the room environment.

### UI support

Container cards show interior environmental status and warnings.

Environmental feeding status text is source-aware. It can refer to the container interior or the room as appropriate.

## Important design intent

Container isolation should make container choice matter without making early experimentation punishing.

Environmental feeders should still be viable, but they should care about where they are being held.

The synthesis tube should be safe as temporary stabilization, not a permanent general-purpose creature prison.

## Tests / QC completed

Basic browser smoke test:
- Page loaded
- Title: Helix Heresy
- Body rendered
- Container-related text found
- Console warnings/errors: 0
- Page errors: 0

Targeted feature smoke test:
- Container list rendered
- Synthesis Tube appeared
- Interior wording appeared
- Synthesis tube communicated isolation/interior wording
- Synthesis completed using keyboard shortcuts
- Container UI still rendered after synthesis
- Page did not blank/crash
- Console warnings/errors: 0
- Page errors: 0

## Known limitations / future work

- Container interior UI may eventually need consolidation if the container cards become too dense.
- Environmental exchange values are first-pass tuning.
- More room systems will make this more meaningful later.
- Advanced environmental equipment networks are not implemented.
