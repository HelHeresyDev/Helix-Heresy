# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Slime Feeding Search and Consumption Behavior System
2. Slime Habitat Preference and Environmental Response System
3. Slime Stress, Fear, Pain, and Threat Response System
4. Elemental Damage Type System
5. Combat Foundation System
6. XP Curve and Breakthrough-Gated Skill Progression
7. Slime Skill Practice, Ability Use, and Behavior Learning System
8. Analyze Ability & Creature Skill Evolution Follow-Up
9. Slime Combat Behavior System
10. Slime Containment Testing and Escape Behavior System
11. Slime Container Interaction and Breach Behavior System
12. Tool Durability and Damage Resistance System
13. Slime Social, Territorial, and Group Behavior System
14. Slime Job Autonomy and Work Behavior System
15. Map-Based Slime Incident and Emergency Response System
16. Slime AI Debugging and Behavior Readout System
17. Black Market Byproduct Economy System

---

## 1. Slime Feeding Search and Consumption Behavior System

Create autonomous feeding search and consumption behavior for slimes.

Slimes should be able to seek food or feed opportunistically when their needs and conditions push them to do so. This should connect to existing feeding, sustenance, feedstock, corpse, waste, residue, local storage, and room-local hauling systems without making every slime constantly consume everything.

The system should answer questions like:
- When does a slime decide it needs food?
- What foods can it recognize or sense?
- Does it prioritize best-match food, nearby food, corpses, waste, feedstock, residue, or environmental sources?
- How does being contained limit feeding search?
- How do jobs like Corpse Processing and Waste Disposal differ from uncontrolled feeding?
- How does feeding create residue, stress, contamination, nutrition, current mass, division pressure, or incidents?
- Can slimes overeat, avoid bad food, or eat dangerous mismatches?
- How should the UI explain why a slime wants food or what it is trying to eat?

A contained slime should not automatically eat from the entire lab. Food must be available in its room, container, assigned station, or through explicit hauling/feeding systems. A loose slime may move toward perceived food if it can path there and has reason to do so.

The desired result is a feeding AI foundation where hunger and sustenance meaningfully affect behavior, local resources matter, and uncontrolled feeding can become a real lab management problem.

Before coding, discuss food target selection, contained versus loose feeding, local availability, job separation, residue effects, and first-pass UI readouts.

---

## 2. Slime Habitat Preference and Environmental Response System

Create habitat preferences and environmental response behavior for slimes.

Slimes should react to their surroundings. A slime's comfort, stress, movement, production, feeding, and containment behavior should eventually be influenced by temperature, moisture, light, ambient mana, contamination, electrical charge, container comfort, crowding, and other room or container conditions.

The system should answer questions like:
- What environmental preferences can slimes have?
- Which preferences derive from element, body consistency, sustenance, shape, or traits?
- How does a bad habitat affect stress, nutrition, production, movement, or containment risk?
- How does a good habitat stabilize or comfort a slime?
- Can a loose slime seek better habitat?
- Can a contained slime press toward preferred areas, hide, or become agitated?
- How should habitat fit be shown without exposing hidden formulas?
- How should habitat behavior interact with future environmental propagation?

This system should make room conditions matter to creatures as living organisms. A watery slime may prefer moisture. A heat-associated slime may seek warmth. A light-sensitive slime may hide from bright rooms. A contaminated or toxic environment may either harm or comfort different specimens depending on biology.

The desired result is a habitat response model that gives slimes reasons to move, settle, stress, calm down, produce less, or cause trouble based on where and how they are housed.

Before coding, discuss which room/container attributes affect habitat first, how habitat preferences are discovered, how behavior changes, and how to present this in room and specimen UI.

---

## 3. Slime Stress, Fear, Pain, and Threat Response System

Create a richer response model for stress, fear, pain, and threats.

Slimes already have Stress and Body Integrity. Their behavior should respond to those conditions. A slime under pressure should not always behave the same way. Depending on traits, current state, intelligence, and history, it might freeze, hide, flee, strike, ooze away, test containment, stop working, cling to a surface, seek food, or lash out at nearby actors.

The system should answer questions like:
- What counts as pain or threat for a slime?
- How does Body Integrity damage change behavior?
- How does Stress change behavior?
- When does a slime flee, freeze, hide, attack, or continue working?
- How do hunger, injury, containment, habitat mismatch, handling, combat, and crowding contribute?
- How should temperament or future behavior traits influence response?
- How should the UI communicate likely response without exposing exact thresholds?
- How do fear and pain differ for simple slimes versus smarter future creatures?

This system should make incidents and combat more interesting. A slime that is injured may become easier to contain, or more dangerous. A stressed slime may stop cooperating with jobs or begin testing its enclosure. A frightened slime may hide rather than attack. A starving slime may ignore fear to reach food.

