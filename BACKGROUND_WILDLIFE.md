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

New physical proposals mark `wildlifeDistribution` and split each guild/size
class's existing integer count among three seeded habitat patches (70% total)
and a lower-density regional background (30%). Each hotspot has 5% of the
region's radius, or 0.25% of its area, wholly inside its envelope. Integer
remainders stay in the final populated patch; count/carrying ceilings and total
original body matter are partitioned, never multiplied. Guild/medium eligibility
is unchanged. Fish occupy at most 15 m of the actual water column, starting no
deeper than 5 m. Initial strategic homes select one of these habitat patches.
This is founding-site allocation, not runtime knowledge or a promise about a
future destination. All patches still compete for the same regional stocks and
renewal. Background and hotspot fields contain different animals even where
their geometry overlaps; forage transport is not individually simulated.

Marked new allocations also record a seven-day **mortality/decomposition-only
starting snapshot**, not a full historical ecosystem warm-up. Seven seeded daily
adult-hazard losses debit original individuals and their already-funded body
matter. Their tissues begin at ages 6.5, 5.5, …, 0.5 days under the normal
class-specific decay hazards. No minimum death, future birth, extra body or food
grant is imposed. Decomposed matter enters available finite detritus capacity;
overflow remains an explicit output. The saved starting death/decomposition
receipt is validated on import and never applied again to a continued run.

Anonymous remains stay in their death patch's finite ledger, not at the
scavenger's current position. Newly marked proposals additionally use
[spatial carcass batches](WILDLIFE_CARCASSES.md): deterministic local death
sites and positioned predator leftovers, rather than uniformly smeared carrion.
Old unmarked accounts retain their coarse fields; actual original-beast corpses
retain their own point positions. New layout/history is not retrofitted into old archives or runs:
unmarked spatial allocations retain their single 0.025%-area feeding ground,
original count, positions, source identity and pristine starting carcass account.

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
carcass ledger per guild/size class/patch. Maintenance competes with strategic creatures for the
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
Bodies move to the same finite carcass owner. New deaths retain separate flesh,
named organs, fluids, tough tissue and hard remains, with tissue-specific decay
hazards into actual detritus and separately retained overflow. Predators finishing
the flesh leave other classes for compatible scavengers. The fixed-size batch
schema, numeric yields, legacy-save limits and actual structural feeding custody
are specified in [Carcass tissues](CARCASS_TISSUES.md); no individual organ objects
or additional animal bodies are generated.

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

