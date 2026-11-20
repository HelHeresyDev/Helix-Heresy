# Sensed Carrion Lantern approaches

The approved approach work is implemented inside #3.38-D, not a new queue entry.
Native movement and regional cohorts share `carrion-lantern-approach.js`.
Ordinary travel remains passive wind drift. Only an actually detected compatible
corpse/nearby carrion field can initiate weak, paid propulsion. Detecting food
does not reserve or consume it.

## Initial physical tuning

| Quantity | Value / rule |
| --- | --- |
| Desired approach velocity | 0.25 m/s toward the last observed point, including descent |
| Maximum thrust | 0.0025 × body weight × minimum bladder/membrane/buoyancy integrity |
| Healthy 30 kg maximum | 0.73575 N; approximately 0.655 m/s through still air at maximum thrust |
| Drag reference | 1.225 kg/m³ air; 1.4 × 2 m area scaled by `(mass / 30)^(2/3)` |
| Injury cutoff | No propulsion at 40% or lower integrity in any required part |
| Stamina cost | 0.1 × actual/max thrust per second; no free recovery during propulsion |
| Regional starting reserve | 30 stamina, recovered through actual supported rest if absent; no source refill |
| Pursuit window | 300 elapsed seconds, never renewed by repeated observations |
| Lost-contact grace | 12 seconds toward the unchanged last observed point |
| Failed/interrupted retry delay | 300 seconds; arrival itself adds no retry delay |
| Regional review | At most five seconds while actively approaching; clipped at actual arrival |

Wind compensation is calculated against the **uncapped actual airflow** before
the existing 0.5 m/s horizontal ground-speed ceiling is applied to the full
two-dimensional vector; its lateral component is no longer discarded.
Thus a 20 m/s headwind is not secretly weakened to 0.5 m/s before thrust is
calculated. Strong wind can carry a pursuing animal away from food. Unknown air
is not assumed calm. This is a coarse terminal-drag controller, not a new fluid
simulation or unlimited aerial pathfinder.

## Two-dimensional movement and convergence

Passive Lantern advection and paid approaches retain both horizontal components.
The vector's magnitude, not each axis independently, receives the existing speed
ceiling. Thrust, drag, stamina, injury, handling, tissue and sensory limits are
unchanged. Unrelated aquatic current/grid movement is not revised.

Native terrain addresses remain integer cells. A Lantern saves bounded signed
`airOffset.x/y` cell fractions, each within half a cell, and `Bodies.position`
converts them with the actual caller-supplied tile scale. Saved metadata cannot
provide its own enlarged spatial scale. Body movement sweeps conservative full
masks in quarter-cell steps, including both orthogonal neighbors at a diagonal
corner and both vertical endpoints. Sensing, approach deltas and contact distance
use actual fractional positions. Pending/refusing bodies get no directed thrust;
passive wind can still carry them. Actual DOM/Canvas observations retain the
earned offset and visible swept footprint through native game reloads.

At a regional convergence front, inward normal transport stagnates but the
horizontal tangent is retained. The neighboring wind is converted through the
recorded boundary/entry frame; the two raw tangential components are averaged
and then limited to the existing ground-speed ceiling. Exactly head-on flows
have zero tangent and can still strand a creature. Two simultaneous nonparallel
convergent planes have no common horizontal tangent and retain a stationary
corner, rather than creating rapid repeated crossings. All participating wind
sources are scheduler dependencies; a real change can release the corner.

This is an explicitly coarse stationary-front rule, not a weather, turbulence
or vertical-updraft simulation. Feeding holds and directed approaches still use
the uncapped actual local wind for their force calculations; a front is not
permission to weaken drag, anchor to an entire anonymous herd, or find food.
Crossing and formation offsets use the actual two-dimensional separating plane.

New regional segments record `vectorFlow: true`. Unmarked legacy cardinal
segments validate with their original controller and retain cached trajectories
on load/review; actual changed conditions or a subsequent segment can use the
new geometry. Old native partial grid motion finishes its already-earned segment
once before fractional advection begins. No historical distance, work, resources
or positions are reconstructed or refunded.

## Retained failing-window checks

[lantern-vector-windows.json](reference/lantern-vector-windows.json) records two
one-day continuations of the existing all-species `a2ffef9d` checkpoints, not a
fresh full seasonal replay. Earlier paid history, all 56,243 strategic originals,
actual other species, original wildlife, weather, geography and deaths remain.
Both final accounts normalize; reusable worlds remain byte-identical and
original-plus-born membership reconciles.

