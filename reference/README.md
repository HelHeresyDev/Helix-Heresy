# Creature reference

For Linux, open **[creature-catalog.ods](creature-catalog.ods)** in LibreOffice Calc.
This is the native OpenDocument format, with all eight sheets, formatting, filters
and frozen headers. Double-click the file, or run this from the repository root:

```sh
libreoffice --calc reference/creature-catalog.ods
```

The original **[XLSX workbook](creature-catalog.xlsx)** is also retained for Excel
and other compatible applications. Both workbooks contain:

- Catalog: humans, slime, Mudlet, Cinderling, Zephyr Mote, Rootling, Sporecap, human-derived homunculus, Hauntbound, Quartz Shardling, Duskcat, Lantern Wisp and all 24 beast species (36 entries). Hauntbound are existing deceased individuals inhabiting objects, not a production recipe or biological species. Quartz Shardling is the first material-specific mining subtype. Duskcat replaces Shadelet with a biological dark-aspected feline. Lantern Wisp is a fragile luminous mineral creature with finite real light, learned local following and physical lantern custody, not a ghost or free permanent lamp.
- **Ecological rates: numeric initial balance values for all 36 entries.** Columns E–P contain separate nurturing/destruction rates for soil/cover, freshwater quantity, freshwater quality, wetland/reef habitat, renewable biomass and arcane stability. Columns C/D identify the counting basis and initial-tuning status. These are real number cells, including explicit zeroes and fractional worker rates, not prose descriptions.
- **Lifecycle & resource use: numeric consumption, reproduction, maturity and mortality for all 36 entries.** It also includes body masses, juvenile intake factors, parental/queen counting units, gestation/incubation, birth material investment, reserves, ageing, travel, temperature, habitat and predation. Existing implemented care values are cited; new demographic values are labeled initial tuning.
- Production detail: per-creature ingredients, process costs, equipment, utilities and care.
- Beast ecology: decoded biomes, comparative prevalence, threat, movement and social traits.
- Planned creatures: no active proposals. Bone Skitter was shelved, not implemented or replaced; its existing tab remains intentionally empty.
- Other life & forms: explicit dog lore and divine, avatar, scientist and receiver distinctions.
- Read me: interpretation, scope, source revision and design limits.

Filters are in row 4; headers and identifying columns stay frozen. Unknown values
are explicitly **Not defined**, not invented zeroes. Human-derived homunculus
numeric tiers are unassigned. Beast rarity uses the actual comparative prevalence
rank rather than invented spawn percentages. No particular world census is implied.
Research tier and production/synthesis tier are independent.

**To find the numbers, select the Ecological rates tab.** They are also in Catalog
columns Q–AB and in the CSV. Units are **ecological points per stated individual
per game day**: 1 EP changes 1 affected hectare by 1 percentage point in that ledger.
For example, Ironroot Colossus has soil/cover nurture **40** and destruction **4**;
Ashhorn Behemoth has **1** and **60**. Multiply each channel by actual local
individual-days and supported activity/resource factors, then divide by affected
hectares for condition-point change. Use the actual calendar month, not an assumed
30 days. Do not sum unlike ledgers or award planned work upfront.

These are **initial authored balance coefficients, not current runtime rates or
proven final balance**. The counting basis matters: Ember Ant rates are per active
worker, Mire Choir per member, Brine Cathedral per whole mature superorganism, and
Marsh Hydra per body rather than per head. Predation-based nurturers such as the
Glasswing Roc have no imaginary direct repair bonus; their ecological benefit
comes from actual control of destructive populations. Zero is deliberate rather
than unknown. Supply, damage, season and performed work still limit achieved rates.

For the new life-history numbers, select **Lifecycle & resource use**:

