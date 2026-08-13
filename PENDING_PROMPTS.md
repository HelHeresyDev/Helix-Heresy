# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue. The prompts and their order are recommendations based on the current state of the prototype, not immutable commitments. Reevaluate the order whenever implementation reveals a more important dependency or the developer changes direction.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

When Codex asks design or clarifying questions, each question should include Codex's recommended answer and enough brief reasoning to explain that recommendation. This lets the developer answer "yes" when the recommendation is acceptable and expand only when a different direction is desired. Do not present unanswered questions without also offering a concrete recommendation unless the available information genuinely does not support one.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. External Detection, Witness Reports, and Suspicion Refactor
2. Investigation Cases, Leads, and Deadlines
3. Evidence Handling and Concealment Work
4. Inspections, Visitors, and Physical Searches
5. Explanations, Institutional Escalation, and Consequences
6. Campaign Objectives, Milestones, and End States
7. New-Run Onboarding and Contextual Tutorial
8. Sound Design, Notifications, and Accessibility Audit
9. Production Sprite Replacement and Art-Direction Pass

The intended long-term frontend is hybrid. Canvas should render the physical map, terrain, sprites, animation, lighting, effects, and map overlays. HTML/CSS should continue to render menus, inspectors, records, policies, dialogs, tooltips, and accessibility controls. Simulation state and rules must remain independent of both renderers. Keep the DOM Compatibility Map as a persistent fallback until a future separate removal decision.

---


## 1. External Detection, Witness Reports, and Suspicion Refactor

Make Suspicion measure external attention rather than hidden wrongdoing. Convert internal incidents into evidence, raise attention only when evidence is observed, reported, correlated, or exposed through commerce, support saved witness or reporting sources without requiring full NPC simulation, and replace the arbitrary permanent peak floor with pressure derived from unresolved evidence, active cases, and slowly fading institutional memory.

## 2. Investigation Cases, Leads, and Deadlines

Create persistent authority investigations with linked known evidence, an institution, a current theory, qualitative case strength, unresolved leads, deadlines, contact history, and escalation state. Preserve knowledge boundaries so the player sees only officially disclosed claims and facts they could reasonably infer from their own site and records.

## 3. Evidence Handling and Concealment Work

Add physical cleaning, collection, relocation, secure storage, lawful disposal, record correction, destruction, and concealment work. Evidence handling must use ordinary access, tools, containers, time, skills, and waste paths; destroying evidence should usually transform or relocate it rather than erase it, while careless tampering can create stronger evidence or contradictions.

## 4. Inspections, Visitors, and Physical Searches

Introduce scheduled inspectors and relevant visitors as physical map actors who enter through lawful access points, request or receive access according to their authority, traverse reachable permitted areas, inspect physical conditions and records, notice discoverable evidence, and respond to obstruction or suspicious access boundaries. Avoid resolving a site inspection through one abstract random roll.

## 5. Explanations, Institutional Escalation, and Consequences

Let the player answer inquiries with structured factual claims supported or contradicted by saved records, physical conditions, witnesses, and prior statements, with an optional player note that is not mechanically interpreted. Escalate proportionally through follow-up demands, surveillance, fines, restrictions, warrants, seizures, and raids while providing warnings and response windows; reserve final campaign success and failure rules for the campaign-objectives pass.

## 6. Campaign Objectives, Milestones, and End States

Define short-, medium-, and long-term objectives, meaningful setbacks, branching milestones, success states, failure states, and reasons to begin another seeded run.

## 7. New-Run Onboarding and Contextual Tutorial

Teach the core discovery, containment, map, task, and research loops through optional contextual guidance that responds to player actions without obscuring the interface.

## 8. Sound Design, Notifications, and Accessibility Audit

Establish restrained sound and notification language, user controls, urgency rules, reduced-sensory alternatives, keyboard and screen-reader coverage, and a complete accessibility review.

## 9. Production Sprite Replacement and Art-Direction Pass

Replace development placeholders with a coherent first production-quality sprite set while preserving semantic keys, footprint anchors, transforms, glyph fallbacks, and the approved visual language.

This is intentionally deferred until late production. Continue creating coherent placeholder assets when new semantic map objects need them; do not begin the final art-replacement pass merely because placeholders expand.

---

For every prompt above: do not modify files until the design has been discussed and the developer explicitly approves implementation.
