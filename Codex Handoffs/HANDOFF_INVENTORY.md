# System Handoff — Inventory

Date: 2026-06-22

## Status

Inventory is implemented and accepted through Pass 6.

Accepted work:
- Inventory Pass 1: Storage Room Ledger Foundation
- Inventory Pass 1 Fix 1: Inventory cheat button and Enter key fix
- Inventory Pass 2: Tools and Supplies Catalog
- Inventory Pass 2 Fix 1: Playwright strict-selector fix
- Inventory Pass 3: Starter Stock
- Inventory Pass 4: Inventory-Aware Handling UI, No Gates
- Inventory Pass 5: Tool Requirement Preview Warnings
- Inventory Pass 6: Tool Requirement Gates

This handoff should be treated as the current source of truth for the Inventory system.

## Purpose

This system adds a Storage Room-grounded inventory/material ledger to the lab.

Before this work:
- Storage Room existed as a real room, but no inventory/material ledger existed.
- Existing systems implied lab materials and tools such as biomass, trace slime, gloves, tongs, hook pole, and scraper.
- Handling methods existed, but they did not connect to any inventory/tool catalog.
- There was a risk of inventory feeling like a floating RPG backpack rather than a lab storage system.

After this work:
- Inventory exists as a lab-wide Storage Room ledger.
- Inventory is displayed in an Inventory panel.
- Inventory has Materials and Tools & Supplies categories.
- Starter materials begin at 0.
- Starter tools begin at 1 each.
- Cheats can add every defined inventory item.
- Handling methods are inventory-aware.
- Handling methods now require matching tools, except bare hands.
- Missing required tools disable relevant handling action buttons.
- Tools are reusable and are not consumed.
- No crafting, recipes, durability, vendors, storage capacity, room-local hauling, or equipment slots have been added.

## Core design decisions

### Inventory is a Storage Room ledger, not a backpack

Inventory is grounded in the Storage Room.

Accepted visible identity:
```txt
Storage Room ledger · Lab-wide prototype
```

Accepted meaning:
- Inventory is tracked lab-wide for now.
- The fiction is that materials/tools are stored in the Storage Room.
- This is not a personal backpack.
- This is not yet room-local item storage.

### Lab-wide for now

Inventory is mechanically lab-wide in the current implementation.

Accepted:
- all stored inventory amounts are globally accessible
- no room-local piles
- no hauling inventory between rooms
- no storage logistics
- no storage capacity

Future room-local storage or hauling should require separate design discussion.

### Materials and tools are distinct

Inventory contains two accepted categories:

```txt
Materials
Tools & Supplies
```

Materials are stored biological/contaminant resources.

Tools & Supplies are reusable lab tools and handling supplies.

### Starter materials begin at zero

Materials currently start at 0.

Accepted materials:
- Biomass
- Trace slime
- Contaminated residue
- Ruined organic matter
- Preserved tissue

These are display/storage ledger entries only until future gameplay sources are explicitly designed.

### Starter tools begin at one

Tools & Supplies currently start at 1 each.

Accepted tools/supplies:
- Thick gloves
- Long tongs
- Hook pole
- Scraper

These are the basic lab tools already implied by current handling methods.

### Cheats can add every inventory item

Inventory cheats exist for prototype testing.

Accepted:
- cheats can add every material
- cheats can add every tool/supply
- cheat button works
- Enter key in the cheat input works
- aliases support common tool/item names

Cheat output uses detached storage-log wording such as:
```txt
Stored tool logged: Thick gloves +1.
```

### Handling methods are inventory-aware

Handling methods now show their inventory relationship.

Accepted examples:
```txt
Tool preview: no tool expected
Inventory: no cataloged tool
Protocol: no tool requirement
Requirement: none
```

```txt
Tool preview: Thick gloves available
Inventory: 1 Thick gloves cataloged in Storage Room
Protocol: required tool stocked
Requirement: stocked
```

```txt
Tool preview: Thick gloves not stocked
Inventory: 0 Thick gloves cataloged in Storage Room
Protocol: procedure blocked until tool is stocked
Requirement: blocked until stocked
```

### Tool gates are enforced, but tools are reusable

Pass 6 makes tools mechanically required for matching handling methods.

