# Regional beast populations — implementation in progress

This is work inside the existing #3.38-D package, not a new prompt or a completion
claim. D remains active and the queue still has eleven packages. Individual
capabilities already implemented by C are described in [BEAST_BEHAVIOR.md](BEAST_BEHAVIOR.md).

## Account model

`beast-populations.js` provides a deterministic internal account model with:

- Original integer cohort membership, compact live ordinal ranges and separate
  detailed-body claims. Detailing removes the same individual from background
  consumption and mortality. Detailed corpses remain with their physical owner;
  they are not also deposited into regional food stocks.
- An explicit supplied calendar with variable month lengths. The 365-day
  demographic denominator is not imposed as the world's calendar year.
- Once-per-month intentions, staggered group departures, travel extending across
  months, residence-dependent consumption and local shortage reactions. Crossing
  a region boundary during travel changes the charged resource account before
  final arrival. The model does not reserve destination food or capacity.
- Shared seasonal transitions in `beast-seasonal-journeys.js`: actual named
  calendar windows, fixed outbound/return itineraries, immediate continuation
  through intermediate waypoints and queued return windows during unfinished
  outbound journeys. Physical obstructions and late arrivals remain failures;
  no invented approach path, teleport or hidden-food rerouting repairs them.
  Seasonal renewal changes at the actual calendar boundary. Saved half-edge
  residence, queued legs and deadlines survive normalization without replanning.
- A choice policy receiving instincts, local neighboring approaches and dated
  personal knowledge, not hidden destination stocks or incoming populations.
  An unsuitable arrival can lead to repeated exploration and real starvation.
- Cached finite resource rates and depletion/reserve-depletion boundaries, rather
  than repeated strategic planning on every call. Reads settle elapsed work but
  do not reroll intentions, change cached rates or award future renewal.
- Background hazards integrated across age bands and old-age doubling, including
  distinct queen hazards. Original small cohorts retain individual event clocks;
  large and generated cohorts use the compact demographic approximation below.
  Explicit predation/combat/scarcity losses remove membership before subsequent
  background hazard processing.
- Original body reserves, finite consumption, retained metabolic outputs and
  timed scarcity harm. Current initial scarcity tuning loses 0.4 normalized
  health per unmet reference daily water ration and 0.1 for food/minerals, after
  compatible body reserves have actually run out. This is calibration, not a new
  general creature-care owner or a change to existing laboratory upkeep.
- Original-source audits, strict saved-state validation, independent run bindings
  and copy-only continued-import rebinding. Invalid records are unavailable, not
  reconstructed as healthy replacements.

Source inputs must explicitly supply real original cohorts, actual regional
stocks/capacities, renewal, traversal edges and the calendar. Generic stock keys
in focused fixtures are not permission to feed a predator plants, renew ore,
invent a hive queen, or generate a natural formation site. The physical source
adapter must establish compatible sources and biological counting units.

## Batched growth, recruitment and mortality

`beast-demography.js` consumes the existing published lifecycle values without
creating a pregnancy, juvenile actor or death object for every background animal.
Work scales with groups/cohorts, supported activity and interval fragmentation,
not directly with headcount. Named local individuals remain detailed and are
excluded from these background owners.

- Each group saves its reproductive intent and attempt rate once per actual
  calendar month. Aggregate daily physiology boundaries settle earned growth,
  attempt credits and background mortality; incubation, resource depletion and
  actual interruptions add their own boundaries. This is not per-frame strategic
  replanning or an upfront monthly grant. The rate denominator stays 365 elapsed
  game days even with a different supplied calendar year.
- Maintenance has first claim on actual regional stocks/renewal. Surplus compatible
  matter funds growth and incubation gradually, with published assimilation and
  retained growth/reproductive waste. Required activity energy and reproductive
  mana also leave finite sources; energy cannot be a body-matter recipe. Mineral
  bodies require an explicit sourced material mixture rather than generic food.
  Neither age nor elapsed incubation manufactures missing body mass.