- Day 10 to 11: 118 living Lanterns remain in 51 cohorts; all 51 have vector
  segments with both components at the endpoint. The original checkpoint has
  only legacy cardinal segments.
- Day 60 to 61: 71 living Lanterns remain in 51 cohorts. The checkpoint's fifteen
  stationary fronts become fifteen tangentially sliding fronts. The one-day
  continuation does not restore lost creatures, reserves or expired meals.

These windows remain rejected because prior performed scarcity/habitat failures
are retained. Sliding is not a meal, and unchanged one-day survival does not
establish long-term generated Lantern viability or native source adoption.
The prior complete seasonal measurements below and in `SEASONAL_VIABILITY.md`
remain historical, not silently relabeled as post-vector results.

Focused verification for this correction covers 67 unit checks: the body,
approach, drift and vector-motion files plus three named cases each for regional
scheduler, shared behavior and predation. Three Chromium cases cover actual
DOM/Canvas native pose/footprint reload and saved off-axis native/regional
approaches. No full suite or new full-world seasonal replay was run.

Existing native full-body terrain, obstruction and clearance checks still apply
to every earned movement segment and descent. A pending action, incapacity,
unwillingness, injury, exhaustion or time limit stops directed effort. Passive
observation/drift stays basal; actual approaches use the existing 8× exertion
metabolism. Native partial grid progress, regional position/velocity segments,
stamina and last observations persist across saves and independent branches.

## Knowledge, arrival and scale

The existing native sight/scent checks locate compatible corpses. Regional
sensing is limited to the corresponding 40 m local range and actual formation
extent. Barriers and protected sources remain unavailable. Anonymous wildlife
fields expose only their nearby sensed edge, not a distant centre or an oracle
for the best regional food supply. Fish beneath the water column do not become
airborne carrion cues. Losing a signal does not update the remembered location;
a depleted, moved or monopolized source can therefore cause a failed pursuit.

Only actual feeding reach permits the normal elapsed observation, specific
tissue claim, handling and ingestion pipeline. Other mouths can consume the
source before arrival. Real wind changes recheck contact even when an earlier
passive segment would otherwise be reused. Neither feeding holds nor anonymous
field totals grant an out-of-reach meal.

A spatially extended cohort cannot fit all its mouths at a point corpse. When
an existing formation actually senses such a corpse, the existing contact split
can separate **one** sensing original for pursuit, retaining the others' actual
positions and five-minute retry spacing. The cohort loop uses a snapshot, so it
does not recursively expand the remaining population in the same update. Huge
formations cannot borrow one member's nose to direct everyone. Anonymous fields
still require the actual feeding formation to fit. These rules also prevent
zero-time arrival retries when only the anchor, not the formation, has arrived.

New approaches/meal claims wait until the regional food store falls below half
capacity; already owned meals can fill the store normally. This prevents repeated
handling of microscopic replacement rations. Passive reviews do not spend active
search effort. Active reviews, including unsuccessful approaches, consume the
existing monthly search/activity budget. Final death freezes further execution.

## Downwind contact and grip allocation

A Lantern can use its existing thrust to aim for a sensed downwind carcass
instead of spending nearly all of it braking. It cannot fight an overpowering
headwind. The live approach can stop inside actual feeding reach; once the
body reaches a point corpse it can start handling immediately, but only
continuous handling followed by elapsed eating debits food. Old saved
approach segments still validate against the course that earned them.

A compact flock's lead observer can peel off on its own when it detects a
point corpse; the rest do not inherit that knowledge. Crossing a shared
globe border takes the air over the next land surface, rather than choosing
an overlapping shore patch merely due to edge order. For newly generated
sources, initial drift lines prefer existing large-wildlife habitat within
the original territory and winds in which an adult could physically hold on
to such a carcass. This screening does not place or reserve a meal, predict
an individual corpse, or alter wildlife counts, wind or original creature
reserves. Unmarked archives keep their prior placement.

After reaching a carcass, the regional meal claim reserves its grip *before*
taking edible tissue from the same corpse. Trace data found a 27.05 kg
Lantern in 5.82 m/s wind touching a single aged carcass with about 11.21 kg
of structure. It needed 11.07 kg to hold, but the former food-first order
left about 8.53 kg for its grip. Handling ended after about 1.87 seconds
instead of the required 60. The corrected claim sets aside the real
structure, with a bounded allowance for decay and the Lantern's growing
mass, then eats only from what remains. Tiny or depleted carcasses still
cannot anchor a feeding Lantern.

Use `node scripts/replay-lantern-meals.js 20 40 65 85 120` for the isolated
generated-world meal trace. It records sensed and reached sources,
interrupted handling, and actual wet tissue debits by source and flock.

