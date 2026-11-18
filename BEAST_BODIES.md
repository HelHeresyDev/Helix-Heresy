# Beast bodies and environmental reach

All 24 authored strategic species now have consumed physical profiles in
`beast-bodies.js`. The actor constructor in `wilderness-beasts.js` attaches an
original body once. Saved dimensions, mass, parts, reserves and pose are not
overwritten by later reference values. This completes the shared physical package,
not every creature ability or population-backed encounter.

## Physical behavior

- Body length, width, height, spread wings, mass, natural reach and anatomical
  parts determine occupied space, clearance, load and bodily impairment. A colossal
  body is not squeezed into one tile. Current and partially entered cells remain
  occupied; corpses retain their bodies. Living members and whole superorganisms
  retain separate original identities, not copied population reserves. A hydra's
  heads and a cathedral's feeding towers are parts, not extra creatures.
- Elongated walkers/swimmers turn with elapsed time and finite effort. The entire
  swept rectangle must fit, including during a saved partial turn. Source geometry,
  other bodies, closed doors, solid fixtures, roofs and protected boundaries block
  incompatible volumes. Unknown terrain does not grant a route.
- Winged flight requires forward movement and spread-wing clearance. A biological
  aerostat follows actual wind; it is not a freely steering aircraft. Levitation
  consumes finite mana even while hovering and fails under suppression. Wing injury,
  incapacity or exhausted reserves can cause a real descent and physical injury.
  Raised solid surfaces catch falls; dead spread wings do not vanish on landing.
- Swimming requires connected water of sufficient depth and oxygen. Amphibians
  cross adjacent shores gradually, retaining a partially submerged pose through
  saves. Drifting bodies follow actual current. Ice is a finite obstruction;
  the canonical ice-breaking body can break contacting original ice with effort.
- Tunneling requires supported soil depth, hardness, density, oxygen and actual
  material. Foundations, inundation and unknown geology block it. Entry/emergence
  take time. Excavation transfers finite material into retained rubble and reduces
  recorded bearing support; a profile creates neither ore nor an infinite tunnel.
- Actual carried item mass constrains capacity, slows movement and adds ground
  load. Damaged locomotor parts impair or prevent locomotion; movement and ordinary
  body-managed strikes spend finite stamina. Rooting is stationary, not movement.
- Sight, hearing, scent, vibration, water pressure and mana-signal checks require
  a supported channel, local three-dimensional range and a real signal path supplied
  by the caller. Darkness, injuries and incompatible media can prevent perception.
  These checks do not disclose remote habitat or change an instinctive destination.

The local adapter consumes existing map geometry and explicit original physical
terrain. Air above an outcrop is distinct from the outcrop's obstructed ground.
Water depth, subterranean material and wind/current must be supplied by a real
source; an ordinary dry patch does not silently become a sea or a mineral deposit.
Small patches can legitimately be too small for a colossal animal.

Carrion Lantern air movement retains both wind components and uses bounded
fractional cell offsets while terrain/occupancy addresses stay integer. Full
swept masks conservatively block corner cutting; sensing and contact distance
use the actual sub-cell position. Native pose observations and saved bodies keep
that earned offset. Existing aquatic grid locomotion is unchanged. See
[sensed Lantern approaches](CARRION_LANTERN_APPROACH.md) for unchanged force limits,
regional tangential fronts and the retained-checkpoint verification boundary.

## Existing behavior and persistence

Rimefang and Gravebloom Elk keep their existing ground encounters. Mirror Apes
keep natural-surface climbing, their original 90 kg mass, separate climbing effort,
learned Soul Lash, finite original spell mana and individual compacts. Their ground
navigation also respects body clearance and injury. New body-managed actors use
the shared physical movement and ordinary combat paths, including physical reach;
this does not implement their remaining special attacks.

Partial motion/turns, altitude, orientation, original identity, injured parts,
spent stamina/mana, rubble, ice and terrain changes are ordinary saved state and
survive continued imports. Reattachment does not heal/refill an existing body.
Nonattendance grants no catch-up travel or attacks. Irreversible scientist death
freezes the run's simulation. A falling dead animal can still settle physically
while the scientist is alive.

Both Canvas and DOM use the same observed body footprint. Sightings retain dated
visible pose and observed cells, not private reserves, exact mass or unseen census.
A hidden tunnel does not become a live marker merely because its body exists.

## Published numbers and remaining boundaries

The **Beast ecology** sheet in the [ODS](reference/creature-catalog.ods) and
[XLSX](reference/creature-catalog.xlsx) now contains seven numeric physical columns
(T–Z): length, width, height, spread wings, adult kg, base m/s and natural reach.
These are baseline body definitions, not promises of travel speed in every medium.
The lifecycle reference's former 60 kg Mirror Ape estimate is corrected to the
already implemented 90 kg body; no existing individual is resized.

The remaining existing queue owns authored abilities, feeding/rest/growth,
reproduction and ecological behavior (#3.38-C), then habitat/terrain allocation,
conserved populations, colonies/groups, ordinary encounter generation and monthly
regional effects (#3.38-D). Twenty-one additional body profiles do **not** cause
new generic wilderness spawns now. Prepared original-source browser fixtures test
the physics, not ordinary-play acquisition or a completed ecological simulation.

Focused checks: `tests/beast-bodies.unit.test.js` covers all 24 profiles plus each
physical family and interruption/resource boundary; `tests/beast-bodies-browser.spec.js`
exercises levitation, winged flight, shores, large-body clearance, finite excavation,
observations, real saves and continued import in both renderers. Existing wilderness,
climbing and spell-imitation checks protect their shared consumers.