- Actual sourced nurseries declare finite receiving capacity, favorable phases
  and local mate access. Eligible original mothers/colony queens, actual mature
  same-group mates and cooldown ranges constrain integer conception batches.
  A queen additionally needs her original same-colony furnace hive. Workers do
  not reproduce. Whole colonial fragmentation partitions existing parental mass;
  environmental/artificial core families keep their existing owners and gain no
  automatic wild formation sites or parental fertility.
- Brood records hold compact parent/success intervals, paid material/mana and a
  due time, not one pregnancy object per parent. Success counts use saved seeded
  stochastic rounding of the published conditional chance. This preserves mean
  rates but deliberately does **not** reproduce independent per-animal variance.
  Newborn batches receive actual newborn mass and append ordinal ranges to stable
  per-group/role identity streams; individual IDs are derived only when needed.
- Killed parents cancel their remaining investment once. Actual destroyed egg/
  fragment nurseries dispose of affected invested material without refunds or
  replacement offspring. Losing a live-bearing nursery does not itself kill a
  mother or erase her funded gestation; missing support prevents completion.
- Compatible generated cohorts merge into age/stage, mass and condition bins.
  Counts, physical mass/stores, parent intervals, paid broods and cooldowns remain
  conserved. Representative age/condition are approximations; earliest/latest
  birth dates remain saved, and maturity/fertility and local handoff use the
  youngest bound rather than prematurely ageing an uncertain member. Already
  detailed bodies and their individual histories are never averaged together.
- Cohorts initially exceeding 128 individuals, and generated birth cohorts,
  settle continuous-hazard survival expectations in batches with a saved seeded
  fractional rounding balance. Large losses remove anonymous ordinal intervals
  and retain compact death/remains summaries, not millions of individual corpse
  records. These summaries retain first/last death dates and total physical mass,
  **not exact individual death times**. They are not omnipresent edible stocks or
  observed casualty reports. Original small-cohort clocks remain unchanged.

`claimLocal` transfers a selected parent's already paid brood progress, attempt
credit and cooldown along with its original body. Background batches immediately
exclude that member. Existing local lifecycle code can continue transferred
broods, and `registerLocalBirth` registers each genuinely emitted physical child
once against the same population. Nursery-bound broods require access to the
original nursery; they cannot teleport with a travelling parent. Missing native
source adapters hold work rather than inventing a supported site. Real nursery
destruction also invalidates its handed-off external broods. These hooks and
their focused handoff checks do not establish full generated-world adoption.

The focused benchmark is `node scripts/benchmark-beast-demography.js`; add
`--long` for 2,400 elapsed game days. It uses explicitly prepared finite supplies,
one or ten independent groups and active growth/reproduction/mortality. It is
not a full-game/world-generation benchmark or proof of ecological balance.
Representative runs of 120 days at 1,000 and 1,000,000 starting bodies each used
roughly 6,000 cohort intervals and tens of milliseconds, with two birth summary
records and four compact death records. The longer run retained hundreds rather
than millions of active cohort records. Wall-clock timing depends on hardware;
focused tests gate structural work/state growth rather than a fragile millisecond
threshold. Detailed encounters and more independent groups still cost more.

## Paid regional maintenance, decline and recovery

`beast-regional-ecology.js` adds an opt-in ecological account to the internal
population model. Ironroot rooting, Thunderback grazing and all eight additional
approved work adapters below now execute against this shared account. Other
species' local C abilities remain intact. Generated-source adoption,
natural formation, ecological opposition and whole-food-web viability are not
established by these workface demonstrations.

Every participating region supplies all six independent condition ledgers:
soil/cover, freshwater quantity, freshwater quality, wetland/reef habitat,
renewable biomass and arcane stability. It also supplies its actual affected
hectares, natural reference conditions, applicable viability floors, original
physical renewal sites and explicit dependencies of usable renewable supplies on
condition. Zero-reference natural terrain does not become exhausted merely for
being a desert or polar region. Missing ecological declarations leave legacy
accounts unchanged, rather than inventing a healthy starting ecology.

