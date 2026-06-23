# System Handoff — Inventory

Date: 2026-06-23

## Status

Inventory is implemented and accepted through Pass 8.

Accepted work:
- Inventory Pass 1: Storage Room Ledger Foundation
- Inventory Pass 1 Fix 1: Inventory cheat button and Enter key fix
- Inventory Pass 2: Tools and Supplies Catalog
- Inventory Pass 2 Fix 1: Playwright strict-selector fix
- Inventory Pass 3: Starter Stock
- Inventory Pass 4: Inventory-Aware Handling UI, No Gates
- Inventory Pass 5: Tool Requirement Preview Warnings
- Inventory Pass 6: Tool Requirement Gates
- Inventory Pass 7: Inventory Change History Tooltips
- Inventory Pass 8: Corpse Processing Material Recovery

This handoff should be treated as the current source of truth for the Inventory system.

## Purpose

Inventory adds a Storage Room-grounded material/tool ledger to the lab.

Before this work:
- Storage Room existed as a real room, but no inventory/material ledger existed.
- Existing systems implied lab materials and tools such as biomass, trace slime, gloves, tongs, hook pole, and scraper.
- Handling methods existed, but they did not connect to any inventory/tool catalog.
- Material/resource changes risked becoming event-log spam.
- Corpse processing did not recover inventory materials into the Storage Room ledger.

After this work:
- Inventory exists as a lab-wide Storage Room ledger.
- Inventory is displayed in an Inventory panel.
- Inventory has Materials and Tools & Supplies categories.
- Starter materials begin at 0.
- Starter tools begin at 1 each.
- Cheats can add every defined inventory item.
- Handling methods are inventory-aware and require matching tools, except bare hands.
- Missing required tools disable relevant handling action buttons.
- Tools are reusable and are not consumed.
- Inventory changes are tracked in item tooltip history rather than event-log accounting spam.
- Corpse processing recovers simple inventory materials.
- No crafting, recipes, durability, vendors, storage capacity, room-local hauling, or equipment slots have been added.

## Core design decisions

### Inventory is a Storage Room ledger, not a backpack

Accepted visible identity:

```txt
Storage Room ledger · Lab-wide prototype
```

Inventory is lab-wide for now and fictionally stored in the Storage Room. It is not a personal backpack and not yet room-local item storage.

### Materials and tools are distinct

Inventory contains:
- Materials
- Tools & Supplies

Materials are stored biological/contaminant resources. Tools & Supplies are reusable lab tools and handling supplies.

### Starter stock

Materials start at 0:
- Biomass
- Trace slime
- Contaminated residue
- Ruined organic matter
- Preserved tissue

Tools start at 1:
- Thick gloves
- Long tongs
- Hook pole
- Scraper

### Cheats

Inventory cheats exist for prototype testing.

Accepted:
- cheats can add every material
- cheats can add every tool/supply
- cheat button works
- Enter key in the cheat input works
- aliases support common tool/item names
- positive and negative cheat adjustments are supported for testing
- inventory clamps at 0
- history records the actual clamped delta

### Inventory accounting belongs in tooltips, not the event log

Routine material/resource accounting should not spam the event log.

Accepted:
- inventory rows show recent changes in tooltip/title text
- each item history stores up to the last 10 changes
- compact history lines do not use timestamps for now

Examples:
```txt
+5 cheat adjustment
-2 cheat adjustment
+1 corpse processing
```

Rejected:
- repeated event log entries such as `Stored material logged: Biomass +1.`
- repeated event log entries such as `Recovered material: Biomass +1.`

The event log should remain reserved for meaningful observations, incidents, and discoveries.

### Handling methods are inventory-aware

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

### Corpse processing is the first real inventory material source

Accepted:
- completed corpse processing recovers inventory materials
- inventory gains go to the Storage Room ledger
- inventory gains record item history
- inventory gains do not create event-log accounting spam

