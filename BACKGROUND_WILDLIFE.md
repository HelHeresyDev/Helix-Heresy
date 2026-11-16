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
| Land animals, small | 2 / 0.05 | 90 | 0.1 | 0.1 | 0.004 | 20 | 0.001 | 30% | 70% |
| Land animals, medium | 10 / 0.25 | 180 | 0.34 | 0.5 | 0.002 | 45 | 0.0006 | 30% | 70% |
| Land animals, large | 100 / 5 | 365 | 1.9 | 3 | 0.001 | 90 | 0.0002 | 30% | 70% |
| Fish, small | 0.25 / 0.005 | 120 | 0.0125 | 0 | 0.05 | 7 | 0.002 | 25% | 50% |
| Fish, medium | 2.5 / 0.01 | 240 | 0.07 | 0 | 0.025 | 10 | 0.001 | 25% | 50% |
| Fish, large | 25 / 0.05 | 365 | 0.4 | 0 | 0.02 | 14 | 0.0005 | 25% | 50% |

Maintenance scales with body mass to the 0.75 power and has a 1.5 juvenile
multiplier. Juvenile mortality is twice the adult hazard. Food is organic matter
for insects, forage for small animals, plankton for marine fish and organic
matter for freshwater fish. Fish need an actual oxygenated water column deeper
than 0.5 m, not a drinking-water ration. Small animals need real freshwater.
These are explicit balancing approximations, not measured or final biology.
The existing internal `smallAnimals` guild ID now includes the three land size
classes; it is not three new catalog species. Legacy definitions without class
or position retain their original 2 kg animal / 250 g fish profiles and spatial
model when loaded. New physical proposals archive the classed definitions.

## Generation and conservation

New proposals archive `backgroundWildlife` allocations derived from their actual
regional food, seasonal renewal and water. Initial abundance uses at most 5% of
the minimum seasonal food/water throughput and 2% of available standing food
mass, with seeded variation. Small/medium/large classes split those same guild
ceilings 25%/35%/40%; they do not each receive another 5% or 2% allocation.
Initial animal body matter is **removed from that
same standing stock** rather than created alongside it. Carrying-count ceilings
start at 1.5 times initial abundance and shrink with the existing local habitat
condition. There are no underground pools or automatic meat/carrion renewals.

New physical proposals refine each populated region into one seeded finite
feeding-ground footprint shared by its anonymous guilds: 0.025% of the regional
area, wholly inside the regional geometric envelope. Fish schools occupy at
most 15 m of the actual water column, starting no deeper than 5 m. Initial
strategic family homes use that same procedural geography rather than unrelated
points tens of kilometres away. This is founding-site allocation, not a runtime
animal map or a promise about a future destination. The footprint does not add
food or water: all size classes still compete for the same original regional
stocks and renewal. Their source catchment remains the regional account; forage
transport within a feeding ground is not individually simulated.

The reusable world holds immutable definitions, not mutable animals. A fresh run
creates its own cohort/food/carcass accounts; continuing a run retains them.
Old archived proposals without wildlife stay unchanged and gain none on load.
Source validation reconstructs allocations and rejects re-signed altered counts.
New spatial definitions store a seed and seven count columns per regional row,
not repeated IDs, profile labels, body masses and geometry. Expansion reconstructs
the same finite definitions before any runtime body partition. This keeps the
10,242-cell world archive inside the tested browser storage quota; it is not a
claim that an expanded all-world run account already fits native game saves.

Each region owns integer age cohorts, paid brood investment and one finite
carcass ledger per guild/size class. Maintenance competes with strategic creatures for the
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
regional positions and usable medium. Unlocated, actively travelling, incapacitated, refusing or obstructed
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
stationary sensing footprint. Search area uses the bounded swept-area
approximation `area × (1 − exp(−summed footprint / area))`. For new classed
herds/schools, its equivalent local circle must actually intersect the finite
feeding-ground circle, in the same regional coordinate frame. Encounter density
uses their intersection, not a region-wide dense field. Fish additionally
require overlap between actual hunter depth/sensing reach and the school's
water band. A distant or vertically unreachable school supplies no meal.
Legacy homogeneous definitions retain their previous area/depth fraction.
This is coarse
statistical foraging, **not** individually simulated fish, known prey coordinates,
guaranteed success or a strategic duel multiplied over a population.

