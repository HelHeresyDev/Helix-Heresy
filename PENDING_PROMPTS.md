# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Map Renderer Boundary and Future Canvas/Sprite Preparation
2. Black Market Byproduct Economy System

---

## 1. Map Renderer Boundary and Future Canvas/Sprite Preparation

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

## 2. Black Market Byproduct Economy System

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
