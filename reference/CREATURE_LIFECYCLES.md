# Creature lifecycle and resource-use reference

> All 36 current entries. Numeric initial balance values with explicitly preserved implemented care values. Not an implemented regional population simulation.

Generated from `scripts/creature-lifecycle-data.js` by the existing creature-catalog builder. Open **Lifecycle & resource use** in the ODS/XLSX workbook for separate numeric columns. `N/A` means inapplicable/unestablished, not a missing zero. No new species, production recipe or queue entry is created.

## Units and monthly application

- Intake is per stated reference body per game day under stated nominal conditions. kg/L/MJ/mana/game fuel units are distinct; ecological points are not food mass. Zero direct water intake for marine bodies is not independence from seawater, oxygen or dietary water. Air, substrate, mineral and mana-fed bodies still require conserved physical body matter.
- Counts refer to actual individuals. Reproduction has its own explicit counting unit: an eligible parent, a viable queen/hive, a whole supported colonial fragment or a real finite formation site. Do not multiply queen recruitment by worker count, whole-superorganism reproduction by polyp count or Hydra reproduction by heads. No site means no site recruitment, regardless of adult headcount.
- Attempts are per **365 elapsed game days**, a standardized rate denominator, not a claim every game-calendar year has 365 days. Expected attempts over a month = eligible actual reproductive units × attempts365 × elapsed days / 365, limited by season, cooldown, mate access, health and paid materials. Actual decisions use only individual instincts/observations/memory/received information. Birth/establishment is scheduled after its own incubation/gestation, not immediately on attempt or at month end. Success is a tuning reference under eligible supported conditions, not a guaranteed fraction of immortal offspring.
- Earliest independence, body maturity and fertility are separate and do not guarantee knowledge, speech, willingness or self-care. Independence may follow body maturity for an artificially grown human-derived body. Food/resource-limited growth cannot meet a mass milestone merely because the calendar elapsed. Juvenile per-body intake starts from adult intake × (actual mass / reference adult mass)^0.75 × juvenile multiplier as initial tuning; actual metabolic and growth inputs remain capped by available compatible resources. Formation clocks are separate from natural birth clocks.
- Extra birth investment = newborn mass × offspring / reproductive assimilation, paid in actual compatible materials over the attempt. Division/fragmentation instead partitions existing parent mass and counts no duplicate added birth mass. Growing afterward still needs intake. Unassisted artificial bodies keep the existing creation-time soul rules; natural recruitment is not a soul retrofit, copied parent soul or free life recipe.
- Background mortality is a **continuous hazard per 1000 individual-days**, not a monthly kill percentage or life-expiration timer. For a constant hazard h over d days, probability = 1 − exp(−h × d / 1000). Juvenile/adult bands split at adultDays; old-age hazard doubles every stated interval after ageing onset. Median/expected lifespan follows the curve and actual hazards rather than a separate contradictory fixed expiry. Explicit combat, predation, starvation, drowning, disease already modeled, soul destruction and existing genomic life budgets are excluded from a second background death charge. No finite ageing onset is not invulnerability.
- Monthly expectations are aggregated into conserved integer age cohorts and scheduled actual events, not fractional bodies or always rounding small cohorts to zero. Use persistent seeded choices/fractional event budgets without rerolling saves; no births before actual gestation or applying an entire month of deaths immediately. Cohort splits and lazy interval evaluation preserve the same resources, members and age-band hazards.
- Reserve days describe stored usable resource at nominal demand, not a guaranteed time-to-death. Starvation/dehydration affect work, fertility, wounds and survival under actual care rules. Travel costs share the same reserves and travel ceilings are not safe-route or migration-knowledge grants. Stationary bodies do not migrate themselves. Habitat area is a reference space allocation, not food capacity, a global destination oracle or authority over a territory. Temperature columns are unprotected/reference niches; body/core exceptions are explicit.
- Predation attempts, success and usable meal size are conditional averages, capped by real perceived reachable prey, effort and existing combat. Derive actual food from actual killed/captured bodies, retaining remains. Do not guarantee hunter food or also charge the same prey a second biomass/death debit. Species can fail to meet maintenance even where average hunting yield appears sufficient.

## Consumption and body reference

