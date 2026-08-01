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
- The selected z-layer remains the primary physical slice. Tall entities use their normal authored presentation on the anchor layer and a restrained cross-section on other occupied layers. Overhead fixtures cut away over the cursor or selected footprint.

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

A creature taller than one layer uses its normal authored presentation on its anchor layer and a translucent cross-section on every other occupied selected slice. Final authored slice artwork may refine this fallback without changing physical occupancy.

## Knowledge Boundaries

The normal renderer represents player knowledge, not omniscient state.

- Unknown space is blank darkness.
- Currently perceived subjects use current observable appearance.
- Stale subjects use a desaturated, outlined, or otherwise distinct last-known representation.
- Uncertain sensory detections use uncertainty markers rather than exact sprites.
- Debug may show true current geometry, identity, and state.
- Icons and trait labels remain gated by discovery even when related physical cues are visible.

Last-known visuals must be stored or derived from an observation snapshot. The renderer must not rebuild stale appearance from the creature's current hidden genome, mass, condition, or location.

The implemented cell-memory model is sparse save data rather than a saved `MapScene`. A cell observation records its coordinate, first and last observation times, source, and a semantic snapshot of remembered terrain, connectivity, door state, room anchor, and rememberable static objects. Dynamic hidden item, corpse, and actor state is not copied into terrain memory. Creature records separately retain last-known body location, footprint, orientation, facing, pose, activity, and broad condition cues.

Current perception is recomputed from the scientist's same-z position, sensory capability, tile lighting, and physical line of sight. Dark permits contact range, Dim permits four tiles, Lit permits eight, and Bright permits twelve. Walls and nontransparent doors occlude cells. Map perception, creature vision, and exact incident perception use this same rule. Darkness returns an explored but unperceived cell to its saved memory rather than erasing it, and each z-layer has independent knowledge.

Remembered observations age in game time:

- Recent: up to fifteen minutes since observation
- Aged: over fifteen minutes and up to two hours
- Archived: over two hours

Terrain remains remembered at every age, with progressively quieter presentation. A changed but unobserved cell continues to draw its saved snapshot with no covert indication that the simulation has changed. Reobserving the cell atomically replaces that snapshot. Player-authored routes, excavation plans, room drafts, and other designations remain visible over unknown or stale space because they are player knowledge.

Uncertain sensory incidents carry an approximate perceived cell, uncertainty radius, source channel, and reduced confidence. They render as markers or regions rather than exact hidden subjects. A stale creature projection is a selectable record at its saved footprint, but physical commands still require reacquisition through the existing exact-observation rules. Debug bypasses the observation boundary explicitly and labels its scene cells and entities as Debug knowledge.

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

## Lighting And Environmental Treatment

Physical lighting is always part of the ordinary world view. Active fixtures and the scientist's physical carried hand lamp contribute to the authoritative tile field with distance falloff. Solid barriers and closed intact doors block it; open stairs, ramps, and shafts transmit it vertically with additional falloff. The current prototype uses semantic `neutral`, `warm`, `cold`, and `arcane` spectra, with the starter oil and hand lamps using `warm`.

Both renderers consume semantic lighting from `MapScene`. Dark and Dim cells reduce material and subject brightness, Lit cells preserve the base palette, and Bright cells receive a restrained highlight. Atmosphere, alerts, cursor, and selection remain separate channels so lighting cannot hide actionable UI. Known dense airborne mixtures may add a static identity-free haze pattern; individual substance identities remain unavailable without Debug or an appropriate future instrument.

