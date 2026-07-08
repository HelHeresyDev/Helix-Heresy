# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Add Middle-Mouse Drag Panning
2. Audit Map Hotkey Conflicts
3. Add Synthesis Tube Contextual Actions
4. Audit All Map Elements for Contextual Actions
5. Add Map Navigation Smoke Tests
6. Black Market Byproduct Economy System

---

## 1. Add Middle-Mouse Drag Panning

Allow the player to pan the map by holding the middle mouse button and moving the mouse.

Mouse panning should support quick visual navigation without requiring scrollbars or dragging unrelated UI elements. This should work alongside normal left-click selection and future right-click/context command behavior.

This system should answer questions like:
- Should middle-mouse drag pan the map exactly with cursor movement or use an accelerated drag?
- Should panning start immediately on middle mouse down, or after a small movement threshold?
- Should the browser's default middle-click behavior be suppressed only over the map?
- Should touchpad/touch panning be considered now or later?
- Should wheel scrolling pan, zoom, or remain unused for now?

The desired result is a reliable drag-to-pan interaction that feels physical and does not interfere with selecting tiles or opening contextual actions.

Before coding, discuss pointer behavior, browser-default suppression, cursor feedback, and whether drag panning should affect hover/tooltip state.

---

## 2. Audit Map Hotkey Conflicts

Audit current and planned keyboard controls for conflicts before adding more map navigation shortcuts.

The game now has time controls, menu hotkeys, command chains, overlay toggles, contextual actions, and soon map movement. The hotkey model should remain legible before the interface accumulates contradictory shortcuts.

This system should answer questions like:
- Which keys are global?
- Which keys only work on the map?
- Which keys only work inside a menu?
- Which keys are reserved for command chains?
- Should WASD take priority over letter menu shortcuts while the map is focused?
- How should the UI communicate available hotkeys without clutter?
- Which browser-native keys should be left alone?

The desired result is a documented hotkey policy that supports WASD panning, menu command chains, speed controls, overlays, and future combat/emergency controls without surprising the player.

Before coding, discuss global versus contextual hotkeys, focus rules, command chain precedence, and how shortcut hints should appear in the UI.

---

## 3. Add Synthesis Tube Contextual Actions

Add relevant contextual actions when the synthesis tube is selected from the map.

The synthesis tube is an important lab object, but selecting it currently does not surface useful commands. The map-based UI should make important objects actionable from selection rather than forcing the player to remember which management screen contains the relevant button.

This system should answer questions like:
- What actions should appear when the synthesis tube is selected?
- Should synthesis actions open the synthesis menu, queue a synthesis task, or both?
- Should disabled synthesis actions explain missing requirements?
- Should the tube show occupancy, current specimen, active task, reserved materials, and contamination/condition state?
- Should contextual actions differ between empty, occupied, active, blocked, or damaged tube states?
- Should selecting a specimen inside the tube focus the specimen or the tube first?

The desired result is that clicking the synthesis tube gives the player obvious, relevant actions and status without needing to hunt through old prototype panels.

Before coding, discuss which synthesis commands belong in the contextual panel, how disabled reasons should be shown, and whether this should be a targeted fix or part of a broader object-action audit.

---

## 4. Audit All Map Elements for Contextual Actions

Audit every selectable map element and add all relevant contextual actions.

The map is becoming the main interface surface. Anything the player can click should either expose useful commands, explain why no commands are available, or route the player to the correct menu. This audit should prevent important systems from becoming hidden behind old panel assumptions.

This system should cover map elements such as:
- doors
- containers
- pits
- collection stations
- synthesis tube
- storage objects
- loose creatures
- contained creatures
- corpses
- incidents
- construction and dig designations
- byproduct receptacles
- stockpiles
- room tiles
- tools and movable objects
- any other selectable entity currently represented on the map

This system should answer questions like:
- What is the most likely entity of interest on crowded tiles?
- Which actions belong directly in the contextual command panel?
- Which actions should open a management menu instead?
- How should disabled commands explain their requirements?
- Which map elements should have inspect-only behavior?
- Which actions should queue scientist tasks?
- Which actions should be immediate UI actions?
- Should debug-only actions appear when debug mode is enabled?

The desired result is a consistent map interaction model where selectable things have meaningful contextual commands and status readouts.

Before coding, discuss prioritization rules, action categories, disabled reasons, queueing behavior, and how much of the full audit should happen in one implementation pass.

---

## 5. Add Map Navigation Smoke Tests

Add smoke tests for the larger map, camera panning, keyboard movement, mouse drag panning, and contextual map actions.

The map is becoming central enough that navigation regressions will make the whole game feel broken. Tests should verify that the map remains visible, selectable, pannable, and usable after the 100x100 expansion and contextual action updates.

This system should answer questions like:
- What should be tested through DOM/Playwright versus direct state/model tests?
- How should tests confirm the camera moves without relying on fragile pixel-perfect assertions?
- How should tests verify selection still works after panning?
- How should tests verify synthesis tube contextual actions appear?
- How should tests cover disabled command reasons?
- Should tests include hotkey conflict checks?

The desired result is a small but useful smoke suite that protects map navigation and contextual action basics.

Before coding, discuss the most valuable smoke paths, test stability concerns, and whether this prompt should be implemented after all related map-navigation prompts or alongside them.

---

## 6. Black Market Byproduct Economy System

Create a black market economy system focused on selling natural byproducts and other illegal biological goods.

The black market should make the lab's strange outputs economically meaningful. Natural byproducts, harvested specimen materials, corpses, preserved tissues, commissioned creatures, and services can eventually become sources of money, reputation, suspicion, and risk.

This system should begin with byproducts because Collection Bay and byproduct coherence create a natural production pipeline. The market should care about what the substance is, how rare or dangerous it is, how pure or fresh it is, how much the buyer wants it, and how risky it is to move.

The system should answer questions like:
- Who buys slime byproducts and why?
- How are prices determined?
- How do rarity, danger, purity, output quality, and demand affect value?
- How does selling affect black market reputation?
- How does selling affect Suspicion?
- How are commissions different from freeform sales?
- How does the market avoid becoming a simple "sell all" button?
- How does the UI keep deals readable and flavorful?

The black market should feel illegal, useful, and dangerous. Selling weird substances should help fund the lab, but also create evidence trails, relationships, expectations, and exposure.

The desired result is an economy foundation where byproducts and biological materials are not just stockpiles, but part of a growing illicit network that can later support commissions, reputation tiers, rare buyers, scams, raids, and story escalation.

Before coding, discuss the market model, the first sellable goods, pricing philosophy, reputation, suspicion, and how much economy depth belongs in the first implementation.
