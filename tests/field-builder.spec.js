const { test, expect } = require('@playwright/test');
const Builder = require('../field-builder');
const copy = x => JSON.parse(JSON.stringify(x));
const cell = x => ({ x, y: 10, z: 21 });
function fixture() {
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact' };
  const institution = { id: 'works:b', name: 'Birch Works', capacityBand: 'functional' };
  const e = { source: { cityId: 'b', populationSourceId: city.assetId, worksId: institution.id }, entry: cell(10), roomId: 'ground', wilderness: { roomId: 'wild', gate: cell(20) } };
  const source = Builder.source(city, institution, null, e), s = Builder.create(source, e, 0);
  const offer = { site: { worldId: 'world', siteId: 'station', roomId: 'wild' }, part: { id: 'floor:one', costs: { stoneBlocks: 1 }, tools: { masonryHammer: 1 }, seconds: 480 }, workCell: cell(25), inputs: [{ stackId: 'stone', quantity: 1 }], tools: [{ stackId: 'hammer', toolId: 'tool:hammer' }] };
  const c = { source, alive: true, capable: true, originalBody: true, custody: false, originalTrip: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip',
    near: true, busy: false, atGround: true, incapacitated: false, injured: false, threatened: false, care: false, site: offer.site, routeOk: true, toolsReturned: true, hazards: ['Wilderness beasts and weather'] };
  const f = { s, c, city, institution, e, offer, now: 0, blocked: false, releases: 0, cancellations: 0, builds: 0, wallet: { money: 500 } };
  f.hooks = { adjacent: goal => Math.abs(s.actor.mapCell.x - goal.x) <= 1, atWork: () => s.actor.mapCell.x === offer.workCell.x,
    move: goal => { if (f.blocked) return false; s.actor.mapCell.x += Math.sign(goal.x - s.actor.mapCell.x); s.actor.roomId = s.actor.mapCell.x > 20 ? 'wild' : 'ground'; return true; },
    release: () => f.releases++, cancel: j => { j.status = 'cancelled'; f.cancellations++; },
    work: () => { if (!s.job) s.job = { status: 'working', progress: 0, attended: false };
      else if (!s.job.attended) s.job.attended = true;
      else if (++s.job.progress === 20) { s.job.status = 'completed'; s.contract.finishedAt = f.now; f.builds++; } } };
  return f;
}
function hire(f) { const q = Builder.review(f.s, f.c, f.offer, f.now); expect(q).toBeTruthy();
  expect(Builder.hire(f.s, f.c, f.offer, q, f.wallet, f.now, () => ({ inputs: [], tools: [] }))).toBe(true); }