Accepted first-pass output table:
- Fresh corpse processed: Biomass +1
- Decaying corpse processed: Biomass +1
- Spoiled corpse processed: Biomass +1
- Ruined corpse processed: Ruined organic matter +1

Rejected in Pass 8:
- dumping/disposal material gains
- scraping/dumping into pits material gains
- cleanup output material gains
- necropsy/genetic material changes
- new corpse states
- new corpse processing actions

## Implemented behavior by pass

### Pass 1 — Storage Room Ledger Foundation

Added:
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

### Pass 1 Fix 1 — Cheat event wiring

Fixed:
- Inventory Cheat button runs `runInventoryCommand()`
- Enter key in the Inventory Cheat input runs `runInventoryCommand()`

### Pass 2 — Tools and Supplies Catalog

Added categories:
- Materials
- Tools & Supplies

Added tools/supplies:
- Thick gloves
- Long tongs
- Hook pole
- Scraper

Pass 2 was catalog-only and did not gate actions.

### Pass 2 Fix 1 — Test selector fix

Fixed Playwright strict-mode selector issue by scoping category checks to inventory sections.

### Pass 3 — Starter Stock

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

### Pass 4 — Inventory-Aware Handling UI, No Gates

Handling UI became inventory-aware but did not block actions yet.

Accepted:
- Handling policy UI shows inventory note for selected method.
- Container handling summaries include method inventory amount and requirement status.
- Open/Close Container button titles include method inventory amount and requirement status.
- Remains/handling/transfer action titles include method inventory details where applicable.
- Inventory cheat updates propagate to handling UI.

### Pass 5 — Tool Requirement Preview Warnings

Handling UI gained clearer preview wording:
- no tool expected
- available
- not stocked
- protocol
- requirement status

Still no gates in Pass 5.

### Pass 6 — Tool Requirement Gates

Tool gates implemented.

Accepted mappings:
- bareHands → no tool
- thickGloves → Thick gloves
- longTongs → Long tongs
- hookPole → Hook pole
- scraper → Scraper

Accepted:
- missing tool disables relevant direct-handling buttons
- disabled buttons explain why
- handling method dropdown remains selectable
- tools are not consumed
- restocking tools re-enables actions

### Pass 7 — Inventory Change History Tooltips

Per-item inventory history added.

Accepted:
- each item has change history
- item row tooltip shows item label, description, current amount, and recent changes
- no timestamp in history lines for now
- last 10 changes are shown
- no history shows `No recorded changes.`
- positive and negative cheat changes are recorded
- negative changes clamp at 0
- history records the actual clamped delta
- inventory changes do not generate event-log accounting spam

### Pass 8 — Corpse Processing Material Recovery

Corpse processing now recovers inventory materials.

Accepted:
- Fresh/Decaying/Spoiled processed corpses add Biomass +1
- Ruined processed corpses add Ruined organic matter +1
- inventory history records `+1 corpse processing`
- inventory gains do not create event-log accounting spam
- dumping/disposal does not produce inventory materials
- tool gates and inventory history regressions still pass

## Current item catalog

### Materials

| Key | Label | Category | Starter amount | Current gameplay source |
|---|---|---:|---:|---|
| biomass | Biomass | Materials | 0 | Corpse processing: Fresh/Decaying/Spoiled +1 |
| traceSlime | Trace slime | Materials | 0 | None yet |
| contaminatedResidue | Contaminated residue | Materials | 0 | None yet |
| ruinedOrganicMatter | Ruined organic matter | Materials | 0 | Corpse processing: Ruined +1 |
| preservedTissue | Preserved tissue | Materials | 0 | None yet |

### Tools & Supplies

| Key | Label | Category | Starter amount | Current behavior |
|---|---|---:|---:|---|
| thickGloves | Thick gloves | Tools & Supplies | 1 | Required for Thick gloves handling method |
| longTongs | Long tongs | Tools & Supplies | 1 | Required for Long tongs handling method |
| hookPole | Hook pole | Tools & Supplies | 1 | Required for Hook pole handling method |
| scraper | Scraper | Tools & Supplies | 1 | Required for Scraper handling method |

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

