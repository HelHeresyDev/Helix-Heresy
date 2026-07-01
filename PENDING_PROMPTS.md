# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Advanced Analyze & Creature Skill Evolution Follow-Up
2. Slime Combat Behavior System
3. Slime Containment Testing and Escape Behavior System
4. Slime Container Interaction and Breach Behavior System
5. Tool Durability and Damage Resistance System
6. Slime Social, Territorial, and Group Behavior System
7. Slime Job Autonomy and Work Behavior System
8. Map-Based Slime Incident and Emergency Response System
9. Slime AI Debugging and Behavior Readout System
10. Black Market Byproduct Economy System

---

## 1. Advanced Analyze & Creature Skill Evolution Follow-Up

Build on the base Analyze implementation by adding stronger Analysis-derived abilities, combat/forensic Analyze variants, and creature skill evolution behavior.

The current foundation has broad world-scale skill domains, tier labels, hidden pre-level-1 practice, scientist skill display rules, hidden slime skill practice, and a base Analyze ability. Base Analyze is instant, costs Mana, is granted by Analysis [Initiate], and reveals only level-1+ creature skill names/tiers plus broad learned behavior memories. It does not reveal exact levels, raw XP, genes, hidden stats, biological traits, weaknesses, compatibility formulas, or level-0 practice.

This follow-up should decide how later Analysis stages grant new abilities such as Advanced Analyze, Combat Analyze, Deep Analyze, or Forensic Analyze, and how creature skills evolve into specialized names without turning passive biology into fake skills.

This system should answer questions like:
- Which Analysis stages unlock which new Analyze-derived abilities?
- What can advanced Analyze variants target: corpses, rooms, tools, materials, enemies, hazards, or combat opponents?
- Should Advanced Analyze reveal exact skill levels, approximate level bands, ability hints, or skill evolution paths?
- How should Combat Analyze differ from base lab Analyze?
- How should Forensic Analyze work on corpses, residue, harvested material, or old evidence?
- Which creature actions grant skill practice?
- When does a skill evolve into a specialized name?
- Is skill evolution automatic, player-guided, or automatic for creatures and guided for the scientist?
- How do abilities attach to evolved skills without turning passive biology into fake skills?

Before coding, discuss advanced Analyze unlocks, target scope, exact-level visibility, combat reads, forensic reads, evolution triggers, specialization naming rules, and the smallest implementation that makes adaptive skills feel alive without overbuilding combat too early.

---

## 2. Slime Combat Behavior System

Create slime-specific combat behavior on top of the combat foundation.

Slimes should fight according to biology, condition, skills, abilities, stress, hunger, fear, environment, and intelligence. They should not all attack the same way. A slime might avoid combat, cling and grapple, spit acid, burn nearby objects, flee to a wet corner, block a doorway, swarm a target, protect offspring, attack food, or panic.

The system should answer questions like:
- When does a slime choose to fight?
- When does it flee, freeze, hide, or surrender space?
- How does hunger, pain, stress, habitat fit, or injury change combat behavior?
- How do elemental damage types and abilities affect decisions?
- How does map distance, line of sight, room layout, and door position affect combat choices?
- How do slimes choose targets?
- How do group slimes coordinate or interfere with each other?
- How does combat behavior grant skill practice?
- How should the UI show combat intent and likely danger?

This system should let slimes become dangerous without making every escaped slime a murder machine. A timid slime may flee. A starving slime may attack food sources. An acid slime may avoid melee if it has a spit ability. A heavy slime may attempt to body-block or crush. A stressed slime may lash out unpredictably.

The desired result is a slime combat AI layer that uses the shared combat rules but produces biologically varied behavior.

Before coding, discuss behavior categories, target selection, ability choice, flee logic, skill practice, UI readouts, and which combat behaviors belong in the first pass.

---

## 3. Slime Containment Testing and Escape Behavior System

Create a system for slimes to test containment and attempt escape.

Containment should not be a purely passive risk number. A stressed, hungry, injured, uncomfortable, curious, aggressive, or intelligent slime may probe its container or room boundaries. This can mean pressing against walls, searching for gaps, squeezing through openings, corroding weak material, shocking locks, pushing lids, waiting for handling mistakes, or repeatedly trying routes that once worked.