The updated isolated `source-small` control (`c08cce7f`) retained 120
original Lanterns and the same wildlife counts and starting carrion mass.
Before the grip-order fix, the revised placements produced no ingestion over
120 days. Afterward, one original flock finished the sixty-second hold and
ate **0.320140 kg of wet tissue** from one actual wildlife carcass on day
61.34. This reconciles with the wildlife ledger and does not include any
initial Lantern reserves or tissue from another Lantern. The replay had
111 approach starts, 90 living originals at day 65, none at day 85, no
births, and final losses of 115 starvation and five background mortality.

The target of repeated feeding from independent carcasses in at least two
original flocks was **not** met. The isolated result is an access and
custody improvement, not evidence of sustained feeding, and the all-species
replay below was not repeated for this change.

## Terrain-backed lee air

New worlds can archive one finite ground-level wind shadow in a lower land
patch when the mapped upwind neighbor is at least 80 m higher. The coarse
relief locates a bounded lee strip rather than pretending to resolve every
ridge. It prefers the windward side of existing wildlife grounds when present.
Relief bounds the strip's length, width and height. Only low air inside that
footprint slows, only while the wind comes from the sheltered direction, and
the remaining flow is nonzero. The rest of the hex keeps its ambient wind.
Older source records with no shelter rows keep their original layout.

Passive drift meets the boundary at an elapsed physical position; Lanterns
cannot seek a shelter or see past a change of flow. Local terrain projects the
same geometry, including fractional tile movement and height. New placements
prefer downwind lines through the actual overlap of shelter and existing
wildlife, without modifying reserves, biology, carcass inventory or wildlife
counts. A reached but unusable corpse is set aside for a bounded local retry
instead of triggering back-to-back thrust and rechecks. Water from meals still
overflows through the real ingestion ledger; only atmospheric uptake predicts
a separate water-cap event.

In the isolated generated `source-small` replay (`071aaf33`), by day 0.12
five original flocks had eaten from 12–33 distinct wildlife carcass sites each,
debiting **0.169369 kg** of wet tissue in total. All 120 originals were alive
at that early checkpoint. The isolated wildlife ledger recorded **25.147816 kg**
eaten at day 10 and **43.754141 kg** at day 40, with no additional intake by
day 120. Seven originals remained at day 85 and one at day 120, with no births.
The other 119 were lost to starvation (96), dehydration (19) and background
mortality (4). The positive and exposed-wind controls use the same real
body; only the lee case finishes a meal. This demonstrates access, not a
viable season or stable reproduction.

The matching all-species replay with kernel `9aebc87` completed all 120 days
and validated all twelve checkpoints. It records **43.754141 kg** of wet
tissue and **17.199929 kg** of food-equivalent, with no new ingestion after
day 40. Seven original Lanterns remained at day 80 (none in the pre-shelter
run), and one remained at day 120. There were no births; 96 died of
starvation, 19 of dehydration and four of background mortality. The source
remains rejected. This is the shelter-only comparison, not a seasonal-wind
replay.

## Seasonal coastal air

New worlds archive two wind vectors per hex: the peak warm and cold phases
of the existing game calendar, with the hemispheres offset by two phases.
The opening and other shoulder phases retain the prevailing climate wind.
In the peak phases it turns and changes strength by latitude, and a bounded
land–sea component derived from the coastline and climate seasonal range
can turn exposed coastal winds onshore or offshore. Subsurface patches have
no seasonal airflow. This does not change the weather used for the original
rain, wildlife or habitat resource budgets. Worlds archived without seasonal
rows keep their old winds and placements.

An elapsed regional or local wind segment stops at the phase boundary and
resumes at the same position under the new air. Existing terrain shadows
still only work with airflow from the sheltered direction. Lanterns do not
know the next phase or steer toward land. On a real crossing, they release
old contact claims and may only sense from the position reached. Native
terrain stores one schedule per visited region instead of a copy per tile.

Focused controls verify that an onshore turn carries a Lantern back to a
finite real carcass it can feed on, while the same starting position and
carcass give no intake when the air continues offshore. They also verify
save/reload across the turn and no retroactive native motion. The generated
`source-small` map has 29 sea-to-surface borders where the component toward
land changes sign across the year. This does not establish recurrent
feeding, reproduction or ecosystem viability. No new full-season replay
was run for this change.

## Pre-shelter integrated generated control