Accepted gate behavior:
- Bare hands requires no tool.
- Thick gloves requires at least 1 Thick gloves.
- Long tongs requires at least 1 Long tongs.
- Hook pole requires at least 1 Hook pole.
- Scraper requires at least 1 Scraper.

Tools are not consumed by use.

Accepted:
- missing required tool disables relevant handling action buttons
- disabled button title explains the reason
- handling method dropdown options remain selectable
- restocking the tool re-enables relevant actions
- tools are reusable and persistent

Preferred blocked wording:
```txt
Procedure blocked: Thick gloves not stocked in Storage Room.
```

Rejected:
- tool consumption
- durability
- contamination of tools
- crafting tools
- equipment slots
- quality tiers

## Implemented behavior

### Pass 1 — Storage Room Ledger Foundation

Inventory foundation added:
- Inventory panel
- inventory state object
- inventory item definitions
- inventory helper functions
- save/load normalization
- inventory rows with data attributes
- tooltip/title text
- inventory cheat UI

Initial material set:
- Biomass
- Trace slime
- Contaminated residue
- Ruined organic matter
- Preserved tissue

Pass 1 was display-only except for prototype cheats.

No gameplay source produced inventory materials in Pass 1.

### Pass 1 Fix 1 — Cheat event wiring

Initial Pass 1 QC found:
- Inventory cheat button existed but did not run the command.

Fix:
- wired the Inventory Cheat button to `runInventoryCommand()`
- wired Enter key in the Inventory Cheat input to `runInventoryCommand()`

Accepted behavior:
- button adds inventory item
- Enter key adds inventory item
- status message updates
- inventory row updates

### Pass 2 — Tools and Supplies Catalog

Inventory categories added:
- Materials
- Tools & Supplies

Tools/supplies added:
- Thick gloves
- Long tongs
- Hook pole
- Scraper

Pass 2 was catalog-only:
- tools were listed in inventory
- tools could be added through cheats
- existing handling methods were not gated by inventory yet

Accepted tool aliases included examples such as:
- gloves
- tongs
- hook pole
- scrapers

### Pass 2 Fix 1 — Test selector fix

Initial Pass 2 QC found a Playwright strict-mode test selector bug.

Fix:
- category-heading checks now target `.inventory-section[data-inventory-category="materials"]`
- category-heading checks now target `.inventory-section[data-inventory-category="tools"]`

No app behavior changed.

### Pass 3 — Starter Stock

Starter stock added:
- materials start at 0
- tools start at 1 each

Accepted starter values:
- Biomass: 0
- Trace slime: 0
- Contaminated residue: 0
- Ruined organic matter: 0
- Preserved tissue: 0
- Thick gloves: 1
- Long tongs: 1
- Hook pole: 1
- Scraper: 1

Cheats add on top of starter stock.

Tools remained catalog-only in Pass 3.

### Pass 4 — Inventory-Aware Handling UI, No Gates

Handling UI became inventory-aware.

Accepted behavior:
- Handling policy UI shows inventory note for the selected method.
- Container handling summaries include method inventory amount and requirement status.
- Open/Close Container button titles include method inventory amount and requirement status.
- Remains/handling/transfer action titles include method inventory details when applicable.
- Inventory cheat updates propagate to handling UI.

Pass 4 did not gate actions.

Accepted examples:
```txt
Inventory: no cataloged tool
Requirement: none
```

```txt
Inventory: 1 Thick gloves cataloged in Storage Room
Requirement: not enforced yet
```

### Pass 5 — Tool Requirement Preview Warnings

Handling UI gained clearer preview wording.

Accepted behavior:
- tool preview shows no tool expected / available / not stocked
- protocol line shows whether requirement is enforced
- requirement line remains visible
- actions still allowed even when not stocked

Accepted examples:
```txt
Tool preview: no tool expected
Inventory: no cataloged tool
Protocol: no tool requirement
Requirement: none
```

```txt
Tool preview: Thick gloves available
Inventory: 1 Thick gloves cataloged in Storage Room
Protocol: tool requirement not enforced
Requirement: not enforced yet
```

```txt
Tool preview: Thick gloves not stocked
Inventory: 0 Thick gloves cataloged in Storage Room
Protocol: tool requirement not enforced; procedure still permitted
Requirement: not enforced yet
```

Pass 5 still did not enforce tool gates.

### Pass 6 — Tool Requirement Gates

Tool gates implemented.

