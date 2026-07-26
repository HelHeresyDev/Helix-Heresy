# Helix Heresy Visual Language

This document defines the approved visual direction for the physical map and its future sprite renderer. It is a production contract for later renderer, asset, animation, and accessibility work. It does not make presentation state authoritative over simulation state.

## Core Direction

Helix Heresy uses a fixed north-up orthographic map. Floors and physical footprints are read from directly above. Walls, fixtures, actors, and other tall subjects may use shallow elevated drawing cues so that their forms remain recognizable, but the game should not use a true isometric projection.

The visual style should be hard-edged, low-detail, and illustrated rather than strict pixel art or heavily painted artwork. It should preserve the rapid readability of a management game while allowing generated creatures to express combinations of Shape, dimensions, Body Consistency, Color, Appendages, Element, Byproduct, condition, and activity.

The ordinary world should look like a physical underground laboratory. Materials, lighting, residue, damage, and equipment determine its base appearance. Room purposes, stockpile identities, access restrictions, environmental measurements, and similar management information belong in optional overlays instead of permanently recoloring the world.

## Projection And Geometry

- The map is orthographic, north-up, and aligned to the simulation grid.
- One horizontal tile always represents one square meter.
- One z-layer currently represents four meters of vertical space.
- Simulation footprints, occupied-cell masks, vertical clearance, interaction ports, and collision remain authoritative.
- A sprite may use perspective, shadow, and minor decorative overhang to communicate form, but transparent or opaque pixels never change physical occupancy.
- True isometric coordinates, diamond tiles, and camera rotation are outside the approved direction.
- The selected z-layer remains the primary physical slice. Rendering other layers, overhead bodies, shafts, and cross-layer silhouettes will be specified by later occlusion and z-layer passes.

Shallow elevation is a readability device, not a second geometry system. A cabinet can show a front face and a slime can show a raised body, while selection, pathfinding, attacks, hauling, and construction still use the square tile model.

## Logical And Source Scale

The renderer must keep physical scale separate from raster resolution.

- Logical world scale: 1 tile = 1 square meter.
- Base raster source scale: approximately 64 by 64 source pixels per occupied tile.
- Multi-tile assets use their complete physical bounds rather than stretching a one-tile icon.
- Attachments and effects use normalized anchors so they can be placed on bodies of different dimensions.
- Source resolution is an asset-production standard, not a required on-screen size.

The initial Canvas target should support these approximate display sizes:

| Tile size | Presentation level | Intended information |
| --- | --- | --- |
| 8-12 px | Strategic | Terrain, silhouettes, important markers, hazards, and broad activity |
| 16-24 px | Operational | Normal play, recognizable actors, doors, furniture, and major condition cues |
| 32-64 px | Inspection | Appendages, body surface, damage, equipment details, and richer activity |

The preferred future zoom sequence is approximately `8, 12, 16, 24, 32, 48, 64` pixels per tile. Canvas may interpolate camera scale smoothly, but semantic presentation changes should occur at stable thresholds.

The default camera should fit the starting laboratory while preferring an operational tile size and capping the initial view around 24-32 pixels per tile. The player may zoom farther out for strategic awareness or farther in for inspection.

## Semantic Zoom

Zoom is not only magnification. The renderer should deliberately change visual density.

At strategic zoom:

- Creatures use strong silhouettes or restrained markers.
- Tiny creatures receive a minimum visible marker without gaining a larger physical footprint.
- Fine surface texture, minor carried objects, and small appendages may be omitted.
- Important incidents, selected objects, and current commands remain legible.

At operational zoom:

- Full creature silhouettes, major appendages, fixtures, doors, corpses, and material differences are visible.
- Activity and condition use a small number of readable pose and effect cues.
- Labels remain contextual rather than covering the map.

At inspection zoom:

- Body consistency, markings, appendage arrangement, wounds, residue, and equipment condition may show additional detail.
- Extra detail must not reveal traits or state the scientist has not observed.
- The inspector remains the authoritative place for exact textual information.

## Modular Creature Rendering

A generated creature should be rendered from a deterministic visual recipe rather than selected from one finished sprite for every possible genome.

The recipe is a renderer-neutral derived model, not a new source of simulation truth. A representative recipe may contain:

