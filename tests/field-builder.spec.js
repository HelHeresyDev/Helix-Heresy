const { test, expect } = require('@playwright/test');
const Builder = require('../field-builder');
const Station = require('../field-station');
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

function batchFixture(count = 4) {
  const f = fixture();
  f.offer = Builder.order(Array.from({ length: count }, (_, n) => ({ ...copy(f.offer), part: { ...copy(f.offer.part), id: `floor:${n}` }, workCell: cell(25 + n * 2) })));
  f.hooks.atWork = () => f.s.actor.mapCell.x === Builder.currentOffer(f.s).workCell.x;
  f.hooks.move = goal => {
    if (f.blocked) return false;
    const a = f.s.actor; a.mapCell.x += Math.sign(goal.x - a.mapCell.x); a.roomId = a.mapCell.x > 20 ? 'wild' : 'ground'; return true;
  };
  f.hooks.work = () => {
    if (!f.hooks.atWork()) { if (f.s.job) f.s.job.attended = false; f.hooks.move(f.s.contract.drop); return; }
    if (!f.s.job) f.s.job = { actorId: f.s.actor.id, partId: Builder.currentOffer(f.s).part.id, taskId: Builder.claimId(f.s),
      operation: Builder.operation(Builder.currentOffer(f.s)), targetKey: Builder.currentOffer(f.s).targetKey, status: 'working', progress: 0, attended: false };
    else if (!f.s.job.attended) f.s.job.attended = true;
    else if (++f.s.job.progress === 20) { f.s.job.status = 'completed'; expect(Builder.complete(f.s, f.now)).toBe(true); f.builds++; }
  };
  return f;
}
test('an exact ordered list has one to four distinct same-site components and deduplicates identical shared tools', () => {
  const f = batchFixture(); expect(Builder.components(f.offer)).toHaveLength(4); expect(f.offer.tools).toHaveLength(1); expect(f.offer.inputs).toHaveLength(4);
  expect(Builder.order([])).toBeNull(); const rows = Builder.components(f.offer);
  expect(Builder.order([...rows, { ...copy(rows[0]), part: { ...rows[0].part, id: 'fifth' } }])).toBeNull();
  expect(Builder.order([rows[0], rows[0]])).toBeNull();
  expect(Builder.order([rows[0], { ...copy(rows[1]), site: { siteId: 'elsewhere' } }])).toBeNull();
  expect(Builder.order([rows[0], { ...copy(rows[1]), tools: [{ ...rows[1].tools[0], stackId: 'substitute' }] }])).toBeNull();
  expect(Builder.order([f.offer])).toBeNull();
});
test('bounded order consent binds its exact order and contents, without multiplying engagement, reserve or time', () => {
  const f = batchFixture(), q = Builder.review(f.s, f.c, f.offer, 0); expect(q).toMatchObject({ fee: 40, reserve: 48, seconds: 7200, upfront: 88 });
  const reordered = Builder.order([...Builder.components(f.offer)].reverse()); let reserves = 0;
  expect(Builder.hire(f.s, f.c, reordered, q, f.wallet, 1, () => { reserves++; return {}; })).toBe(false); expect(reserves).toBe(0); expect(f.wallet.money).toBe(500);
  expect(Builder.review(f.s, f.c, { ...f.offer, components: [...f.offer.components, f.offer.components[0]] }, 1)).toBeNull();
  hire(f); expect(f.wallet.money).toBe(412); expect(f.s.contract.index).toBe(0); expect(f.s.contract.completed).toEqual([]);
});
test('sequential physical movement completes only authorized components while preserving the first arrival wage clock', () => {
  const f = batchFixture(); hire(f); tick(f, 45); expect(f.builds).toBe(1); expect(f.s.contract.index).toBe(1);
  const started = f.s.contract.startedAt, first = copy(f.s.contract.completed[0]);
  tick(f, 150); expect(f.builds).toBe(4); expect(f.s.contract.startedAt).toBe(started); expect(f.s.contract.completed[0]).toEqual(first);
  expect(f.s.contract.completed.map(p => p.partId)).toEqual(Builder.components(f.offer).map(p => p.part.id));
  expect(new Set(f.s.contract.completed.map(p => p.taskId)).size).toBe(4); expect(f.s.history.filter(p => p.kind === 'built')).toHaveLength(4);
  expect(Builder.complete(f.s, f.now)).toBe(false); tick(f, 100); expect(f.builds).toBe(4); expect(f.wallet.money).toBe(412);
});
test('a blocked ordered component never skips to a later job and its waiting spends the original two-hour budget', () => {
  const f = batchFixture(); hire(f); tick(f, 34); f.blocked = true; const completed = copy(f.s.contract.completed), position = copy(f.s.actor.mapCell);
  tick(f, 100); expect(f.s.contract.completed).toEqual(completed); expect(f.s.actor.mapCell).toEqual(position); expect(f.builds).toBe(1);
  Builder.advance(f.s, f.c, f.hooks, f.now = f.s.contract.startedAt + 7200);
  expect(f.s.phase).toBe('returning'); expect(f.s.contract.earned).toBe(48); expect(f.s.contract.completed).toEqual(completed); expect(f.wallet.money).toBe(412);
});
test('partial batch reload preserves the original order, receipts, person and one wage clock without duplicate completion', () => {
  const a = batchFixture(), b = batchFixture(); hire(a); hire(b); tick(a, 45); tick(b, 45);
  b.s = copy(b.s); tick(a, 150); tick(b, 150); expect(b.s).toEqual(a.s); expect(b.builds).toBe(4);
  const finished = copy(b.s); expect(Builder.complete(b.s, b.now)).toBe(false); expect(b.s).toEqual(finished);
});
test('interruption preserves finished components and private batch outcomes require actual reunion before return settlement', () => {
  const f = batchFixture(); hire(f); tick(f, 45); expect(Builder.receive(f.s, f.c, f.now)).toBe(true); const known = Builder.publicView(f.s);
  f.c.near = false; tick(f, 30); expect(f.builds).toBe(2); expect(Builder.publicView(f.s)).toEqual(known);
  f.c.threatened = true; tick(f); expect(f.s.phase).toBe('returning'); expect(f.s.contract.completed).toHaveLength(2);
  expect(Builder.receive(f.s, f.c, f.now)).toBe(false); expect(Builder.settle(f.s, f.c, f.wallet, f.now)).toBe(false);
  f.c.threatened = false; f.c.near = true; tick(f, 60); expect(f.s.phase).toBe('awaitingSettlement');
  expect(Builder.settle(f.s, f.c, f.wallet, f.now)).toBe(true); expect(f.s.received.completed).toHaveLength(2);
  expect(Builder.settle(f.s, f.c, f.wallet, f.now)).toBe(false); expect(f.s.actor.id).toBe(f.s.source.allocationId);
});