| Creature | Adult / newborn kg | Food kg/day | Direct water L/day | Minerals kg/day | Fuel units/day | Mana/day | Other demand/day |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Human | 70 / 3.5 | 1.5 | 3 | 0 | 0 | 0 | 0 N/A |
| Slime | 1 / 0.5 | 0.02 | 0 | 0 | 0 | 0 | 0 N/A |
| Mudlet | 2 / 2 | 0 | 1.8 | 0 | 0 | 0 | 0 N/A |
| Human-derived homunculus | 48 / 48 | 1.2 | 2.5 | 0 | 0 | 0 | 0 N/A |
| Cinderling | 1 / 1 | 0 | 0 | 0 | 24 | 0 | 0 N/A |
| Zephyr Mote | 0.12 / 0.12 | 0 | 0 | 0 | 0 | 24 | 0 N/A |
| Rootling | 1.25 / 0.02 | 0.48 | 1.2 | 0.024 | 0 | 0 | 0 N/A |
| Sporecap | 0.5 / 0.001 | 1.2 | 0.48 | 0 | 0 | 0 | 0 N/A |
| Hauntbound | 0.5 / N/A | 0 | 0 | 0 | 0 | 0 | 0 N/A |
| Quartz Shardling | 2 / 0.1 | 0 | 0 | 0.24 | 0 | 0 | 0 N/A |
| Duskcat | 2.5 / 0.1 | 0.288 | 0.6 | 0 | 0 | 0 | 0 N/A |
| Lantern Wisp | 0.1 / 0.1 | 0 | 0 | 0 | 0 | 48 | 0 N/A |
| Ashhorn Behemoth | 400000 / 2500 | 2000 | 12000 | 2000 | 0 | 0 | 0 N/A |
| Glasswing Roc | 30000 / 200 | 600 | 120 | 0 | 0 | 0 | 0 N/A |
| Mire Choir | 60 / 0.05 | 2 | 2 | 0 | 0 | 0 | 0 N/A |
| Nullmaw Stalker | 500 / 10 | 12 | 20 | 0 | 0 | 0 | 0 N/A |
| Thunderback Grazer | 2500 / 80 | 70 | 160 | 0 | 0 | 0 | 5 MJ atmospheric electrical charge; only while actually available |
| Candlecap Myriapod | 0.3 / 0.0003 | 0.015 | 0.01 | 0 | 0 | 0 | 0 N/A |
| Ironroot Colossus | 300000 / 1 | 300 | 6000 | 1200 | 0 | 40 | 0 N/A |
| Gloam Prowler | 250 / 3 | 8 | 12 | 0 | 0 | 0 | 0 N/A |
| Rimefang Pack | 120 / 1.5 | 4 | 5 | 0 | 0 | 0 | 0 N/A |
| Sunspine Basilisk | 400 / 0.3 | 5 | 3 | 0 | 0 | 0 | 0 N/A |
| Ley Manta | 2000 / 10 | 0.2 | 0 | 0.02 | 0 | 60 | 0 N/A |
| Carrion Lantern | 30 / 0.2 | 1.5 | 0.3 | 0 | 0 | 0 | 0 N/A |
| Brine Cathedral | 2000000 / 100 | 40000 | 0 | 200 | 0 | 0 | 0 N/A |
| Reef Wyrm | 50000 / 30 | 800 | 0 | 20 | 0 | 0 | 0 N/A |
| Abyssal Bell | 80000 / 100 | 600 | 0 | 0 | 0 | 0 | 0 N/A |
| Frostwake Leviathan | 200000 / 3000 | 4000 | 0 | 0 | 0 | 0 | 0 N/A |
| Marsh Hydra | 1500 / 2 | 40 | 20 | 0 | 0 | 0 | 0 N/A |
| Rivercoil | 40000 / 50 | 600 | 0 | 10 | 0 | 0 | 0 N/A |
| Ember Ant | 0.001 / 0.000002 | 0.0002 | 0.0001 | 0.00002 | 0 | 0 | 0 N/A |
| Dreaming Tortoise | 100000 / 20 | 700 | 1500 | 0 | 0 | 20 | 0 N/A |
| Mirror Ape | 60 / 1 | 2 | 3 | 0 | 0 | 0 | 0 N/A |
| Gravebloom Elk | 350 / 12 | 10 | 20 | 0 | 0 | 0 | 0 N/A |
| Storm Kite | 0.08 / 0.002 | 0.0005 | 0 | 0.0002 | 0 | 0 | 0.2 MJ actually acquired electrical charge |
| Burrowing Furnace | 6000 / 5 | 0 | 20 | 120 | 0 | 0 | 200 MJ geological/chemical thermal energy, only where actually available |

## Maturation and recruitment