```text
bodyFamily
physicalDimensions
footprintMask
verticalExtent
orientation
consistencyTreatment
pigmentationPalette
surfaceModules
attachments
elementalManifestations
byproductManifestations
conditionCues
pose
activity
variationSeed
knowledgeState
```

### Body Families

Shape selects a lightweight body family and rig:

- Radial: spherical and blob-like bodies
- Surface: puddles and flat sheets
- Elongated: worm-like and serpentine bodies
- Upright: humanoid bodies
- Quadruped: dog-shaped bodies
- Solid: cubic and similarly rigid bodies
- Branching: star-like and irregular branching bodies

Each family provides normalized anchors or sockets appropriate to that anatomy. Radial bodies may provide edge, top, underside, and rear sockets. Upright bodies may provide shoulder, hand, back, head, and hip sockets. Surface bodies may distribute attachments around their perimeter.

Rare strange biology remains legal. If an attachment has no ideal socket on a body family, a deterministic fallback places it at a plausible perimeter or body anchor rather than rejecting the creature.

### Assembly Order

The conceptual assembly order is:

1. Build the Shape-derived body silhouette inside the physical footprint.
2. Fit it to current dimensions and Current Mass.
3. Apply Body Consistency to edges, deformation, transparency, and surface structure.
4. Apply pigmentation through a controlled palette rather than a flat tint.
5. Place Appendage modules on deterministic compatible sockets.
6. Add restrained Element manifestations.
7. Add active Byproduct manifestations where physically appropriate.
8. Add observable condition, damage, compression, and activity cues.
9. Add renderer-owned selection, alert, path, and accessibility treatment.

The complete body should read as one organism. Modules must share lighting direction, outline weight, palette discipline, and deformation so they do not resemble unrelated stickers.

### Body Consistency

Body Consistency changes rendering behavior as well as surface appearance. Examples include:

- Loose jelly: soft silhouette, sagging, and stronger squash deformation
- Crystalline: angular edges, facets, and limited deformation
- Gloopy: uneven edges, hanging material, and slow shape recovery
- Gaseous or diffuse: reduced opacity and an unstable boundary
- Rigid: stable proportions and minimal deformation

These are visual treatments of actual biology. They must not add capabilities, collision, or weaknesses that the simulation does not contain.

### Pigmentation

Color chooses a small coordinated palette containing body midtones, shadow, highlights, and internal or surface accents. It should not simply multiply every module by one color. Elemental effects, damage, selection, and lighting must remain distinguishable from pigmentation.

### Appendages

Appendages are reusable authored or procedural modules attached through the body rig. Their position and count should be stable for the creature. Growth may move their anchors as proportions change, but they should not randomly rearrange every frame or after loading a save.

Animated appendages follow the base body's transform and pose. An appendage may visually reach beyond the occupied mask during an animation, but attack reach and collision still come from simulation rules.

### Element And Byproduct

Element should contribute restrained physical manifestations such as frost, bubbles, heat distortion, electrical arcing, internal motion, or magical suppression. Byproducts should appear primarily while being produced, accumulated, spilled, or carried.

World appearance is not the same as scientific identification. Visible green droplets do not automatically reveal Poison. The creature may display an observable physical phenomenon while its Element label and icon remain hidden until discovered.

## Deterministic Variation And Lineage

Creatures with the same broad traits should look related without becoming exact visual clones. A stable variation seed derived from durable creature and genome data may control:

- Silhouette irregularity
- Surface markings
- Facet or spot placement
- Minor proportions
- Attachment arrangement
- Internal pattern
- Animation rhythm

The same saved creature must reconstruct the same appearance after loading. Rendering may use lineage or shared genome regions to produce family resemblance, but it must not invent visible heredity that contradicts the generated genome.

Random variation is chosen when the recipe is created or rebuilt from stable data. It is never sampled independently every render frame.

## Growth, Damage, And Condition

Current Mass and physical dimensions change the assembled body's scale and occupied mask. Growth should regenerate or update the cached body recipe rather than stretching a tiny bitmap indefinitely.

Observable state can influence presentation:

