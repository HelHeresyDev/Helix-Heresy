# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Slime AI Debugging and Behavior Readout System
2. Black Market Byproduct Economy System

---

## 1. Slime AI Debugging and Behavior Readout System

Create debugging tools and player-facing readouts for slime AI behavior.

As slime AI becomes more complex, the player and developer need to understand what a slime is doing and why. The game should expose broad, readable behavior state to the player while offering deeper debug information through cheats or development-only readouts.

The system should answer questions like:
- What behavior state should be visible on the specimen card?
- How should the UI explain a slime's current intent?
- How should the game show blocked goals, missing food, bad habitat, stress triggers, or unreachable targets?
- What AI debug data should be available for testing?
- How should behavior logs avoid spamming the event log?
- How should tests assert AI decisions reliably?
- How should readouts hide exact hidden formulas while still being useful?
- How should the readout help diagnose stuck pathing, invalid goals, or runaway behavior loops?

Player-facing readouts might be broad: Idle, Feeding, Seeking food, Stressed, Hiding, Testing container, Escaping, Fighting, Working, Recovering, or Blocked. Debug readouts can show more precise state, score weights, target IDs, paths, and blockers for development.

The desired result is a behavior readout and debug foundation that makes slime AI testable, understandable, and maintainable as more systems are added.

Before coding, discuss player-facing state labels, debug-only detail, test helpers, event-log boundaries, and how to surface AI problems without spoiling hidden biology.

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
