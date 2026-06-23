# System Handoff — Byproduct Coherence

Date: 2026-06-23

## Status

Byproduct Coherence is implemented and accepted through Pass 3.

Accepted work:
- Byproduct Coherence Pass 1: Biologically Coherent Byproducts
- Byproduct Coherence Pass 1 Fix 1: Browser-context test fix
- Byproduct Coherence Pass 2: Physiology-Compatible Natural Byproducts
- Byproduct Coherence Pass 2 Fix 1: Pass 1 regression test signature update
- Byproduct Coherence Pass 3: Output Intensity Bands and Rolled Expression
- Byproduct Coherence Pass 3 test fixes: Pass 1/2 regression tests updated for multi-line byproduct titles

This handoff should be treated as the current source of truth for the byproduct coherence system.

## Purpose

This system fixes byproduct generation so slimes produce biologically coherent natural byproducts.

Before this work:
- Byproducts could be selected in ways that did not make sense for the slime.
- An acid slime could receive a byproduct that had no acid/chemical/biological coherence.
- Byproduct behavior was too arbitrary and felt detached from the organism’s element and physiology.

After this work:
- Byproduct remains genetic internally.
- Element/biology determines the compatible byproduct pool.
- Body consistency/physiology refines the compatible pool.
- The byproduct gene pair selects the byproduct slot and output intensity band.
- Each specimen rolls a hidden exact expression value inside the selected band.
- Moderate output is the baseline metabolic demand.
- Trace/Low output reduce food demand slightly.
- High output increases food demand slightly.
- Player-facing UI stays simple and does not explain genetic mapping.
- Jobs/intended uses do not affect natural byproducts.
- No harvesting, inventory output, feeding-residue system, current-output simulation, or harvestable-material system has been added.

## Core design decisions

### Natural byproduct is not job output

A slime’s job/use should not determine its natural byproduct.

Accepted distinction:
- Natural byproduct: what the slime naturally leaves behind as part of its biology.
- Feeding residue: mess left because of what the slime ate.
- Harvestable material: what can be extracted from the slime itself.

These are separate concepts.

Examples:
- A slime eating corpses may leave loose biomatter or ruined organic residue because of the meal.
- That does not mean biomatter is its natural byproduct.
- That also does not determine what can be harvested from the slime itself.

Rejected:
- `Use as Cleaner` changing natural byproduct
- corpse-processing job changing natural byproduct
- intended use changing natural byproduct
- player-selected job affecting natural byproduct

### Byproduct remains genetic internally

Byproduct is still controlled by genes.

The important change is that the byproduct gene is interpreted through biological context:
- Element/biology determines the compatible pool.
- Consistency/physiology can reorder or refine that pool.
- The byproduct gene pair selects a slot in the resulting pool.
- The same byproduct gene pair also selects an output intensity band.

Player-facing UI should not show the internal genetic mapping.

### The same gene pair is stable

The same gene pair should have stable internal meaning.

Accepted:
- the same gene pair selects the same slot group
- the same gene pair selects the same output band
- multiple gene pairs can map to the same byproduct slot
- multiple gene pairs can produce the same byproduct name while differing in output intensity

Example concept:
- AA and AT can both select the same byproduct slot.
- AA may be Trace output.
- AT may be Low output.
- Both can show the same byproduct name with different natural output and metabolic demand.

### Multiple alleles can produce the same byproduct

There are 16 two-base byproduct gene combinations.

Not every pair needs a unique byproduct.

Accepted:
- 16 gene pairs map into 4 byproduct slots
- multiple allele pairs can resolve to the same byproduct slot
- each element/physiology context maps those slots to biologically coherent outcomes

### Player-facing UI should not explain genetics

The UI should remain simple and observational.

Accepted:
```txt
Byproduct: Acid droplets
Natural output: High
Metabolic demand: Elevated
```

Forbidden player-facing text:
```txt
Byproduct gene
AT selects
allele slot
gene-compatible pool
food modifier
output scalar
```

Do not show:
- exact scalar
- exact food modifier
- allele-to-slot explanation
- gene pair mapping
- internal hidden roll values

### Moderate output is the baseline

Moderate output is the default metabolic baseline.

Accepted:
- Moderate output should map to baseline metabolic demand.
- Trace and Low output slightly reduce food demand.
- High output slightly increases food demand.
- The modifier is intentionally small.

### Good individual rolls are possible

The genome determines the band, but the individual specimen rolls inside that band.

Accepted:
- same genome can produce different hidden expression rolls on different specimens
- the roll is hidden
- high rolls can matter later if harvesting or output collection is added
- the game can support “good roll” chase behavior like rare/shiny specimen hunting

## Implemented behavior by pass

### Pass 1 — Biologically Coherent Byproducts

Pass 1 fixed the global-random byproduct problem.

