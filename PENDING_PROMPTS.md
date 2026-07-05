# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Management Menus and Top-Level Navigation
2. Creature Records Menu
3. Task and Queue Management Menu
4. Inventory, Resources, and Room Stockpile Menus
5. Policies, Automation, and Debug Menus
6. Message History and Alert Feed
7. Map Overlay and Legend Menu
8. Remove Persistent Prototype Panels
9. Keyboard Navigation and Menu Flow Polish
10. Black Market Byproduct Economy System

---

## 1. Management Menus and Top-Level Navigation

Replace the old tab/panel mentality with top-level management menus suitable for a Dwarf Fortress or RimWorld style interface.

Management screens should be opened intentionally from the map shell, not always occupy screen space. Menus can include Creatures, Tasks, Inventory, Rooms, Policies, Records, Messages, Construction, Combat, Debug, and future Market screens.

The system should answer questions like:
- What top-level categories should exist?
- Should menus be full-screen overlays, windows, drawers, or a mix?
- Should time continue while menus are open?
- Should menus be searchable or filterable?
- How should Escape, Back, and close behavior work?
- How should menu state reset or persist between sessions?

The desired result is a structured menu system that can scale to many future screens without returning to disconnected prototype panels.

Before coding, discuss category names, menu behavior, whether menus pause time, and which existing tabs should be migrated first.

## 2. Creature Records Menu

Move creature lists, specimen sheets, discovered traits, skills, jobs, status, lineage, corpses, and released/contained state into a dedicated creature records menu.

Creatures still physically exist on the map, in containers, in pits, or as corpses, but the records menu should let the player review known biological information across the lab.

The system should answer questions like:
- How should living, deceased, released, contained, assigned, and missing creatures be grouped?
- How should the creature record avoid revealing hidden information?
- Should clicking a creature record focus the map location if known?
- How should Analyze-discovered skill information appear?
- How should job suitability, activity, condition, lineage, and inventory outputs be organized?
- How should corpses and necropsy records relate to living creature records?

The desired result is a clean creature-management screen that supports both map-first play and record-keeping.

Before coding, discuss list structure, filtering, unknown information, map focus behavior, and which existing creature panels should be retired.

## 3. Task and Queue Management Menu

Move scientist queue, task details, blocked tasks, path preview, cancellation, priorities, and future work orders into a dedicated Tasks menu.

The normal queue should remain scientist-only unless the design later introduces directly controlled agents. Facility processes, slime activities, station filling, and autonomous creature behavior should appear in their own records or activity readouts rather than the scientist queue.

The system should answer questions like:
- What task information needs to be visible at a glance?
- Should path previews appear only when a movement overlay is active?
- How should blocked, waiting, active, and completed tasks be displayed?
- Should the player reorder tasks now or later?
- How should cancelled tasks clean up partial state?
- How should queued compound actions be shown?

The desired result is a task management screen that supports direct scientist control without pretending the player controls every creature.

Before coding, discuss task grouping, cancellation, reordering, path display, and how to remove the old queue drawer once obsolete.

## 4. Inventory, Resources, and Room Stockpile Menus

Move inventory, resources, tools, collected byproducts, harvested materials, local stockpiles, pit contents, and room supply knowledge into map-aware inventory menus.

The current global totals are readable, but future play should care where supplies physically are, when they were last inventoried, and whether they are accessible.

The system should answer questions like:
- How should global totals and room-local stockpiles be shown together?
- How should last-inventoried knowledge be represented?
- Should selecting an inventory item highlight map locations where it is known to exist?
- How should tools, byproducts, feedstock, waste, residue, and harvested materials be grouped?
- How should Collection Bay receptacles and overflow appear?
- How should hauling needs be explained from inventory views?

The desired result is an inventory system that supports physical logistics without cluttering the main map.

Before coding, discuss grouping, map focus behavior, last-known inventory language, and how this menu should support future black market sales.

## 5. Policies, Automation, and Debug Menus

Move automation policies and debug tools into dedicated menus behind the map shell.