- Low Current Mass: reduced body volume
- Compression: visibly crowded or deformed body
- Body Integrity damage: wounds, cracks, missing mass, or unstable edges
- High Stress: tense, restless, contracted, or agitated motion where anatomy permits
- Feeding: contact and ingestion pose
- Combat: attack, defend, flee, or freeze pose
- Quiescence: reduced motion appropriate to plant-like slime biology

Visual cues should remain broad. Exact stat values belong in menus and inspectors.

## Multi-Tile And Multi-Layer Bodies

Large creatures render across their complete occupied-cell mask. The body may be drawn as one cached image covering its bounds or as coordinated sections, but the following rules apply:

- Every occupied tile participates in selection highlighting.
- One stable primary anchor controls stacking and contextual selection priority.
- Hit testing resolves through semantic entity targets and physical masks, not alpha pixels.
- Orientation follows saved physical orientation.
- Turning and movement interpolate presentation without changing the authoritative path.
- Corpses preserve the body's death-time form and shrink as physical consumption progresses.
- Last-known bodies use the last observed footprint and appearance rather than current hidden state.

The later z-layer and occlusion specification will define how a creature taller than one layer appears above, below, or through the selected slice.

## Knowledge Boundaries

The normal renderer represents player knowledge, not omniscient state.

- Unknown space is blank darkness.
- Currently perceived subjects use current observable appearance.
- Stale subjects use a desaturated, outlined, or otherwise distinct last-known representation.
- Uncertain sensory detections use uncertainty markers rather than exact sprites.
- Debug may show true current geometry, identity, and state.
- Icons and trait labels remain gated by discovery even when related physical cues are visible.

Last-known visuals must be stored or derived from an observation snapshot. The renderer must not rebuild stale appearance from the creature's current hidden genome, mass, condition, or location.

## Palette And Contrast

The base palette should be dark and desaturated without collapsing known space into black.

- Natural stone: cool charcoal and mineral gray
- Finished floors and structures: material-specific midtones
- Wood, metal, brick, glass, cloth, and biological matter: recognizable material families
- Living biology: comparatively stronger pigmentation
- Arcane energy: distinct luminous accents
- Hazards and emergencies: reserved high-salience colors plus shape or motion cues
- Unknown space: near-black with minimal structure

Room-purpose color, stockpile color, access color, environmental measurements, and other management abstractions appear through overlays. They do not permanently tint ordinary terrain.

Selection must remain visible over every material and overlay. Alerts must not rely on red alone. Element, team, condition, and danger should not compete for the same color channel when shape, outline, animation, or iconography can carry part of the meaning.

## Terrain Connectivity Contract

Terrain sprites and procedural shapes consume derived connectivity rather than inspecting simulation arrays or neighboring DOM nodes.

- Physical layers remain independent: natural rock, floor surfaces, constructed walls, door fixtures, vertical connectors, future fluids, and management boundaries.
- Cardinal edges use the bit order North `1`, East `2`, South `4`, and West `8`. The resulting mask classifies isolated, end, straight, corner, tee, and cross forms.
- Diagonal masks only refine corners. They never make two tiles physically connected.
- Each edge has an explicit relation: `joined`, `abutment`, `portal`, `transition`, `exposed`, `unknown`, or `boundary`.
- Natural rock joins through different ore deposits. Constructed-to-natural contacts and unlike constructed materials retain seams through `abutment`.
- Doors save a frame axis and derive the perpendicular passage axis. The frame does not rotate merely because neighboring structures later change.
- Stairs report `up`, `down`, or `both`. Ramps report entry, middle, exit, and upper-landing segments.
- Room and compartment boundaries are overlay data and do not alter structural masks.
- Unknown neighbors produce capped `unknown` edges. Renderers must not infer or reveal the hidden neighbor.
- Stable coordinate-based variation selects cosmetic variants without storing presentation state in saves.
- Fluids will use the same relation contract when tile-level liquid state exists; this pass reserves the semantic layer without pretending fluid simulation is implemented.

## Readability Requirements

At the default operational zoom, the player should be able to distinguish:

- Walkable floor, solid rock, walls, doors, and open vertical connections
- Scientist, living creature, corpse, fixture, loose item, spill, and incident
- Selected versus unselected subjects
- Open, closed, breached, and seriously damaged barriers
- Current physical position versus stale or uncertain information

At strategic zoom, the player should still be able to locate actors, serious hazards, current selection, and important commands without reading glyph text.

