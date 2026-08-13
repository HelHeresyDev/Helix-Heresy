# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Chemical Recipes, Batch Provenance, and Product Classification
2. Open Market, Business Reputation, and Legal Fulfillment
3. Illegal Processed Goods and Black-Market Expansion
4. Front Company Operations, Corporate Records, and Cover Credibility
5. Above-Ground Sprite Generation and Visual Integration
6. Suspicion, Investigations, and Evidence Management
7. Campaign Objectives, Milestones, and End States
8. New-Run Onboarding and Contextual Tutorial
9. Sound Design, Notifications, and Accessibility Audit
10. Production Sprite Replacement and Art-Direction Pass

The intended long-term frontend is hybrid. Canvas should render the physical map, terrain, sprites, animation, lighting, effects, and map overlays. HTML/CSS should continue to render menus, inspectors, records, policies, dialogs, tooltips, and accessibility controls. Simulation state and rules must remain independent of both renderers. Keep the DOM Compatibility Map as a persistent fallback until a future separate removal decision.

---


## 1. Chemical Recipes, Batch Provenance, and Product Classification

Add tag- and phase-compatible chemical transformations whose physical intermediates and finished batches retain exact provenance, craftsmanship, contamination, hazards, packaging, assay/documentation status, waste, and legal classification.

## 2. Open Market, Business Reputation, and Legal Fulfillment

Add a lawful economy with finite wholesale purchase orders, business reputation, deadlines, quality/documentation requirements, exact finished-batch reservations, loading-bay fulfillment, reliable payment, and a legal ledger.

## 3. Illegal Processed Goods and Black-Market Expansion

Extend black-market offers and contracts from raw byproducts to typed manufactured contraband, preserving quality, provenance, physical reservations, contact preferences, payout, handling risk, and exposure.

## 4. Front Company Operations, Corporate Records, and Cover Credibility

Model the chemistry company's legal identity, operating state, declared activity, purchase/production/shipment/waste records, public and restricted spaces, and qualitative cover credibility derived from actual facility conditions and legitimate work.

## 5. Above-Ground Sprite Generation and Visual Integration

Generate and integrate a coherent development-quality bitmap sprite set for the Chemistry Front's surface terrain, building envelope, access/logistics fixtures, chemistry equipment, products, hazards, and exterior details while preserving semantic asset keys, footprint anchors, transforms, glyph fallbacks, and Canvas/DOM parity.

## 6. Suspicion, Investigations, and Evidence Management

Turn Suspicion into an active pressure system involving traces, records, witnesses, inspections, concealment, explanations, evidence handling, and escalating institutional responses.

## 7. Campaign Objectives, Milestones, and End States

Define short-, medium-, and long-term objectives, meaningful setbacks, branching milestones, success states, failure states, and reasons to begin another seeded run.

## 8. New-Run Onboarding and Contextual Tutorial

Teach the core discovery, containment, map, task, and research loops through optional contextual guidance that responds to player actions without obscuring the interface.

## 9. Sound Design, Notifications, and Accessibility Audit

Establish restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard and screen-reader coverage, and a complete accessibility review.

## 10. Production Sprite Replacement and Art-Direction Pass

Replace development placeholders with a coherent first production-quality sprite set while preserving semantic keys, footprint anchors, transforms, glyph fallbacks, and the approved visual language.

This is intentionally deferred until late production. Continue creating coherent placeholder assets when new semantic map objects need them; do not begin the final art-replacement pass merely because placeholders expand.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