Temperature, humidity, ambient mana, light, and aggregate airborne contamination are mutually exclusive diagnostic overlays. Ordinary current readings expose descriptive bands rather than exact values. A saved room observation may project its last band across remembered cells using desaturation, hatching, and an age-bearing tooltip; unknown cells remain blank and hidden current state is never recomputed into a stale overlay. Debug may expose the underlying exact values and airborne identities.

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
- Terrain remains cell-based; physical objects and actors are unique entity records with anchors, full footprints, bounds, normalized quarter-turn physical orientation, vertical extent, and semantic visual keys.
- Contained occupants, stations, and other selectable relationships belong in the interaction index unless they are independently visible physical entities.
- Entity presentation fields carry semantic physical layer, four-way actor facing, canonical pose, activity family, motion, independent actor condition cues, at most two severity-ranked equipment status cues, and modular recipe keys without defining animation frames.
- Knowledge is explicit: `current`, `stale`, `uncertain`, `unknown`, or `debug`.
- Environment records contain values only when the perspective is permitted to know them. Stale room observations carry only remembered values and bands.
- Effects carry a stable source, ground/world/alert plane, affected cells, knowledge, severity, intensity band, optional damage tags and timing, uncertainty, stack count, semantic visual key, and optional interaction targets. Management coloration and diagnostic readings are overlays.
- Selection identifies the semantic target and its complete selected footprint.
- CSS classes, DOM datasets, Canvas objects, draw calls, image instances, and asset paths are not scene data.
- The scene is never saved. Simulation state and observation memory remain authoritative.

The first Canvas prototype is available as a transient Debug renderer while the DOM map remains the default fallback. It draws visible and one-tile overscan `MapScene` cells plus unique entities, uses semantic presentation rules rather than CSS classes, scales its backing surface for the device pixel ratio, and redraws through invalidated animation frames. Camera navigation updates the persistent Canvas in place. Tile-aligned shared camera state is combined with a transient pixel offset for smooth WASD and grab panning; wheel zoom remains discrete and preserves the pointed map area, and responsive resizing preserves the viewed center. Shared coordinate transforms account for the active origin and zoom. Canvas pointer interaction normally resolves through the scene's ordered, knowledge-filtered interaction index; a current or Debug actor also supplies a transient rectangular hit region that follows its displayed body. It selects semantic targets by physical cell masks, highlights complete visible footprints, updates the keyboard cursor, cycles repeated clicks through crowded-cell targets from topmost to bottommost, exposes that same order through the HTML inspector, and never alpha-tests artwork or queries hidden simulation entities. The inspector preserves the exact clicked footprint cell instead of silently switching to a multi-tile subject's anchor. Delayed HTML tooltips consume the scene's semantic tooltip text. Room and access painters support Canvas left-drag input, construction retains click-to-toggle designation, middle drag remains camera movement, and overscan cells are not interactive. Generated individual placeholders and four development atlases now cover every semantic terrain, fixture, container, item, actor, corpse, effect, and marker family emitted by the current renderer; unresolved future keys and failed images retain the glyph/procedural presentation.

Authored entity sprites declare complete logical dimensions in horizontal tiles and vertical layers, plus an integer tile-anchor offset expressed in the oriented output rectangle and aligned to the scene entity's anchor cell. Physical orientation is normalized at the `MapScene` boundary into zero through three clockwise quarter turns and an independent mirror flag. Actor facing is separately normalized to North, East, South, West, or `none`; it never changes collision, footprint rotation, or navigation. Rotation occurs inside the oriented logical rectangle at every zoom level. The renderer draws a multi-tile sprite only when its oriented dimensions, anchor, and layer count exactly match the authoritative footprint bounds. Otherwise the full procedural footprint and anchor glyph remain visible and diagnostics report the mismatch. Tall assets draw normally on their anchor layer; other occupied layers use a translucent crossed slice instead of repeating the complete sprite.

## Actor State Contract

Actor visuals consume simulation behavior through `actor-visual-state.js`; they do not run a presentation-only behavior system.