The desired result is a threat-response foundation that connects condition stats to believable behavior and prepares the game for escape, combat, handling accidents, and emergency response.

Before coding, discuss response categories, triggers, condition thresholds, trait influences, UI readouts, and how much should be implemented before full combat.

---

## 4. Elemental Damage Type System

Create a system that gives slime actions, hazards, and contact effects a damage type based on the slime's element or biological output.

The core idea is that elemental identity should matter mechanically. An acid slime should threaten things with acid damage. A fire slime should threaten things with heat or burn damage. An electric slime should threaten things with electrical damage. A cold slime should threaten things with freezing damage. A metal or stone slime may threaten things through physical abrasion, crushing, or impact rather than chemical damage.

This system should make elemental traits matter when slimes interact with containers, tools, rooms, corpses, equipment, and eventually other creatures. The goal is not just combat damage. Damage type should become a shared language for biological hazards and material resistance.

The system should answer questions like:
- What damage type does each slime element naturally produce?
- Can a slime have multiple relevant damage types, such as acid plus physical abrasion?
- What damage type applies during direct handling?
- What damage type applies when a slime leaks, drips, burns, shocks, freezes, corrodes, scrapes, or crushes something?
- How should neutral, non-elemental, or strange elements be represented?
- How should the UI communicate damage type without exposing hidden formulas?
- How should damage type connect to future container wear, tool durability, room damage, injuries, combat, and harvesting?

Damage types should feel biological and material, not just RPG labels. "Acid damage" means corrosion, chemical burns, dissolving tissue, and eating through unsuitable materials. "Electric damage" means shocks, arcs, nerve disruption, and stress on conductive tools. "Heat damage" means burns, drying, melting, or ignition. "Cold damage" means freezing, brittleness, numbness, or condensation. Physical damage may include crushing, tearing, scraping, piercing, or abrasion depending on the slime.

The desired result is a clear elemental damage vocabulary that future systems can reuse. Once this exists, equipment, containers, tools, rooms, and creatures can have resistances or vulnerabilities that make biological compatibility more meaningful.

Before coding, discuss the damage type model, the element-to-damage mapping, how many damage types the prototype needs, and where damage type should first appear in the UI.

---

## 5. Combat Foundation System

Create the foundation for combat as a map-aware simulation system.

Combat should not be limited to future story battles. It should support lab accidents, escaped slimes, scientist self-defense, creature attacks, containment failures, intruders, future raids, and eventually outdoor or conquest-layer conflict. The first foundation should define how actors threaten each other, target each other, use abilities, take damage, flee, become incapacitated, and interact with map position.

The system should answer questions like:
- Is combat real-time, queued, tick-based, turn-like, or a hybrid?
- How does map distance, adjacency, line of sight, and room layout matter?
- What counts as an attack, contact hazard, ability, shove, grapple, or escape action?
- How does damage apply to Body Integrity, health, stamina, stress, tools, containers, or room objects?
- How do elemental damage types integrate?
- How do actors choose targets?
- How do fleeing, incapacitation, death, surrender, or loss of control work?
- How should the UI show combat without overwhelming the lab management interface?

The first implementation should be a foundation, not a complete tactical game. It should create shared rules and data shapes that slime combat behavior, scientist response, intruders, emergency incidents, and future creature abilities can reuse.

The desired result is a combat framework that makes danger spatial and systemic: actors occupy the map, use abilities or contact actions, take consequences, and generate events that other AI systems can respond to.

Before coding, discuss combat timing, target selection, range, damage application, ability hooks, map interaction, UI presentation, and what the smallest useful combat pass should include.

---

## 6. XP Curve and Breakthrough-Gated Skill Progression

Rework skill XP so progression supports long-term skill tiers, difficult breakthroughs, and meaningful dedicated practice.

The effective skill level cap should be around level 320. Skills should progress through tier bands:

- Initiate: levels 1-50
- Novice: levels 51-100
- Adept: levels 101-150
- Master: levels 151-200
- Heroic: levels 201-250
- Legendary: levels 251-300
- Divine: levels 301-320+

Normal levels should feel achievable through regular practice, but crossing into a new tier should require a breakthrough. Breakthroughs should happen at:

- 0 -> 1
- 50 -> 51
- 100 -> 101
- 150 -> 151
- 200 -> 201
- 250 -> 251
- 300 -> 301

A breakthrough should require unusually concentrated progress. The XP required to cross a threshold should be based on the XP cost of a level 20 levels higher. For example:

- 0 -> 1 should cost about as much as 20 -> 21
- 50 -> 51 should cost about as much as 70 -> 71
- 100 -> 101 should cost about as much as 120 -> 121
- 150 -> 151 should cost about as much as 170 -> 171
- 200 -> 201 should cost about as much as 220 -> 221
- 250 -> 251 should cost about as much as 270 -> 271
- 300 -> 301 should cost about as much as 320 -> 321