Implemented:
- element-compatible byproduct pools
- 16 byproduct gene pairs mapped deterministically into 4 stable slots
- byproduct resolution through element-compatible pools
- acid slimes resolve acid-compatible byproducts
- water slimes resolve water-compatible byproducts
- all elements have dedicated compatible pools
- no player-facing genetic explanation text
- no new byproduct mechanics

Accepted acid-compatible byproducts:
- acid droplets
- corrosive slime
- dissolved sludge
- sterile solvent

Accepted water-compatible byproducts:
- clean water
- cooling brine
- watery residue
- slick gel

Pass 1 explicitly did not add:
- hybrid system
- byproduct harvesting
- inventory output
- current-output simulation
- gas/air systems
- acid damage
- new slime behavior

### Pass 1 Fix 1 — Browser-context test fix

Initial Pass 1 QC found:
- app implementation was correct
- browser test failed because a Node-scope helper was called inside `page.evaluate()`

Fix:
- moved genome replacement helper into browser context inside `page.evaluate()`

Result:
- smoke tests passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

### Pass 2 — Physiology-Compatible Natural Byproducts

Pass 2 refined byproduct resolution using body consistency/physiology.

Implemented:
- consistency/physiology influence for natural byproducts
- physiology profiles such as fluid/coating/dense/airy
- physiology-based slot reordering/refinement
- acid and water specific physiology overrides
- fallback physiology reordering for other element pools
- no job/intended-use influence

Accepted:
- element determines the compatible pool
- consistency/physiology narrows or reorders the pool
- the byproduct gene pair still selects a stable slot inside the resulting context
- different consistencies can produce different byproducts within the same element
- jobs/intended uses do not affect natural byproduct

Explicitly rejected:
- `currentOutputSimulation`
- `harvestByproduct`
- `byproductInventoryOutput`
- job-based byproduct changes
- intended-use byproduct changes
- corpse-eating residue logic
- feeding-residue system
- harvestable-material system

### Pass 2 Fix 1 — Pass 1 regression test signature update

Initial Pass 2 QC found:
- Pass 2 app implementation was correct
- Pass 1 regression test expected old 3-argument byproduct resolver call
- Pass 2 correctly used 4-argument call including `traits.consistency`

Fix:
- updated Pass 1 regression test to expect:
```js
resolveByproductOutcome(
  traits.element,
  traits.byproduct,
  getRegionCode(genome, "byproduct"),
  traits.consistency
)
```

Result:
- Pass 1 and Pass 2 tests passed
- no app behavior changed

### Pass 3 — Output Intensity Bands and Rolled Expression

Pass 3 made the byproduct gene do more than select the substance.

Implemented:
- output intensity bands
- hidden rolled expression values
- small metabolic demand modifiers
- byproduct title lines for broad player-facing labels
- food/nutrition gain/cost hooks using hidden modifier

Accepted visible labels:
- Natural output: Trace
- Natural output: Low
- Natural output: Moderate
- Natural output: High

Accepted metabolic labels:
- Metabolic demand: Slightly reduced
- Metabolic demand: Mild
- Metabolic demand: Baseline
- Metabolic demand: Elevated

Accepted internal output bands:

| Band | Hidden output scalar range | Food demand modifier |
|---|---:|---:|
| Trace | 0.25–0.50 | ×0.96–×0.98 |
| Low | 0.55–0.85 | ×0.98–×1.00 |
| Moderate | 0.90–1.10 | ×1.00 |
| High | 1.15–1.45 | ×1.02–×1.05 |

Accepted behavior:
- same byproduct gene pair chooses the same byproduct slot and output band
- individual specimens roll hidden expression values inside the selected band
- exact hidden values are not shown
- moderate output is baseline
- high output makes food demand slightly higher
- trace/low output makes food demand slightly lower
- jobs/intended uses do not affect output intensity

Pass 3 explicitly did not add:
- byproduct harvesting
- inventory outputs from byproducts
- current-output simulation
- feeding-residue system
- harvestable-material system
- acid damage systems
- gas/air systems
- hybrid element systems
- job-based byproduct changes
- intended-use byproduct changes
- new slime behavior
- new room mechanics
- crafting/recipes/storage capacity

### Pass 3 test fixes — Multi-line byproduct title regression fixes

Pass 3 added multi-line byproduct titles:
```txt
Byproduct: sterile solvent
Natural output: Trace
Metabolic demand: Slightly reduced
```

Older Pass 1/2 tests initially compared the entire title string and failed because AA/AT could share the same byproduct name while differing in output band/metabolic label.

Fixes:
- Pass 1 now uses helper to compare only the byproduct name portion for stable-slot checks.
- Pass 2 now extracts the first title line before comparing against allowed pool entries.
- Pass 2 same-slot checks now use the name-only helper instead of full title equality.
- Pass 3 separately verifies the output/metabolic labels.

Final result:
- Pass 1: 2/2 passed
- Pass 2: 2/2 passed
- Pass 3: 2/2 passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

