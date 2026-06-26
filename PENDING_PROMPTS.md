# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Container Compatibility & Material Resistance System
2. Room-Local Storage and Hauling System
3. Lab Construction & Room Expansion System
4. Black Market Byproduct Economy System
5. Elemental Damage Type System
6. Tool Durability and Damage Resistance System
7. XP Curve and Breakthrough-Gated Skill Progression
8. Analyze Ability & Creature Skill Evolution Follow-Up

---

## 1. Container Compatibility & Material Resistance System

Create a deeper compatibility system between containers and the creatures housed inside them.

Containers should not be interchangeable boxes. A container’s material, sealing, drainage, porosity, structure, size, and handling properties should matter when housing strange organisms. A watery slime, acid slime, heavy mineral slime, vapor-producing slime, corrosive slime, hot slime, tiny puddle slime, and aggressive slime may all create different containment concerns.

The system should answer questions like:
- What makes a container good or bad for a specific specimen?
- How does container material resist acid, heat, cold, moisture, pressure, physical force, or magic?
- How do drainage, sealing, open-top geometry, and porosity affect containment?
- How does size/weight affect fit and safety?
- How does byproduct behavior affect long-term housing?
- How does the player see compatibility without receiving exact hidden formulas?
- What happens when a container is a poor fit?

This system should connect to existing ideas like physical fit, handling risk, Specimen Drainage Tanks, receptacles, hood venting, and room-specific staging. A container that is safe for a dry, docile specimen may be a terrible choice for an acid-dripping or vapor-producing one.

The desired result is a container system where choosing the right vessel is part of the biology puzzle and future lab safety loop.

Before coding, discuss container properties, specimen compatibility factors, UI presentation, and how incompatibility should affect the game.

---

## 2. Room-Local Storage and Hauling System

Create a system for room-local storage and hauling within the lab.

Right now, many resources and inventory concepts are lab-wide for prototype convenience. As the lab grows, some things should physically live in rooms: containers, corpses, collected byproducts, feedstocks, tools, waste, preserved materials, and other objects. The player should eventually care where things are, how they move, and which rooms can use them.

This system should answer questions like:
- Which items should remain lab-wide abstractions and which should become room-local?
- What kinds of objects need physical hauling?
- How does the scientist move items between rooms?
- What is stored in Storage Room versus Collection Bay versus waste areas?
- How do room-local piles or ledgers avoid becoming tedious?
- How do tools and materials become available to actions in other rooms?
- How should hauling interact with doors, time, stamina, risk, and room conditions?

This is not meant to turn Helix Heresy into a warehouse game. It should make physical lab logistics meaningful where they improve the biology/lab fantasy, while keeping routine management readable and manageable.

The desired result is a foundation for location-aware lab resources that can support future construction, crafting, collection, feeding, corpse storage, and black market workflows.

Before coding, discuss what should become room-local first and how to avoid overwhelming the player.

---

## 3. Lab Construction & Room Expansion System

Create a system for expanding the underground laboratory with new rooms and infrastructure.

The lab should grow from a cramped illegal workspace into a larger hidden facility. Rooms should be physical spaces that can be unlocked, constructed, connected, upgraded, damaged, contaminated, sealed, or repurposed. Expansion should matter because different biological work requires different rooms, equipment, and risks.

The system should answer questions like:
- How does the player build a new room?
- What does construction cost?
- Does construction require time, labor, money, secrecy, or materials?
- How are rooms connected?
- Can doors, ventilation, drainage, power, light, mana, or containment infrastructure be built or upgraded?
- How does construction affect Suspicion or risk?
- How do room roles differ from room equipment?
- How does the UI present lab layout without becoming a complex base-builder too early?

Existing rooms like Main Lab, Bedroom, Storage Room, Pit, Menagerie, and Collection Bay should become part of a larger expansion model instead of a fixed list forever.