Carrion Lanterns now use saved passive observation instead of the active-search
effort cycle above. Their food/water demand, wet-tissue partition and finite
atmospheric uptake are described in [passive biology](BEAST_POPULATIONS.md#passive-metabolism-and-finite-moisture).
The ordinary daily-ration-per-600-seconds ingestion rule has a Lantern exception:
3 kg wet tissue per 600 seconds, independent of their much lower basal demand.
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

New wind-enabled Carrion Lantern sources also use actual saved drift positions:
the current feeding footprint, not the entire swept flight corridor, can claim
tissue. All original members must fit the encountered field. Tissue is released
on leaving contact; a field's aggregate corpse mass cannot anchor an aerostat.
Only a reachable positioned original corpse with sufficient real structural
weight can support a finite, stamina-paid feeding hold. Unknown/calm flow does
not grant steering, and scavenging large remains does not grant a hunting power.
See [the physical wind and holding contract](BEAST_POPULATIONS.md#wind-driven-carrion-lanterns).

An encountered Lantern meal whose actual food yield cannot cover even its
prospective handling metabolism is released uneaten. Paid observation is not
refunded. Empty/uneconomic diffuse-field samples receive a saved one-hour review
backoff, preventing trace quantities from scheduling repeated handling or tiny
contact boundaries. An actually sensed original point corpse takes precedence
over an overlapping diffuse cue and can still wake observation during that
backoff. Neither rule grants distant knowledge, food, steering or free effort.

Foraging needs no destination census or new migration adviser. The simulator's
private density resolves physical encounter chances; it is not passed to animal
route choices or exposed in the UI. Participant loss, original-body handoff,
incapacity, refusal or habitat loss can interrupt a search. Departure releases
held meals at their origin rather than copying them across a journey. Timed
stops can reuse these same feeding routines at an actual route position, with
frozen progress and paid arrival delay; moving bodies still cannot forage.
Dependent family young require actual provisioning rather than receiving a
shared regional meal. Completed bouts now yield to real care, and caregivers
schedule another hunt from their shareable ration rather than relying on fat
that their young cannot eat. Active/rest search intervals are clipped by their
actual waveform so a final partial cycle cannot overspend the monthly ceiling.
See [route feeding and dependent care](BEAST_POPULATIONS.md#route-feeding-and-dependent-care).
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

The preceding care-and-route-stop `source-small` 120-day generated replay uses source
`beast-habitat-source:8d9290e7`, 334 physical regions, 2,615 strategic groups and
89 original source populations spanning all 24 strategic species. Its final
accounts reconcile independently:

| Account | Original | Paid births | Living | Dead | Hunted separately |
| --- | ---: | ---: | ---: | ---: | ---: |
| Strategic bodies | 56,243 | 190,892 | 130,906 | 116,229 | Included in dead |
| Anonymous wildlife | 97,503,071,748 | 72,177,231,821 | 67,144,369,462 | 102,524,782,773 | 11,151,334 |

Strategic deaths comprise 116,028 background losses, 191 starvation and ten
dehydration losses. All living strategic bodies retain stationary formations or
positioned journeys; 20,808 are travelling. Wildlife ends in 3,339 cohorts, not
billions of individual objects. Actual wildlife ingestion is **4,936,838 kg**,
compared with 43,886 kg in the earlier pond-enabled uniform-tiny-prey replay.
Classes share the original guild food/water ceilings; the increase is not funded
by extra meat renewal or another wildlife budget.

The replay still records 32 performed resource-shortfall records and no
original-beast duels. Source gaps remain 38 missing work sites, eight unverified
furnace-metal sources and 32 unverified dream-participant sources. An exact-depth
marine-medium fix removes the former 123 false Brine Cathedral starvation
deaths without changing their plankton supply. Remaining scarcity is real
diagnostic failure, not grounds for declaring the source healthy or exhausted.
Actual care delivers 9,732,180 kg of food and 18,817,597 litres of water. Dependent
scarcity deaths decrease from 636 to thirteen compared with the previous
care/stop baseline; Thunderback scarcity deaths decrease from 562 to zero and
Rivercoil starvation is removed. Remaining food/care failures are not excused
by these improvements or by aggregate receipts.

This run reaches 371,551 event boundaries, 96.1 million cohort integration
visits and 52.9 MB serialized expanded account state. The initial 100 days took
roughly 796 seconds with checkpoint/validation enabled; the saved day-100 state
then continued for roughly 335 seconds using the equivalent enclosing-tile
checks for uniform regional foraging habitat. This is not a fresh whole-cycle
timing measurement of the optimized kernel. Both the intermediate checkpoints
and final account validate without weakening the nonnegative-store checks.
The compact immutable world definitions pass default-resolution browser
save/reload, but this expanded run account is **not** a native-game performance
or save-capacity certificate. The opt-in benchmark reports issue/source-gap
kinds, deaths by cause/species, care receipts and scarcity circumstances
alongside conservation and feeding totals:

```sh
node scripts/benchmark-generated-beast-habitats.js --days=120
```

### Wind-enabled replay

This full-ecosystem snapshot predates the passive-metabolism/moisture correction.
It is preserved for comparison, not presented as a current corrected-biology run.

The newer fresh `source-small` 120-day execution uses
`beast-habitat-source:6702be10`. It retains 334 regions and 89 original
populations; conserved cohort divisions bring the group count to 2,631.

| Account | Original | Paid births | Living | Dead | Hunted separately |
| --- | ---: | ---: | ---: | ---: | ---: |
| Strategic bodies | 56,243 | 190,892 | 130,906 | 116,229 | Included in dead |
| Anonymous wildlife | 97,503,071,748 | 72,177,228,026 | 67,144,388,401 | 102,524,792,636 | 11,118,737 |

Strategic deaths are 116,027 background, 168 starvation and 34 dehydration.
**All 120 original Carrion Lanterns are dead by day 20**: 94 starvation, 24
dehydration and two background losses, with no new Lantern births. The saved
cohorts record 23 wind crossings. Correct transport and successful prepared
corpse-contact tests do not establish viable generated scavenging or drinking
access. This is an explicit unresolved source failure, not normality inferred
from labels, evidence of exhaustion or a reason to steer toward hidden food.

Actual wildlife ingestion is 4,935,319 kg. Thirteen dependent scarcity deaths
remain in the other families; actual care delivers 9,732,182 kg of food and
18,817,599 litres of water. All 20,808 travelling survivors remain positioned;
unlocated living bodies are zero. There are still no original-beast duels.
The replay reports 36 performed resource-shortfall records, plus the unchanged
38 missing work sites, eight unverified furnace-metal sources and 32 unverified
dream-participant sources. Its status remains **rejected**.

This fresh execution took about 1,120 seconds with checkpoint/validation enabled,
356,157 boundaries and 95,955,051 cohort integration visits. The final expanded
account is 53,643,253 bytes. Focused checks ran concurrently on the same machine;
this wall time is not an isolated performance comparison or native-game
acceptance measurement. Ten-day checkpoints and the final account pass the final
validation rules; a continued binding also validates without changing ownership.
The temporary expanded snapshots remain outside the repository.

The focused unit selection covers wind drift, bodies, foraging, the regional
scheduler, demography, parental care, the regional food web, habitat sources and
bindings: 155 checks pass. Four browser cases cover partial wind/meal reload,
both native body renderers and generated-source compressed storage/continuation.
The full suite was not run under the focused-testing policy.

### Corrected-biology isolated control

This is the historical passive-only control. Both it and the sensed-approach
control below predate the distributed starting-state correction recorded last.

The focused generated-geography control runs only the original 120 Carrion
Lanterns against unchanged finite anonymous wildlife, water, climate and winds.
Other strategic species and their work/competition are deliberately excluded;
this is **not** another full-ecosystem or native-game viability certificate.
It validates saved state every 20 days and runs the complete 120-day interval.
Survivors are 116 at day 20, 66 at days 40 and 60, and zero by day 80. There are
no births; 91 starvation, 24 dehydration and five background losses reconcile
all originals. Actual atmospheric uptake is 141.966 L. This particular drift
history encounters **zero food**: longer fasting is demonstrated, not sustained
generated carrion access. No carcasses, safe destinations or rescue births were
added to make it pass.

The corrected control completes in about ten seconds with 34,936 boundaries,
236,642 cohort integration visits and 45 final strategic cohorts. It retains
zero active-search seconds. The new warm-humid prepared fixture survives 30 days
without food, while dry, missing-vapour and competing-mouth controls remain
resource-limited. Independent partial saves, real tissue-water conservation,
native demand, wind-front interruption/rebasing and spreadsheet values have
focused checks. The full regression suite was not run.

The benchmark checks normalization at ten-day endpoints. For diagnosis, an
explicit `--checkpoint-dir=/absolute/existing/directory` writes private
`day-N.json` snapshots before those checks, using exclusive creation so nothing
is overwritten. `--resume=/absolute/path/day-N.json --days=120` continues a valid
whole-day diagnostic snapshot with the same source/binding; it does not activate
the rejected source, repair invalid saves or rewrite the immutable world. The
reported execution time then covers only the continued interval, not its saved
prefix. These expanded private snapshots belong outside the repository.

**The tested generated ecosystem remains rejected.** These routines establish
sustained feeding in supplied fixtures, not all-species generated food-web or
opposition viability, all original habitat/formation sources or native encounter adoption. The full
cycle is diagnostic evidence, not a healthy-world or performance certificate.
No world is activated or relabelled exhausted to bypass those remaining D
requirements, and no new queue item is added. Physical placement, paid catchment
ponds, nursery/maternal formations and positioned journeys are recorded in
[population location continuity](BEAST_POPULATIONS.md#habitat-placement-and-location-continuity).

### Sensed-approach isolated control

The approved [approach controller](CARRION_LANTERN_APPROACH.md) completed
the same targeted 120-day generated-geography control with original source
`beast-habitat-source:622013f8`. It records 31 original-weighted approach starts,
2,093.1604 individual-seconds of paid approach, and **2.044763 kg of actual
remains of other original Lanterns eaten**. No anonymous wildlife is hunted or ingested.
Only the original 120 Lanterns are simulated alongside the unchanged finite
background guilds, atmosphere, geography and winds; no rescue bodies are added.

Living originals are 116 at day 20, 71 at days 40 and 60, and zero by day 80.
There are no births; 96 starvation, nineteen dehydration and five background
losses reconcile the originals. Atmospheric collection is 151.333673 L. All
twenty-day checkpoints validate. The run takes about 21.1 seconds with focused
checks also running: 53,830 boundaries, 587,094 cohort integrations, 102,860
regional rebuilds and 45 final strategic cohorts. A fixed formation cannot
repeatedly declare a zero-time arrival when only its anchor reaches a corpse;
one physically sensing original can use existing contact separation instead.

This demonstrates actual sensed feeding, **not sustained generated food access**.
The earlier passive-only control also predates typed tissues, so these outcomes
are not an isolated steering-only causal comparison. The source remains rejected
and the existing D acceptance remains open. No additional prompt is created.

### Distributed starting-state isolated control — 2026-11-17

This historical control predates spatial carcass batches. The replay script now
uses the new model; [current measurements and limits](WILDLIFE_CARCASSES.md#targeted-120-day-generated-control)
supersede these figures for current generation.

The previous `node scripts/replay-carrion-lantern.js` execution used source
`beast-habitat-source:b1c3df52`, seed `source-small`, refinement 2. Only the
original 120 Lanterns and finite anonymous wildlife are simulated; other
strategic species, their kills, competition and ecological work are excluded.
No rescue bodies, refilled reserves or guaranteed survival are supplied.

The unchanged 97,503,071,748 original anonymous individuals partition into
91,005,668,902 living and 6,497,402,846 starting dead. Their funded remains retain
24,347,335.806720 kg after 9,606,361.745280 kg of actual initial decomposition.
There are 4,409 initial pooled wildlife cohorts, not individual animal objects.

| Day | Living original Lanterns | Cumulative wet tissue eaten | Of which anonymous wildlife |
| --- | ---: | ---: | ---: |
| 20 | 116 | 0.343585 kg | 0.343585 kg |
| 40 | 71 | 2.040194 kg | 0.343585 kg |
| 60 | 70 | 2.040194 kg | 0.343585 kg |
| 80–120 | 0 | 2.040194 kg | 0.343585 kg |

The other 1.696609 kg eaten comes from real original Lantern corpses. There are
39 original-weighted approaches and 2,530.2404 individual-seconds of paid
approach. Lantern recruitment is zero. Losses reconcile as 95 starvation,
nineteen dehydration and six background deaths. Atmospheric intake is
151.461688 L. Anonymous wildlife has zero hunted individuals; its own paid
recruitment totals 76,664,135,888, with 67,169,093,481 living at day 120.

Every twenty-day normalization checkpoint passes, including historical airflow
fronts after their last cohort member dies. Wind segments now retain their last
represented ordinal, so validation uses the actual historical formation extent
rather than a smaller, empty present-day formation. The run takes about 35.2 s:
115,245 boundaries, 884,464 cohort integrations, 165,535 regional rebuilds and
45 final strategic cohorts. These are measured costs, not a performance or
all-species viability certificate.

The supplied compact habitat separately sustains one Lantern through 120 days
with actual anonymous-carrion ingestion and funded wildlife recruitment, without
killing live prey; only unrelated strategic background mortality is suppressed
in that food-sufficiency fixture. The generated control does **not** establish
sustained scavenging: global corpse kilograms are not local accessible meals,
and coarse patch fields still approximate corpse locations. Generated source
acceptance/native adoption and the existing D checklist remain unresolved.
Neither normal nor exhausted status is granted to bypass them. No new queue
entry is added.

Focused verification: 105 unit checks covering distribution, wildlife,
foraging, generated-source compatibility, approaches and wind history; two
Chromium cases cover generated-world compressed storage/continuation and
partial native/regional approaches. The full suite was not run under repository
policy. No creature/lifecycle values changed, so the reference spreadsheets
require no regeneration.

### Spatial carcass correction

The approved local-carcass correction is implemented within D. Each real
natural death is allocated by a fixed spatial hierarchy, with actual tissue
ages and lazily resolved local sites. Predator kills retain their performed
positions. Local custody reconciles with the original aggregate inventory;
scavengers find body-sized meals, not a fraction of a habitat-wide coating.
Actual reach, one-body structural support, paid handling and interruptions
still apply. No corpse appears because an animal needs food.

The current isolated source `beast-habitat-source:5cddbb5e` validates all
120 days but ingests zero anonymous wildlife and only 1.690274 kg of actual
original Lantern remains. All originals still die by day 80, with no births.
This honest result does not certify the generated scavenger allocation or
invalidate the supplied local-feeding/holding controls. Exact batching,
conservation, processing bounds and replay results are in
[spatial wildlife carcasses](WILDLIFE_CARCASSES.md). No new package is added.