## Current player-facing behavior

Byproduct UI may show:

```txt
Byproduct: Acid droplets
Natural output: Trace
Metabolic demand: Slightly reduced
```

```txt
Byproduct: Corrosive slime
Natural output: Low
Metabolic demand: Mild
```

```txt
Byproduct: Dissolved sludge
Natural output: Moderate
Metabolic demand: Baseline
```

```txt
Byproduct: Sterile solvent
Natural output: High
Metabolic demand: Elevated
```

The UI should not show:
- gene pair
- allele slot
- exact scalar
- exact food modifier
- genetic explanation
- internal roll quality

## Current internal model

The byproduct result is resolved roughly as:

```txt
element/biology -> compatible byproduct pool
consistency/physiology -> refined/reordered pool
byproduct gene pair -> slot + output band
specimen roll -> hidden exact expression inside the band
```

This model intentionally supports future creature-hunting:
- genes define the possible band
- individual roll determines hidden quality inside the band
- later testing/observation could reveal hints about unusually strong expression

## Relationship to other systems

### Inventory

Byproduct Coherence does not currently generate inventory items.

Inventory sources remain separate.

Do not add inventory output from natural byproducts without a future design discussion.

### Corpse processing

Corpse processing can recover inventory materials through the Inventory system.

That is not the same as natural byproduct.

A slime eating/processing a corpse may leave feeding residue, but feeding residue is not implemented as part of this byproduct system.

### Contamination cleanup

Contamination cleanup behavior and traces are separate from natural byproduct.

Do not use “Use as Cleaner” or cleanup activity to determine natural byproduct.

### Jobs / Intended use

Jobs and intended uses are explicitly excluded.

Natural byproduct should not change because the player assigns or intends a job.

### Harvestable materials

Harvestable specimen materials are not implemented here.

Future harvestable materials should be designed separately from natural byproducts.

## Explicitly not implemented

Byproduct Coherence currently does not include:
- byproduct harvesting
- inventory outputs from byproducts
- current-output simulation
- feeding-residue system
- harvestable-material system
- acid damage systems
- gas/air spread
- tool corrosion
- hybrid element systems
- job-based byproduct changes
- intended-use byproduct changes
- new slime behavior
- new room mechanics
- crafting
- recipes
- storage capacity
- exact output numbers in the UI
- genetic explanation in the UI
- visible roll-quality ratings

Do not add those unless a future design discussion explicitly starts that system.

## Tests / QC completed

### Pass 1 QC

Initial QC:
- syntax passed
- source-level implementation passed
- browser test failed due to Node-scope helper inside browser context

Issue:
- `replaceRegion()` unavailable inside `page.evaluate()`

Verdict:
- test fix required

### Pass 1 Fix 1 QC

Confirmed:
- browser-context genome replacement fixed
- smoke test passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0
- acid/water byproducts coherent
- allele slots stable
- no genetic explanation text
- no scope creep

Verdict:
- ACCEPT

### Pass 2 QC

Confirmed:
- source implementation correct
- acid and water physiology pools correct
- other elements fallback to physiology reordering
- consistency profiles influence byproduct selection
- jobs/intended uses excluded
- no genetic explanation text
- no scope creep

Issue:
- Pass 1 regression expected old 3-argument resolver call

Verdict:
- app accepted, test fix required

### Pass 2 Fix 1 QC

Confirmed:
- Pass 1 regression test updated to new 4-argument resolver call
- Pass 1 tests passed
- Pass 2 tests passed
- headed visual inspection passed
- console warnings/errors: 0
- page errors: 0

Verdict:
- ACCEPT

### Pass 3 QC

Confirmed:
- Pass 3 app implementation correct
- output bands present
- hidden rolled expression present
- metabolic demand modifier present
- broad UI labels shown
- exact scalar/modifier not shown
- jobs/intended uses excluded
- no scope creep

Issue:
- Pass 1/2 tests stale because they compared full multi-line byproduct title text

Verdict:
- app accepted, test fixes required

### Pass 3 test-fix QC

Confirmed:
- Pass 1 tests pass
- Pass 2 tests pass
- Pass 3 tests pass
- headed visual inspection passes
- console warnings/errors: 0
- page errors: 0
- hidden number/genetic explanation text remains absent
- no scope creep

Verdict:
- ACCEPT

## Known limitations / future work

Potential future work:
- add observation/testing to reveal estimated output quality without exact numbers
- add a separate feeding-residue system
- add a separate harvestable-material system
- add byproduct collection/harvesting only after design discussion
- add inventory outputs from byproducts only after design discussion
- tune output band ranges and food modifiers after playtesting
- add specific physiology overrides for more elements beyond acid/water if needed
- improve language for byproduct tooltip if it becomes unclear

Likely next byproduct direction:
- pause and hand off
- or Byproduct Coherence Pass 4 could add observation-based output quality estimates while still hiding exact roll values

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