The system should answer questions like:
- What makes a slime test containment?
- How do hunger, stress, habitat mismatch, crowding, pain, intelligence, and temperament influence escape attempts?
- What container properties can be tested?
- How do elemental damage types and body consistency affect escape methods?
- Can slimes learn from failed or successful escape attempts?
- How do doors and room barriers matter after escape?
- How should escape progress be shown without exact formulas?
- What counts as a minor incident versus an actual breach?

This should connect to container compatibility, active containment risk, map pathing, doors, movement, and future emergency response. A slime that cannot escape its container may still raise stress, damage equipment, foul the interior, or create warning signs.

The desired result is containment behavior that feels active and biological: slimes can pressure the lab in ways that match their needs and bodies, while the player gets readable warning signs and meaningful prevention tools.

Before coding, discuss escape triggers, containment testing actions, progress, failure effects, successful breach behavior, learning, and UI warnings.

---

## 4. Slime Container Interaction and Breach Behavior System

Create detailed behavior for how slimes interact with containers during and after containment failures.

Containers are physical objects with fit, compatibility, material resistance, drainage, seal, openings, comfort, durability, and location. Slimes inside them should interact with those properties. When containment degrades or fails, the result should depend on the slime and container rather than always producing the same generic escape.

The system should answer questions like:
- How does a slime behave inside a container?
- What container properties matter to daily behavior?
- How do poor fit, poor compatibility, discomfort, drainage problems, sealing problems, damage, or contamination affect the slime?
- What happens when a container is partially damaged but not breached?
- How does a slime exit a broken, open, tipped, cracked, dissolved, or unsealed container?
- Where is the slime placed on the map after a breach?
- What happens to the container, its contents, residue, byproducts, corpses, or tools?
- How should breach results be shown in the event log, map, room readout, and specimen readout?

This system should make containment failures physically grounded. A watery slime leaking through a crack, an acid slime dissolving a weak tray, a heavy slime tipping a vessel, and a vapor slime escaping through a poor seal should feel like different failures.

The desired result is a container-interaction foundation that makes containment risk, material resistance, slime behavior, map placement, and emergency response work together.

Before coding, discuss daily container interaction, partial damage, breach types, post-breach placement, container state changes, and UI reporting.

---

## 5. Tool Durability and Damage Resistance System

Create a durability and resistance system for lab tools and handling equipment.

Tools should be physical objects that can wear down, get damaged, and eventually become unreliable or unusable. Thick gloves, long tongs, hook poles, scrapers, and future equipment should not be abstract permanent toggles. They should have durability, such as `10 / 10`, and that durability should change based on what kind of hazard they are exposed to.

The key idea is that tools have material properties and resistances. Thick gloves might be rubberized and resist electrical damage well, but perform worse against acid, cutting, heat, or puncture depending on their construction. Metal tongs might resist heat and physical abrasion better than gloves, but conduct electricity and may corrode under acid. A scraper might tolerate physical residue but suffer from corrosion or heat. A hook pole might be useful at distance but have its own weaknesses.

This system should answer questions like:
- What durability value should each tool start with?
- What happens when durability reaches zero?
- Does low durability reduce effectiveness before total failure?
- Which damage types can affect each tool?
- What resistance profile does each tool have?
- How does tool damage happen during handling, corpse work, cleanup, Collection Bay staging, or future procedures?
- How should the player inspect tool condition?
- How should warnings appear when a selected tool is damaged or poorly matched?
- Can tools be repaired, replaced, or discarded now, or should that wait for a future system?

Durability should make tool choice meaningful. The player should eventually care that rubber gloves are safer against electricity, metal tongs are safer against heat or distance, and the wrong tool for the hazard may get ruined quickly or put the scientist at risk.

The UI should communicate condition clearly without becoming spreadsheet-heavy. A tool might show `Durability: 8 / 10`, plus broad resistance notes like `strong electrical resistance`, `poor acid resistance`, or `conductive`. Tooltips can carry more detail than the main UI.

The desired result is a foundation where tools are reusable but not indestructible. Handling choices should start to matter materially, and future systems like container movement, slime handling, Collection Bay work, cleanup, harvesting, and accidents can wear down equipment in consistent ways.