function repairFixture() {
  const f = batchFixture();
  f.offer = Builder.order(Builder.components(f.offer).map((p, n) => {
    const target = { id: `original-${n}`, present: true, original: true, condition: [0, 20, 80, 99][n], stamp: 0 };
    return { ...p, operation: 'repair', target, targetKey: Station.targetKey({ target }) };
  }));
  f.targets = copy(Builder.components(f.offer).map(p => p.target));
  f.hooks.targetsValid = () => Builder.components(f.s.contract.offer).slice(f.s.contract.index)
    .every((p, n) => p.targetKey === Station.targetKey({ target: f.targets[n + f.s.contract.index] }));
  return f;
}
test('repair-only orders require distinct surviving bound originals and reject mixed operations or reconstruction', () => {
  const f = repairFixture(), rows = Builder.components(f.offer); expect(rows).toHaveLength(4); expect(Builder.operation(f.offer)).toBe('repair');
  for (const change of [{ operation: 'build' }, { operation: 'reconstruct' }, { targetKey: 'stale' },
    { target: { ...rows[1].target, present: false } }, { target: { ...rows[1].target, original: false } },
    { target: { ...rows[1].target, condition: 100 } }, { target: { ...rows[1].target, condition: -1 } }])
    expect(Builder.order([rows[0], { ...copy(rows[1]), ...change }])).toBeNull();
  expect(Builder.order([rows[0], rows[0]])).toBeNull(); expect(Builder.order([...rows, { ...rows[0], part: { id: 'fifth' } }])).toBeNull();
  const q = Builder.review(f.s, f.c, f.offer, 0), changed = copy(rows); changed[1].target.stamp = 1; changed[1].targetKey = Station.targetKey(changed[1]);
  expect(Builder.hire(f.s, f.c, Builder.order(changed), q, f.wallet, 1, () => ({}))).toBe(false); expect(f.wallet.money).toBe(500);
});
test('one finite repair pass per original records capped outcomes without repeats, new clocks or remote reports', () => {
  const f = repairFixture(); hire(f); const known = Builder.publicView(f.s); f.c.near = false;
  tick(f, 45); const started = f.s.contract.startedAt; f.s = copy(f.s); tick(f, 150);
  expect(f.s.contract.completed.map(p => p.restoredCondition)).toEqual([45, 65, 100, 100]);
  expect(f.s.contract.startedAt).toBe(started); expect(f.s.contract.reserve).toBe(48); expect(f.wallet.money).toBe(412);
  expect(f.s.history.filter(r => r.kind === 'repaired')).toHaveLength(4); expect(Builder.complete(f.s, f.now)).toBe(false);
  tick(f, 50); expect(f.builds).toBe(4); expect(Builder.publicView(f.s)).toEqual(known);
  f.c.near = true; expect(Builder.receive(f.s, f.c, f.now)).toBe(true); expect(f.s.received.completed).toHaveLength(4);
});
test('any unfinished target change withdraws the entire repair order even during arrival or self-care', () => {
  for (const phase of ['arriving', 'care', 'incapacitated']) {
    const f = repairFixture(); hire(f); if (phase !== 'arriving') tick(f, 45);
    const completed = copy(f.s.contract.completed), index = f.s.contract.index;
    f.c.care = phase === 'care'; f.c.incapacitated = phase === 'incapacitated'; f.targets[index].condition++;
    tick(f); expect(['returning', 'awaitingSettlement']).toContain(f.s.phase); expect(f.s.contract.completed).toEqual(completed);
    expect(f.s.contract.reason).toContain('fresh consent'); expect(f.releases).toBeGreaterThan(0);
    f.targets[index].condition--; tick(f, 10); expect(f.s.contract.completed).toEqual(completed);
  }
});
test('damage to completed repair targets never retargets or cancels the remaining agreed originals', () => {
  const f = repairFixture(); hire(f); tick(f, 45); expect(f.s.contract.index).toBe(1);
  f.targets[0].present = false; tick(f, 150); expect(f.s.contract.completed).toHaveLength(4); expect(f.s.phase).toBe('onSite');
});
function reconstructionFixture() {
  const f = repairFixture();
  f.offer = Builder.order(Builder.components(f.offer).map(p => {
    const target = { ...p.target, present: false, condition: null, stamp: null, installationKey: `old:${p.part.id}`, footprintKey: 'empty', goodsRemain: false };
    return { ...p, operation: 'reconstruct', target, targetKey: Station.targetKey({ target }) };
  }));
  f.targets = copy(Builder.components(f.offer).map(p => p.target)); return f;
}
test('reconstruction-only orders bind distinct missing originals and reject mixed entries, orphan goods or unbound footprints', () => {
  const f = reconstructionFixture(), rows = Builder.components(f.offer); expect(rows).toHaveLength(4);
  for (const change of [{ operation: 'build' }, { operation: 'repair' }, { targetKey: 'stale' },
    ...[{ present: true }, { original: false }, { installationKey: '' }, { footprintKey: '' }, { goodsRemain: true }].map(t => {
      const target = { ...rows[1].target, ...t }; return { target, targetKey: Station.targetKey({ target }) };
    })]) expect(Builder.order([rows[0], { ...copy(rows[1]), ...change }])).toBeNull();
  expect(Builder.order([rows[0], rows[0]])).toBeNull(); expect(Builder.order([...rows, { ...rows[0], part: { id: 'fifth' } }])).toBeNull();
  const q = Builder.review(f.s, f.c, f.offer, 0), changed = copy(rows);
  changed[1].target.installationKey = 'new-original'; changed[1].targetKey = Station.targetKey(changed[1]);
  expect(Builder.hire(f.s, f.c, Builder.order(changed), q, f.wallet, 1, () => ({}))).toBe(false); expect(f.wallet.money).toBe(500);
});
test('reconstruction completion records only explicit full-condition replacements with one original clock and no remote knowledge', () => {
  const f = reconstructionFixture(); hire(f); const known = Builder.publicView(f.s); f.c.near = false;
  tick(f, 45); const started = f.s.contract.startedAt; f.s = copy(f.s); tick(f, 150);
  expect(f.s.contract.completed.map(p => p.restoredCondition)).toEqual([100, 100, 100, 100]);
  expect(f.s.history.filter(r => r.kind === 'reconstructed')).toHaveLength(4); expect(f.s.contract.startedAt).toBe(started);
  expect(f.wallet.money).toBe(412); expect(Builder.publicView(f.s)).toEqual(known);
  tick(f, 30); expect(f.builds).toBe(4); expect(Builder.complete(f.s, f.now)).toBe(false);
});
test('changed reconstruction footprints stop unfinished work during travel, care or a saved partial order without undoing completed work', () => {
  for (const phase of ['arriving', 'care', 'working']) {
    const f = reconstructionFixture(); hire(f); if (phase !== 'arriving') tick(f, 45);
    f.s = copy(f.s); f.c.care = phase === 'care'; const completed = copy(f.s.contract.completed);
    f.targets[f.s.contract.index].footprintKey = 'new-property'; tick(f);
    expect(['returning', 'awaitingSettlement']).toContain(f.s.phase); expect(f.s.contract.reason).toContain('fresh consent');
    expect(f.s.contract.completed).toEqual(completed); expect(f.releases).toBeGreaterThan(0);
  }
});