Inventory affects handling methods.

Handling methods remain selectable even when their tool is missing.

Action buttons that use a missing required tool are blocked.

Tools are not consumed.

### Direct handling risk

Inventory tool gates work alongside direct handling risk.

A blocked action should show the missing-tool reason rather than creating a task.

Direct handling risk still exists and should not be removed.

### Corpse/remains handling

Completed corpse processing can recover inventory materials.

Where existing remains/corpse handling uses the current handling method, tool requirements should apply.

Dumping/disposal does not recover inventory materials.

### Resources/feedstocks

Inventory is separate from existing resources and feedstocks.

Important known distinction:
- Existing abstract resource biomass may still be updated by older corpse-processing systems.
- Inventory Biomass is a separate Storage Room ledger item.
- Do not merge inventory items with existing feedstocks unless a future design explicitly starts that work.

## Detached message/tone rules

Inventory and handling messages should use detached lab-observation/protocol wording.

Accepted:
```txt
Procedure blocked: Thick gloves not stocked in Storage Room.
```

```txt
+1 corpse processing
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
- cleanup output material sources
- trace slime gameplay sources
- contaminated residue gameplay sources
- preserved tissue gameplay sources
- new corpse states
- new corpse processing actions
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

### Pass 2 QC / Fix 1

Initial app was correct, but Pass 2 had a Playwright strict-mode selector bug. Fix 1 corrected the selector.

Final confirmed:
- Materials section exists
- Tools & Supplies section exists
- tool catalog present
- aliases work
- no action gates
- no scope creep

Verdict:
- ACCEPT

### Pass 3 QC

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

Confirmed:
- tool gates work
- stocked tools allow actions
- missing tools disable relevant action buttons
- disabled tooltip/title uses `Procedure blocked: Thick gloves not stocked in Storage Room.`
- restocking re-enables actions
- handling method dropdown remains selectable
- tools are not consumed
- no durability/crafting/capacity/room-local systems
- no scope creep

Verdict:
- ACCEPT

### Pass 7 QC

Confirmed:
- inventory tooltip history works
- positive/negative cheat history works
- no event-log accounting spam
- last-10 history cap works
- tool gate regression passes
- save/load normalization works
- no scope creep

Verdict:
- ACCEPT

### Pass 8 QC

Confirmed:
- corpse-processing inventory recovery works
- Fresh/Decaying/Spoiled processed corpses add Biomass +1
- Ruined processed corpses add Ruined organic matter +1
- inventory tooltip/history records `+1 corpse processing`
- no event-log accounting spam
- non-processing disposal does not add inventory
- tool gate regression passes
- inventory history regression passes
- no scope creep

Known test issue:
- headed test timed out waiting for `#skipAmountInput`
- classified as test-script timing fragility, not app bug

Verdict:
- ACCEPT

## Known limitations / future work

Potential future work:
- harden the Pass 8 headed visual test if needed
- add material sources for Trace slime
- add material sources for Contaminated residue
- add material sources for Preserved tissue
- decide if fresh corpse processing should eventually recover Preserved tissue instead of only Biomass
- add inventory source/discovery messages only if they do not spam the event log
- add material spending for research or synthesis only after design discussion
- add storage capacity only after design discussion
- add room-local storage/hauling only after design discussion
- add tool durability/contamination only after design discussion
- audit all direct-handling actions to ensure missing-tool gates apply wherever intended
- review interaction between legacy resource biomass and inventory Biomass if confusion appears

Likely next inventory direction:
- inventory is complete enough to pause
- or Inventory Pass 9 could add one carefully designed source for Trace slime / Contaminated residue / Preserved tissue

## Repository / workflow notes

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