The desired result is a lab-growth foundation that lets future systems add morgues, containment wings, ritual chambers, black market docks, incinerators, cold storage, grow rooms, power rooms, and specialized research spaces.

Before coding, discuss the construction model, room unlock flow, layout representation, costs, and how much base-building complexity belongs in the prototype.

---

## 4. Black Market Byproduct Economy System

Create a black market economy system focused on selling natural byproducts and other illegal biological goods.

The black market should make the lab’s strange outputs economically meaningful. Natural byproducts, harvested specimen materials, corpses, preserved tissues, commissioned creatures, and services can eventually become sources of money, reputation, suspicion, and risk.

This system should begin with byproducts because Collection Bay and byproduct coherence create a natural production pipeline. The market should care about what the substance is, how rare or dangerous it is, how pure or fresh it is, how much the buyer wants it, and how risky it is to move.

The system should answer questions like:
- Who buys slime byproducts and why?
- How are prices determined?
- How do rarity, danger, purity, output quality, and demand affect value?
- How does selling affect black market reputation?
- How does selling affect Suspicion?
- How are commissions different from freeform sales?
- How does the market avoid becoming a simple “sell all” button?
- How does the UI keep deals readable and flavorful?

The black market should feel illegal, useful, and dangerous. Selling weird substances should help fund the lab, but also create evidence trails, relationships, expectations, and exposure.

The desired result is an economy foundation where byproducts and biological materials are not just stockpiles, but part of a growing illicit network that can later support commissions, reputation tiers, rare buyers, scams, raids, and story escalation.

Before coding, discuss the market model, the first sellable goods, pricing philosophy, reputation, suspicion, and how much economy depth belongs in the first implementation.

---

## 5. Elemental Damage Type System

Create a system that gives slime actions, hazards, and contact effects a damage type based on the slime’s element or biological output.

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

Damage types should feel biological and material, not just RPG labels. “Acid damage” means corrosion, chemical burns, dissolving tissue, and eating through unsuitable materials. “Electric damage” means shocks, arcs, nerve disruption, and stress on conductive tools. “Heat damage” means burns, drying, melting, or ignition. “Cold damage” means freezing, brittleness, numbness, or condensation. Physical damage may include crushing, tearing, scraping, piercing, or abrasion depending on the slime.

The desired result is a clear elemental damage vocabulary that future systems can reuse. Once this exists, equipment, containers, tools, rooms, and creatures can have resistances or vulnerabilities that make biological compatibility more meaningful.

Before coding, discuss the damage type model, the element-to-damage mapping, how many damage types the prototype needs, and where damage type should first appear in the UI.

---

## 6. Tool Durability and Damage Resistance System

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

## 7. XP Curve and Breakthrough-Gated Skill Progression

Rework skill XP so progression supports long-term skill tiers, difficult breakthroughs, and meaningful dedicated practice.

The effective skill level cap should be around level 320. Skills should progress through tier bands:

- Initiate: levels 1–50
- Novice: levels 51–100
- Adept: levels 101–150
- Master: levels 151–200
- Heroic: levels 201–250
- Legendary: levels 251–300
- Divine: levels 301–320+

Normal levels should feel achievable through regular practice, but crossing into a new tier should require a breakthrough. Breakthroughs should happen at:

- 0 → 1
- 50 → 51
- 100 → 101
- 150 → 151
- 200 → 201
- 250 → 251
- 300 → 301

A breakthrough should require unusually concentrated progress. The XP required to cross a threshold should be based on the XP cost of a level 20 levels higher. For example:

- 0 → 1 should cost about as much as 20 → 21
- 50 → 51 should cost about as much as 70 → 71
- 100 → 101 should cost about as much as 120 → 121
- 150 → 151 should cost about as much as 170 → 171
- 200 → 201 should cost about as much as 220 → 221
- 250 → 251 should cost about as much as 270 → 271
- 300 → 301 should cost about as much as 320 → 321

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
- How does 0 → 1 work for hidden pre-skill practice?
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