Policies should eventually cover feeding, corpse handling, offspring handling, collection transfers, job automation, room behavior, alerts, and many future systems. Debug tools should remain available during prototype testing but should not shape the normal player interface.

The system should answer questions like:
- How should policy categories be organized?
- Should individual slime automation exclusions live in Policies, Creature Records, or both?
- Which prototype cheats belong in Debug versus testing-only utilities?
- Should Debug default on during prototype testing but remain visually separate?
- How should policy effects explain themselves?
- How should future per-room and per-creature exceptions fit?

The desired result is a scalable policy/debug structure that keeps testing tools useful without contaminating the main play surface.

Before coding, discuss policy categories, debug visibility, exception rules, and how to prevent the menu from becoming an unstructured settings pile.

## 6. Message History and Alert Feed

Create a proper message history menu and a small non-intrusive live alert feed.

The map shell should show only recent important messages in a compact transparent feed. Full history should live in a dedicated menu with filters. Routine task accounting should stay out of the main feed but can remain in full history.

The system should answer questions like:
- Where should the compact feed live on the full-screen map?
- How many recent messages should it show?
- What events are important enough for the live feed?
- How should message filters work in the full history menu?
- How should acknowledged, stale, and manually resolved incidents appear?
- Should critical non-combat incidents pause/slow time like combat?

The desired result is clear situational awareness without flooding the main map.

Before coding, discuss feed placement, message categories, filters, pause/slow rules, and what counts as routine versus notable.

## 7. Map Overlay and Legend Menu

Move overlay controls, legends, filters, and debug visibility into a menu that supports map-first play.

Existing overlays such as Incidents, Combat, Resources, Movement, Construction, and future AI/perception/debug overlays should be easy to toggle and understand without permanently occupying panel space.

The system should answer questions like:
- Should overlays be controlled from a radial menu, toolbar, command palette, or management menu?
- Should overlay legends appear only when active?
- Should overlay hotkeys exist now?
- How should selected-resource overlays choose which resource/category to show?
- How should debug-only overlays be separated from normal player knowledge?
- How should known versus actual map information be represented?

The desired result is an overlay system that helps players read the lab without giving free information or crowding the screen.

Before coding, discuss overlay access, legends, filtering, hotkeys, and debug separation.

## 8. Remove Persistent Prototype Panels

After the key map menus exist, remove or retire the old persistent prototype panels.

This pass should clean up redundant UI surfaces, duplicate buttons, layout scaffolding, outdated tabs, and code paths that only existed to support the old panel-heavy layout.

The system should answer questions like:
- Which panels are fully obsolete after the menu migration?
- Which components should be reused inside menus?
- Which duplicated commands should be removed?
- Which CSS layout rules can be simplified?
- Which tests need to move from panel assumptions to map/menu assumptions?
- What compatibility shims should be deleted because old saves are not a priority?

The desired result is a cleaner UI architecture where the map shell, menus, inspectors, commands, and overlays are the real interface.

Before coding, discuss removal scope, reusable components, test changes, and how to avoid deleting useful debugging surfaces too early.

## 9. Keyboard Navigation and Menu Flow Polish

Polish keyboard navigation, command flow, and menu state for the map-first interface.

The player should be able to pause, change speed, open common menus, move through command lists, inspect selected entities, close/back out of menus, and operate common map commands without relying only on mouse clicks.

The system should answer questions like:
- Which hotkeys should be reserved for core actions?
- Should hotkeys be visible in menus?
- How should keyboard focus work when menus open and close?
- Should the map support keyboard cursor movement now?
- How should Escape behave across map, menus, nested inspectors, and command prompts?
- Should keybindings be remappable later?

The desired result is an interface foundation that can eventually support dense Dwarf Fortress style command play without sacrificing mouse usability.

Before coding, discuss hotkey set, focus behavior, Escape/back rules, accessibility concerns, and which keyboard affordances belong in the first pass.

## 10. Black Market Byproduct Economy System

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