- **G–K:** food/organic kg/day, direct water L/day, mineral kg/day, fuel units/day and routine mana/day. Other energy demands and their units are in L/M. Minerals/fuel/mana are not interchangeable food kilograms; marine bodies still need seawater/oxygen even with zero direct freshwater drinking.
- **O–Q:** earliest independent care, adult body and reproductive eligibility in days. These are different clocks; natural maturation is not replaced by a fast laboratory formation timer.
- **S–AB:** actual reproductive counting unit, parental/queen body and mortality, attempts per **365 elapsed game days**, success fraction, offspring per successful event, gestation/incubation and cooldown. Never multiply queen recruitment by worker count or whole-colony recruitment by polyp count.
- **AH–AK:** juvenile/adult background hazards per **1,000 individual-days**, ageing onset and hazard-doubling interval. For constant hazard `h` over `d` days, death probability is `1 - exp(-h*d/1000)`, not a fixed monthly cull. Explicit combat, starvation and existing genomic life-budget deaths are not charged twice.

Compact numeric lifecycle values are also in **Catalog AF–AK / CSV**, with status
in AL. The [lifecycle reference](CREATURE_LIFECYCLES.md) explains the full schema,
resource accounting, monthly cohorts and special cases. `N/A` explicitly marks
inapplicable/unestablished fields: Hauntbound do not reproduce, artificial homunculus
fertility is not established, and natural elemental/mineral recruitment counts
actual finite formation sites rather than adult parents. Zero modeled homunculus
recruitment is not a claim of biological sterility. Baseline hazards are not a
guarantee of safety or a hard lifespan expiration date.

The Catalog also includes **approved-design** columns for nurturing/destroying/neutral
disposition, net environmental impact and specific ecological adversaries. These
are not morality, threat ratings or a claim of implemented regional balancing.
The Beast ecology sheet's **Food-web role** remains the separate authored niche.
The [fixed biology and ecology matrix](CREATURE_ECOLOGY_MATRIX.md) covers all 36
classifications, the 24 strategic species' bounded biology/capabilities, local
maintenance, actual nurturer defeat, exhausted territories and conditional recovery.
Its B–D ownership table identifies the remaining runtime work without adding prompts.
The matrix and workbook Read me also record monthly regional planning with gradual
effects, per-individual rate units and knowledge-limited migration: traditional
destinations can fail, forced dispersal is essentially random, and no hidden
capacity coordinator guarantees a safe arrival. Numeric baseline coefficients are
now published; their consumed implementation, calibration and the actual monthly
simulation remain C/D work, not completed runtime behavior.

[The CSV](creature-catalog.csv) contains the primary catalog only; additional sheets
and formatting are in the ODS/XLSX workbooks. [The preview](creature-catalog-preview.png) shows
selected columns/rows from the same dataset, not every sheet.

Rebuild the snapshots with:

```sh
python3 scripts/build-creature-catalog.py --as-of 2026-11-12
PYTHONDONTWRITEBYTECODE=1 python3 tests/creature-catalog.test.py
```

To build only the Linux-native ODS without replacing existing XLSX, CSV or preview
files, add `--format ods` to the build command.

To check the existing ODS conversion against the XLSX without requiring the source
documents to remain at their original locations:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tests/creature-catalog.test.py OdsArtifactTests
```

Source citations refer to the captured source files. The displayed revision is
the repository base; a rebuild can include working-tree changes against that base.
If source documents are relocated, the exporter's source paths must be updated
before full regeneration; this does not affect opening the existing workbooks.

The full rebuild also regenerates `CREATURE_ECOLOGY_MATRIX.md` and
`CREATURE_LIFECYCLES.md` from their authored design sources; edit those sources
rather than the generated Markdown tables.
The exporter reads existing runtime definitions and current pending proposals;
manual annotations live in `scripts/creature-catalog-data.js`, with approved ecological
design in `scripts/creature-ecology-design.js` and numeric life histories in
`scripts/creature-lifecycle-data.js`. It changes no gameplay
definitions. ODS/XLSX/CSV generation uses Python's standard library and Node.js;
the optional PNG preview additionally uses Pillow. Rebuilding replaces these named
generated snapshots, so retain manual workbook edits separately if desired.