Accepted behavior:
- matching handling actions require matching tools
- bare hands requires no tool
- missing tool disables relevant direct-handling buttons
- disabled buttons explain why
- handling method dropdown remains selectable
- tools are not consumed
- restocking tools re-enables actions

Accepted gate mappings:
- bareHands → no tool
- thickGloves → Thick gloves
- longTongs → Long tongs
- hookPole → Hook pole
- scraper → Scraper

Accepted blocked wording:
```txt
Procedure blocked: Thick gloves not stocked in Storage Room.
```

Accepted stocked wording:
```txt
Tool preview: Thick gloves available
Inventory: 1 Thick gloves cataloged in Storage Room
Protocol: required tool stocked
Requirement: stocked
```

Accepted missing-tool wording:
```txt
Tool preview: Thick gloves not stocked
Inventory: 0 Thick gloves cataloged in Storage Room
Protocol: procedure blocked until tool is stocked
Requirement: blocked until stocked
```

## Current item catalog

### Materials

| Key | Label | Category | Starter amount |
|---|---|---:|---:|
| biomass | Biomass | Materials | 0 |
| traceSlime | Trace slime | Materials | 0 |
| contaminatedResidue | Contaminated residue | Materials | 0 |
| ruinedOrganicMatter | Ruined organic matter | Materials | 0 |
| preservedTissue | Preserved tissue | Materials | 0 |

### Tools & Supplies

| Key | Label | Category | Starter amount | Current behavior |
|---|---|---:|---:|---|
| thickGloves | Thick gloves | Tools & Supplies | 1 | Required for Thick gloves handling method |
| longTongs | Long tongs | Tools & Supplies | 1 | Required for Long tongs handling method |
| hookPole | Hook pole | Tools & Supplies | 1 | Required for Hook pole handling method |
| scraper | Scraper | Tools & Supplies | 1 | Required for Scraper handling method |

## Current handling-method inventory behavior

### Bare hands

Accepted:
```txt
Tool preview: no tool expected
Inventory: no cataloged tool
Protocol: no tool requirement
Requirement: none
```

Bare hands remains always available if no other non-inventory blocker applies.

### Tool methods

If stocked:
```txt
Tool preview: <Tool> available
Inventory: <amount> <Tool> cataloged in Storage Room
Protocol: required tool stocked
Requirement: stocked
```

If missing:
```txt
Tool preview: <Tool> not stocked
Inventory: 0 <Tool> cataloged in Storage Room
Protocol: procedure blocked until tool is stocked
Requirement: blocked until stocked
```

Disabled action title:
```txt
Procedure blocked: <Tool> not stocked in Storage Room.
```

## Relationship to existing systems

### Storage Room

Inventory is grounded in Storage Room.

Storage Room remains:
- real room
- connected only to Main Lab
- closed door by default
- container-compatible
- material-storage identity

Inventory is lab-wide for now but fictionally stored in the Storage Room.

### Handling methods

Inventory now affects handling methods.

Handling methods remain selectable even when their tool is missing.

Action buttons that use a missing required tool are blocked.

### Direct handling risk

Inventory tool gates work alongside direct handling risk.

A blocked action should show the missing-tool reason rather than creating a task.

Direct handling risk still exists and should not be removed.

### Corpse/remains handling

Where existing remains/corpse handling uses the current handling method, tool requirements should apply.

No new corpse output/material generation was added.

### Resources/feedstocks

Inventory is separate from existing resources and feedstocks.

Do not merge inventory items with existing feedstocks unless a future design explicitly starts that work.

## Detached message/tone rules

Inventory and handling messages should use detached lab-observation/protocol wording.

Accepted:
```txt
Stored material logged: Biomass +1.
```

```txt
Procedure blocked: Thick gloves not stocked in Storage Room.
```

Avoid:
```txt
I cannot do that.
```

```txt
The scientist cannot proceed.
```

Avoid emotional or self-concerned framing.

## Explicitly not implemented

Inventory currently does not add:
- crafting
- recipes
- vendors
- shops
- buying/selling
- item rarity
- equipment slots
- tool durability
- tool contamination
- tool consumption
- storage capacity
- room-local material piles
- hauling inventory between rooms
- item decay
- container repair
- research costs
- auto-loot
- gameplay material sources
- corpse processing outputs
- cleanup outputs
- new slime behavior
- new door mechanics
- new injury mechanics
- combat
- recapture
- escape systems
- PPE systems beyond cataloged handling tools
- treatment systems
- medicine systems

