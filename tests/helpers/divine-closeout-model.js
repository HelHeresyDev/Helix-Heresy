const B = require('../../divine-bodies'), O = require('../../divine-capabilities'), S = require('../../divine-submission');
const W = require('../../divine-wayfinding'), R = require('../../divine-reign');
const clone = x => JSON.parse(JSON.stringify(x));
function fixture(n = 2) {
  const rows = Array.from({ length: n }, (_, i) => {
    const god = { id: `god:${i}`, privateObjective: i ? 'opposeRivals' : 'protectFollowers', domains: ['fire'],
      stableIdentity: { mortalIdentityId: `mortal:${i}`, originKind: i ? 'beast' : 'human' },
      lifecycle: { lifeState: 'living', divinityState: i ? 'descended' : 'divine' },
      divineCore: { state: 'stable', identityBound: true, repeatableSignature: `sig:${i}`, innateCapacity: 450, receivingCapacity: 600 },
      power: { reserve: 475, reserveCapacity: 2000 }, expenditures: { communication: 7, miracles: 10, protection: 8 },
      worshipSources: [{ id: 'worship:original', sourcePopulationId: 'human-population:original', sourcePopulationUnits: 1000, followerUnits: 12, kind: 'human',
        practiceId: 'householdRites', beliefOnlyPopulation: 0, devotionPermille: 900, organizationPermille: 900, ritualInfrastructurePermille: 500,
        offeringPermille: 500, holySiteSupportPermille: 0, coercedWorshipPermille: 0, receptionEfficiencyPermille: 900 }] };
    return { godId: god.id, god, faith: null, death: null };
  });
  const book = O.create({ complete: true, rows }, { worldId: 'world', runId: 'run' }, 0, true);
  const homes = rows.map((r, i) => ({ godId: r.godId, cellId: `planet-cell:0000${i + 1}`, placeId: `holy-site:${i}`, cityId: null, name: `Original ${i}` }));
  const bodies = B.create(book, homes, 0), reign = R.create(book, 0);
  const c = { alive: true, capable: true, free: true, allowed: true, wayfinding: true, researched: true, animancy: 201,
    mana: 100, resonanceDamage: 2000, combatReady: true, instrument: true, bodyEpoch: 0, field: false,
    visible: true, tracks: true, distance: 1, lineOfEffect: true, cell: { x: 10, y: 10, z: 0 }, roomId: 'lab',
    distanceTo: id => Number(id.slice(-1)) * 1000, originUsable: () => true };
  const stacks = [{ key: 'arcaneFeedstock', quantity: 1000, carriedBy: 'scientist', cell: clone(c.cell) }];
  return { book, bodies, reign, c, stacks, at: 0 };
}
function advance(f, seconds) {
  f.at += seconds;
  W.advance(f.bodies, f.book, f.c, f.at, { prepare: g => ({ x: 10, y: 10, z: g.z }), move: (roomId, cell) => {
    f.c.roomId = roomId; f.c.cell = clone(cell); f.stacks.forEach(i => i.cell = clone(cell));
    const loc = W.location(f.bodies, roomId);
    Object.assign(f.c, loc || { field: false, cellId: null, cityId: null, placeId: null });
  } });
}
function scan(f) {
  if (!W.begin(f.bodies, f.book, f.stacks, f.c, 'scan', null, f.at)) throw Error('scan failed'); f.c.mana -= 5; advance(f, W.SCAN);
}
function visit(f, id) {
  if (!W.begin(f.bodies, f.book, f.stacks, f.c, 'outbound', id, f.at)) throw Error('passage failed');
  f.c.mana -= f.bodies.access.job.terms.mana; advance(f, f.bodies.access.job.seconds);
}
function identify(f, a) {
  if (!B.begin(f.bodies, f.book, a, f.stacks, f.c, f.at)) throw Error('examine failed');
  f.at += 120; B.advance(f.bodies, f.book, f.at, () => f.c); if (!a.identified) throw Error('examination not completed');
}
function hit(f, a, amount) {
  B.attack(f.bodies, f.book, a, f.c, f.at); S.witnessAttack(f.bodies, f.book, a, f.c, f.at);
  const damage = B.absorb(f.bodies, f.book, a, amount, f.c);
  if (damage) { a.health = Math.max(0, a.health - damage); a.lastDamage = { at: f.at, amount: damage, attackerId: 'scientist', bodyEpoch: 0, serial: (a.lastDamage?.serial || 0) + 1 }; }
  if (a.health === 0) B.death(f.bodies, f.book, a, f.at, 'actual modeled physical damage');
  B.observe(f.bodies, f.book, a, f.c, f.at);
}
module.exports = { fixture, clone, advance, scan, visit, identify, hit };
