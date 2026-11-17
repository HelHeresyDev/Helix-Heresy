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
the existing cardinal-grid/0.5 m/s horizontal ground-speed convention is applied.
Thus a 20 m/s headwind is not secretly weakened to 0.5 m/s before thrust is
calculated. Strong wind can carry a pursuing animal away from food. Unknown air
is not assumed calm. This is a coarse terminal-drag controller, not a new fluid
simulation or unlimited aerial pathfinder.

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

The replay script now uses the approved distributed habitat/aged starting
remains correction. Its current source, exact ingestion split and continued
failure to sustain generated Lanterns are recorded in
[the distributed starting-state control](BACKGROUND_WILDLIFE.md#distributed-starting-state-isolated-control--2026-11-17).
Empty/uneconomic diffuse samples use a one-hour review backoff; an actually
sensed point corpse still takes precedence and can wake observation. Finite
claims are released if their food yield cannot cover handling metabolism.
These changes do not alter the approach thrust, physiology or original reserves.
