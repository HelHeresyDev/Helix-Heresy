# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Laboratory Expansion and Procedural Excavation Progression
2. Research Projects and Technology Unlocks
3. Experimental Instruments and Physical Diagnostic Workflows
4. Genetics Experiment Planning and Result Comparison
5. Advanced Slime Reproduction and Heredity
6. Creature Needs, Habitats, and Long-Term Welfare
7. Large-Population Slime AI and Group Behavior
8. Containment Breaches and Emergency Response
9. Tactical Combat Actions, Injuries, and Recovery
10. Scientist Equipment, Clothing, and Loadouts
11. Expanded Production Chains and Material Processing
12. Utility Networks, Power Failures, and Maintenance
13. Black-Market Contracts, Deadlines, and Consequences
14. Suspicion, Investigations, and Evidence Management
15. Campaign Objectives, Milestones, and End States
16. New-Run Onboarding and Contextual Tutorial
17. Sound Design, Notifications, and Accessibility Audit
18. Production Sprite Replacement and Art-Direction Pass

The intended long-term frontend is hybrid. Canvas should render the physical map, terrain, sprites, animation, lighting, effects, and map overlays. HTML/CSS should continue to render menus, inspectors, records, policies, dialogs, tooltips, and accessibility controls. Simulation state and rules must remain independent of both renderers. Keep the DOM Compatibility Map as a persistent fallback until a future separate removal decision.

---

## 1. Laboratory Expansion and Procedural Excavation Progression

Turn excavation and construction into a longer laboratory-expansion arc with meaningful spatial constraints, geological variation, room planning, and escalating infrastructure requirements.

## 2. Research Projects and Technology Unlocks

Add explicit research projects that consume observations, specimens, scientist time, instruments, and resources to unlock new capabilities without bypassing the discovery loop.

## 3. Experimental Instruments and Physical Diagnostic Workflows

Implement physical diagnostic instruments, sampling procedures, calibration, uncertainty, and workflows that justify increasingly precise environmental and biological information.

## 4. Genetics Experiment Planning and Result Comparison

Provide tools for defining hypotheses, organizing controlled genetic experiments, comparing subjects and results, and recording evidence without revealing undiscovered mappings automatically.

## 5. Advanced Slime Reproduction and Heredity

Expand splitting, recombination, mutation, brood relationships, inherited traits, and lineage records into a predictable-but-discoverable breeding system.

## 6. Creature Needs, Habitats, and Long-Term Welfare

Deepen nutrition, rest, stimulation, social contact, environmental fit, illness, stress, and ethical tradeoffs so long-term creature care affects behavior and research.

## 7. Large-Population Slime AI and Group Behavior

Develop scalable local coordination, flocking or clustering, competition, cooperation, territorial behavior, and group responses for laboratories containing many autonomous creatures.

## 8. Containment Breaches and Emergency Response

Create multi-stage containment emergencies with alarms, lockdowns, evacuation, recapture, cleanup, repair, evidence, and lasting consequences derived from physical simulation state.

## 9. Tactical Combat Actions, Injuries, and Recovery

Expand tactical positioning, attacks, defenses, abilities, wounds, treatment, incapacitation, and recovery while keeping combat readable and integrated with ordinary laboratory work.

## 10. Scientist Equipment, Clothing, and Loadouts

Add physical equipment slots, protective clothing, tools, consumables, encumbrance, preparation, storage, and loadout decisions that affect laboratory and field actions.

## 11. Expanded Production Chains and Material Processing

Build multi-stage recipes, intermediate materials, quality propagation, byproducts, workstation dependencies, bills, stock targets, and physical hauling into a broader production economy.

## 12. Utility Networks, Power Failures, and Maintenance

Deepen electricity, ventilation, drainage, heat, mana, fuel, capacity, faults, redundancy, inspection, repair, and scheduled maintenance across connected physical networks.

## 13. Black-Market Contracts, Deadlines, and Consequences

Add negotiated contracts, delivery requirements, deadlines, reputation, unreliable contacts, payment risk, contraband logistics, and consequences for failed or suspicious deals.

## 14. Suspicion, Investigations, and Evidence Management

Turn Suspicion into an active pressure system involving traces, records, witnesses, inspections, concealment, explanations, evidence handling, and escalating institutional responses.

## 15. Campaign Objectives, Milestones, and End States

Define short-, medium-, and long-term objectives, meaningful setbacks, branching milestones, success states, failure states, and reasons to begin another seeded run.

## 16. New-Run Onboarding and Contextual Tutorial

Teach the core discovery, containment, map, task, and research loops through optional contextual guidance that responds to player actions without obscuring the interface.

## 17. Sound Design, Notifications, and Accessibility Audit

Establish restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard and screen-reader coverage, and a complete accessibility review.

## 18. Production Sprite Replacement and Art-Direction Pass

Replace development placeholders with a coherent first production-quality sprite set while preserving semantic keys, footprint anchors, transforms, glyph fallbacks, and the approved visual language.

This is intentionally deferred until late production. Continue creating coherent placeholder assets when new semantic map objects need them; do not begin the final art-replacement pass merely because placeholders expand.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
