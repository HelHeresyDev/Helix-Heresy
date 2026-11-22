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
remaining opposition/native-adoption limitations. `runtimeSource` now explicitly
separates integrity-checked encounter activation from ecological viability; it
cannot turn an archived forecast or private control into a healthy-ecosystem
certificate. The [bounded native adapter](BEAST_POPULATIONS.md#bounded-native-encounter-adapter)
does not resolve the measured feeding failures or complete D.

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

## Integrated 120-day replay with seasonal winds

The [current compact report](reference/seasonal-wind-integrated-control.json)
records one fresh `source-small`, refinement-2 replay with runtime `af0fec9`
and source `beast-habitat-source:43996615`. No simulation rules were changed for
the replay. It has the same 24 species, 89 populations, 334 regions and 56,243
original beasts as the pre-shelter control. Its source has seasonal wind
rows and terrain shelters, but no coastal Wyrm nursery schools on this seed.
This is a same-seed comparison, not an A/B run with only winds toggled.

All twelve ten-day checkpoints normalized, preserved the same canonical world
and reconciled membership and intake against the executed receipts.
**56,243 originals + 190,892 births = 131,048 living + 116,087 dead.**
The source remains **rejected**: 35 resource-shortfall records and 30 grouped
scarcity-death records, representing 147 starvation deaths and 19 dehydration
deaths. There were no habitat-floor breaches, completed-cycle maintenance
deficits, exhausted regions, flood erosion or original-beast contacts. Zero
contacts leave natural opposition unverified, not proven absent in every world.

| Species with scarcity losses | Living / original | Starvation / dehydration | Foraged tissue (kg) |
| --- | ---: | ---: | ---: |
| Carrion Lantern | 1 / 120 | 96 / 19 | 35.63 |
| Reef Wyrm | 0 / 23 | 23 / 0 | 14,065.66 |
| Frostwake Leviathan | 0 / 12 | 12 / 0 | 21,882.05 |
| Abyssal Bell | 0 / 12 | 12 / 0 | 305,367.04 |
| Marsh Hydra | 8 / 12 | 4 / 0 | 53,613.76 |

None of those five species recruited offspring. All three marine predators
ate in this run, but their species totals do not tell us which individuals
could feed often enough. The 171 first-shortfall records show regional
animal matter but do not establish physical access or dietary compatibility.

The Lanterns ate 25.15 kg by day 10, 26.33 kg by day 40 and 35.63 kg by day 70.
They ate nothing more through day 120, including after the second wind turn
at day 90. Total intake was 13.54 kg food-equivalent. The shelter-only run
ate 43.75 kg and had seven Lanterns alive at day 80, compared with five here.
Both runs ended with one survivor, no births and the same breakdown of
Lantern deaths (96 starvation, 19 dehydration, four background). More food
windows did not yield sustained feeding or recruitment in this replay.

The first targeted Lantern case is traced below. Its lack of a meal was a
physical access failure, not a demonstrated feeding bug. The remaining
Lantern and marine records still call for per-group access and repeat
feeding evidence, not a blanket increase in regional prey biomass.
[Abyssal Bell search pacing](HUNTING_HABITATS.md#abyssal-bell-search-pacing)
separately tested whether one original could still hunt late in the month.
It restored late feeding attempts and real intake, but did not meet the
individual's food needs in the replay window.

Execution took 3,647.034 seconds (60.8 minutes); the expanded final account
was 363 MB. Positioned wildlife carcass sites rose from 22,640 at day 30 to
148,543 at day 70. Of the latter, 147,008 natural sites had no recorded
consumption or active reservation. This is a diagnostic storage/runtime
observation, not a measured browser save size or proof that those sites can
be discarded. Raw checkpoints and the full report are in the ignored
`.replay-checkpoints/current-source-small-VaeaU47X/`; only compact evidence
is tracked. Use the replay command below with a fresh checkpoint directory.

### Day 10 to 13 Lantern shortfall: wind prevented a grip

The day-10 checkpoint for source `43996615` was resumed through day 13 with
all other species, weather, and carcass inventories intact. The traced
original cohort, `natural-group:beast-population:carrion-lantern:01:0:young`,
comprised two juveniles in `habitat:46:surface`. It reproduced the archived
first food shortfall at 1,030,024.756 game seconds (day 11.92), including the
timestamp and inventory in the first-shortfall snapshot.

- A private audit sampled the actual path at 72 points or short segments.
  Five original insect carcass sites had compatible tissue within 40 m;
  the closest sampled site was 9.68 m away. This is a sampled lower bound
  on nearby carcass sites, not a count of everything the flock passed.
- All 323 elapsed intervals had 7.24 m/s airflow. The body's own grip-force
  limit was below the drag force throughout, even before evaluating a
  carcass's attachment strength. The passive pass was too fast to stay in
  reach for 60 seconds. Position and available tissue alone were insufficient.
- The actual foraging loop recorded 72 sensing calls with no eligible
  target, 72 capture reviews with no claims, and zero approach, handling,
  or eating time. Both juveniles were still alive at day 13, with no fat
  or food left and health down to 89.2%.

This is one explained food-access failure, not proof that every Lantern
shortfall has the same cause. No wind, movement, intake, carcass, or
knowledge rule changed. Two focused checks verify that the observer
leaves a successful control run unchanged and distinguishes nearby but
unholdable tissue from a distant corpse.

```sh
node scripts/trace-lantern-shortfall.js \
  .replay-checkpoints/current-source-small-VaeaU47X/day-10.json \
  natural-group:beast-population:carrion-lantern:01:0:young 13
```

## Historical pre-shelter integrated 120-day control

The later [shelter-only comparison](CARRION_LANTERN_APPROACH.md#terrain-backed-lee-air)
also finished 120 days with all 24 species and twelve valid checkpoints. It
improved Lantern access from zero ingestion to 43.754141 kg wet tissue, but
only one original Lantern survived, with no births. Its measured source
result was still rejected. The archived comparison below remains the
pre-shelter reference; seasonal winds were not included in either full replay.

[integrated-seasonal-control.json](reference/integrated-seasonal-control.json)
records a **fresh** `source-small`, refinement-2 world with source
`beast-habitat-source:e8a02b1f`. It combines hunting placement, vector Lantern
motion and catchment drainage with the existing care, carcass and food-web
systems. The simulation kernel is commit `cb7383e`; the only additions in this
pass are private Node reporting/observation, focused checks and documentation.
No rates, original counts, wildlife, wind, food, reserves or rules were tuned.

All 24 species, 89 populations and 334 regions execute for 120 days. All twelve
ten-day checkpoints normalize; the reusable world stays byte-identical across
them and its canonical digest validates. This is not an isolated Lantern or
hydrology control. **The measured result remains rejected.**

Membership reconciles exactly, globally and per species:
**56,243 originals + 190,892 births = 131,047 living + 116,088 dead**.
Deaths are 115,922 background, 160 starvation and six dehydration. The published
report retains all 24 species' membership and intake totals, twelve milestones,
scarcity contexts and original-source provenance.

| Measured result | Earlier complete baseline | Current integrated control |
| --- | ---: | ---: |
| Resource-shortfall records | 63 | 33 |
| Grouped scarcity-death records | 58 | 25 |
| Starvation / dehydration deaths | 213 / 29 | 160 / 6 |
| Habitat-floor breaches | 1 | 0 |
| Completed-cycle maintenance deficits | 37 | 0 |
| Original-beast encounter contacts | 0 | 0 |

These are different generated source records on the same original geography,
with several corrections combined—not a single-variable causal experiment.
Current cumulative unmet maintenance is 551,091.814388 kg in the hunting-food
account and 2,152.737295 L water. A lower death count does not mean every unmet
quantity improved. None of the 166 deduplicated first-failure snapshots proves
a local meal: each retains some regional stock/animal matter, with actual
access or compatibility still unresolved. No region is relabeled exhausted.

### Feeding findings, without a pooled-intake shortcut

| Species with scarcity losses | Living / original | Starvation / dehydration | Actual foraged wet tissue |
| --- | ---: | ---: | ---: |
| Carrion Lantern | 0 / 120 | 109 / 6 | 0 kg |
| Reef Wyrm | 0 / 23 | 23 / 0 | 0 kg |
| Frostwake Leviathan | 0 / 12 | 12 / 0 | 21,882.05 kg |
| Abyssal Bell | 0 / 12 | 12 / 0 | 0 kg |
| Marsh Hydra | 8 / 12 | 4 / 0 | 53,548.88 kg |

There are no births in these five rows. Lanterns additionally lose five members
to background mortality. A species-wide positive feeding total is not proof
that every group or dependent ate: all Frostwakes die despite some ingestion.
Three Frostwake scarcity losses are dependents with living known guardians;
the audit records no delivered Frostwake food/water. Guardian presence alone
does not prove capability, proximity or available rations. Of all 166 scarcity
deaths, 158 are stationary independents, three stationary dependents, four
stopped independents and one travelling independent. Age classes in the report
are calendar-age bands, not certificates of adult body mass or skill.

All Lanterns are dead by day 80, with **zero** observed wet-tissue ingestion,
food-equivalent, carrion-water uptake or instant remains meals. They take
166.477044 L from actual atmospheric water, not remote ground water. At day 70,
84 are still alive but food/fat stores are exhausted and living health spans
about 0.239–0.287. Survival on initial reserves and delayed death is not feeding
viability. The full world's 688,126.999 kg of elapsed foraging cannot be credited
to Lanterns. Their sensed approaches/motion are implemented, but access remains
unresolved; no rescue food, special source placement or immunity is supplied.

Conversely, 124 of 125 original Rimefangs survive; the one loss is background
mortality, with no scarcity deaths. All twelve Nullmaws survive. Rimefangs
actually ingest 64,690.93 kg and deliver 4,559.00 kg food/3,498.32 L water through
care; Nullmaws ingest 18,576.09 kg. These complete-world observations strengthen
the earlier isolated placement controls without certifying all predator starts.

### Fixed remaining D accounting

This is the same four-item [existing acceptance list](BEAST_POPULATIONS.md#fixed-d-acceptance-still-unfinished),
not new prompts or additional prerequisites:

| Existing requirement | What this run establishes; what remains |
| --- | --- |
| Source repair, seasonal viability and adoption | Habitat maintenance now passes in this sample, with zero flood erosion. The five feeding-loss species above remain unresolved, so this source is not accepted/adopted. |
| Natural formation sites and sustained food-web/opposition integration | Performed food/care and existing work execute; zero original-beast contacts do not demonstrate opposition. Finite natural formation-site coverage remains existing implementation work. |
| Native encounters, persistence, travel/logistics and dated observations | A diagnostic account is not a live encounter integration. This pass changes no native adoption, knowledge or human logistics. |
| Focused native/source-class and strategic-output acceptance | The Node replay does not exercise native DOM/Canvas, whole-package source-class outputs or publication boundaries. The already-listed 3.35d-D/E integration stays with its existing owner. |

Eight hives still lack refined metal and 32 tortoise groups lack willing dream
participants. Those optional dormant abilities are not new blockers or credited
as performed nurturing. No rate changes, formation features, opposition fixes
or encounter changes were smuggled into this measurement pass. D stays open,
the queue stays at eleven and the tutorial stays deferred.

### Reporting method and reproduction

The replay-only intake observer delegates to the unchanged integrators. Direct
maintenance uptake comes from their executed cached supply rates; elapsed meals
and care use actual transfer deltas. Starting reserves are not new intake;
care delivery is an internal transfer, not extra environmental production.
Instant remains are reported as wet kg without invented water/food conversion.
The bounded event-ring fallback reports unattributed instant meals explicitly;
this run has zero unattributed kg. Per-species foraging, atmosphere and care
reconcile with the original pooled receipts at every checkpoint.

Observation-on/off prepared accounts remain byte-identical. A positive Lantern
meal control verifies that the meter can record real tissue, food and water.
Saved observation resumes with the exact source/time and never reconstructs
missing earlier intake; observers detach on success and failure. Audit data is
outside the game account and reusable world. No browser runtime dependency is
added. **Eleven focused unit checks pass; the full suite was not run.**

Execution took 1,565.344 seconds (26.09 minutes), with 330,779 boundaries,
115,783,374 cohort intervals and a 116,336,513-byte final expanded account. This
is an observed diagnostic cost, not a controlled performance comparison or a
proof that native/default-resolution saves fit browser quotas.

Checkpoints and the full report are retained under the ignored
`.replay-checkpoints/integrated-aU61avzq/`; only the compact reference is committed.
An interrupted earlier `/tmp` execution was lost with its environment; none of
its partial observations is substituted for this fresh completed run.

To reproduce, create a fresh directory under `.replay-checkpoints/`, then run:

```sh
node scripts/benchmark-generated-beast-habitats.js --days=120 --checkpoint-dir=.replay-checkpoints/NEW_CONTROL --save-report
node scripts/summarize-integrated-season.js .replay-checkpoints/NEW_CONTROL reference/NEW_REPORT.json RUNTIME_COMMIT
```

The directory must already exist and be real; snapshots/reports refuse to
overwrite files. Preserve its `intakeAudit` alongside `world`/`account` when
resuming. Repository-local ignored checkpoints survive environment resets;
temporary-directory checkpoints are not durable evidence storage.

## Historical post-drainage/post-care generated 120-day control

The earlier measured baseline is
[post-drainage-seasonal-control.json](reference/post-drainage-seasonal-control.json):
seed `source-small`, refinement 2, source `beast-habitat-source:a2ffef9d`,
runtime commit `f07bfe2`. It includes the drainage and independent care
corrections, all 24 species, 89 original populations and 334 regions. All twelve
ten-day normalization checkpoints pass. The result remains **rejected**.

| Measured issue | Records |
| --- | ---: |
| Actual resource shortfall | 63 |
| Habitat-floor breach | 1 |
| Completed-cycle maintenance deficit | 37 |
| Scarcity deaths, grouped by species/region/cause | 58 |

Membership reconciles exactly: **56,243 originals + 190,892 births = 130,971
living + 116,164 dead**. Death causes are 115,922 background, 213 starvation and
29 dehydration. Unmet maintenance totals are 574,510.181470 kg in the hunting-food
account and 2,139.572604 L of water. The 205 deduplicated first-failure snapshots
all retain positive regional stock or animal matter; none proves an accessible
meal or caregiver delivery. No region is automatically relabeled exhausted.

The remaining failures have distinct evidence and limits:

- **Initial predator placement:** an actual Rimefang case starts with roughly
  550 kg of background land animals across three million hectares despite better
  compatible feeding grounds in its original territory. The implemented
  [finite hunting-habitat correction](HUNTING_HABITATS.md) changes new-world
  placement without changing original counts, prey, rates or migration knowledge.
  The failing six-member family survives 15 days in the corrected site; all 19
  coallocated groups retain 113 living originals without scarcity deaths after
  30 days. These are deliberately isolated controls, not a full-world pass.
- **Dependent care:** thirteen scarcity deaths concern stationary dependents.
  Recorded Rimefang/Frostwake loss examples have living local guardians but no
  currently capable, food-supplied caregiver. Independent water funding does not
  restore an already incapacitated parent or make a food ration appear.
- **Journey feeding/access:** 21 independent scarcity deaths occur while stopped
  and thirteen while travelling. Those contexts do not, by themselves, establish
  either a legitimate unavoidable loss or an implementation defect. Source
  support, actual feeding opportunities and original routes remain separate.
- **Wind-driven scavenging:** all 120 original Lanterns die (96 starvation,
  nineteen dehydration, five background). Checkpoints include sea drift and
  convergence-front stranding; their full feeding-access explanation remains
  unresolved. The model records 37 approach starts and 2,445.16 earned approach
  seconds, with no limited carcass queries. Pooled food receipts are not a
  Lantern-specific ingestion measurement; living prey cannot fund scavenger
  placement, and no new food or wind-steering ability was supplied.
- **Habitat maintenance:** all 37 negative completed-cycle balances concern soil
  cover. Only `habitat:117:wetland` crosses its floor, first around day 58.87,
  reaching a minimum of zero. Subsequent [catchment reconciliation](WETLAND_DRAINAGE.md#catchment-sized-generated-control-and-the-37-deficits)
  traces 35 to flood-only soil destruction and two to dominant flooding plus
  small paid Mire Choir soil costs. All 37 have positive recorded balances when
  only flood erosion is excluded. New-world catchment-sized outlets remove that
  erosion in the separate hydrology-only control, not in a repeated full food
  web. These historical losses remain recorded, not proof of defeated nurturers.
- **Opposition/adoption:** original-beast duel contacts remain zero. Eight hives
  still lack refined metal and 32 tortoise groups lack recorded willing dream
  participants. Optional dormant powers get no unperformed maintenance credit.
  Native encounter and strategic-output acceptance remains unfinished.

Execution took 1,822.719 seconds (30.38 minutes), with 504,239 boundaries,
114,005,146 cohort intervals and a 115,047,706-byte expanded final account.
The finite anonymous wildlife ledger retains roughly 97.5 billion original
animals without per-animal planners. Validated diagnostic snapshots do not
establish that expanded run accounts fit native browser-save quotas.

The placement correction creates new source `beast-habitat-source:6fe013ab`;
**that source has not received another complete seasonal replay**. The measured
baseline remains its original archived `a2ffef9d` source, not a retroactively
repaired world. The historical pre-drainage figures below are also retained.
The subsequent catchment correction creates `beast-habitat-source:e8a02b1f` with
unchanged original counts, rainfall and authored maintenance rates. Its
[120-day drainage control](reference/catchment-drainage-control.json) covers
all 62 wetlands and explains the 37 historical soil deficits, but excludes animal
consumption/ongoing nurturing in its private copy. It does not replace this
rejected all-species baseline or establish source adoption.
These full-season measurements also precede the
[Lantern vector-motion correction](CARRION_LANTERN_APPROACH.md#two-dimensional-movement-and-convergence).
Its two retained one-day windows verify motion/save continuity, not a replacement
seasonal survival or maintenance result.

The hunting-placement pass's focused verification covers 43 unit checks in the source, binding and
hunting-habitat files, plus two named Chromium generation/storage/reload checks.
The recorded report's source scope and population/death conservation also pass
direct assertions. The full test suite was not run under `AGENTS.md`.

## Historical pre-drainage generated 120-day control

The recorded complete replay uses `source-small`, refinement 2, source
`beast-habitat-source:9b62d184`: all 24 species, 89 original populations, 334
regions and 56,243 strategic originals. Every ten-day normalization checkpoint
and final assessment validates. The result is still **rejected**.

These measurements precede the [finite drainage correction](WETLAND_DRAINAGE.md).
That correction adds a separate hydrology-only control, not a new complete
food-web result. The counts below remain historical measurements of this exact
source and kernel; they are not regenerated or silently relabeled as new results.

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
102 different regions. Their soil-cover collapse was driven by the then-current
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

## Historical assessment verification and reproduction

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

That command on the current implementation generates the new hunting-placement
source, not either historical baseline. Reproducing the post-drainage baseline
from zero requires commit `f07bfe2` or its retained original world. The completed
run's ten-day checkpoints and raw `report.json` remain in
`/tmp/helix-current-seasonal.cxPzp2jL`; they are temporary local artifacts, not
committed browser saves. A current-code assessment can reuse the exact saved
world/account with `--resume=.../day-120.json --days=120` without advancing another
cycle. Use a different real checkpoint directory if saving output: snapshots
never overwrite existing files. Only the one approved full seasonal diagnostic
was run in this pass; the full test suite was not run.
