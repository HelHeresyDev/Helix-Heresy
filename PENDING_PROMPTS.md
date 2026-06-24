# Pending Prompts

This file contains Codex prompts that are waiting to be discussed and eventually implemented.

Codex may refer to `DESIGN_BIBLE.md` for project context, but this file is the active implementation queue.

Important: Do not implement any prompt from this file immediately. Every prompt must go through a design discussion first. Codex should respond with feedback, concerns, suggestions, and clarifying questions before making code changes. Implementation should only begin after the design has been discussed and I explicitly approve moving forward.

After a prompt has been fully discussed, implemented, and tested, remove that completed prompt from `PENDING_PROMPTS.md` automatically as part of cleanup for that implementation. Do not remove a prompt just because it has been discussed. Do not remove a prompt just because coding has started. Only remove it after the feature is implemented and tested.

Prototype save compatibility is not a priority unless explicitly requested. It is acceptable to break or reset old local saves while the game is still being tested only by the developer and Codex. Prefer clear code and clean forward design over preserving outdated prototype save structures.

## Current Priority Order

1. Collected Byproduct Inventory Transfer System
2. Feeding Residue System
3. Harvestable Specimen Material System
4. Container Compatibility & Material Resistance System
5. Room-Local Storage and Hauling System
6. Lab Construction & Room Expansion System
7. Black Market Byproduct Economy System
8. Elemental Damage Type System
9. Tool Durability and Damage Resistance System

---

## 1. Collected Byproduct Inventory Transfer System

Create a system for transferring accumulated Collection Bay byproducts into the Storage Room inventory ledger.

Once Collection Bay apparatus has accumulated material, the player should be able to collect or transfer that material into inventory. This should feel like emptying catch basins, scraping collection plates, draining a vessel, changing a filter, or decanting condensate into storage.

This system is the bridge between Collection Bay accumulation and the inventory economy. It should make collected natural byproducts usable without turning routine accounting into event-log spam.

The system should answer questions like:
- What counts as transferable collected byproduct?
- Does transfer require scientist time, stamina, tools, or handling method?
- Does transfer happen from the room, from a vessel, from a hood/condenser, or from a staged specimen row?
- How are collected byproducts named in inventory?
- Should inventory use specific byproduct names, broader material categories, or both?
- How does inventory history record the source of collected material?
- What should the player see when there is nothing ready to transfer?
- How should partial or trace amounts be represented?

The transfer should preserve the game’s separation of concepts:
- natural byproduct collection comes from living output caught by apparatus
- feeding residue comes from meals and jobs
- harvestable material comes from cutting into or breaking down the specimen

The desired result is a clear workflow where Collection Bay output becomes inventory through deliberate transfer, with item history showing where the material came from and the event log reserved for meaningful observations rather than routine accounting.

Before coding, discuss how collected byproduct should map into inventory items and how transfer should feel in the UI.

---

## 2. Feeding Residue System

Create a system for residue caused by what slimes eat.

Feeding residue is not the same thing as a natural byproduct. Natural byproduct is routine biological output. Feeding residue is the mess, leftover material, contamination, waste, or transformed matter caused by a specific meal or job.

A corpse-eating slime might leave loose biomatter, ruined organic matter, contaminated residue, slime trace, or almost nothing depending on the corpse, the slime’s biology, and how efficient the digestion is. A waste-disposal slime might reduce waste but leave trace contamination. A mismatched diet might create stress, poor nutrition, room mess, or low-quality residue.

The system should answer questions like:
- What kinds of residue can different foods or jobs leave behind?
- How does slime sustenance affect residue?
- How do body traits, element, and efficiency affect residue?
- How does corpse state affect residue?
- Does residue appear in the room, in the container, in waste drums, or in inventory?
- How does the player observe or learn residue behavior?
- How does residue affect future cleanup, contamination, waste, or inventory systems?

This system should make feeding and job outcomes feel more biological. A slime’s food should matter not only because it restores nutrition, but because digestion can create consequences.

The desired result is a clear residue model that can support corpse processing, waste disposal, manual feeding, contamination, cleanup, and future material recovery without confusing residue with natural byproducts or harvestable specimen material.

Before coding, discuss how feeding residue should be represented, where it should live, and how it should interact with existing feeding and job systems.

---

## 3. Harvestable Specimen Material System

Create a system for materials that can be extracted from a slime’s body.

Harvestable specimen material is separate from natural byproduct and feeding residue. It is what the scientist can recover by cutting, draining, scraping, dissecting, rupturing, dissolving, or otherwise breaking down part or all of the specimen.

Different slimes should have different harvestable materials based on their biology. A watery slime, acid slime, mineral slime, vaporous slime, tar-like slime, crystalline slime, and fibrous slime should not all produce the same useful remains. Size, body consistency, element, condition, maturity, death state, and extraction method can all matter.

The system should answer questions like:
- What can be harvested from a living slime versus a corpse?
- What harvest methods exist?
- Which methods injure, stress, ruin, or kill the specimen?
- How does harvestable material differ from necropsy?
- How does corpse freshness affect harvest quality?
- What materials should go to inventory?
- How does the scientist learn what a specimen is worth harvesting for?
- How should harvesting be presented without exposing hidden gene mappings?

This system should support the fantasy of a grim underground biology lab. Harvesting is not just clicking “delete corpse for resources.” It should feel like a procedure with consequences, value, and risk.

The desired result is a foundation for specimen-derived materials that can later support research, crafting, sale, preservation, mutation work, and more detailed necropsy chains.

Before coding, discuss the harvest model, living-versus-dead extraction, relationship to necropsy, and how results should enter inventory.

---

## 4. Container Compatibility & Material Resistance System

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

## 5. Room-Local Storage and Hauling System

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

## 6. Lab Construction & Room Expansion System

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

## 7. Black Market Byproduct Economy System

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

## 8. Elemental Damage Type System

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

## 9. Tool Durability and Damage Resistance System

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