- Facing prefers a current combat target, then the next movement cell, then an interaction target, then the last observed facing. Symmetric or unknown actors may use `none`; humanoids default South when no direction exists.
- The canonical primary poses are `idle`, `moving`, `working`, `feeding`, `attacking`, `guarded`, `fleeing`, `quiescent`, `strained`, `recovering`, and `prone`.
- Pose precedence is terminal state, combat response, containment strain, feeding, work, movement, recovery, quiescence, then idle.
- Activity retains its exact simulation ID and readable label while also declaring the broad family `idle`, `movement`, `work`, `feeding`, `combat`, `containment`, `recovery`, or `terminal`.
- Injury, critical condition, compression, stress, and uncertainty are independent condition cues. They do not replace a meaningful active pose.
- Current state is derived. Only observation memory stores last-known facing, pose, activity, and condition cues for later knowledge-safe rendering.
- Canvas draws restrained static direction, pose, and condition marks. Transition timing, interpolation, loops, and reactions belong to the animation clock rather than this state contract.

## Animation Clock And Movement

Presentation uses a monotonic real-time clock anchored to the latest authoritative simulation clock, current speed, pause state, and transient timeline revision. Changing speed or pausing first commits elapsed real time under the old rate and then reanchors presentation. Loading, resetting, relocating, replanning, replacing an activity, or manually skipping time creates a discontinuity; the resulting scene snaps instead of visually traversing time that the simulation already resolved. Presentation time is transient and can never advance tasks, collision, attacks, occupancy, or any other rule.

`MapScene` actor motion records carry a stable segment ID, state and intent, knowledge-filtered origin and destination cells, origin and destination orientations, segment start and arrival times, and a revision. Action records use charge, active, and recovery timestamps while simulation remains responsible for deciding when effects occur.

- Current and Debug horizontal movement may interpolate linearly between authoritative tiles. Stale, uncertain, and unknown actors remain fixed.
- A segment interpolates only when its real display duration is at least 80 ms. Faster segments snap, preventing accelerated time from becoming a blur.
- The complete body, actor cues, selection outline, and supplemental known-actor hit bounds translate together. Collision and the cell interaction index remain discrete.
- Rotation snaps to authoritative orientation. Vertical travel stays layer-safe and may fade at its origin instead of floating between z-layers.
- Pausing freezes the sampled presentation time. Reduced-motion preference disables interpolation.
- Canvas requests another animation frame only while an eligible visible segment is active. The DOM renderer remains tile-snapped.

## Render Order And Occlusion

The shared render-order policy is renderer-neutral and deterministic. The ascending passes are background `0`, terrain `10`, ground fluids and hazards `20`, paths and designations `30`, loose items `40`, remains `45`, fixtures and barriers `50`, actors `60`, overhead structures `70`, world effects `80`, fog and knowledge treatment `90`, alerts and task markers `100`, selection `110`, and cursor or active-tool preview `120`.

- Entities in the same pass sort by their southern footprint edge, then x-coordinate, z-coordinate, and stable ID.
- A physical entity is drawn once per selected layer even when its footprint contains several cells.
- Selecting an obscured entity fades only later-drawn entities whose occupied cells overlap its selected-layer footprint. The selection outline remains above every physical and knowledge layer without moving the selected sprite out of physical order.
- Overhead fixtures remain in their physical pass but become a restrained cutaway where they overlap the cursor or selected footprint.
- Ground and world effects have separate semantic planes. Alerts render above fog only after knowledge filtering, so their ordering cannot reveal an unknown event.
- Crowded-cell target order is derived from the same visible render keys. Independently visible targets precede contained or related records, and repeated Canvas clicks cycle through the known list.

## Effects, Hazards, And Status Indicators

Effects communicate discrete physical state and actionable information rather than decorating every continuous simulation value.

