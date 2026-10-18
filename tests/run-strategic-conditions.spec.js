const { test, expect } = require('@playwright/test');
const Conditions = require('../run-strategic-conditions');
const Identity = require('../scientist-identity');
const Registry = require('../carrier-identity');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const site = { worldId: 'world', runId: 'run', cityId: 'a', officeId: 'office', installationId: 'office:service-channel', maintenanceId: 'upkeep' };
  const upkeep = { id: 'upkeep', cityId: 'a', officeId: 'office', installation: { id: site.installationId }, handoverId: 'actual-handover',
    lastAt: 10, dueAt: 100, graceUntil: 150, receipts: [], privateDisposition: 'SECRET_POLICY', treasury: 999999 };
  return { site, upkeep, initial: Conditions.advance(null, site, upkeep, 10) };
}
function repair(f, at = 200, name = 'actual-repair') {
  const r = { id: name, installationId: f.site.installationId, at, dueAt: at + 100, graceUntil: at + 150, quantity: 3, workSeconds: 120,
    manifest: { privateProperty: 'SECRET_CUSTODY' } };
  f.upkeep.receipts.push(r); Object.assign(f.upkeep, { servicedAt: at, dueAt: r.dueAt, graceUntil: r.graceUntil }); return r;
}
const entry = s => s.installations[0];
test('original run/site binding and exact maintenance deadline change only one installation', () => {
  const f = fixture(), original = copy(f);
  expect(entry(f.initial).events[0].sourceId).toBe('actual-handover');
  expect(Conditions.serviceReason(f.initial, f.site)).toBe('');
  expect(entry(Conditions.advance(f.initial, f.site, f.upkeep, 149.9)).status).toBe('maintained');
  const failed = Conditions.advance(f.initial, f.site, f.upkeep, 180);
  expect(entry(failed).status).toBe('maintenanceOffline');
  expect(entry(failed).events.at(-1)).toMatchObject({ at: 150, sourceId: 'actual-handover', kind: 'expired' });
  expect(Conditions.serviceReason(failed, f.site)).toContain('maintenance grace expired');
  expect(Conditions.serviceReason(failed, null)).toBe(''); expect(f).toEqual(original);
  expect(JSON.stringify(failed)).not.toMatch(/SECRET|treasury|999999|route|sovereign/);
});
test('physical receipts restore once at completion, not when an interface claims new dates', () => {
  const f = fixture(), failed = Conditions.advance(f.initial, f.site, f.upkeep, 180);
  f.upkeep.graceUntil = 1000; expect(entry(Conditions.advance(failed, f.site, f.upkeep, 190)).status).toBe('maintenanceOffline');
  const r = repair(f); const restored = Conditions.advance(failed, f.site, f.upkeep, 210);
  expect(entry(restored).status).toBe('maintained'); expect(entry(restored).events.at(-1)).toMatchObject({ kind: 'restored', sourceId: r.id, at: 200 });
  expect(Conditions.advance(restored, f.site, f.upkeep, 210)).toEqual(restored);
  expect(entry(Conditions.advance(restored, f.site, f.upkeep, 220)).events).toEqual(entry(restored).events);
});
test('large steps replay timely repairs before expiry and preserve later exact failure', () => {
  const f = fixture(); repair(f, 140);
  const maintained = Conditions.advance(f.initial, f.site, f.upkeep, 280);
  expect(entry(maintained).events.map(e => e.kind)).toEqual(['baseline', 'renewed']);
  const expired = Conditions.advance(f.initial, f.site, f.upkeep, 300);
  expect(entry(expired).events.map(e => [e.kind, e.at])).toEqual([['baseline', 10], ['renewed', 140], ['expired', 290]]);
});
test('one large step may record genuine loss, restoration and a second loss chronologically', () => {
  const f = fixture(); repair(f, 200);
  const s = Conditions.advance(f.initial, f.site, f.upkeep, 500);
  expect(entry(s).events.map(e => [e.kind, e.at])).toEqual([['baseline', 10], ['expired', 150], ['restored', 200], ['expired', 350]]);
  expect(new Set(entry(s).events.map(e => e.id)).size).toBe(4);
});
test('duplicate, out-of-order, future, unrelated and incomplete receipts cannot backdate or restore', () => {
  const f = fixture(), failed = Conditions.advance(f.initial, f.site, f.upkeep, 180);
  repair(f, 160, 'late-old-receipt'); repair(f, 210, 'future-receipt');
  f.upkeep.receipts.push({ ...f.upkeep.receipts[1], id: 'wrong-installation', at: 190, installationId: 'other' },
    { ...f.upkeep.receipts[1], id: 'unfinished', at: 190, workSeconds: 1 });
  const s = Conditions.advance(failed, f.site, f.upkeep, 200);
  expect(entry(s).events).toEqual(entry(failed).events);
  expect(Conditions.advance(s, f.site, f.upkeep, 199)).toEqual(s);
  expect(Conditions.advance(s, f.site, f.upkeep, 300, false)).toEqual(s);
});
test('foreign world/run/city/office or replacement installation cannot inherit condition or knowledge', () => {
  const f = fixture(), failed = Conditions.advance(f.initial, f.site, f.upkeep, 180);
  for (const key of Object.keys(f.site)) {
    const other = { ...f.site, [key]: 'other' };
    expect(Conditions.advance(failed, other, f.upkeep, 200)).toEqual(failed);
    expect(Conditions.publicView(failed, other)).toBeNull();
    expect(Conditions.serviceReason(failed, other)).toContain('not established');
  }
  expect(Conditions.normalize(null)).toBeNull();
  expect(Conditions.advance(null, { ...f.site, runId: 'new-run' }, f.upkeep, 10).reports).toEqual([]);
});
test('away and unauthorized reads remain dated despite actual failure and restoration', () => {
  const f = fixture(); const known = Conditions.observe(f.initial, f.site, 'Counter service available', 10, true);
  const failed = Conditions.advance(known, f.site, f.upkeep, 180);
  expect(Conditions.publicView(failed, f.site)).toEqual(Conditions.publicView(known, f.site));
  expect(Conditions.observe(failed, f.site, 'SECRET', 180, false)).toEqual(failed);
  repair(f); const restored = Conditions.advance(failed, f.site, f.upkeep, 210);
  expect(Conditions.publicView(restored, f.site).at).toBe(10);
  const observed = Conditions.observe(restored, f.site, 'Counter battery allocation exhausted', 210, true);
  expect(Conditions.publicView(observed, f.site)).toMatchObject({ at: 210, status: 'maintained', available: false });
  expect(Conditions.normalize(copy(observed))).toEqual(observed);
  expect(Conditions.observe(observed, f.site, 'Counter service available', 200, true)).toEqual(observed);
});
test('maintenance restoration neither asserts other operating capacity nor changes political records', () => {
  const f = fixture(); repair(f); const s = Conditions.advance(f.initial, f.site, f.upkeep, 210);
  for (const reason of ['External power outage', 'Original counter or clerk unavailable', 'Clerk duty allocation exhausted']) {
    const report = Conditions.publicView(Conditions.observe(s, f.site, reason, 210, true), f.site);
    expect(report.available).toBe(false); expect(report.availability).toBe(reason);
  }
  const failed = Conditions.advance(s, f.site, f.upkeep, 400);
  expect(Conditions.publicView(Conditions.observe(failed, f.site, 'Counter service available', 400, true), f.site).available).toBe(false);
  expect(f.upkeep.handoverId).toBe('actual-handover');
});
test('the existing identity service consumes run eligibility without bypassing physical capacity or charging blocked work', () => {
  const f = fixture(), failed = Conditions.advance(f.initial, f.site, f.upkeep, 180);
  const market = { homeId: 'a' }; Registry.provision(market, { institutionId: 'registry:a', cityId: 'a', name: 'Aster', active: true, localDistanceKm: 2 }, 0);
  const office = market.identityOffices[0], value = Identity.create(), wallet = { money: 100 };
  const c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear',
    serviceAvailable: !Conditions.serviceReason(failed, f.site) };
  const q = Identity.preview(value, office, 'Mira');
  expect(Identity.begin(value, office, q, wallet, c, 180)).toBe(false); expect(wallet.money).toBe(100);
  repair(f); const restored = Conditions.advance(failed, f.site, f.upkeep, 210);
  c.serviceAvailable = !Conditions.serviceReason(restored, f.site); expect(Identity.begin(value, office, q, wallet, c, 210)).toBe(true);
  Identity.advance(value, [office], c, 310); const progress = value.job.progress, work = office.workSeconds;
  c.serviceAvailable = false; Identity.advance(value, [office], c, 410);
  expect(value.job.progress).toBe(progress); expect(office.workSeconds).toBe(work);
  c.serviceAvailable = true; Identity.advance(value, [office], c, 510); expect(value.job.progress).toBe(progress); // No outage catch-up.
  Identity.advance(value, [office], c, 2300); expect(value.job).toBeNull(); expect(value.documents).toHaveLength(1);
});
test('normalization keeps only dated condition/report fields and cannot retain canonical secrets', () => {
  const f = fixture(), n = copy(f.initial); n.secret = 'SECRET'; n.installations[0].privatePolicy = 'SECRET';
  n.installations[0].events[0].reserves = 99999;
  expect(Conditions.normalize(n)).toEqual(f.initial);
  expect(Conditions.normalize({ worldId: 'world', runId: 'run', installations: {}, reports: {} }).installations).toEqual([]);
});
test('validated saved-run imports rebind the continued copy without changing the original or inheriting it into fresh games', () => {
  const f = fixture(), known = Conditions.observe(f.initial, f.site, 'Counter service available', 10, true), before = copy(known);
  const to = { worldId: 'imported-world', runId: 'imported-run' }, site = { ...f.site, ...to };
  const imported = Conditions.rebind(known, f.site, to);
  expect(known).toEqual(before); expect(Conditions.serviceReason(imported, site)).toBe('');
  expect(Conditions.publicView(imported, site).events).toEqual(Conditions.publicView(known, f.site).events);
  expect(Conditions.advance(imported, site, f.upkeep, 180).installations[0].status).toBe('maintenanceOffline');
  expect(known).toEqual(before);
  expect(Conditions.rebind(known, { ...f.site, runId: 'unrelated' }, to)).toEqual(known);
  expect(Conditions.rebind(null, f.site, to)).toBeNull();
});
