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
- Continuous background hazards integrated across actual age bands and old-age
  doubling, including distinct queen hazards. Saved exposure and event thresholds
  preserve risk for small populations. Explicit predation/combat/scarcity losses
  remove membership before later background hazard processing.
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
nurturing work, successful allocation repair, funded growth/recruitment and live
regional integration remain unfinished D work. Checks omit unimplemented benefits
instead of inventing their capacity. Rejection is not evidence of historical
ecological defeat or exhausted territory.

Condition values in these proposals are relative initial calibration, not a
satellite observation or a claim that naturally arid terrain has forest cover.
The diagnostic compares conservative potential pressure, not measured performed
work, and cannot replace the still-unfinished ecological maintenance execution.

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
2. Funded growth/recruitment, finite natural formation sites, performed regional
   ecological work, sustained food-web/source integration and causal exhaustion/
   recovery using the existing data and C behavior. Local hunts, shared carcasses,
   original-body handoff and explicit stock interruptions now exist; they do not
   establish regional viability or implement those broader consumers.
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
node tests/beast-predation.unit.test.js
node tests/beast-behavior.unit.test.js
node tests/beast-seasonal-journeys.unit.test.js
node tests/beast-habitat-sources.unit.test.js
npx playwright test tests/beast-habitat-sources-browser.spec.js --project=chromium --workers=1
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