- Ground effects include known physical spills and surface hazards. The physical stack remains the sole item target; its effect is a non-interactive decoration.
- World effects include known structural failure and authoritative timed abilities. Fire, electricity, magic, and damage-tag styles exist as procedural or glyph fallbacks but appear only when simulation state actually supplies them.
- Alert effects include current, stale, or uncertain incidents plus the selected/next, urgent, or blocked task endpoint. Player-authored task markers remain known; physical hazards still obey perception.
- Multiple incidents or tasks on one cell collapse to one highest-priority marker with a count. Every related target remains in the scene interaction index.
- Uncertain alerts use an area ring and reduced confidence instead of an exact-looking hidden location. Stale alerts are subdued and dashed.
- Current fixtures, containers, and doors may carry at most two status cues ordered by criticality. Breach and serious blockage outrank power, capacity, impairment, and damage warnings. Routine switched-off state stays textual.
- Actors retain their separate pose and condition-cue grammar. Status badges do not replace injury, stress, compression, movement, work, feeding, guarding, or combat poses.
- Selection and cursor remain above every effect. Shape, glyph, pattern, and placement carry meaning alongside color so later accessibility modes can strengthen the same contract.
- Static presentation is the default. A later authoritative timed effect may request restrained event-driven animation, but effects do not create a permanent frame loop.

## Rendering And Asset Boundaries

- Simulation state does not contain Canvas objects, DOM nodes, image instances, or draw commands.
- A discovery-aware visual selector creates the visual recipe from authoritative state and observation records.
- The asset manifest resolves semantic module keys into images and metadata.
- The manifest owns repository-relative image paths, source rectangles, logical tile/layer dimensions, integer tile anchors, transform capabilities, aliases, and category fallbacks; `MapScene` carries only semantic keys.
- Image loading is asynchronous and cached. Its `idle`, `loading`, `ready`, `partial`, and `error` diagnostics never block simulation startup.
- The renderer assembles procedural geometry and authored raster modules into an offscreen surface.
- The result is cached until relevant recipe inputs change.
- Camera movement and ordinary animation reuse cached visuals.
- Rendering hundreds of actors must not rebuild every modular body every frame.
- Missing assets fall back to procedural shapes or glyphs without breaking interaction.

The approved long-term renderer remains hybrid: Canvas for the physical map and HTML/CSS for menus, inspectors, policies, logs, dialogs, tooltips, and accessibility controls.

## Accessibility And Fallback

The existing DOM glyph map remains a supported fallback rather than disposable scaffolding. Canvas also has a glyph-first presentation that deliberately skips sprite drawing while preserving procedural terrain, semantic entity glyphs, actor and equipment cues, effects, selection, and interaction.

Renderer parity is guarded by a deterministic visual catalog rather than screenshots of procedural live runs. The catalog covers terrain and portals, knowledge and physical light, environmental and alert treatments, crowded targets, z-layer cross-sections, multi-tile sprites, high contrast, marker scaling, several tile sizes, and compact-desktop layout. DOM and Canvas keep separate approved screenshots, while a zero-tolerance semantic report requires the same visible subjects, interaction order, selection, cursor, tooltip content, and assistive summary. Linux Chromium is the baseline platform. Screenshot changes require explicit review and never by themselves authorize replacing the DOM fallback.

The renderer-independent HTML accessibility panel persists local preferences for sprite-with-fallback or glyph-first map style, reduced motion, standard or high contrast, reduced/standard/strong effect intensity, 8/12/16-pixel minimum tile size, and 100/125/150-percent marker scale. Operating-system reduced-motion and forced-color settings take precedence. A readable zoom floor clamps every zoom input consistently. Reduced effects retain a minimum visibility for serious hazards.

Color is never the sole signal. Routes, designations, hazards, effects, equipment status, stale or uncertain knowledge, selection, and cursor state retain distinct glyphs, shapes, patterns, line styles, placement, or outlines. The map exposes one polite assistive description for the keyboard cursor's coordinates, known cell details, and selectable target rather than adding every tile to the tab order.

The sprite renderer must preserve all interaction and information available in glyph mode. Visual richness may add atmosphere and recognition, but it may not remove textual identification or keyboard operation.

## Deferred Decisions

This specification does not yet define:

- Final production sprite filenames or atlas packing
- Final animation frame counts
- Final authored fog and production-quality lighting/environment shader artwork beyond the implemented semantic treatment
- Final authored cross-layer slice artwork for tall bodies
- Final swatch values

Those decisions belong to later production-art and accessibility work and should conform to this visual language.