| Creature | Independent / adult / fertile days | Method / counting unit | Attempts / 365 days | Success | Offspring / success | Gestation / incubation days | Cooldown days | Birth investment kg/event |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Human | 6570 / 6570 / 6570 | live birth; One eligible adult mother with actual mate access | 0.5 | 0.75 | 1 | 280 | 365 | 10 |
| Slime | 0 / 0.008333333333333333 / 0.008333333333333333 | Natural division; existing genome-dependent conserved parent partition; One mature full-mass parent meeting actual division-readiness conditions | 941.9354838709677 | 1 | 1 | 0 | 0.3875 | 0 |
| Mudlet | 0 / 0 / N/A | Environmental formation, not parental reproduction; One actual stable water/earth-pattern site with finite clay and water | 4 | 0.25 | 1 | 2 | 30 | 5.714285714285714 |
| Human-derived homunculus | 30 / 3 / N/A | Existing advanced artificial growth only; natural fertility unestablished; N/A — not a natural breeding unit; artificial procedure uses original apparatus/inputs | 0 | 0 | 0 | 0 | 0 | 0 |
| Cinderling | 0 / 0 / N/A | Environmental formation, not parental reproduction; One actual stable flame-pattern site with finite burning carbonaceous matter | 6 | 0.2 | 1 | 1 | 14 | 2.857142857142857 |
| Zephyr Mote | 0 / 0 / N/A | Environmental formation, not parental reproduction; One actual stable air-pattern site with a finite captured air parcel | 12 | 0.2 | 1 | 0.5 | 7 | 0.34285714285714286 |
| Rootling | 14 / 90 / 180 | Natural sourced propagation; no spontaneous new plant; One mature propagule-producing plant with suitable receiving substrate | 4 | 0.5 | 2 | 14 | 60 | 0.1142857142857143 |
| Sporecap | 7 / 30 / 45 | Natural spores establishing a new bounded mat; One mature fruiting body with actual spores and suitable unoccupied substrate | 12 | 0.1 | 4 | 7 | 14 | 0.01142857142857143 |
| Hauntbound | 0 / 0 / N/A | Nonreproductive; existing attachment, not artificial production; N/A — no offspring or creation recipe | 0 | 0 | 0 | 0 | 0 | 0 |
| Quartz Shardling | 1 / 365 / N/A | Natural mineral-lattice deposition, not parental breeding; One actual quartz-bearing deposition site with suitable earth-pattern conditions | 1 | 0.3 | 1 | 90 | 180 | 0.4 |
| Duskcat | 60 / 180 / 240 | live birth; One eligible adult mother with actual mate access | 2 | 0.7 | 3 | 65 | 90 | 0.8571428571428573 |
| Lantern Wisp | 0 / 0 / N/A | Natural mineral-core formation; not a deceased spirit or parental breeding; One actual luminous-mineral deposition site with suitable light-aspected conditions | 2 | 0.2 | 1 | 30 | 90 | 0.28571428571428575 |
| Ashhorn Behemoth | 365 / 3650 / 5475 | live birth; One eligible adult mother with actual mate access | 0.25 | 0.7 | 1 | 540 | 730 | 7142.857142857143 |
| Glasswing Roc | 180 / 1095 / 1825 | Egg clutch; One eligible adult mother with actual mate access | 0.5 | 0.65 | 2 | 120 | 365 | 1142.857142857143 |
| Mire Choir | 30 / 180 / 365 | Aquatic egg clutch; One eligible adult spawning member with actual mate/choir access | 2 | 0.6 | 40 | 20 | 120 | 5.714285714285714 |
| Nullmaw Stalker | 180 / 730 / 1095 | live birth; One eligible adult mother with actual mate access | 1 | 0.6 | 2 | 120 | 180 | 57.142857142857146 |
| Thunderback Grazer | 180 / 730 / 1095 | live birth; One eligible adult mother with actual mate access | 1 | 0.75 | 1 | 300 | 365 | 228.57142857142858 |
| Candlecap Myriapod | 2 / 45 / 60 | Egg clutch; One eligible adult mother with actual mate access | 4 | 0.4 | 80 | 10 | 60 | 0.06857142857142856 |
| Ironroot Colossus | 90 / 18250 / 36500 | Sourced propagule developing in suitable ground; One mature propagule-bearing individual and actual receiving site | 0.2 | 0.4 | 1 | 365 | 1095 | 2.857142857142857 |
| Gloam Prowler | 120 / 540 / 730 | live birth; One eligible adult mother with actual mate access | 1 | 0.65 | 3 | 90 | 180 | 25.714285714285715 |
| Rimefang Pack | 90 / 365 / 730 | live birth; One eligible adult mother with actual mate access | 1 | 0.7 | 4 | 70 | 180 | 17.142857142857142 |
| Sunspine Basilisk | 7 / 730 / 1095 | Egg clutch; One eligible adult mother with actual mate access | 1 | 0.6 | 8 | 90 | 240 | 6.857142857142858 |
| Ley Manta | 90 / 730 / 1095 | live birth; One eligible adult mother with actual mate access | 0.5 | 0.6 | 1 | 180 | 365 | 28.571428571428573 |
| Carrion Lantern | 14 / 90 / 120 | Egg clutch; One eligible adult mother with actual mate access | 3 | 0.5 | 6 | 20 | 60 | 3.4285714285714293 |
| Brine Cathedral | 365 / 3650 / 7300 | Viable colonial fragment separation; One mature whole colony with a viable supported fragment and actual receiving habitat | 0.1 | 0.5 | 1 | 365 | 1825 | 0 |
| Reef Wyrm | 90 / 1825 / 3650 | Egg clutch; One eligible adult mother with actual mate access | 0.5 | 0.6 | 4 | 120 | 365 | 342.8571428571429 |
| Abyssal Bell | 30 / 3650 / 5475 | Deep-water egg clutch; One eligible adult mother with actual mate access | 0.25 | 0.5 | 10 | 180 | 730 | 2857.1428571428573 |
| Frostwake Leviathan | 365 / 5475 / 7300 | live birth; One eligible adult mother with actual mate access | 0.2 | 0.7 | 1 | 540 | 1095 | 8571.428571428572 |
| Marsh Hydra | 14 / 730 / 1095 | Egg clutch; One eligible adult mother with actual mate access | 1 | 0.5 | 6 | 90 | 240 | 34.285714285714285 |
| Rivercoil | 60 / 1460 / 2190 | Aquatic egg clutch; One eligible adult mother with actual mate access | 1 | 0.6 | 8 | 90 | 180 | 1142.857142857143 |
| Ember Ant | 30 / 45 / 180 | Queen egg laying; worker reproduction rate is zero; One actual fertile queen in a viable supplied hive; never every worker | 365 | 0.8 | 2000 | 10 | 1 | 0.01142857142857143 |
| Dreaming Tortoise | 30 / 7300 / 14600 | Egg clutch; One eligible adult mother with actual mate access | 0.1 | 0.6 | 3 | 180 | 1825 | 171.42857142857144 |
| Mirror Ape | 730 / 1460 / 1825 | live birth; One eligible adult mother with actual mate access | 0.5 | 0.7 | 1 | 200 | 365 | 2.857142857142857 |
| Gravebloom Elk | 120 / 545 / 730 | live birth; One eligible adult mother with actual mate access | 1 | 0.75 | 1 | 230 | 365 | 34.285714285714285 |
| Storm Kite | 7 / 45 / 90 | Egg clutch; One eligible adult mother with actual mate access | 4 | 0.6 | 6 | 10 | 30 | 0.03428571428571429 |
| Burrowing Furnace | 30 / 730 / 1095 | Mineral-shelled eggs using actual parental mineral investment; One eligible adult mother with actual mate access | 0.5 | 0.5 | 2 | 180 | 365 | 28.571428571428573 |