The [complete pre-shelter ecosystem control](SEASONAL_VIABILITY.md#current-integrated-120-day-control)
uses fresh source `beast-habitat-source:e8a02b1f` and kernel `cb7383e`. It retains
all 24 species, original wildlife, weather, corpses, care and work. All twelve
ten-day checkpoints normalize. This replaces neither the historical isolated
control below nor the retained one-day vector windows with relabeled numbers.

The species-attributed replay observer records **zero Lantern wet-tissue or
food-equivalent ingestion**, zero carrion water and zero instant remains meals.
Actual atmospheric uptake is 166.477044 L. Pooled ecosystem foraging of
688,126.999 kg is not Lantern intake. A separate positive-meal control confirms
the observer records real Lantern food/water when ingestion actually occurs.

| Day | Living Lanterns | Cumulative wet tissue eaten |
| --- | ---: | ---: |
| 10 | 118 | 0 kg |
| 20 | 116 | 0 kg |
| 30 | 90 | 0 kg |
| 40–70 | 84 | 0 kg |
| 80–120 | 0 | 0 kg |

At day 70 those 84 have exhausted food/fat and health is only 0.239–0.287.
Delayed death is not successful scavenging. All 120 originals die with no
offspring: 109 starvation, six dehydration, five background. Improved motion
and atmospheric water do not establish reachable feeding. The source remains
rejected; exact sensing/approach/contact opportunities and missing meals remain
unresolved, not excused as natural extinction or supplied by a new mechanic.
No controller, biology, food, wind or population rule changed in this measurement
pass. See the existing D accounting in the linked seasonal report.

## Historical targeted generated control

These are the pre-distribution measurements of the isolated
`source-small`, refinement-2, 120-day control. Source
`beast-habitat-source:622013f8` supplies the original 120 Lanterns, unchanged finite
anonymous wildlife, atmospheric water, geography and wind. Other strategic
species and their competition/work are deliberately excluded. No carcasses,
reserves, safe destinations or rescue births are added.

| Day | Living originals | Cumulative wet tissue eaten |
| --- | ---: | ---: |
| 20 | 116 | 0 kg |
| 40 | 71 | 2.044763 kg |
| 60 | 71 | 2.044763 kg |
| 80–120 | 0 | 2.044763 kg |

There are 31 original-weighted approach starts and 2,093.1604 individual-seconds
of paid approach. All ingested material comes from corpses of other original
Lanterns in this isolated control, not predator kills or anonymous wildlife;
anonymous-wildlife ingestion and hunting are both zero. There are no
births. Original losses reconcile as 96 starvation, nineteen dehydration and
five background deaths. Actual atmospheric collection is 151.333673 L.

The run completes in about 21.1 seconds while focused checks also execute on
the machine: 53,830 boundaries, 587,094 cohort-integration visits, 102,860 regional
rebuilds and 45 final strategic cohorts. Every twenty-day checkpoint validates.
The previous passive-only control had zero ingested food, 66 survivors at day 60
and none at day 80; it predates typed tissues as well as steering, so the change
is not a steering-only causal comparison.

This demonstrates actual sensed approaches and finite ingestion in generated
geography, **not viable generated scavenger food access**. All originals still
die before the end of the cycle. The source remains rejected; sustained
all-species food-web viability, source repair/adoption and the other existing D
acceptance work remain open. There is no automatic new prompt or healthy-world
certificate.

Focused verification includes 201 unit checks for the new controller and native bodies/behavior,
predation, wind drift, foraging, tissue inventories, physiology, regional food
web, population/scheduler and background wildlife. Four Chromium cases cover
native predation, existing wind/biology continuity, and partial native/regional
approaches across reload and independent branches. Twelve catalog/artifact checks
also confirm the existing reference workbooks remain consistent. The full suite was not run
under repository policy.

The replay script now uses distributed habitat/aged starting remains and the
approved spatial-carcass correction. Its current source, exact ingestion split
and continued failure to sustain generated Lanterns are recorded in
[the spatial-carcass control](WILDLIFE_CARCASSES.md#targeted-120-day-generated-control).
Empty/uneconomic diffuse samples use a one-hour review backoff; an actually
sensed point corpse still takes precedence and can wake observation. Finite
claims are released if their food yield cannot cover handling metabolism.
These changes do not alter the approach thrust, physiology or original reserves.

New wildlife carcasses expose fixed nearby sites, not the edge of a diffuse
field. The existing single-member point-contact split also applies to those
sites. A current flow that cannot permit handling or a hold on one body's
actual structure does not justify pursuing a tiny corpse. This is a local
physical feasibility check, not permission to inspect distant food or future
winds. Losing contact before handling finishes does not award a completed meal.