Do not add those unless a future design discussion explicitly starts that system.

## Tests / QC completed

### Pass 1 QC

Initial result:
- syntax check passed
- inventory panel rendered
- all five materials appeared at 0
- save/load normalization worked
- Storage Room grounding was correct
- scope was clean
- cheat button was broken

Issue:
- Inventory Cheat button had no click event listener.

Verdict:
- fix required

### Pass 1 Fix 1 QC

Result:
- syntax check passed
- smoke test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- Inventory Cheat button works
- Enter key works
- every defined inventory item could be added
- no scope creep

Verdict:
- ACCEPT

### Pass 2 QC

Initial result:
- app implementation correct
- Pass 1 regression passed
- strict-mode failure in Pass 2 test

Issue:
- broad `[data-inventory-category="materials"]` selector matched both category section and child rows

Verdict:
- test fix required

### Pass 2 Fix 1 QC

Result:
- syntax check passed
- smoke tests passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- Materials section exists
- Tools & Supplies section exists
- tool catalog present
- aliases work
- no action gates
- no scope creep

Verdict:
- ACCEPT

### Pass 3 QC

Result:
- syntax check passed
- smoke tests passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- materials start at 0
- tools start at 1
- tooltips mention starter stock/catalog-only
- cheats add on top of starter stock
- handling methods not gated
- no scope creep

Verdict:
- ACCEPT

### Pass 4 QC

Initial issue:
- user initially received/witnessed wrong zip contents from an earlier bundle confusion
- corrected bundle was generated and tested

Final result:
- syntax check passed
- smoke tests passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- handling policy inventory note works
- container handling summaries include inventory/requirement info
- button titles include inventory/requirement info
- cheat updates propagate to handling UI
- no gating yet
- no scope creep

Verdict:
- ACCEPT

### Pass 5 QC

Result:
- syntax check passed
- targeted smoke tests passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- tool preview shows no tool expected / available / not stocked
- available/not-stocked behavior works
- container summary/button titles include preview and protocol
- inventory cheat updates propagate
- no gates yet
- no scope creep

Verdict:
- ACCEPT

### Pass 6 QC

Result:
- syntax check passed
- targeted smoke tests passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Confirmed:
- tool gates work
- stocked tools allow actions
- missing tools disable relevant action buttons
- disabled tooltip/title uses:
  - `Procedure blocked: Thick gloves not stocked in Storage Room.`
- restocking re-enables actions
- handling method dropdown remains selectable
- tools are not consumed
- no durability/crafting/capacity/room-local systems
- no scope creep

Verdict:
- ACCEPT

## Known limitations / future work

Potential future work:
- add gameplay material sources, such as corpse processing producing biomass or ruined organic matter
- add contamination cleanup outputs to inventory only after design discussion
- add inventory source/discovery messages
- add material spending for research or synthesis only after design discussion
- add storage capacity only after design discussion
- add room-local storage/hauling only after design discussion
- add tool durability/contamination only after design discussion
- refine cheat aliases if needed
- audit all direct-handling actions to ensure missing-tool gates apply wherever intended

Likely next inventory direction:
- Inventory Pass 7 — one narrow gameplay source for materials, probably corpse/remains processing output
- or pause inventory and return to gameplay systems

## Repository / workflow notes

This system is expected to be incorporated into the current tracked source files.

Project workflow reminders:
- Use fresh prompts for new Cline/Codex chats.
- Each Cline chat has no prior context; prompts must be self-contained.
- Cline should be used for QC/testing/visual inspection/reporting, not coding, unless explicitly requested.
- The assistant should generate implementation files/patch bundles directly when asked.
- When replacement-file bundles are created, provide only the `.zip` link by default.
- Do not add manifest files to normal zips unless explicitly needed.
- Discuss each pass before coding.
- Run syntax checks and smoke/QC tests before committing.
- Use `git add .` for staging unless there is a specific reason not to.
- Do not create handoff docs until all passes for a feature are accepted.

Suggested commits for accepted work:
- `Add storage inventory ledger`
- `Add inventory tools catalog`
- `Add inventory starter stock`
- `Add inventory-aware handling UI`
- `Add tool requirement previews`
- `Add tool requirement gates`