## Mortality, reserves and travel

| Creature | Juvenile / adult hazard per 1000 days | Ageing onset / doubling days | Food / water reserve days | Travel km/day / intake multiplier | Reference area ha | Reference C range |
| --- | --- | --- | --- | --- | --- | --- |
| Human | 0.02 / 0.01 | 18250 / 3650 | 14 / 2 | 20 / 1.5 | 0.2 | 10 / 32 |
| Slime | 0 / 0 | N/A / N/A | 3 / N/A | 1 / 1.5 | 0.01 | 5 / 35 |
| Mudlet | 0.01 / 0.01 | N/A / N/A | N/A / 1.1111111111111112 | 0.2 / 1.5 | 0.001 | 1 / 45 |
| Human-derived homunculus | 0.02 / 0.01 | 18250 / 3650 | 1 / 1 | 15 / 1.5 | 0.2 | 15 / 32 |
| Cinderling | 0.02 / 0.02 | N/A / N/A | 0.16666666666666666 / N/A | 0.3 / 1.5 | 0.001 | 60 / 360 |
| Zephyr Mote | 0.02 / 0.02 | N/A / N/A | N/A / N/A | 0.5 / 1.5 | 0.001 | -20 / 50 |
| Rootling | 0.5 / 0.03 | 1825 / 365 | 1.4583333333333333 / 1.6666666666666667 | 0 / 1 | 0.0001 | 8 / 40 |
| Sporecap | 2 / 0.1 | 365 / 180 | 1.3888888888888888 / 2.0833333333333335 | 0 / 1 | 0.0001 | 8 / 35 |
| Hauntbound | 0 / 0 | N/A / N/A | N/A / N/A | 1 / 1 | 0.001 | N/A / N/A |
| Quartz Shardling | 0.01 / 0.005 | N/A / N/A | 2 / N/A | 0.288 / 1 | 0.01 | -50 / 180 |
| Duskcat | 0.5 / 0.08 | 2920 / 730 | 2.0833333333333335 / 1.6666666666666667 | 8 / 1.5 | 25 | 5 / 38 |
| Lantern Wisp | 0.02 / 0.01 | N/A / N/A | N/A / N/A | 1 / 1 | 0.01 | -20 / 80 |
| Ashhorn Behemoth | 0.08 / 0.005 | 36500 / 7300 | 30 / 5 | 12 / 1.5 | 100000 | -5 / 45 |
| Glasswing Roc | 0.2 / 0.01 | 21900 / 3650 | 10 / 3 | 180 / 1.5 | 250000 | -15 / 45 |
| Mire Choir | 5 / 0.08 | 3650 / 730 | 5 / 1 | 5 / 1.5 | 100 | 8 / 35 |
| Nullmaw Stalker | 0.3 / 0.04 | 7300 / 1460 | 7 / 2 | 15 / 1.5 | 2000 | -5 / 45 |
| Thunderback Grazer | 0.2 / 0.02 | 9125 / 1825 | 7 / 2 | 20 / 1.5 | 2000 | -10 / 40 |
| Candlecap Myriapod | 30 / 1 | 365 / 90 | 10 / 1 | 0.2 / 1.5 | 0.05 | 5 / 35 |
| Ironroot Colossus | 0.05 / 0.002 | 182500 / 36500 | 60 / 14 | 1 / 1.5 | 50000 | -15 / 40 |
| Gloam Prowler | 0.5 / 0.05 | 4380 / 1095 | 7 / 2 | 25 / 1.5 | 1500 | -15 / 38 |
| Rimefang Pack | 0.8 / 0.06 | 3650 / 730 | 7 / 2 | 25 / 1.5 | 1000 | -40 / 20 |
| Sunspine Basilisk | 2 / 0.03 | 10950 / 2190 | 30 / 7 | 8 / 1.5 | 1200 | 10 / 50 |
| Ley Manta | 0.3 / 0.02 | 10950 / 2190 | 7 / N/A | 100 / 1.5 | 100000 | -10 / 40 |
| Carrion Lantern | 3 / 0.15 | 1095 / 365 | 5 / 2 | 30 / 1.5 | 500 | 0 / 40 |
| Brine Cathedral | 0.1 / 0.002 | 182500 / 36500 | 30 / N/A | 5 / 1.5 | 200000 | 8 / 32 |
| Reef Wyrm | 1 / 0.01 | 36500 / 7300 | 14 / N/A | 30 / 1.5 | 50000 | 12 / 32 |
| Abyssal Bell | 2 / 0.008 | 54750 / 10950 | 45 / N/A | 12 / 1.5 | 100000 | -2 / 12 |
| Frostwake Leviathan | 0.1 / 0.005 | 36500 / 7300 | 60 / N/A | 60 / 1.5 | 200000 | -2 / 12 |
| Marsh Hydra | 1 / 0.02 | 18250 / 3650 | 7 / 2 | 8 / 1.5 | 1500 | 8 / 38 |
| Rivercoil | 1 / 0.015 | 18250 / 3650 | 14 / N/A | 15 / 1.5 | 10000 | 5 / 35 |
| Ember Ant | 20 / 3 | 90 / 30 | 2 / 1 | 0.1 / 1.5 | 0.0001 | 15 / 55 |
| Dreaming Tortoise | 0.2 / 0.001 | 182500 / 36500 | 90 / 30 | 3 / 1.5 | 100000 | 0 / 40 |
| Mirror Ape | 0.15 / 0.025 | 9125 / 1825 | 7 / 2 | 10 / 1.5 | 250 | 10 / 35 |
| Gravebloom Elk | 0.3 / 0.03 | 4380 / 1095 | 10 / 3 | 20 / 1.5 | 1000 | -30 / 28 |
| Storm Kite | 5 / 0.5 | 730 / 180 | 3 / N/A | 60 / 1.5 | 100 | -10 / 40 |
| Burrowing Furnace | 0.2 / 0.02 | 10950 / 2190 | 30 / 5 | 2 / 1.5 | 3000 | 20 / 300 |