On completion, actual local density and the authored hunter success ceiling
produce seeded integer catches, capped by surviving prey and feeding capacity.
Hunters prefer eligible larger prey before smaller classes, an intrinsic size
preference rather than a census or remote location hint. The original size
limit still excludes adult prey at least half the hunter's current body mass.
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
held meals at their origin rather than copying them across a journey. Timed
stops can reuse these same feeding routines at an actual route position, with
frozen progress and paid arrival delay; moving bodies still cannot forage.
Dependent family young require actual provisioning rather than receiving a
shared regional meal. See [route feeding and dependent care](BEAST_POPULATIONS.md#route-feeding-and-dependent-care).
Spent
effort is not refunded. Actual unmet maintenance can trigger the existing
knowledge-limited dispersal; an empty generic meat stock alone cannot send a
successfully feeding hunter away. Partial searches, meals, physiology, paid
embryos and carcasses survive ordinary JSON saves and continued branches; final death freezes
them. Regional clocks still leave unrelated accounts untouched.

## Verification and limits

The wildlife, spatial-wildlife and foraging focused unit checks cover matter/count
conservation, paid recruitment and growth, parent loss, shared food/feeding time,
starvation, drying fish habitat,
locality, density-limited catches, marine reach, scavenging, interrupted searches,
save/continued independence, malformed claims/budgets/actions, million-member
scaling and unchanged archives. Spatial checks additionally cover shared class
budgets, bounded horizontal/vertical reach, profile-specific growth/recruitment,
loss of the actual water column, corrupt geometry and partial saved searches.
Sufficient finite land and marine fixtures keep
their original predators healthy through all 120 calendar days, including paid
juvenile growth; deficient/blocked/refusing cases genuinely starve. Prepared
feeding fixtures suppress unrelated natural-death thresholds only, not prey loss,
recruitment or food costs; they are not proof that every generated habitat works.
Browser cases reload both partial search and partial eating, then continue
independent branches without disclosing private state. Named food-web/regional-
clock and generated-source storage browser checks also pass. The full test suite
is not run under the repository's focused-testing policy.

The current care-and-route-stop `source-small` 120-day generated replay uses source
`beast-habitat-source:be09b6d3`, 334 physical regions, 2,615 strategic groups and
89 original source populations spanning all 24 strategic species. Its final
accounts reconcile independently:

| Account | Original | Paid births | Living | Dead | Hunted separately |
| --- | ---: | ---: | ---: | ---: | ---: |
| Strategic bodies | 56,243 | 191,024 | 130,360 | 116,907 | Included in dead |
| Anonymous wildlife | 97,503,071,748 | 72,176,483,140 | 67,145,748,250 | 102,525,878,073 | 7,928,565 |

Strategic deaths comprise 116,028 background losses, 246 starvation and 633
dehydration losses. All living strategic bodies retain stationary formations or
positioned journeys; 11,786 are travelling. Wildlife ends in 3,324 cohorts, not
billions of individual objects. Actual wildlife ingestion is **4,469,905 kg**,
compared with 43,886 kg in the earlier pond-enabled uniform-tiny-prey replay.
Classes share the original guild food/water ceilings; the increase is not funded
by extra meat renewal or another wildlife budget.

The replay still records 59 performed resource-shortfall records and no
original-beast duels. Source gaps remain 42 missing work sites, four unverified
furnace-metal sources and 32 unverified dream-participant sources. An exact-depth
marine-medium fix removes the former 123 false Brine Cathedral starvation
deaths without changing their plankton supply. Remaining scarcity is real
diagnostic failure, not grounds for declaring the source healthy or exhausted.
Dependent young no longer receive regional rations directly, and health damage
uses their actual scaled needs rather than an adult's denominator. Thus the
larger dependent-death total is not directly comparable to the former
pre-provisioning baseline. Actual care delivers 8,484,558 kg of food and
15,982,803 litres of water, yet 636 dependent scarcity deaths remain; aggregate
receipts do not prove that all families can feed their young.

Measured execution takes roughly 457 seconds, 253,775 event boundaries, 44.0
million cohort integration visits and 52.3 MB serialized expanded account state.
The compact immutable world definitions pass default-resolution browser
save/reload, but this expanded run account is **not** a native-game performance
or save-capacity certificate. The opt-in benchmark reports issue/source-gap
kinds, deaths by cause/species, care receipts and scarcity circumstances
alongside conservation and feeding totals:

```sh
node scripts/benchmark-generated-beast-habitats.js --days=120
```

**The tested generated ecosystem remains rejected.** These routines establish
sustained feeding in supplied fixtures, not all-species generated food-web or
opposition viability, all original habitat/formation sources or native encounter adoption. The full
cycle is diagnostic evidence, not a healthy-world or performance certificate.
No world is activated or relabelled exhausted to bypass those remaining D
requirements, and no new queue item is added. Physical placement, paid catchment
ponds, nursery/maternal formations and positioned journeys are recorded in
[population location continuity](BEAST_POPULATIONS.md#habitat-placement-and-location-continuity).
