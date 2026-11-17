# Carcass tissues and selective feeding

`carcass-tissues.js` is the shared finite inventory for native beast corpses,
regional beast death batches and anonymous wildlife carcasses. An ordinary meat
eater finishing the flesh does not erase organs, fluids, hide or bones. Carrion
Lanterns can consume **all animal tissue classes**, including bones, teeth,
horns and shells. They do not digest wood, equipment, non-biological stone/metal,
fungal crowns or elemental/mineral bodies. Existing free mineral stores and
non-biological Furnace armor remain separate matter. Biologically made shells
are animal hard remains, not loose stone.

These are initial coarse animal-body tuning values, not anatomical claims about
every species. They partition existing body mass; they never add a second food
budget. The same numeric values are available in the **Carcass tissues** tab of
[the Linux-friendly ODS](reference/creature-catalog.ods) and the XLSX workbook.

| Class | Animal mass share | Decay hazard/day | Ingestion multiplier | Organic kg/kg | Water L/kg | Mineral kg/kg | Rejected solids kg/kg |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Flesh/fat | 0.60 | 0.10 | 1 | 0.50 | 0.45 | 0.02 | 0.03 |
| Liver | 0.025 | 0.20 | 1 | 0.30 | 0.65 | 0.02 | 0.03 |
| Heart | 0.01 | 0.20 | 1 | 0.30 | 0.65 | 0.02 | 0.03 |
| Brain | 0.015 | 0.20 | 1 | 0.30 | 0.65 | 0.02 | 0.03 |
| Other organs | 0.05 | 0.20 | 1 | 0.30 | 0.65 | 0.02 | 0.03 |
| Fluids | 0.10 | 0.30 | 1 | 0.10 | 0.85 | 0.03 | 0.02 |
| Hide/tendon/cartilage | 0.10 | 0.02 | 0.4 | 0.40 | 0.25 | 0.05 | 0.30 |
| Bones/teeth/horns/shells | 0.10 | 0.005 | 0.1 | 0.15 | 0.10 | 0.65 | 0.10 |

Mass shares sum to one **after** separating known non-animal material. A class
retains initial, remaining, consumed, decomposed and reserved kilograms. Aggregate
`edibleKg` is a compatibility total of animal tissue, **not** how much any
particular species can eat. Native and regional selection use diet-compatible,
unreserved tissue instead. The current ordinary meat-eater policy accepts flesh;
Lanterns accept all animal classes. An explicit `carrionDiet` can name just
`liver`, for example, without admitting hearts, brains or generic meat. No new
organ-specialist creature has been invented.

## Transfers and time

Compatible tissue leaves its one source through the shared `take`/`debit`
transfer primitives. Selective extraction and feeding cannot each claim the
same material. The returned physical receipt can fund a receiving body or a
material output, not both. Existing laboratory specimen harvesting remains its
separate owner; this work adds no new wildlife-harvesting UI or manufacturing
recipe.

For Lanterns, each wet kilogram partitions into organic matter, water, minerals
and rejected solids. Up to 0.05 kg of that kilogram's **existing organic matter**
becomes corpse-light substrate; the remaining organic fraction enters the food
store. Water only enters available storage (including simultaneous actual
maintenance); excess becomes recorded water waste. Mineral and rejected-solid
outputs remain explicit. Thus bone is only 0.10 kg food-equivalent and 0.10 L
water per wet kilogram, not a kilogram of meat or a water-rich meal. Ordinary
predators retain the existing wet-food store/lifecycle convention: ingested
flesh's water/minerals are part of that wet mass, not a second hydration or mineral
credit.

Lantern base throughput remains 3 wet kg per 600 seconds for soft tissue;
tough tissue takes 2.5 times as long and hard remains ten times as long.
Regional meals reserve specific classes and accrue actual intake over elapsed
eating time. Each class decays exponentially at its own hazard, only after an
actual freezing interval ends. Claimed meals account for their own decay while
the source accounts for unclaimed tissue, preventing double decomposition.
Detritus capacity and overflow remain finite receiving accounts.

A wind-resisting feeding hold may reserve actual hard/tough structure at the
same positioned corpse. That structure cannot simultaneously feed another
mouth and still decays during the hold. Its conservative two-hour decay margin,
actual wind drag, body extent, organ condition and paid effort constrain support.
Releasing a meal also releases its remaining structural custody. Anonymous
field-wide carcass totals never become a physical anchoring body.

## Persistence and scale

Old untyped saves retain only their disclosed remaining soft-food account and
old 45% food/5% light/up-to-50% water yields. Loading or continuing a run never
recreates already eaten bones or identifies an unknown old organ. A later real
death can add typed tissue to the same batch without rewriting earlier matter.
Equipment is never inferred from body mass or duplicated into a carcass.

Save validation checks class totals, material conservation and exclusive
class/anchor ownership. Reloaded/continued branches retain their own remaining
quantities and elapsed feeding clocks. A fixed number of numeric counters per
corpse batch/guild replaces per-animal organ objects; one million deaths do not
create one million organ inventories.

This completes the approved tissue-class extension inside #3.38-D. It is not a
new prompt, a completed generated ecosystem, a new full-ecosystem replay, native
adoption of a rejected source, or newly implemented directed Lantern flight.

The subsequent approved [sensed-approach extension](CARRION_LANTERN_APPROACH.md)
implements bounded paid steering separately and records its targeted replay;
it does not change the tissue quantities or certify ecosystem viability.

Focused verification: 154 unit checks across carcass tissues, predation,
individual behavior, regional food-web/foraging, wildlife, wind drift, Lantern
biology and population loss accounts; twelve catalog/workbook checks; five
Chromium cases for native leftovers, predation, regional custody, wind holds and
passive biology across reload/continued branches. The full suite was not run
under the repository's focused-testing policy.
