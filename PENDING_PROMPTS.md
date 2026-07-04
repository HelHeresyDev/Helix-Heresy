# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Inventory, Stockpile, and Room-Local Resource Map Workflow
2. Container and Specimen Management Map Workflow
3. Construction Designation and Room Assignment Map Workflow
4. Combat and Emergency Response Map Workflow
5. Journal, Log, and Message Feed Integration Pass
6. Menu Hierarchy and Screen Manager System
7. UI State Persistence and Player Preference System
8. Map Renderer Boundary and Future Canvas/Sprite Preparation
9. Black Market Byproduct Economy System

---

## 1. Inventory, Stockpile, and Room-Local Resource Map Workflow

Rework inventory and room-local resources for the map-first interface.

The game now has lab-wide totals backed by room-local stockpiles. A map-first UI should help the player understand where resources physically are, what room has access, what needs hauling, and what commands will consume or move supplies.

This system should answer questions like:
- How should the player view resources by room?
- How should Storage Room stockpiles appear from the map?
- How should room-local materials appear in inspectors?
- How should hauling requirements appear before starting an action?
- How should commands explain that resources exist elsewhere and will need hauling?
- Should stockpile overlays or resource filters exist?
- How should inventory item history remain accessible?
- How should collected byproducts, harvested materials, tools, feedstocks, waste, and corpses differ in the UI?

The desired result is a resource workflow where inventory remains readable as a ledger, but the player also understands physical availability and room-local logistics from the map.

Before coding, discuss inventory screen placement, room resource inspectors, hauling previews, overlays, stockpile focus, and which resource types need map workflows first.

---

## 2. Container and Specimen Management Map Workflow

Rework container and specimen management around map selection.

Containers and specimens are central to the game. The player should be able to select a container or slime on the map, inspect it, move it, feed it, harvest it, stage it, release it, recapture it, assign it, Analyze it, or respond to problems through contextual workflows.

This system should answer questions like:
- How should contained slimes appear on the map if the container owns the footprint?
- How should the player select a slime inside a container from the map?
- How should container contents, compatibility, containment risk, residue, byproduct collection, and breach state appear in inspectors?
- How should specimen actions move from old panels into context commands?
- How should release, move, feed, harvest, assign job, Analyze, and containment actions work from selection?
- How should warnings appear for dangerous or risky specimen commands?
- How should multiple slimes in one container be handled?

The desired result is a map-first specimen workflow where the player can manage creatures from their physical location instead of treating specimen management as a separate list game.

Before coding, discuss container selection, contained-specimen selection, contextual actions, risk warnings, multi-occupant containers, and which specimen commands should move first.

---

## 3. Construction Designation and Room Assignment Map Workflow

Rework construction and room assignment into a map-first workflow.

Construction already begins from the physical blueprint: the player designates earth tiles to excavate, queues excavation, and assigns room purpose afterward. The UI should make that workflow feel like a natural map tool rather than a panel action.

This system should answer questions like:
- How does the player enter construction/designation mode?
- How are dig tiles selected, painted, confirmed, cancelled, or cleared?
- How are planned dig tiles, rough rooms, assigned rooms, door links, and invalid designations shown?
- How does the player assign or change room purpose from the map?
- How should construction costs, time, access, warnings, and future secrecy/noise concerns appear?
- How should room expansion differ from creating a new room?
- How should the UI avoid overbuilding a full base-builder too early?

The desired result is a construction workflow that feels like the beginning of a Dwarf Fortress-style map interface while staying limited to the prototype's current excavation and room-purpose model.

Before coding, discuss construction mode, designation tools, confirmation flow, map highlights, room assignment inspector, and the smallest pass that improves construction usability.

---

## 4. Combat and Emergency Response Map Workflow

Create a map-first workflow for combat and emergency response.

Combat and incidents are spatial. The player should be able to see danger on the map, select actors or incidents, inspect threat state, issue response commands, and understand paths, adjacency, and contact. The first-pass combat framework should become readable and actionable through the map-first UI.

This system should answer questions like:
- How should active combat be shown on the map?
- How should target selection work for Strike or future combat abilities?
- How should adjacency, contact, range, and accessible container targets be communicated?
- How should emergency commands appear for incidents, escaped slimes, breached containers, hostile creatures, or dangerous rooms?
- How should pause/time-speed behavior integrate with combat UI?
- How should combat intent, threat band, actor health/condition, and available responses appear without exposing hidden values?
- How should the UI distinguish combat, containment response, cleanup, repair, and evacuation?

