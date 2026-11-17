# Measured seasonal viability

This corrects the existing assessment inside **3.38-D**. It adds no queue entry,
certificate workflow, species, food, metal, consent or weather system. Native
encounter adoption and sustained opposition remain unfinished.

## Forecasts are not observations

`beast-habitat-sources.forecast(source, map)` retains the old conservative
generator calculation. Its baseline stock budget assumes food must be a
regional stock, its hypothetical prey allocation considers strategic bodies
rather than the implemented anonymous wildlife, and its condition comparison
uses natural renewal without executed nurturing. Those estimates can flag risks;
they cannot establish what an actual hunting/restoration interval accomplished.

The immutable world's existing `record.assessment` remains that archived forecast.
Generation still uses it to rank the same allocation candidates. No geographic
placement, original count, resource partition or source identity is rerolled by
this correction. Existing `rejected`/`feasibleInitialCycle` forecast labels are
not measured verdicts, including when an archive contains a positive prediction.

`assess(source, map)` now returns an explicitly preliminary, unverified result
with forecast **warnings**, not fictitious performed failures.
`assess(source, map, { account, binding })` validates and assesses the actual
population account. The existing `replay` uses this same assessment and requires
the full catalog. Its `report.viability` separates measured support from the
remaining opposition/native-adoption limitations. `runtimeSource` cannot promote
an archived forecast or even a supported private control into active encounters.

## What the measured assessment checks

- Matching source identity, calendar, original cohort/population counts and
  region coverage; generated replays retain all 24 species. A small supplied
  control cannot substitute for the generated roster.
- Actual cumulative unmet food/water/material needs, including shortfalls of
  individuals that later died. Actual starvation and dehydration remain failures;
  later supplies cannot cancel them.
- Recorded natural renewal, paid nurturing and actual destruction by condition
  channel. Potential workers, dormant furnaces and unconsented dreams contribute
  no unperformed work.
- Minimum observed conditions and actual time below supported floors. Later
  restoration cannot erase a transient breach.
- Negative maintenance balances over completed calendar cycles. Seasonal
  drawdown above the floor may recover through actual supplied work; a whole
  unsupported cycle is retained even if later good cycles offset its total.

The ecological account stores six minima, pooled floor-breach timing and pooled
completed-cycle deficits. It does not create per-animal ecological plans or a
per-frame census. Existing event/month boundaries and paid-rate accounting are
unchanged. Old snapshots without the observation history may load, but their
missing historical observations are not reconstructed into a passing result.

Measured statuses are `incomplete`, `unverified`, `rejected` or `supported`.
Known performed failures reject even a partial interval. A supported complete
interval is not a perpetual equilibrium guarantee. The enclosing generated
replay remains unverified if interval support is established but required
opposition/native integration is not. Neither kind of rejection changes the
causal exhausted-territory rules or labels a lost nurturer automatically.

## First-shortfall evidence

At a cohort's first actual unmet need, private state records the resource,
regional stock/renewal and regional animal matter at a dated snapshot within
that first integration interval. The existing first-shortfall time, dependency,
journey phase and actual loss/care context remain separate.

Positive regional matter does **not** establish an accessible meal: it may be
outside reach, behind an obstacle, incompatible with the consumer, alive when
the consumer needs carrion, or unavailable through an actual caregiver.
`regional-matter-present-access-or-compatibility-unresolved` says exactly that;
`no-recorded-regional-stock-at-first-shortfall` is not proof of global habitat
exhaustion. Undocumented older snapshots remain `unrecorded`. None of these
private snapshots enters animal knowledge or a public census.

## Current generated 120-day control

The one current-source complete replay uses `source-small`, refinement 2, source
`beast-habitat-source:9b62d184`: all 24 species, 89 original populations, 334
regions and 56,243 strategic originals. Every ten-day normalization checkpoint
and final assessment validates. The result is still **rejected**.

The compact recorded result is [seasonal-viability-control.json](reference/seasonal-viability-control.json).
The 1,779 preliminary warnings remain advisory, separate from the measured
issues below; no warning is simply renamed as an observed failure.

| Measured issue | Records |
| --- | ---: |
| Actual resource shortfall | 61 |
| Habitat-floor breach | 51 |
| Completed-cycle maintenance deficit | 51 |
| Scarcity deaths, grouped by species/region/cause | 55 |

The two sets of 51 habitat records concern the **same 51 wetland regions**, not
102 different regions. Their soil-cover collapse is driven by the current
overflow/flood-erosion adapter. For example, one final wetland rate reports
87,573 soil-cover points lost per day while full banks receive about 876 million
litres daily. This identifies a model/calibration problem to investigate, not
proof of realistic flood severity, a defeated nurturer or a request to spawn
more restorers. No hydrology or erosion rate was altered in this pass.

Unmet maintenance totals are 574,117.410187 kg in the hunting-food account and
2,139.661294 L of water. These are not claims that those quantities of edible,
reachable meals were absent from the entire world.

Strategic membership reconciles as **56,243 originals + 190,892 births = 130,979
living + 116,156 dead**. Death causes are 115,922 background, 205 starvation and
29 dehydration. All 120 original Lanterns are dead: 96 starvation, nineteen
dehydration and five background. Other scarcity deaths include 49 starving and
ten dehydrated Rimefangs, 23 Reef Wyrms, twelve Frostwakes, twelve Abyssal Bells,
five Marsh Hydras, four Sunspines, two Nullmaws and two Glasswing Rocs.

There are 201 deduplicated first-failure snapshots, all with positive regional
stock or animal matter. They retain access/compatibility as unresolved rather
than certifying food supply. Thirteen snapshots concern stationary dependents;
37 concern water shortage among travelling dependent grazers. Recorded Rimefang
care-loss examples show present capable caregivers and regional freshwater, but
no available food ration; this does not establish that the combined provisioning
rule, timing or destination allocation is adequate.

Actual anonymous-wildlife ingestion is 503,247.694038 kg across the whole food
web, with 10,689,339 hunts. Strategic-remains ingestion totals 9,381.843313 kg.
Neither is a Lantern-specific intake figure. There are still zero original-beast
duel contacts; military/opposition acceptance is not supplied by those hunts.
Eight ant hives still lack refined metal and 32 tortoise groups lack recorded
willing dream participants. They remain dormant, not compulsory continuous work.

Execution took 1,775.646 seconds (about 29.6 minutes), with 510,906 boundaries,
113,845,376 cohort integration visits and a 114,887,165-byte expanded account.
This is one focused seasonal diagnostic, not the full test suite or proof that
expanded accounts fit native browser-save quotas.

## Verification and reproduction

The named assessment/source/binding/ecology/benchmark unit files pass 69 checks;
the directly affected regional-work file passes 35. Three named foraging cases
cover real land/marine seasonal ingestion and blocked-access starvation; two
care cases cover saved provisioning and honest private shortage context.
That is **109 distinct focused unit checks**, not a full regression run.

Two named Chromium checks cover actual generated compressed-world reload and
measured habitat lows through browser storage, subsequent paid restoration and
continued import. The failure remains recorded after visible conditions recover.
No renderer changed. The full suite was not run under `AGENTS.md`.

For the complete diagnostic, create a real temporary directory with `mktemp -d`,
then run `node scripts/benchmark-generated-beast-habitats.js --days=120
--checkpoint-dir=THE_EXACT_DIRECTORY --checkpoint-final-only --save-report` as one
command. The script writes a final source/account checkpoint and `report.json`
without overwriting existing files, while still validating every ten-day boundary.
Retained checkpoints can be re-assessed without repeating the seasonal simulation.
No additional full replay was run for documentation or commits.
