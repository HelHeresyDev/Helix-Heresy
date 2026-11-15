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

`beast-foraging.js` replaces the once-daily, one-cohort five-minute wildlife
attempt with monthly **per-cohort elapsed-time budgets**. Each actual calendar
day remaining in the plan allows up to six hours of active searching, two hours
of eating and one hour of handling, subject to an eight-hour combined active
ceiling. These are ceilings, not credited effort or promised meals. Every eligible
hungry cohort can repeat local search/handling/eating/rest cycles. Sparse original-
beast duels retain their separate authored hunt-attempt ceilings; an unsuccessful
daily contact cannot consume a whole cohort's background feeding allowance.

An actual hungry, willing cohort's original members must have established
regional positions and usable medium. Unlocated, travelling, incapacitated, refusing or obstructed
groups get no background catch. Searches conservatively decline habitats with
unresolved explicit barriers; they do not route through them by decree.

Search effort uses the shared body's movement speed, injuries, per-second stamina
cost and levitation mana cost. An hourly search batches short movement/rest
cycles analytically, retaining half the available effort per movement cycle.
Only elapsed, actually supported rest restores stamina; actual food pays for
mana recovery during that interval. A later meal cannot pay for earlier unfed
rest, and eating/handling are not simultaneous rest. An eight-hour bout can
continue after a partial meal until reserves are full or its budget is spent.
Running out of food during a search does not create an early capture or reroll.
Passive aerostats without an established current search only their
stationary sensing footprint. Search area uses a homogeneous-field overlap
approximation, `area × (1 − exp(−summed footprint / area))`; fish additionally use
the fraction of their water-column habitat within sensing depth. This is coarse
statistical foraging, **not** individually simulated fish, known prey coordinates,
guaranteed success or a strategic duel multiplied over a population.

On completion, actual local density and the authored hunter success ceiling
produce seeded integer catches, capped by surviving prey and feeding capacity.
Prey are not reserved when the search begins. Captures remove their bodies before
their edible tissue can feed the searching cohort. A catch grants a single-owner
claim against that same carcass, not an instant stomach refill or a second food
inventory. Handling and ingestion take elapsed time; ingestion uses the existing
daily-ration-per-600-seconds rate and may continue well beyond five minutes.
Claims share finite tissue with competitors and decomposition, preserve existing
freezing intervals and release uneaten tissue on interruption. Real nearby
original-beast remains can likewise support a longer personal meal without
feeding distant members. Natural corpses can also be encountered locally;
Carrion Lanterns only scavenge and retain their existing 5%
light-tissue allocation. All guilds share one ingestion-time budget. Remaining
tissue stays in the same finite guild carcass account, subject to competitors
and decay—not an omnipresent regional meat stock. Independent growing young can
spend ingested surplus above two nominal daily rations on structural growth at
the existing rate/assimilation efficiency; other missing maintenance or energy
still prevents growth. Age alone never supplies the missing material.

Foraging needs no destination census or new migration adviser. The simulator's
private density resolves physical encounter chances; it is not passed to animal
route choices or exposed in the UI. Participant loss, original-body handoff,
incapacity, refusal or habitat loss can interrupt a search. Departure releases
held meals at their origin rather than copying them across a journey. Spent
effort is not refunded. Actual unmet maintenance can trigger the existing
knowledge-limited dispersal; an empty generic meat stock alone cannot send a
successfully feeding hunter away. Partial searches, meals, physiology, paid
embryos and carcasses survive ordinary JSON saves and continued branches; final death freezes
them. Regional clocks still leave unrelated accounts untouched.

## Verification and limits

The 21 wildlife and 17 foraging focused unit checks cover matter/count
conservation, paid recruitment and growth, parent loss, shared food/feeding time,
starvation, drying fish habitat,
locality, density-limited catches, marine reach, scavenging, interrupted searches,
save/continued independence, malformed claims/budgets/actions, million-member
scaling and unchanged archives. Sufficient finite land and marine fixtures keep
their original predators healthy through all 120 calendar days, including paid
juvenile growth; deficient/blocked/refusing cases genuinely starve. Prepared
feeding fixtures suppress unrelated natural-death thresholds only, not prey loss,
recruitment or food costs; they are not proof that every generated habitat works.
Browser cases reload both partial search and partial eating, then continue
independent branches without disclosing private state. Named food-web/regional-
clock and generated-source storage browser checks also pass. The full test suite
is not run under the repository's focused-testing policy.

The `source-small` 120-day generated replay starts with 329 wildlife cohorts
representing roughly 97 billion small animals/insects/fish across 213 regions.
Cohort work, not one object per animal, handles that headcount. With elapsed
feeding routines, roughly 70.8 billion recruits, 99.6 billion natural/scarcity
deaths and 1,146,887 caught animals reconcile to 68.5 billion survivors in 969
wildlife cohorts. Actual wildlife ingestion increases from the previous
five-minute implementation's **42.2 kg to 26,123 kg**; no generic meat renewal
or increased prey allocation pays for the difference.

The 56,186 original strategic beasts remain separate: 104,994 paid births
reconcile to 91,494 living and 69,686 dead (69,181 background deaths, 501
starvation and four dehydration). This still leaves 151 performed resource-
shortfall records and two unlocated-original records. At the endpoint 58,923
living originals/descendants lack established contact positions; the sample has
no original-beast duels. Recorded source gaps remain 196 unsupported work media,
512 unsupported nurseries, 33 missing work sites, one unverified furnace-metal
source and 32 unverified dream-participant sources. These are diagnostic counts,
not player knowledge or grounds for declaring those sources harmless.

The measured elapsed-routine replay takes roughly three minutes, with 182,676
boundaries, 18.1 million cohort integration visits and about 36 MB serialized
account state. This costs more than the earlier roughly 53-second, barely-feeding
sample; it is **not** a native-game performance certificate. The opt-in benchmark
now reports issue/source-gap kinds and death causes alongside conservation and
feeding totals. Run it with:

```sh
node scripts/benchmark-generated-beast-habitats.js --days=120
```

**The tested generated ecosystem remains rejected.** These routines establish
sustained feeding in supplied fixtures, not all-species generated food-web or
opposition viability, all original habitat/formation sources or native encounter adoption. The full
cycle is diagnostic evidence, not a healthy-world or performance certificate.
No world is activated or relabelled exhausted to bypass those remaining D
requirements, and no new queue item is added.