Monthly ecological intent names an already known workface, not a hidden future
destination. Actual location, mature physical body, health, willingness, intact
rootable substrate and original shared work-site capacity gate performed work.
Travelling or detailed individuals cannot simultaneously restore the regional
account. The seven local physical recipes are shared through
`beast-habitat.js::workSpec`; filter channels are shared through `filterSpec`.
Rooting consumes water, minerals and organic matter and retains actual rooted
biomass/atmospheric-water outputs. Those outputs are physical retained matter,
not automatically edible regional stock or a replacement renewal site.

Maintenance has first claim on supply. Growth, funded reproduction and ecological
work share a normalized cohort effort budget. There is one work-energy request
per working cohort, shared with demographic work; missing mana/charge cannot
fund an effect. The published daily throughput is the coarse ordinary-rest
approximation, not an extra full day of work added to rest. This is not a native
per-body stamina or combat simulator: detailing transfers the original out of
background work, and native interruptions still need source-backed integration.
The activity request spends real regional energy supply; it does not create a
fresh personal mana reservoir for a subsequent local-body claim.

Grazing pressure uses actual compatible forage consumption and its paid activity,
without consuming that food a second time or granting a positive disposition
bonus. Rooting earns nurturing and incurs its authored destructive side effects
only in the channels its actual recipe supports. Natural renewal, performed
nurturing and destruction have separate cumulative receipts; their net changes
condition per affected hectare. Rates are cached between calendar, daily
physiological, depletion, loss, journey and condition-boundary events. Reads
settle only elapsed effects; they do not replan or award a month's future work.

Explicit condition/reference ratios can reduce subsequent usable food/water
renewal, never increase it above the original source ceiling. Lost productivity
is foregone food production. Incoming water rejected from the usable account
remains recorded as unusable/diverted water. Destroying an original catchment
debits its actual material once and disables only its original renewal shares;
the original incoming flow is diverted, not conjured as drinking water. EP never
regenerates ore, creates meat, repairs a destroyed site or fabricates a worker.

Exhaustion requires a recorded actual original contributor/renewal-site loss,
subsequent performed destruction in a supported affected channel, a condition
decline from the loss-time buffer and crossing that region's applicable floor.
A contributor needs prior paid work there: its species label or an unperformed
order is insufficient. Original deaths still own their existing loss/remains
accounts. Ecological causal summaries pool repeated losses by original stream,
region and cause, retaining first/last times and counts rather than creating a
record per background individual. Cohorts with different sets of worked regions
cannot merge and lend unearned contributor provenance to unworked originals.
Historical exhaustion/recovery episodes remain
saved even after current condition recovers. Bad initial allocation, shortage,
winter, an unrelated source loss or missing facts cannot certify exhaustion.

Recovery needs actual surviving/returning original support, usable substrate,
paid inputs and elapsed work above the applicable floors. A source loss does
not spawn a rescuer, restore destroyed material or teleport a tree. Detailed
native-body losses and pre-city histories are not automatically projected back
onto regions from an old location snapshot; that native provenance remains D
integration work. The source-proposal feasibility assessor is unchanged and
still rejects unaccepted generated allocations.

The prepared endpoint uses a 10-hectare **maintenance workface**, not a complete
species territory or a healthy generated region. One original Ironroot supports
ten original grazers through a full seasonal cycle. Killing that tree produces
gradual soil decline and later exhaustion; a separately surviving original must
travel back along the real edge before paid restoration can recover the workface.
Finite buffer/input quantities are explicit in
`scripts/benchmark-beast-regional-ecology.js`; they do not certify territorial
space, the complete diet of every species, natural formation or ecological defense.
An original catchment-loss check also exercises discovered shortage, dispersal
and dehydration at an equally poor destination without destination clairvoyance.

Run `node scripts/benchmark-beast-regional-ecology.js` for the focused scaling
check. A representative 120-day run at 12, 12,000 and 1,200,000 starting bodies
retained three cohorts and **372–375 cohort intervals**, about 14–18 KB
of serialized state and roughly 11–16 ms locally. Timings are illustrative, not a
test threshold. More regions, independent groups and detailed bodies cost more;
this is not a full-game benchmark or ecological balance certificate.

### Existing work adapters

`beast-regional-work.js` supplies the fixed approved set, without adding species,
abilities or authored rate changes:

