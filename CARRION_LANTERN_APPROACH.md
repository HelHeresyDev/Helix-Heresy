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