Before coding, discuss the durability model, resistance categories, starting durability values, how tool wear should be triggered, and how much repair/replacement gameplay belongs in the first implementation.

---

## 6. Slime Social, Territorial, and Group Behavior System

Create social, territorial, and group behavior for slimes.

Not all slimes should be social, but groups of slimes should not always behave like unrelated isolated objects. Some may tolerate each other, avoid each other, compete for food, crowd each other, follow similar environmental preferences, swarm toward food, protect offspring, merge into piles, or become territorial.

The system should answer questions like:
- Which slimes care about nearby slimes?
- How do brood, maturity, stress, hunger, size, species family, element, and temperament affect group behavior?
- How do slimes compete for food, space, warmth, moisture, or safety?
- Can slimes follow, avoid, crowd, swarm, or attack each other?
- How does overcrowding affect stress and containment risk?
- Can parent/offspring relationships matter after splitting?
- How should group behavior affect combat, jobs, feeding, containment, and incidents?
- How should the UI communicate group dynamics without overcomplicating specimen cards?

This system should support the fantasy that the lab is filled with living organisms, not independent stat blocks. A crowded containment room, a pile of offspring, or a tank with multiple slimes should create different behavior pressures than isolated specimens.

The desired result is a first-pass social and territorial model that makes groups meaningful while leaving complex society and intelligence for future creature families.

Before coding, discuss which social interactions belong to simple slimes, how group pressure is calculated, how it affects behavior, and what should be visible to the player.

---

## 7. Slime Job Autonomy and Work Behavior System

Create autonomous work behavior for slimes assigned to jobs.

Jobs should not feel like abstract timers detached from creature behavior. A slime assigned to Corpse Processing, Waste Disposal, collection support, cleanup, defense, or future work should behave like a creature performing an activity in a place. Its needs, stress, habitat, hunger, skills, condition, and local access should affect whether it works, pauses, fails, wanders, feeds, or creates incidents.

The system should answer questions like:
- How does a slime decide to continue assigned work versus satisfy a stronger drive?
- How do job targets become local map or room targets?
- How do work tasks interact with movement, feeding, residue, stress, and condition?
- How do skills and practice affect work behavior?
- How does a slime fail, refuse, abandon, or interrupt a job?
- How do job assignments differ from autonomous opportunistic behavior?
- How should the UI show why a slime is working or not working?
- How should automation avoid silently overriding important creature needs?

This system should make work assignments feel grounded. A corpse-processing slime should move to or act on a corpse target. A waste-disposal slime should interact with local waste. A defense slime should have patrol or response behavior later. Work should produce skill practice where appropriate.

The desired result is a job AI layer where assigned work is integrated with the slime's behavior system instead of being only a hidden progress bar.

Before coding, discuss job behavior states, target selection, interruption rules, movement integration, skill practice, failure modes, and UI explanations.

---

## 8. Map-Based Slime Incident and Emergency Response System

Create map-based slime incidents and emergency response behavior.

Slime incidents should happen in space. Escapes, failed handling, container breaches, feeding accidents, stress events, combat, hazardous leakage, corpse disturbance, and byproduct spills should have locations on the map, affect nearby objects, and create response opportunities for the scientist.

The system should answer questions like:
- Which slime incidents become map-based first?
- How is an incident location chosen?
- How does the scientist respond using movement and queued tasks?
- Can the player issue emergency commands such as seal door, move away, recapture, feed, calm, clean, repair, or fight?
- How do doors, barriers, containers, tools, and room conditions affect response?
- How do nearby slimes, corpses, containers, and tools react to incidents?
- How should incident urgency and location be shown on the blueprint and in panels?
- When does an incident end?

The first pass should not implement every disaster. It should create a framework where slime-related incidents can be located, displayed, prioritized, and responded to using the physical map and existing task systems.

The desired result is a spatial emergency foundation that makes slime AI, containment, combat, tools, and room conditions feel connected.

Before coding, discuss incident types, location rules, response task flow, UI alerts, map highlights, and how to avoid overwhelming the player.

---

## 9. Slime AI Debugging and Behavior Readout System

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