| Original creature | Performed regional action and physical limits |
| --- | --- |
| Mire Choir | Detritus-supported wetland tending requires a surviving wetland bed and an actual adequate water column. Nutrients remain physical outputs. |
| Reef Wyrm | Actual calcium/organic inputs and ordinary prey/mineral upkeep fund growth of an existing living reef, stopping at its finite receiving capacity. |
| Rivercoil | Construction material becomes a finite shared dam; actual connected flow bounds work, retention, passage and spill. |
| Gravebloom Elk | Actual carrion and water grow an existing bloom in its original favorable phases; new bloom enters the same finite edible stock once. |
| Ember Ant | Only adult workers of the original site colony build its furnace from actual metal/fuel. Queens, brood and other colonies do not supply worker credits. |
| Dreaming Tortoise | The original tortoise and identified original participant groups must actually be present, alive, willing, sleeping and consenting. Existing atmospheric water becomes rain; mana is charged once. |
| Ley Manta | Credits only the actual excess-mana intake used by its shared paid physiological/work bill. No second mana debit or invented personal reservoir is supplied. |
| Brine Cathedral | Original surviving feeding-tower fractions constrain actual plankton intake and whole-superorganism throughput once; absent marine medium or destroyed towers cannot feed or filter. |

Regional sites declare actual affected area, shared worker capacity, original
physical substrate/structures and applicable seasonal/medium facts. Aquatic
work uses actual water volume and area, plus the existing shared body's minimum
depth and footprint; declaring an arbitrarily shallow or tiny patch cannot make
a colossal organism fit. Finite structure receiving capacity is shared across
all cohorts, not allocated afresh to each worker batch. Reef/bloom outputs enter
declared physical stocks, not a second inventory or automatic formation site;
furnace output belongs to its original colony's site. It does not automatically
grant another nursery, queen or hive.

The explicit adjacent watercourse uses one finite original flow account, processed
upstream before downstream consumption. A dam cannot reserve downstream drinking
water and also retain it upstream. Banks fill at actual event times, unretained
flow/spill passes to the adjoining account, and declared floodable ground can
suffer actual overflow damage. All overflow remains physical output rather than
being discarded by a stock clamp. Constructed dams retain hydraulic effects after
their builder is lost, but receive no ongoing labor credit. A captured-water
provenance tag is part of the same water stock, **not additional water**; the
aggregate account spends tagged water first. Breach releases only surviving
tagged water and retains real structure debris. Destroyed beds/sites do not
automatically repair. Cyclic or nonadjoining flow and duplicate outlets are
rejected; this is coarse adjacent flux, not a whole-world hydrodynamics model or
instant long-range logistics.

Dream participants refer to original groups, not a site-level consent assertion.
Absence, travel, loss, detailing, wakefulness or refusal interrupts future work
after settling what was already paid. The source-owner activity and tower-damage
hooks settle at the exact event time; they are not automatic consent, combat
projection or native-world source adoption. Tower damage applies uniformly to
the named cohort; a uniquely injured original must be detailed or represented
in its own compatible cohort. Distinct tower injuries cannot be averaged into
repaired structures during compaction, and a local original-body handoff retains
those injuries rather than creating intact replacement towers.

The manta adapter does not assume an unknown personal pool has space to fill.
It credits only measured shared-bill intake against the existing local
one-mana-per-second filtration ceiling. Thus sixty actually filtered/spent mana
over a day earns only `60 / 86400` of a fully supported daily EP ceiling, not a
free full day of repair. The intake is already charged by the shared activity
request; no body mass or stored mana is manufactured. Brine food is likewise
charged by the ordinary intake account once. Reduced intake can drain the same
original body reserves and cause real hunger rather than reducing upkeep needs.

Discrete burns, excavation, attacks and predation remain actual C/physical
events. Merely owning an Ashhorn or predator adds no assumed daily horn casts,
kills or restoration. No new regional combat AI or magical powers are introduced.
Monthly intent, shared growth/reproduction effort, cached rates, partial-work
reloads, continued branches, original identities and final-death freeze remain
the existing account contract. These adapters close this approved work-action
set, not D's remaining generated-population, formation or encounter acceptance.

