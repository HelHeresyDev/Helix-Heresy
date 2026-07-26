# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Map Selection, Hit Testing, and Contextual Action Parity
2. Sprite Asset Manifest and Loading Pipeline
3. Sprite Anchors, Orientation, and Multi-Tile Scaling
4. Render Layers, Occlusion, and Draw Order
5. Actor Facing, Pose, and Activity States
6. Animation Clock and Movement Interpolation
7. Player Knowledge, Fog, and Last-Known Visuals
8. Lighting, Environmental Tinting, and Visibility
9. Map Effects, Hazards, and Status Indicators
10. Glyph Fallback and Accessibility Modes
11. Large-Population Rendering Benchmark and Culling
12. Automated Visual Regression and Renderer-Parity Tests

The intended long-term frontend is hybrid. Canvas should render the physical map, terrain, sprites, animation, lighting, effects, and map overlays. HTML/CSS should continue to render menus, inspectors, records, policies, dialogs, tooltips, and accessibility controls. Simulation state and rules must remain independent of both renderers. Do not remove the current DOM map renderer until the Canvas renderer has demonstrated behavioral and visual parity.

---

## 1. Map Selection, Hit Testing, and Contextual Action Parity

Route Canvas pointer coordinates back into the existing selection and command systems. Preserve top-priority entity selection, multi-entity `Also here` handling, multi-tile highlighting, hover information, keyboard selection, inspectors, contextual commands, and player-knowledge restrictions.

## 2. Sprite Asset Manifest and Loading Pipeline

Create a stable asset manifest for terrain, fixtures, items, actors, effects, and UI-map markers. Support loading status, missing-asset fallbacks, sprite metadata, caching, future atlases, development placeholders, and asset validation without hard-coding image paths throughout game rules.

## 3. Sprite Anchors, Orientation, and Multi-Tile Scaling

Define how sprites attach to tile anchors, rotate or mirror, span multiple horizontal tiles, occupy multiple z-layers, and align with interaction points. Large actors and equipment must remain physically and visually consistent at every supported zoom level.

## 4. Render Layers, Occlusion, and Draw Order

Define deterministic ordering for terrain, floors, fluids, items, corpses, fixtures, actors, overhead structures, effects, fog, paths, alerts, cursor, and selection. Establish how tall or overlapping entities occlude each other and how the player inspects hidden objects on crowded tiles.

## 5. Actor Facing, Pose, and Activity States

Add renderer-neutral facing and pose state derived from movement, combat, feeding, quiescence, work, injury, containment pressure, and other meaningful activities. Visual states should reflect simulation behavior without creating a parallel animation-only AI system.

## 6. Animation Clock and Movement Interpolation

Separate smooth visual interpolation from discrete simulation time. Support variable game speeds, pause, time skips, movement between tiles, ability charge and recovery, short reactions, and animation cancellation without allowing presentation timing to change simulation outcomes.

## 7. Player Knowledge, Fog, and Last-Known Visuals

Render only what the scientist currently knows. Define unexplored darkness, currently perceived entities, stale last-known positions, uncertain detections, remembered terrain, changed-but-unobserved spaces, Debug omniscience, and visual decay without leaking hidden simulation state.

## 8. Lighting, Environmental Tinting, and Visibility

Translate the existing physical light and environment fields into readable map visuals. Cover darkness, local light sources, temperature and mana overlays, airborne substances, visibility limits, selected diagnostic overlays, and color treatment that does not obscure sprites or encode inaccessible information.

## 9. Map Effects, Hazards, and Status Indicators

Create a restrained renderer-neutral effect layer for spills, airborne hazards, fire, electricity, magic, damage, combat, structural failure, alerts, paths, and task markers. Effects should communicate important physical events without turning every continuously simulated value into visual noise.

## 10. Glyph Fallback and Accessibility Modes

Preserve a complete glyph-based map mode alongside sprites. Add options for reduced motion, high contrast, color-independent indicators, readable zoom limits, and alternate effect intensity so the Canvas transition does not sacrifice the prototype's clarity or accessibility.

## 11. Large-Population Rendering Benchmark and Culling

Benchmark the Canvas renderer with large maps, hundreds of actors, multi-tile bodies, effects, overlays, and frequent simulation updates. Establish frame-time budgets, viewport culling, dirty-state rules, allocation limits, and evidence-based thresholds before considering WebGL or another rendering layer.

## 12. Automated Visual Regression and Renderer-Parity Tests

Build deterministic screenshots and semantic parity tests for representative map states, zoom levels, z-layers, selections, overlays, knowledge states, crowded tiles, large actors, and responsive viewports. Canvas should replace the DOM map only after required interactions and visible information remain equivalent.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
