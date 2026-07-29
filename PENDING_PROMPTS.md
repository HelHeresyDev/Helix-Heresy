# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Large-Population Rendering Benchmark and Culling
2. Automated Visual Regression and Renderer-Parity Tests

The intended long-term frontend is hybrid. Canvas should render the physical map, terrain, sprites, animation, lighting, effects, and map overlays. HTML/CSS should continue to render menus, inspectors, records, policies, dialogs, tooltips, and accessibility controls. Simulation state and rules must remain independent of both renderers. Do not remove the current DOM map renderer until the Canvas renderer has demonstrated behavioral and visual parity.

---

## 1. Large-Population Rendering Benchmark and Culling

Benchmark the Canvas renderer with large maps, hundreds of actors, multi-tile bodies, effects, overlays, and frequent simulation updates. Establish frame-time budgets, viewport culling, dirty-state rules, allocation limits, and evidence-based thresholds before considering WebGL or another rendering layer.

## 2. Automated Visual Regression and Renderer-Parity Tests

Build deterministic screenshots and semantic parity tests for representative map states, zoom levels, z-layers, selections, overlays, knowledge states, crowded tiles, large actors, and responsive viewports. Canvas should replace the DOM map only after required interactions and visible information remain equivalent.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