## Local predation and original-body handoff

`beast-predation.js` supplies shared local prey selection and corpse accounting,
consumed by the existing native creature behavior/attack pipeline. A hungry,
capable hunter needs an actually sensed compatible prey body. The initial attempt
budget is five game minutes, followed by a five-minute retry cooldown; lost
contact expires after twelve seconds without updating unseen target coordinates.
Injury, incapacity, depleted effort and local diplomatic constraints can stop the
attempt. Attacks, misses, escape, wounds and deaths still belong to ordinary
physical combat, not a monthly kill percentage. Nearby willing, hungry pack
members must actually hear one another and sense the same prey to contribute
their body scale; known distinct original packs cannot pool their numbers.
An exposed calf is not a license to hunt its fortress-sized adult counterpart.

Carrion Lanterns do not initiate hunts. Detectable real carcasses support local
feeding/approach; an airborne scavenger must physically descend to reach ground
remains. Each corpse retains one finite ledger of initial edible tissue, tissue
eaten and tissue decomposed. Eating and decomposition also reduce that same
physical body's mass. Neither creates a second regional meat/carrion stock.
Freezing suspends only actual frozen time; thaw, chunked updates and repeated
reads cannot recreate meat. Per-eater feeding timestamps prevent duplicate
elapsed feeding across both repeated calls and different corpses. Existing
Carrion Lantern light-substrate transfers still come from its actual meal.

The population model now offers `claimLocal`: an adapter must provide the exact
original member's established local position and compatible full-body terrain.
A shared regional range or centroid alone is insufficient. Original effort and
magical/other reserve provenance is required too: the background model cannot
replace missing history with freshly full or fabricated empty pools. It removes that
member from background intake/mortality and retains its actual local actor with
the original claim, including depleted stores, age and health. A local death
settles that claim once; its sole corpse remains with the actor, not also in
background edible stocks. Saves and continued-run copies retain the body and
partial hunt/carcass state without reattachment refills.

This is **not completed generated-population encounter integration**. Existing
native local actors now perform the food-web sequence, and focused source-claim
checks exercise the handoff, but ordinary travel/logistics do not yet adopt all
generated populations through this adapter. Unlocated originals stay unresolved.
Background populations receive no automatic kills, meals, corpse discoveries or
restoration credit. Generated source diagnostics still cannot count hypothetical
prey allocations as performed hunts or a sustainable food web.

## Generated habitat proposals and feasibility diagnostics

`beast-habitat-sources.js` now runs during new world generation where canonical
beast ecology exists. Its private `beastHabitatSources` record is saved with the
reusable world and validated during normal storage/import roundtrips. It is a
proposal, **not an accepted active ecology account**. Older archived worlds
without that record remain unchanged; loading never rerolls missing sources.

The record contains compact arrays:

- `patchRows`: cell index, habitat-kind index and affected hectares. Spherical
  polygon areas come from the actual geodesic globe. Surface, wetland and shore
  fractions partition land; an ocean cell has its actual water-column habitat.
  Subsurface habitat is a separate volume, not duplicated surface food/rainfall.
- `groupRows`: canonical population index, group ordinal, patch index, adult and
  young counts. A hive row instead records workers and brood; its one original
  queen and two males are explicit separate cohorts. A Brine Cathedral remains
  one whole organism, not a multiplied polyp population. Adult sex/eligibility
  and original juvenile mass are recorded without granting growth or births.
- Population counting provenance and separate located/unlocated counts. Existing
  authoritative Rimefang, Gravebloom Elk and Mirror Ape individual totals are
  preserved. Other counts use seeded biological group/density calibration,
  **not** abundance indices or religious group units. An unsupported count stays
  unknown/unlocated, never zero or a fabricated replacement body.
- Traditional migration paths, original destinations and phases from canonical
  ecology. These do not change when destination food is absent. They contain no
  received map, food reservation or knowledge of another group's intentions.

Expanded inputs keep forage, organic matter, detritus, plankton, freshwater,
minerals, heat, charge and excess mana separate. Plant/plankton shares partition
their production rather than duplicating it. Plant water use is deducted from
rainfall. Seawater is not freshwater drinking stock. Weathered substrate and
original dissolved salts are finite, with **zero mineral/ore replenishment**.
There is no automatic meat/carrion income or new naturally occurring species.