The desired result is a combat/emergency workflow where the player can respond spatially instead of hunting through panels while the lab is on fire or a slime is loose.

Before coding, discuss combat map markers, target selection, response commands, time behavior, threat inspectors, and what current combat actions should be surfaced first.

---

## 5. Journal, Log, and Message Feed Integration Pass

Integrate the journal, event log, messages, discoveries, and notifications into the map-first interface.

The current prototype has many systems that generate observations, inventory histories, incident alerts, discoveries, warnings, and event log entries. A map-first UI needs a cleaner message hierarchy so the player knows what is urgent, what is historical, what is discovery-related, and what is routine accounting.

This system should answer questions like:
- Where does the main event/message feed live?
- What belongs in the event log versus incident alerts versus inventory history versus journal discoveries?
- How does the player filter messages?
- How do map locations link from log entries?
- How should discoveries and scientific observations be surfaced without interrupting every task?
- How should routine resource accounting avoid spamming the main feed?
- How should the journal remain useful in a map-first interface?

The desired result is a cleaner information flow where important events are visible, routine accounting stays in history/tooltips, and map-linked messages can focus the relevant room, object, specimen, or incident.

Before coding, discuss message categories, filtering, map linking, journal placement, history boundaries, and which existing messages should be migrated or reclassified.

---

## 6. Menu Hierarchy and Screen Manager System

Create a screen manager and menu hierarchy for the map-first interface.

As the interface becomes more structured, the game needs a clear way to manage major screens, drawers, overlays, modal dialogs, command menus, inspectors, and debug tools. The player should understand where they are in the UI and how to return to the map.

This system should answer questions like:
- What are the major screens?
- What remains part of the main map shell?
- What opens as a side inspector, bottom drawer, command menu, modal, overlay, or full-screen management view?
- How does the UI handle nested menus?
- How does Escape/back behavior work?
- How should debug/cheat tools fit without polluting normal gameplay UI?
- How should screen state interact with hotkeys, selection, time controls, and autosave/import/export?

The desired result is a menu hierarchy that can support growing complexity without turning the UI into a maze of panels.

Before coding, discuss screen categories, navigation rules, Escape/back behavior, modal rules, debug placement, and how to migrate existing panels gradually.

---

## 7. UI State Persistence and Player Preference System

Create a UI state and preference system for the map-first interface.

As the interface gains inspectors, overlays, filters, command menus, split panes, hidden panels, hotkeys, and debug modes, the game should remember reasonable UI preferences without mixing them into simulation state.

This system should answer questions like:
- Which UI state should persist across saves?
- Which UI state should reset each session?
- Should map zoom, pan, selected overlay, pinned inspector, collapsed drawers, message filters, and panel widths be saved?
- How should player preferences differ from run-specific UI state?
- How should debug options be stored?
- How should the game avoid corrupting saves with transient UI details?
- How should import/export treat UI preferences?

The desired result is a clean separation between game state and UI state. The simulation should remain the source of truth, while player interface preferences make the map-first UI comfortable to use.

Before coding, discuss persistent versus transient UI state, storage location, defaults, reset behavior, save/import implications, and which preferences matter first.

---

## 8. Map Renderer Boundary and Future Canvas/Sprite Preparation

Create a clean boundary around map rendering so the current DOM map can eventually be replaced or supplemented by Canvas and sprites.

The final version may be simulation-heavy, may need to display 2D sprites, and may need to handle hundreds of actors or more. The current DOM map is fine for the prototype, but simulation and UI logic should not depend on DOM tiles in a way that makes future rendering upgrades painful.

This system should answer questions like:
- What is the boundary between map state, map view model, and map renderer?
- Which code currently assumes DOM tiles are the map?
- What data should a renderer receive each frame or render pass?
- How should click, hover, selection, overlays, highlights, and tooltips pass through the renderer boundary?
- How can the current DOM renderer be preserved while preparing for Canvas?
- What would trigger a future Canvas migration?
- How should future 2D sprites, zoom/pan, animation, dense actor rendering, and combat overlays fit?
- How should renderer tests avoid depending on one rendering technology forever?

The desired result is not to implement Canvas immediately unless Codex strongly recommends it after discussion. The desired result is to prevent the current map UI from becoming so DOM-coupled that Canvas or sprites require a rewrite of simulation, pathfinding, object placement, and selection.

Before coding, discuss renderer boundaries, current coupling, view model shape, event routing, Canvas migration triggers, and the smallest refactor that keeps the DOM map working while preparing for future rendering.

---

## 9. Black Market Byproduct Economy System

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