This should make tier advancement feel like a real barrier without making every ordinary level painfully slow.

Breakthrough progress should decay while the actor is stalled at a threshold. The idea is that a breakthrough requires dedicated and consistent effort, or a large spike of XP from a difficult challenge. A creature or scientist casually touching a skill once and then ignoring it should not slowly bank a breakthrough forever.

This system should answer questions like:
- What XP curve gives good pacing up to an effective cap around 320?
- How much XP should normal levels require?
- How should breakthrough XP be stored separately from normal XP?
- How quickly should breakthrough progress decay?
- Does decay happen over real time, game time, missed practice opportunities, or unrelated activity?
- Do difficult challenges give breakthrough-favorable XP?
- Can low-risk repetitive grinding cross a breakthrough, or only maintain progress?
- How does 0 -> 1 work for hidden pre-skill practice?
- Does crossing a breakthrough immediately trigger skill evolution or only unlock the next tier?
- How should the UI show threshold progress without making the system feel like a spreadsheet?

The intended feel is:
- normal practice builds competence
- tier transitions require breakthroughs
- breakthroughs reward focus, pressure, danger, or unusually meaningful experience
- progress at a threshold can be lost if it is not sustained
- earned levels are not lost through decay
- stats and biological truths remain hidden
- skills remain observable through the skill system and Analyze rules

The desired result is a skill progression model where reaching a new tier feels like a meaningful event, not just another XP tick. A scientist or creature should be able to grind basic competence, but higher-tier evolution should require sustained dedication or extraordinary experience.

Before coding, discuss the XP curve, breakthrough storage, decay rules, tier transition behavior, UI presentation, and how this should interact with existing skill levels and future Analyze/evolution behavior.

---

## 7. Slime Skill Practice, Ability Use, and Behavior Learning System

Create a system for slime skill practice, ability use, and learned behavior.

Slimes should improve at things they actually do. A slime that repeatedly grapples, squeezes through gaps, digests corpses, withstands harsh conditions, spits acid, hides, climbs, or fights should gain relevant practice. This should connect to the adaptive skill system without turning passive biology into fake skills.

The system should answer questions like:
- Which slime actions grant skill practice?
- Which behaviors are skills, which are abilities, and which are outcomes?
- How do slimes unlock or improve abilities through skill use?
- How does the game avoid creating skills for passive byproduct production, containment pressure, collection rate, or other derived outcomes?
- How do current traits and hidden stats shape which skills a slime can practice effectively?
- How does practice connect to the XP breakthrough system?
- How does behavior history affect future AI choices?
- How should the UI reveal learned behavior without exposing hidden biological truths?

This system should make slimes become different over time. Two similar slimes should diverge if one is used for corpse work, one survives repeated containment stress, one fights intruders, and one spends its life in a comfortable collection station.

The desired result is a learning foundation where repeated action shapes skill progress, abilities, and behavior tendencies, while biology remains separate from skill identity.

Before coding, discuss practice sources, ability hooks, skill categories, XP integration, behavior history, save structure, and how this should connect to Analyze.

---

## 8. Analyze Ability & Creature Skill Evolution Follow-Up

Build on the first-pass adaptive skill foundation by adding the actual Analyze ability, creature-visible skill sheets, and skill evolution behavior.

The current foundation has broad world-scale skill domains, tier labels, hidden pre-level-1 practice, and scientist skill display rules. This follow-up should decide how actors use Analyze in laboratory and combat contexts, how much skill information Analyze reveals, and how creature skills become visible without exposing genes, hidden stats, weaknesses, or exact formulas.

This system should answer questions like:
- What UI action represents Analyze in the lab and in combat?
- What can Analyze target: creatures, corpses, rooms, tools, materials, enemies, or hazards?
- How does the Analyze skill affect confidence, partial reads, and misreads?
- When do creature skills first appear, and where should they be displayed?
- Which creature actions grant skill practice?
- When does a skill evolve into a specialized name?
- Is skill evolution automatic, player-guided, or automatic for creatures and guided for the scientist?
- How do abilities attach to evolved skills without turning passive biology into fake skills?

Before coding, discuss the Analyze workflow, creature skill visibility, evolution triggers, specialization naming rules, and the smallest implementation that makes adaptive skills feel alive without overbuilding combat too early.

---

## 9. Slime Combat Behavior System

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

## 10. Slime Containment Testing and Escape Behavior System

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

## 11. Slime Container Interaction and Breach Behavior System

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

## 12. Tool Durability and Damage Resistance System

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

## 13. Slime Social, Territorial, and Group Behavior System

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

## 14. Slime Job Autonomy and Work Behavior System

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

## 15. Map-Based Slime Incident and Emergency Response System

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

## 16. Slime AI Debugging and Behavior Readout System

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

## 17. Black Market Byproduct Economy System

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