These are explicit initial physical calibrations: supported wetland fractions
are 12% of a land cell and shore fractions 4%; remaining surface area is not
duplicated. Accessible weathered depth is 2 mm for exposed bedrock, otherwise
2 cm at the surface and 0.5 m underground. Dissolved marine minerals use only
the original upper 200 m or shallower actual depth. Stock capacities and daily
inputs depend on those volumes, existing climate/geology/arcane fields and the
existing four seasonal phases; they are not measured final balance values.

The generator tries at most three seeded candidate calibrations before keeping
its best **diagnostic** result. This only changes uncommitted proposals, not
existing actors or saved original counts. Edible stock compatibility comes from
the existing C behavior's diet rules. Initial plant/detritus feeding locations
prefer supported physical supply where available; that generator preference is
not a creature migration adviser. New proposals start migratory originals at
their actual traditional home where compatible original habitat exists. Flying
over sea permits passage through air, not a new ocean home or extra population.
Checks include timed resource shortfalls and separate environmental ledgers, compatible reachable prey,
integer prey-body budgets shared once, and geometrically possible opposition.
Scavengers cannot kill living prey to fund their own food. Food-web allocations
are generator-only feasibility budgets; they neither kill source animals nor
become real meat stocks, reserved meals or creature knowledge.

Seasonal feasibility now replays the **same month/edge transitions consumed by
the account model**, rather than emitting a blanket unverified label. It charges
travel effort and resident individual-days to each actual route region. All
groups share one finite regional stock; renewal accrues only over elapsed time,
with capacity-limited carryover between seasons. Later rain or forage cannot pay
an earlier shortage. Diagnostics retain exact depletion intervals, missing
amounts, blocked routes, late arrivals (including still-unfinished journeys), and
per-group travel summaries. This is a conservative initial-cycle supply replay,
not a substitute for population biology or performed ecological work: it grants
no hypothetical prey kills, paid nurturing, future recruits or successful escape
from scarcity. The account model separately consumes actual body reserves and
can lose originals to starvation.

The tested generated allocation is still **rejected**, with concrete seasonal/
prey shortages, unverified opposition and unresolved original habitat. Paid
regional work and funded growth/recruitment execute in the account model;
successful generated allocation repair and live regional integration remain
unfinished D work. Checks omit unimplemented benefits
instead of inventing their capacity. Rejection is not evidence of historical
ecological defeat or exhausted territory.

Condition values in these proposals are relative initial calibration, not a
satellite observation or a claim that naturally arid terrain has forest cover.
The diagnostic compares conservative potential pressure, not measured performed
work, and cannot substitute for the account model's paid maintenance execution.

`runtimeSource` refuses these rejected/unverified proposals. Diagnostic expansion
is marked `diagnosticOnly`, which `beast-populations.create` also refuses. Source
validation reconstructs physical areas and initial counts from the world, so
re-signing an inflated table cannot create extra supply. Valid original habitat
placements and advisory diagnostics from older archives remain immutable rather
than being regenerated by improved checks. Activation also reruns current
physical feasibility; an old advisory success cannot bypass it. No proposal or failure
detail is copied into public beast reports or the world-library interface.

## Fixed D acceptance still unfinished

1. Successful source allocation repair and full seasonal initial viability,
   including supplied ecological opposition and original source adoption without
   duplicating the existing Rimefang/Elk/Mirror Ape consumers. Generated proposals
   and strict diagnostics now exist; their tested rejection is not completion.
2. Finite natural formation sites and sustained food-web/source integration using
   the existing data and C behavior. The approved eight additional work adapters,
   paid Ironroot work/Thunderback pressure and causal decline/exhaustion/recovery
   now execute in supplied workfaces, alongside batched growth/recruitment, local
   hunts, shared carcasses and original-body handoff. This does not establish
   all-species regional viability, ecological opposition/defense or actual
   generated-source adoption.
