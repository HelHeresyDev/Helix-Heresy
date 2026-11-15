# Background wildlife

`background-wildlife.js` supplies the approved ordinary-food-chain layer inside
existing #3.38-D. It does not add researchable creatures, strategic beast species,
encounter victories or another pending prompt. The catalog stays at 36 entries
and the strategic roster at 24. These are anonymous, locally adapted guilds,
not claims that one fish or mammal species lives in every climate.

## Quantified initial tuning

All amounts below are per individual; rates use elapsed game days. Offspring/day
is a pooled potential including ordinary reproductive participation, not one
pregnancy for every animal. Actual funded births still have integer counts.

| Guild | Adult / newborn kg | Adult days | Food kg/day | Freshwater L/day | Potential offspring/day | Incubation days | Adult mortality/day | Assimilation | Birth success |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Insects | 0.002 / 0.0001 | 14 | 0.0002 | 0 | 0.05 | 3 | 0.01 | 25% | 60% |
| Small animals | 2 / 0.05 | 90 | 0.1 | 0.1 | 0.004 | 20 | 0.001 | 30% | 70% |
| Fish | 0.25 / 0.005 | 120 | 0.0125 | 0 | 0.05 | 7 | 0.002 | 25% | 50% |

Maintenance scales with body mass to the 0.75 power and has a 1.5 juvenile
multiplier. Juvenile mortality is twice the adult hazard. Food is organic matter
for insects, forage for small animals, plankton for marine fish and organic
matter for freshwater fish. Fish need an actual oxygenated water column deeper
than 0.5 m, not a drinking-water ration. Small animals need real freshwater.
These are explicit balancing approximations, not measured or final biology.

## Generation and conservation

New proposals archive `backgroundWildlife` allocations derived from their actual
regional food, seasonal renewal and water. Initial abundance uses at most 5% of
the minimum seasonal food/water throughput and 2% of available standing food
mass, with seeded variation. Initial animal body matter is **removed from that
same standing stock** rather than created alongside it. Carrying-count ceilings
start at 1.5 times initial abundance and shrink with the existing local habitat
condition. There are no underground pools or automatic meat/carrion renewals.

The reusable world holds immutable definitions, not mutable animals. A fresh run
creates its own cohort/food/carcass accounts; continuing a run retains them.
Old archived proposals without wildlife stay unchanged and gain none on load.
Source validation reconstructs allocations and rejects re-signed altered counts.

Each region owns integer age cohorts, paid brood investment and one finite
carcass ledger per guild. Maintenance competes with strategic creatures for the
same stocks and renewal. Surplus funds growth and embryos through cached rates
over elapsed time, with assimilation waste and exact funding boundaries.
No age timer supplies missing body mass. Monthly reproductive budgets respect
local receiving space and already committed broods. Funding accrues during the
month; the incubation window follows that month's close. Birth success is saved,
seeded aggregate rounding, not independent per-animal variance.

Actual adult loss reduces pooled live-bearing gestation and disposes only its
paid material. Already laid insect/fish eggs may survive parents, but dead adults
cannot keep funding them. Failed or unsupported broods retain their material as
discarded output, never a refund. Persistent shortages or unsuitable medium
reduce normalized health by 0.2/day at a full deficit and can kill the remaining
cohort. Mortality integrates elapsed hazards and settles integer losses daily.
Bodies move to the same finite carcass owner, then decay at the shared 0.1/day
hazard into actual detritus, retaining receiving overflow separately.

Audits reconcile original + born = living + natural/scarcity dead + hunted, and
original body matter + assimilated investment = living + invested embryos +
dead body matter + discarded embryos. Dead body matter separately reconciles
remaining corpse + consumed + decomposed. Feeding, waste and water outputs are
not additional bodies or a second carcass inventory.

## Background foraging

Existing strategic predators retain their monthly hunt budgets. An actual hungry,
willing, capable cohort can spend a five-minute search instead of being granted
an automatic meal. Its original members must have established regional positions
and usable medium. Unlocated, travelling, incapacitated, refusing or obstructed
groups get no background catch. Searches conservatively decline habitats with
unresolved explicit barriers; they do not route through them by decree.

Search effort uses the shared body's movement speed, injuries, per-second stamina
cost and levitation mana cost. Half the available effort is retained for handling
prey/return. Passive aerostats without an established current search only their
stationary sensing footprint. Search area uses a homogeneous-field overlap
approximation, `area × (1 − exp(−summed footprint / area))`; fish additionally use
the fraction of their water-column habitat within sensing depth. This is coarse
statistical foraging, **not** individually simulated fish, known prey coordinates,
guaranteed success or a strategic duel multiplied over a population.

On completion, actual local density and the authored hunter success ceiling
produce seeded integer catches, capped by surviving prey and feeding capacity.
Prey are not reserved when the search begins. Captures remove their bodies before
their edible tissue can feed the searching cohort. Natural corpses can also be
encountered locally; Carrion Lanterns only scavenge and retain their existing 5%
light-tissue allocation. All guilds share one ingestion-time budget. Remaining
tissue stays in the same finite guild carcass account, subject to competitors
and decay—not an omnipresent regional meat stock.

Foraging needs no destination census or new migration adviser. The simulator's
private density resolves physical encounter chances; it is not passed to animal
route choices or exposed in the UI. Participant loss, original-body handoff,
incapacity, refusal or habitat loss can interrupt a search. Spent effort and
opportunities are not refunded. Partial searches, physiology, paid embryos and
carcasses survive ordinary JSON saves and continued branches; final death freezes
them. Regional clocks still leave unrelated accounts untouched.

## Verification and limits

The 21 focused unit checks cover matter/count conservation, paid recruitment and
growth, parent loss, shared food/feeding time, starvation, drying fish habitat,
locality, density-limited catches, marine reach, scavenging, interrupted searches,
save/continued independence, malformed state, million-member scaling and unchanged
archives. A browser case reloads a real pending search and continues through
recruitment without disclosing its private state. Named generated-source browser
checks include default-resolution compressed storage.

The `source-small` 120-day generated replay completes a full supplied seasonal
cycle, with 329 initial wildlife cohorts representing roughly 97 billion small
animals/insects/fish across 213 regions. Cohort work, not one object per animal,
handles the population. The measured cycle took about 53 seconds of execution;
roughly 70.8 billion recruits, 99.5 billion natural/scarcity deaths and 1,508 caught
animals reconciled to 68.6 billion survivors in 969 wildlife cohorts. Background
feeding consumed only 42.2 kg in that sample—explicit evidence that adding a
prey base alone has **not** supplied its large predators. The 56,186 original
strategic beasts remain separate: 104,914 births reconciled to 91,445 living and
69,655 dead. These are diagnostic counts, not player knowledge. Run it with:

```sh
node scripts/benchmark-generated-beast-habitats.js --days=120
```

**The tested generated ecosystem remains rejected.** This layer supplies a finite
prey base; it does not establish sufficient actual foraging, viable opposition,
all original habitat/formation sources or native encounter adoption. The full
cycle is diagnostic evidence, not a healthy-world or performance certificate.
No world is activated or relabelled exhausted to bypass those remaining D
requirements, and no new queue item is added.