Text and exact values remain in HTML inspectors, menus, tooltips, and records. The map communicates category, location, state, and urgency.

## Map Scene Contract

Both the glyph renderer and future Canvas renderer consume the same transient, versioned `MapScene`.

- The scene covers the visible viewport plus a one-tile overscan margin.
- Terrain remains cell-based; physical objects and actors are unique entity records with anchors, full footprints, bounds, orientation, vertical extent, and semantic visual keys.
- Contained occupants, stations, and other selectable relationships belong in the interaction index unless they are independently visible physical entities.
- Entity presentation fields reserve facing, pose, activity, motion, condition, and modular recipe keys without defining final animation frames.
- Knowledge is explicit: `current`, `stale`, `uncertain`, `unknown`, or `debug`.
- Environment records contain values only when the perspective is permitted to know them. Stale room observations carry only remembered values and bands.
- Incidents and combat markers are effects. Management coloration and diagnostic readings are overlays.
- Selection identifies the semantic target and its complete selected footprint.
- CSS classes, DOM datasets, Canvas objects, draw calls, image instances, and asset paths are not scene data.
- The scene is never saved. Simulation state and observation memory remain authoritative.

The first Canvas prototype is available as a transient Debug renderer while the DOM map remains the default fallback. It draws visible and one-tile overscan `MapScene` cells plus unique entities, uses semantic presentation rules rather than CSS classes, scales its backing surface for the device pixel ratio, and redraws through invalidated animation frames. Camera navigation updates the persistent Canvas in place. Tile-aligned shared camera state is combined with a transient pixel offset for smooth WASD and grab panning; wheel zoom remains discrete and preserves the pointed map area, and responsive resizing preserves the viewed center. Shared coordinate transforms account for the active origin and zoom. Canvas pointer interaction resolves only through the scene's ordered, knowledge-filtered interaction index: it selects semantic targets by physical cell masks, highlights complete visible footprints, updates the keyboard cursor, exposes crowded-cell alternatives through HTML inspectors, and never alpha-tests artwork or queries hidden simulation entities. Delayed HTML tooltips consume the scene's semantic tooltip text. Room and access painters support Canvas left-drag input, construction retains click-to-toggle designation, middle drag remains camera movement, and overscan cells are not interactive. A small generated placeholder set now exercises semantic image resolution for terrain, fixtures, items, actors, effects, and markers; all unresolved or failed keys retain the glyph/procedural presentation.

## Rendering And Asset Boundaries

- Simulation state does not contain Canvas objects, DOM nodes, image instances, or draw commands.
- A discovery-aware visual selector creates the visual recipe from authoritative state and observation records.
- The asset manifest resolves semantic module keys into images and metadata.
- The manifest owns repository-relative image paths, source dimensions, logical tile dimensions, aliases, and category fallbacks; `MapScene` carries only semantic keys.
- Image loading is asynchronous and cached. Its `idle`, `loading`, `ready`, `partial`, and `error` diagnostics never block simulation startup.
- The renderer assembles procedural geometry and authored raster modules into an offscreen surface.
- The result is cached until relevant recipe inputs change.
- Camera movement and ordinary animation reuse cached visuals.
- Rendering hundreds of actors must not rebuild every modular body every frame.
- Missing assets fall back to procedural shapes or glyphs without breaking interaction.

The approved long-term renderer remains hybrid: Canvas for the physical map and HTML/CSS for menus, inspectors, policies, logs, dialogs, tooltips, and accessibility controls.

## Accessibility And Fallback

The existing glyph map remains a supported fallback rather than disposable scaffolding. Later passes should provide reduced motion, high contrast, color-independent indicators, readable minimum zoom, scalable map markers, and adjustable effect intensity.

The sprite renderer must preserve all interaction and information available in glyph mode. Visual richness may add atmosphere and recognition, but it may not remove textual identification or keyboard operation.

## Deferred Decisions

This specification does not yet define:

- Final production sprite filenames or atlas packing
- Canvas draw order and occlusion
- Final animation frame counts
- Four-way versus eight-way authored facing
- Exact fog, lighting, and environmental shader treatment
- Exact cross-layer rendering for tall bodies
- Final swatch values

Those decisions belong to the corresponding pending prompts and should conform to this visual language.