3. Native integration with world/run persistence, ordinary travel, supported human
   logistics, correctly sized/mediated physical encounters and legitimate dated
   observations. New-world source generation is wired into the library, but the
   account model is not connected to live encounters and does not remove existing
   contact-only restrictions.
4. Focused native DOM/Canvas, source-class, save/import, death/knowledge and
   strategic-output acceptance for the whole package. World-domination evaluator
   integration remains in the already-listed 3.35d-D/E, not this package.

Do not remove D, lower the queue count, or present the account model as completed
regional gameplay until these existing acceptance requirements pass. No species,
follow-up prompt or additional certification gate is authorized by this document.

## Focused checks

```sh
node tests/beast-populations.unit.test.js
node tests/beast-demography.unit.test.js
node tests/beast-regional-ecology.unit.test.js
node tests/beast-regional-work.unit.test.js
node tests/beast-predation.unit.test.js
node tests/beast-behavior.unit.test.js
node tests/beast-seasonal-journeys.unit.test.js
node tests/beast-habitat-sources.unit.test.js
npx playwright test tests/beast-habitat-sources-browser.spec.js --project=chromium --workers=1
npx playwright test tests/beast-regional-ecology-browser.spec.js --project=chromium --workers=1
npx playwright test tests/beast-predation-browser.spec.js --project=chromium --workers=1
```

The sixteen current model checks cover source typing/all 36 profile identities,
calendar boundaries, conserved claims, continuous hazards, resource depletion,
knowledge-independent choices, staggered journeys, failed arrivals and starvation,
interrupted supplies, duplicate-death exclusion, save validation and independent
copies. Eight shared-seasonal checks cover multi-edge timing, midpoint billing,
queued returns and lateness, hidden-truth-independent routes, obstructions,
half-edge reloads, actual renewal boundaries and no-will/mid-month starts.
Seventeen additional source checks cover geodesic area/volume, all 24
species, counting units, finite stocks and prey allocation, seasonal failures,
knowledge-isolated traditional routes, shared supply competition, early depletion,
unfinished late journeys, refusal of invalid proposals and canonical world
preservation. One browser case covers actual browser generation, compressed
world storage/reload, private diagnostics and refusal to activate a rejected
proposal. Fourteen local food-web checks cover original claims, death/corpse custody,
perception/scale/pack limits, failed/interrupted hunts, shared feeding/decomposition,
starvation, unseen prey death, reload/continued copies and final-death boundaries. Native DOM/Canvas
cases perform a sensed Rimefang hunt, actual combat kill and feeding, retaining
partial pursuit and corpse state across reload without private-state disclosure.
They use prepared original local sources, not proof of generated regional source
adoption. No check claims completed world-level balance or universal encounter
coverage. The full suite remains opt-in under repository policy.

Nineteen demographic checks additionally cover matter/energy conservation,
maintenance priority, real incubation, elapsed-day attempt rates, original colony
roles, fragmentation, interruption, compact large losses, cohort merging, arbitrary
read/reload chunking, malformed records, moving gestation and paid local maternal/offspring handoff.
The focused headcount and longer-history benchmarks are reported separately from
native play. No full-suite run is implied by the commands listed here.

Nineteen regional ecology checks cover original source/area declarations, paid
work and shared effort, real material/energy interruption, independent channels,
no duplicated food credit, seasonal lows, causal contributor/site loss,
shortage/dispersal/death, gradual original-body return/recovery, detailing,
partial-work serialization/continued binding, final-death freeze, contributor
provenance under merging and compact
million-body scaling. A browser check uses the actual index dependency order and
internal model serializer across a reload. It deliberately does **not** claim
native game-save adoption or ordinary-play regional encounters.

Thirty-four regional-work checks cover the complete eight-adapter set, physical
inputs and receiving limits, shared colony capacity, consent withdrawal, marine
body geometry, finite connected flow, downstream scarcity/flooding, breach and
debris, paid bed destruction, damaged towers and original-body handoff, arbitrary
read chunking, partial-work saves, independent/continued branches, final-death
freeze and million-member batch scaling. A second browser case executes all
eight adapters through the actual index dependencies and reloads partial work;
these remain internal-model checks rather than claims of native source adoption.