function tick(f, n = 1) { for (let k = 0; k < n; k++) Builder.advance(f.s, f.c, f.hooks, ++f.now); }
test('one qualified original local works employee needs actual population, original institution and functioning capacity', () => {
  const f = fixture(); expect(f.s.actor.skills.fabrication).toBe(12); expect(f.s.source.people).toBe(1); expect(f.s.actor.id).toBe('works:b:field-builder');
  for (const city of [{ ...f.city, assetId: 'other' }, { ...f.city, currentPopulation: 0 }, { ...f.city, physicalCondition: 'ruined' }]) expect(Builder.source(city, f.institution, null, f.e)).toBeNull();
  for (const institution of [{ ...f.institution, id: 'unrelated' }, { ...f.institution, capacityBand: 'failing' }, { ...f.institution, operationalStatus: 'disrupted' }]) expect(Builder.source(f.city, institution, null, f.e)).toBeNull();
  expect(Builder.source(f.city, f.institution, { currentCapacityBand: 'failing' }, f.e)).toBeNull();
});
test('disclosed exact one-component terms require original free capable nearby people, supplies, route and finite duty', () => {
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { originalTrip: false }, { near: false }, { custody: true }, { atGround: false }, { busy: true }, { routeOk: false }, { source: null }, { threatened: true }, { incapacitated: true }]) {
    const f = fixture(); expect(Builder.review(f.s, { ...f.c, ...wrong }, f.offer, 0)).toBeNull();
  }
  const f = fixture(); expect(Builder.review(f.s, f.c, null, 0)).toBeNull(); f.s.dutySeconds = 100; expect(Builder.review(f.s, f.c, f.offer, 0)).toBeNull();
  f.s.dutySeconds = 28800; f.c.source.restrictions = [{ forbidsPrivateConstruction: true, text: 'No private works.' }]; expect(Builder.review(f.s, f.c, f.offer, 0)).toBeNull();
});
test('stale or changed component, quantities, hazards and identity cannot debit or reserve employment', () => {
  const f = fixture(), q = Builder.review(f.s, f.c, f.offer, 0); let reserves = 0;
  const reserve = () => { reserves++; return {}; };
  for (const wrong of [{ bodyEpoch: 2 }, { visitId: 'new' }, { tripId: 'new' }, { hazards: [] }, { near: false }]) expect(Builder.hire(f.s, { ...f.c, ...wrong }, f.offer, q, f.wallet, 1, reserve)).toBe(false);
  expect(Builder.hire(f.s, f.c, { ...f.offer, workCell: cell(26) }, q, f.wallet, 1, reserve)).toBe(false);
  expect(Builder.hire(f.s, f.c, f.offer, q, f.wallet, 60, reserve)).toBe(false); expect(f.wallet.money).toBe(500); expect(reserves).toBe(0);
  expect(Builder.hire(f.s, f.c, f.offer, q, f.wallet, 1, () => null)).toBe(false); expect(f.wallet.money).toBe(500);
});
test('actual walking precedes arrival and wages; one component completes without a queue or an automatic next job', () => {
  const f = fixture(); hire(f); expect(f.wallet.money).toBe(412); f.blocked = true; tick(f, 120);
  expect(f.s.phase).toBe('arriving'); expect(f.s.contract.startedAt).toBeNull(); expect(f.builds).toBe(0);
  f.blocked = false; tick(f, 60); expect(f.s.phase).toBe('onSite'); expect(f.builds).toBe(1);
  const started = f.s.contract.startedAt; tick(f, 100); expect(f.builds).toBe(1); expect(f.s.contract.startedAt).toBe(started); expect(f.s.actor.roomId).toBe('wild');
});
test('danger, injury, original site, backing and authority changes interrupt labor before physical withdrawal', () => {
  for (const wrong of [{ threatened: true }, { injured: true }, { source: null }, { site: null }, { bodyEpoch: 2 }, { visitId: 'other' }, { tripId: 'other' }, { custody: true }]) {
    const f = fixture(); hire(f); tick(f, 15); expect(f.s.job.status).toBe('working'); Object.assign(f.c, wrong); tick(f);
    expect(f.s.job.status).toBe('cancelled'); expect(f.s.phase).toBe('returning'); expect(f.builds).toBe(0); expect(f.wallet.money).toBe(412);
  }
});
test('self-care resets tool attendance and pauses actual work without backfill or free effort', () => {
  const f = fixture(); hire(f); tick(f, 15); const progress = f.s.job.progress;
  f.s.contract.pickup = { stackId: 'hammer', dueAt: 20 }; f.c.care = true; tick(f, 100);
  expect(f.s.contract.pickup).toBeNull(); expect(f.s.job.progress).toBe(progress); f.c.care = false; tick(f); expect(f.s.job.progress).toBe(progress);
});
test('finite two-hour on-site budget includes waiting and initiates real return, not a remote refund', () => {
  const f = fixture(); hire(f); tick(f, 20); f.blocked = true;
  Builder.advance(f.s, f.c, f.hooks, f.now = f.s.contract.startedAt + 7200);
  expect(f.s.phase).toBe('returning'); expect(f.s.contract.earned).toBe(48); expect(f.wallet.money).toBe(412); expect(f.s.actor.roomId).toBe('wild');
  expect(Builder.settle(f.s, f.c, f.wallet, f.now)).toBe(false);
});
test('incapacity and death retain the same body and property; irreversible scientist death freezes state', () => {
  const f = fixture(); hire(f); tick(f, 15); const position = copy(f.s.actor.mapCell); f.c.incapacitated = true; tick(f, 5); expect(f.s.actor.mapCell).toEqual(position);
  f.c.alive = false; const before = copy(f.s); tick(f, 100); expect(f.s).toEqual(before);
  f.c.alive = true; f.s.actor.status = 'dead'; f.s.actor.diedAt = f.now; tick(f); expect(f.s.phase).toBe('dead'); expect(f.wallet.money).toBe(412);
});
test('public records stay dated while private construction advances, and no remote report or new hire is available', () => {
  const f = fixture(); hire(f); tick(f, 15); expect(Builder.receive(f.s, f.c, f.now)).toBe(true); const known = Builder.publicView(f.s);
  f.c.near = false; tick(f, 100); expect(f.builds).toBe(1); expect(Builder.publicView(f.s)).toEqual(known);
  expect(Builder.receive(f.s, f.c, f.now)).toBe(false); expect(Builder.review(f.s, f.c, f.offer, f.now)).toBeNull();
});
test('physical return and original tool handback precede exactly-once integer settlement and no replenishment', () => {
  const f = fixture(); hire(f); tick(f, 60); Builder.withdraw(f.s, f.hooks, f.now); tick(f, 30); expect(f.s.phase).toBe('awaitingSettlement');
  expect(Builder.settle(f.s, { ...f.c, toolsReturned: false }, f.wallet, f.now)).toBe(false);
  expect(Builder.settle(f.s, { ...f.c, bodyEpoch: 2 }, f.wallet, f.now)).toBe(false);
  expect(Builder.settle(f.s, { ...f.c, visitId: 'later' }, f.wallet, f.now)).toBe(true);
  expect(Number.isInteger(f.wallet.money)).toBe(true); expect(f.wallet.money).toBeGreaterThan(412); expect(f.wallet.money).toBeLessThanOrEqual(460);
  const money = f.wallet.money, duty = f.s.dutySeconds, person = f.s.actor; expect(Builder.settle(f.s, f.c, f.wallet, f.now)).toBe(false);
  expect(f.wallet.money).toBe(money); hire(f); expect(f.s.actor).toBe(person); expect(f.s.dutySeconds).toBe(duty);
});