function logFixture() {
  const f = batchFixture(1), input = { id: 'original-log', cell: cell(25) }, signature = 'exact-original-log-signature';
  f.offer = { ...f.offer, operation: 'saw', from: 0, inputId: input.id, inputSignature: signature, targetKey: signature,
    part: Builder.logPart(input), tools: [{ key: 'handSaw', toolId: 'original-saw', stackId: 'saw-stack' }],
    inputs: [{ stackId: input.id, key: 'fieldLog', quantity: 1 }] };
  f.hooks.targetsValid = () => !f.changed;
  const working = f.hooks.work;
  f.hooks.work = () => {
    if (f.s.job && f.s.job.progress === 19) f.s.job.receipt = { actorId: f.s.actor.id, taskId: Builder.claimId(f.s), inputId: input.id,
      outputs: [{ id: 'lumber', key: 'lumber', quantity: 2 }, { id: 'debris', key: 'woodDebris', quantity: 1 }] };
    working();
  };
  return f;
}
test('one-log consent is separate, cannot batch or mix with construction, and binds its exact inputs and loan', () => {
  const f = logFixture(); expect(Builder.validOrder(f.offer)).toBeTruthy();
  for (const change of [{ components: [f.offer] }, { inputId: 'substitute' }, { targetKey: 'stale' }, { from: 1 },
    { part: { ...f.offer.part, seconds: 1 } },
    { tools: [{ ...f.offer.tools[0], key: 'masonryHammer' }] }, { inputs: [{ stackId: f.offer.inputId, quantity: 2 }] }])
    expect(Builder.validOrder({ ...f.offer, ...change })).toBeFalsy();
  expect(Builder.order([f.offer, { ...f.offer, part: { ...f.offer.part, id: 'other' } }])).toBeNull();
  expect(Builder.order([fixture().offer, f.offer])).toBeNull();
  const q = Builder.review(f.s, f.c, f.offer, 0); expect(q).toMatchObject({ fee: 40, reserve: 48, seconds: 7200 });
  expect(Builder.hire(f.s, f.c, { ...f.offer, inputSignature: 'other', targetKey: 'other' }, q, f.wallet, 1, () => ({}))).toBe(false);
  expect(f.wallet.money).toBe(500);
});
test('one-log processing records exactly one private output receipt without a second job or new wage clock', () => {
  const f = logFixture(); hire(f); const known = Builder.publicView(f.s); f.c.near = false; tick(f, 100);
  expect(f.s.contract.completed).toHaveLength(1); expect(f.s.contract.completed[0]).toMatchObject({ operation: 'saw', inputId: 'original-log' });
  expect(f.s.contract.completed[0].outputs.map(o => o.quantity)).toEqual([2, 1]);
  expect(f.s.history.at(-1).kind).toBe('sawn'); expect(f.s.contract.completed[0].restoredCondition).toBeUndefined();
  const started = f.s.contract.startedAt; tick(f, 50); expect(f.builds).toBe(1); expect(f.s.contract.startedAt).toBe(started);
  expect(Builder.publicView(f.s)).toEqual(known); expect(Builder.complete(f.s, f.now)).toBe(false);
  f.c.near = true; expect(Builder.receive(f.s, f.c, f.now)).toBe(true); expect(f.s.received.completed).toHaveLength(1);
});
test('changed original processing input withdraws during arrival or care, with normal finite-budget and death rules', () => {
  for (const care of [false, true]) {
    const f = logFixture(); hire(f); if (care) tick(f, 15);
    f.c.care = care; f.changed = true; tick(f); expect(['returning', 'awaitingSettlement']).toContain(f.s.phase);
    expect(f.s.contract.completed).toEqual([]); expect(f.s.contract.reason).toContain('fresh consent');
  }
  const f = logFixture(); hire(f); tick(f, 15); f.c.care = true;
  const progress = f.s.job.progress; tick(f, 30); expect(f.s.job.progress).toBe(progress);
  f.c.alive = false; const before = copy(f.s); tick(f, 30); expect(f.s).toEqual(before);
  f.c.alive = true; Builder.advance(f.s, f.c, f.hooks, f.now = f.s.contract.startedAt + 7200);
  expect(f.s.phase).toBe('returning'); expect(f.s.contract.earned).toBe(48);
});