## Source preservation and exceptions

| Creature | Value status | Artificial base formation days | Notes | Source |
| --- | --- | --- | --- | --- |
| Human | Initial lifecycle balance values; not implemented population behavior | N/A | Human food/water masses and demographics are initial reference tuning, not overrides of existing hunger meters, exceptional individuals, consent, body skills or city ledgers. Independence is ordinary self-sufficiency, not a legal status or automatic employment. | reference/DESIGN_BIBLE.md; app.js (existing needs); initial demographic tuning |
| Slime | Implemented care values plus initial lifecycle tuning; see notes | 0.005555555555555556 | 1 kg is a reference normalization, not universal slime mass. Proposed kg/day does not replace genome-dependent nutrition/feeding units. Existing reference: growth 12 minutes (natural jitter 0.75–1.25), brood 1, stability risk 5 gives 558-minute division pressure, plus regrowth/readiness delay. Actual genomes override all reference clocks; existing genomic life budget (120–7200 minutes) remains explicit and is NOT replaced by a second mortality hazard. Eight-minute lab synthesis is a skill-adjusted base, not gestation. | app.js: growth/brood/lifespan pools, divisionPressureMinutes, tryNaturalSplit; initial kg/day reference |
| Mudlet | Implemented care values plus initial lifecycle tuning; see notes | 0.006944444444444444 | Implemented body: 2 kg clay plus initial 2 L retained water, kept separate from structural mass. Nominal evaporation at 20 C / 50% humidity is 0.075 L/hour = 1.8 L/day; actual humidity/heat change it. No invented food need; reserve days are a reference depletion budget, not guaranteed survival. Natural site recruitment is new tuning, not a population-per-parent multiplier. | creature-formation.js: Mudlet body and evaporation; initial natural formation/demographic tuning |
| Human-derived homunculus | Implemented care values plus initial lifecycle tuning; see notes | 3 | Implemented: 72-hour growth, 48 kg embodiment, maturity flag at completion, 24 food-hours and 24 water-hours per care. Proposed kg/L demands are reference conversions, not implemented physical ration amounts. Thirty-day independent-care learning is initial tuning and never grants speech, consent or skills by timer. Fertility is unestablished: zero modeled natural recruitment is not a claim of biological sterility. Growth inputs/utilities remain in Production detail, not adult upkeep. | homunculi.js: MODES, embody, advance; app.js: nourishment; initial kg/day conversion and learning/ageing tuning |
| Cinderling | Implemented care values plus initial lifecycle tuning; see notes | 0.006944444444444444 | Implemented bright burn 1 fuel unit/hour = 24/day, smolder 0.25/hour = 6/day; capacity 4, initially 2. No hydration need: quenching harms. Structural kg is proposed because fuel units have no authored kg conversion. Listed temperatures refer to core, not ambient temperature. No extra natural death hazard is charged for already explicit starvation/cold damage. | creature-formation.js: advanceCinderling, feed, formation; initial structural mass/site recruitment tuning |
| Zephyr Mote | Implemented care values plus initial lifecycle tuning; see notes | 0.006944444444444444 | Implemented sealed 1 mana/hour = 24/day, gentle 2/hour = 48/day, strong 4/hour = 96/day; capacity 16, initially 2. The 0.12 kg air mass is a proposed reference conversion for the existing 0.1 cubic metre parcel, not a tracked runtime mass. Does not eat biomass, drink or neutralize contaminants. Listed reserve is mana, not food. | creature-formation.js: advanceZephyr, rechargeMote, takeAir; initial density/site/temperature tuning |
| Rootling | Implemented care values plus initial lifecycle tuning; see notes | 0.25 | Implemented nominal at 20 C/full light: organic uptake 0.02 kg/hour, minerals 0.001/hour, water 0.05 L/hour; respiration 0.01 kg/hour lit or 0.03 dark. Initial live structure 0.75 kg stem + 0.15 roots; roots cap 0.5 kg and extend at up to 0.02 kg/hour, so formed-body remaining root growth can be 17.5 hours, not a 90-day artificial delay. Natural seedling clocks and fertility are new tuning; medium and waste remain conserved. | rootlings.js: body, step; creature-formation.js: required; initial natural life history |
| Sporecap | Implemented care values plus initial lifecycle tuning; see notes | 0.16666666666666666 | Implemented digestion ceiling 0.05 kg/hour = 1.2/day, evaporation 0.02 L/hour = 0.48/day at 20 C/humidity >=35. Material yield 25% reserve, 25% spent substrate, 50% respiratory loss; respiration 0.01 kg/hour and open spore production up to 0.005/hour spend reserves. Listed reserve assumes open spores; cover/gill state changes expenditure. New recruitment tuning counts established caps/mats, not every emitted spore; current runtime spores do not automatically spawn offspring. | sporecaps.js: body, step; creature-formation.js: required; initial natural recruitment tuning |
| Hauntbound | Implemented care values plus initial lifecycle tuning; see notes | N/A | Implemented: 0.5 kg doll, no meals/water/sleep, 20 N soul force and finite exertion/recovery. No biological ageing hazard or fertility. Zero baseline mortality does not prevent object destruction or soul injury/death; voluntary reincarnation is departure, not a birth/death timer. Travel is proposed mechanical capacity, never automatic work consent. No universal temperature death threshold for all inhabited objects. | hauntbound.js: DEFINITION, create; HAUNTBOUND.md; initial travel capacity only |
| Quartz Shardling | Implemented care values plus initial lifecycle tuning; see notes | 0.041666666666666664 | Implemented 10 g/hour bite ceiling = 0.24 kg/day, only 25% of consumed quartz assimilates, max body 2 kg, formed body 1 kg. Actual reserve initially 48 hours/cap 72; ingestion refills at 400 reserve-hours per kg, so maintenance can be 0.06 kg/day rather than always eating the ceiling. Fed formed-body gain of 1 kg can take 16.67 days; natural 365-day juvenile history is new tuning, not a replacement. Travel uses a proposed 1 m reference tile and five minutes/tile at uninterrupted slow movement; digging/obstacles reduce it. | shardlings.js: MATERIALS, body, eat, step; creature-formation.js: required; initial natural deposition history |
| Duskcat | Implemented care values plus initial lifecycle tuning; see notes | 0.3333333333333333 | Implemented 12 g food and 25 mL water/hour, initial 2 kg body, growth capped at +0.5 kg with 25% of eaten food; fed remaining growth can take 6.94 days, not 180 days after formation. Baseline mana idle cost is zero; concealment costs 1/hour while active and assisted pounce +1 per event. Capacity 16, formed reserve 2. Existing physical rest/training/needs persist; natural birth/fertility, hunting averages and ageing are new tuning. | duskcats.js: body, step, pendingPounce; creature-formation.js: required; initial natural life history |
| Lantern Wisp | Implemented care values plus initial lifecycle tuning; see notes | 0.006944444444444444 | Implemented bright 2 mana/hour = 48/day, voluntary low-reserve dim 0.5/hour = 12/day; capacity 16, initial reserve 2. A shutter hides light without saving fuel. No biological food/water/sleep or passive reproduction; natural recruitment is new source-limited tuning. Starvation/disruption and core damage remain explicit, not duplicated as background deaths. | lantern-wisps.js: body, step; creature-formation.js: required; initial natural deposition history |
| Ashhorn Behemoth | Initial lifecycle balance values; not implemented population behavior | N/A | Huge mature mass/food demand is initial tuning, not a one-tile body. Recruitment is slow; calving grounds and actual maternal reserves constrain births. | scripts/creature-lifecycle-data.js (initial tuning) |
| Glasswing Roc | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Mire Choir | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Nullmaw Stalker | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Thunderback Grazer | Initial lifecycle balance values; not implemented population behavior | N/A | Charge use/feeding cannot refill without actual electrical supply. Herd members consume forage individually; panic fire losses are not duplicate ordinary mortality. | scripts/creature-lifecycle-data.js (initial tuning) |
| Candlecap Myriapod | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Ironroot Colossus | Initial lifecycle balance values; not implemented population behavior | N/A | All physical mass must be supplied by conserved substrates; magic and age cannot manufacture a colossal body. Earliest maturity requires enough accumulated growth. | scripts/creature-lifecycle-data.js (initial tuning) |
| Gloam Prowler | Initial lifecycle balance values; not implemented population behavior | N/A | Short-blink mana is paid per actual use, not a mandatory daily ambient drain or wall bypass. | scripts/creature-lifecycle-data.js (initial tuning) |
| Rimefang Pack | Initial lifecycle balance values; not implemented population behavior | N/A | Existing local health/combat/identity stay unchanged. Cold expenditure is conditional actual use; freezing does not create drinking water. | scripts/creature-lifecycle-data.js (initial tuning) |
| Sunspine Basilisk | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Ley Manta | Initial lifecycle balance values; not implemented population behavior | N/A | Mana feeding supplies energy, not matter. Offspring require actual parental/material mass investment; direct drinking is zero, not permission to create body water or ignore source moisture. | scripts/creature-lifecycle-data.js (initial tuning) |
| Carrion Lantern | Initial lifecycle balance values; not implemented population behavior | N/A | Travel is a wind-dependent reference, never guaranteed directed flight. Corpse-light spends actual carrion-derived substrate; no ghosts, soul feeding or resurrection. | scripts/creature-lifecycle-data.js (initial tuning) |
| Brine Cathedral | Initial lifecycle balance values; not implemented population behavior | N/A | Zero freshwater drinking is not zero seawater dependence. Flowing/processed seawater is not consumed freshwater. Module/member damage reduces actual throughput; one polyp does not carry a whole colony reproductive rate. | scripts/creature-lifecycle-data.js (initial tuning) |
| Reef Wyrm | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Abyssal Bell | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Frostwake Leviathan | Initial lifecycle balance values; not implemented population behavior | N/A | Ice wake/body mass consumes finite reserves. Zero direct freshwater drinking does not imply water-free biology or permanent ice creation. | scripts/creature-lifecycle-data.js (initial tuning) |
| Marsh Hydra | Initial lifecycle balance values; not implemented population behavior | N/A | Regenerating a head is repair funded by extra food/mana, not reproduction, a new individual or a refund of consumed biomass. | scripts/creature-lifecycle-data.js (initial tuning) |
| Rivercoil | Initial lifecycle balance values; not implemented population behavior | N/A | Initial life-history tuning; preserve actual anatomy, resources, agency, received knowledge and habitat constraints. | scripts/creature-lifecycle-data.js (initial tuning) |
| Ember Ant | Initial lifecycle balance values; not implemented population behavior | N/A | The 180-day reproductive clock applies only to queen development; ordinary workers never become fertile on that timer. Queen reference body 0.05 kg; queen background hazard 0.02/1000 days, ageing onset 1825 days, doubling 730 days (not worker mortality). Her extra egg investment is supplied by actual colony food. No queen, mate supply or brood appears from populationIndex or divine units. | scripts/creature-lifecycle-data.js (initial tuning) |
| Dreaming Tortoise | Initial lifecycle balance values; not implemented population behavior | N/A | Sapience/consent remains independent. Weather/dream actions spend actual sleep/mana/available moisture; neither age nor nature role grants infinite restoration. | scripts/creature-lifecycle-data.js (initial tuning) |
| Mirror Ape | Initial lifecycle balance values; not implemented population behavior | N/A | Implemented original imitation reserve is 48 mana, Soul Lash 12 per paid release; zero mandatory daily casting cost. Capacity does not invent natural regeneration, copied skills, consent or species-wide knowledge. | scripts/creature-lifecycle-data.js (initial tuning) |
| Gravebloom Elk | Initial lifecycle balance values; not implemented population behavior | N/A | Do not turn the herbivore into a direct carrion eater. Bloom nutrient investment and seasonal habitat remain conserved; ecological points are not kg of edible flowers. | scripts/creature-lifecycle-data.js (initial tuning) |
| Storm Kite | Initial lifecycle balance values; not implemented population behavior | N/A | Charge energy is not new body matter; eggs/growth need conserved materials. Calm grounds and agitates the swarm. Travel is weather-limited; a random/instinctive destination may lack charge. | scripts/creature-lifecycle-data.js (initial tuning) |
| Burrowing Furnace | Initial lifecycle balance values; not implemented population behavior | N/A | Temperature interval is occupied tunnel/body-adjacent thermal niche, not universal surface weather. No generic biomass diet or conjured geological gas. Earliest juvenile growth needs actual assimilated mineral mass. | scripts/creature-lifecycle-data.js (initial tuning) |

## Existing implementation ownership

C owns consumed needs/growth/reproductive behavior and calibration against actual original bodies/resources; D owns conserved cohorts, food production/edibility/renewal, timed recruitment/mortality/migration and saved monthly outcomes. Real regional edible stocks and replenishment are required separately; neither habitat hectares nor ecological points automatically feed animals. Remaining puberty/fertility, reference transport and source-site mechanics are not silently claimed implemented by publishing this table. The active queue does not grow or close C/D here.
