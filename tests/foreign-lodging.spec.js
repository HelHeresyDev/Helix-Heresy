const { test, expect } = require('@playwright/test');
const Lodging = require('../foreign-lodging');
const Visitor = require('../foreign-reception');
const Approach = require('../city-approach');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
const copy = x => JSON.parse(JSON.stringify(x));
const source = () => ({ cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', administrationId: 'admin:b',
  administrationName: 'Neighbor Civic Administration', watchId: 'watch:b', currentAuthority: true, capacityBand: 'functional',
  lawId: 'law:b', recognition: 'verified', localRules: [] });
function fixture() {
  const g = Approach.gate({ id: 'reception:b', cityId: 'b', institutionId: 'admin:b', capacityBand: 'functional', createdAt: 0,
    clerk: { id: 'original-clerk', name: 'Mira Clerk', status: 'alive', health: 100, mapCell: { x: 10, y: 6 } },
    guard: { id: 'original-guard', status: 'alive', health: 100, mapCell: { x: 12, y: 7 } } });
  Visitor.publish(g, source(), 0); g.materialized = true; Lodging.publish(g, source(), 0);
  const p = { id: 'original-visitor-permit', cityId: 'b', bodyEpoch: 0, visitId: 'actual-road-visit', issuedAt: 0, expiresAt: 21600 };
  g.visitorAdmission.permits.push(p);
  return { g, wallet: { money: 500 }, c: { alive: true, capable: true, local: true, atDesk: true, clerkPresent: true,
    lineOfSight: true, cityId: 'b', bodyEpoch: 0, visitId: p.visitId, authorityCurrent: true, sourceCurrent: true,
    accommodationIntact: true, otherBusy: false, atBerth: false, visitorPermit: p, bans: [], evidence: {} } };
}
const lodging = f => f.g.visitorLodging;
function book(f, at = 100) { const q = Lodging.quote(f.g, f.c, at); expect(q).toBeTruthy();
  expect(Lodging.begin(f.g, f.c, q, f.wallet, at)).toBe(true); return q; }
const advance = (f, at) => Lodging.advance(f.g, f.c, at);
const permission = (f, at) => Lodging.permission(f.g, f.c.bodyEpoch, f.c.visitId, at);

test('lodging publication uses original supported annex capacity and preserves damaged saved accommodation', () => {
  const f = fixture(), raw = source(), before = copy(raw);
  for (const changes of [{ currentPopulation: 0 }, { capacityBand: 'strained' }, { currentAuthority: false }, { lawId: 'other' }, { administrationId: 'other' }, { physicalCondition: 'ruined' }]) {
    const g = copy(f.g); delete g.visitorLodging; expect(Lodging.publish(g, { ...raw, ...changes }, 100)).toBeNull();
  }
  const g = copy(f.g); delete g.visitorLodging; g.materialized = false; expect(Lodging.publish(g, raw, 100)).toBeNull();
  expect(raw).toEqual(before); lodging(f).berth.condition = 10; lodging(f).money = 20;
  Lodging.publish(f.g, raw, 5000); expect(lodging(f).berth.condition).toBe(10); expect(lodging(f).money).toBe(20);
  expect(lodging(f)).not.toHaveProperty('staff'); expect(lodging(f).berth.roomId).toBe(f.g.annexRoomId);
  lodging(f).berth = null; Lodging.publish(f.g, raw, 6000); expect(lodging(f).berth).toBeNull();
  expect(Lodging.observe(f.g, f.c, 6000)).toMatchObject({ berthId: null, condition: null });
});
test('lodging exact terms need visitor approval, local attendance, independent law, finite original clerk and usable berth', () => {
  const f = fixture(); expect(Lodging.quote(f.g, f.c, 100)).toMatchObject({ total: 20, checkInSeconds: 60, staySeconds: 28800,
    clerkId: 'original-clerk', visitorPermitId: 'original-visitor-permit', berthId: 'reception:b:guest-berth' });
  const changes = [f => f.c.visitorPermit = null, f => f.c.visitorPermit.expiresAt = 160, f => f.c.visitorPermit.bodyEpoch = 1,
    f => f.c.visitorPermit.cityId = 'a', f => f.c.atDesk = false, f => f.c.alive = false, f => f.c.capable = false,
    f => f.c.local = false, f => f.c.lineOfSight = false, f => f.c.clerkPresent = false, f => f.c.otherBusy = true,
    f => f.c.sourceCurrent = false, f => f.c.authorityCurrent = false, f => f.c.accommodationIntact = false,
    f => f.g.powerSeconds = 59, f => f.g.receptionWorkSeconds = 59, f => f.g.clerk.health = 49,
    f => lodging(f).berth.condition = 49, f => f.g.receptionAssignment = 'another-person', f => f.g.visitorAdmission.job = {},
    f => lodging(f).berth = null, f => f.c.bans = [{ status: 'active', cityId: 'b' }]];
  for (const change of changes) { const h = fixture(); change(h); expect(Lodging.quote(h.g, h.c, 100)).toBeNull(); }
  f.c.bans = [{ status: 'active', cityId: 'a', recognizedBy: [{ cityId: 'b' }] }]; expect(Lodging.quote(f.g, f.c, 100)).toBeTruthy();
  f.c.bans[0].recognizedBy[0] = { cityId: 'b', localOrderId: 'b-order', institutionId: 'b-court', status: 'active' };
  expect(Lodging.quote(f.g, f.c, 100)).toBeNull();
});
test('lodging reservation atomically escrows payment without creating permission, supplies or instant rest', () => {
  for (const change of [f => f.wallet.money = 19, f => f.g.clerk.id = 'replacement', f => lodging(f).berth.id = 'replacement',
    f => lodging(f).berth.condition = 90, f => f.c.bodyEpoch = 1, f => f.c.visitId = 'other-visit']) {
    const f = fixture(), q = Lodging.quote(f.g, f.c, 100); change(f); const before = copy(f);
    expect(Lodging.begin(f.g, f.c, q, f.wallet, 100)).toBe(false); expect(f).toEqual(before);
  }
  const f = fixture(), q = Lodging.quote(f.g, f.c, 100), before = copy(f);
  expect(Lodging.begin(f.g, f.c, q, f.wallet, 160)).toBe(false); expect(f).toEqual(before);
  expect(Lodging.begin(f.g, f.c, q, f.wallet, 130)).toBe(true); expect(f.wallet.money).toBe(480);
  expect(lodging(f).money).toBe(0); expect(permission(f, 130)).toBeNull(); expect(lodging(f).job.escrow).toBe(20);
  expect(Lodging.begin(f.g, f.c, q, f.wallet, 130)).toBe(false); expect(f.g.receptionWorkSeconds).toBe(14400);
});
test('lodging check-in consumes original shared work and power and grants only a separately dated eight-hour stay once', () => {
  let f = fixture(); book(f); advance(f, 130); expect(lodging(f).job.progress).toBe(30); expect(permission(f, 130)).toBeNull();
  f = copy(f); advance(f, 160); expect(lodging(f).job).toBeNull();
  expect(permission(f, 160)).toMatchObject({ issuedAt: 160, expiresAt: 28960, scope: 'visitorAnnexAndGuestBerthOnly', price: 20 });
  expect(f.g.receptionWorkSeconds).toBe(14340); expect(f.g.powerSeconds).toBe(86340); expect(f.g.receptionAssignment).toBeNull();
  expect(f.g.visitorAdmission.permits[0].expiresAt).toBe(21600); expect(lodging(f).money).toBe(20); expect(lodging(f).stays).toHaveLength(1);
  const before = copy(f); advance(f, 200); expect(lodging(f).stays).toEqual(before.g.visitorLodging.stays);
  expect(Lodging.cancel(f.g, f.c, f.wallet, 200)).toBe(false); expect(f.wallet.money).toBe(480);
});
test('lodging absence, outages, injuries, original identities and shared queues hold attendance without backfill', () => {
  for (const change of [f => f.c.atDesk = false, f => f.g.clerk.health = 49, f => f.g.powerSeconds = 0,
    f => f.c.sourceCurrent = false, f => f.g.receptionAssignment = 'other', f => lodging(f).berth.id = 'replacement',
    f => f.g.clerk.id = 'replacement', f => f.g.visitorAdmission.permits = [], f => f.c.bodyEpoch = 1]) {
    const f = fixture(); book(f); advance(f, 130); change(f); advance(f, 5000); expect(lodging(f).job.progress).toBe(30);
  }
  let f = fixture(); book(f); advance(f, 130); f.c.atDesk = false; advance(f, 2000); f = copy(f);
  f.c.atDesk = true; advance(f, 4000); expect(lodging(f).job.progress).toBe(30); advance(f, 4030);
  expect(permission(f, 4030).issuedAt).toBe(4030); expect(f.g.receptionWorkSeconds).toBe(14340);
});
test('lodging unfinished cancellation refunds the full original escrow once while retaining spent clerk resources', () => {
  let f = fixture(); book(f); advance(f, 130); f = copy(f);
  expect(Lodging.cancel(f.g, f.c, f.wallet, 130)).toBe(true); expect(f.wallet.money).toBe(500); expect(lodging(f).money).toBe(0);
  expect(f.g.receptionWorkSeconds).toBe(14370); expect(f.g.powerSeconds).toBe(86370); expect(lodging(f).berth.reservedBy).toBeNull();
  expect(f.g.receptionAssignment).toBeNull(); expect(permission(f, 130)).toBeNull(); expect(Lodging.cancel(f.g, f.c, f.wallet, 130)).toBe(false);
  book(f, 200); expect(lodging(f).job.progress).toBe(0); expect(f.wallet.money).toBe(480);
});
test('lodging original owner can reclaim unfinished escrow after a later visit without reviving check-in permission', () => {
  const f = fixture(); book(f); advance(f, 130); f.c.visitId = 'later-visit'; f.c.visitorPermit = null;
  advance(f, 5000); expect(lodging(f).job.progress).toBe(30); expect(permission(f, 5000)).toBeNull();
  f.c.local = false; expect(Lodging.cancel(f.g, f.c, f.wallet, 5000)).toBe(false);
  f.c.local = true; expect(Lodging.cancel(f.g, f.c, f.wallet, 5000)).toBe(true); expect(f.wallet.money).toBe(500);
  expect(lodging(f).stays).toEqual([]); expect(f.g.receptionWorkSeconds).toBe(14370);
});
test('lodging physical berth use remains separate from expired trading rights and cannot follow a new body or visit', () => {
  const f = fixture(); book(f); advance(f, 160); f.c.atDesk = false; f.c.atBerth = true;
  expect(Lodging.restReason(f.g, f.c, 22000, 900)).toBe(''); expect(Visitor.permission(f.g, 0, f.c.visitId, 22000)).toBeNull();
  expect(Lodging.restReason(f.g, { ...f.c, atBerth: false }, 22000, 900)).not.toBe('');
  expect(Lodging.restReason(f.g, { ...f.c, accommodationIntact: false }, 22000, 900)).not.toBe('');
  expect(Lodging.restReason(f.g, { ...f.c, bodyEpoch: 1 }, 22000, 900)).not.toBe('');
  expect(Lodging.restReason(f.g, { ...f.c, visitId: 'new-visit' }, 22000, 900)).not.toBe('');
  expect(Lodging.restReason(f.g, f.c, 28059, 900)).toBe('');
  expect(Lodging.restReason(f.g, f.c, 28060, 900)).not.toBe('');
  expect(Lodging.restReason(f.g, f.c, 28900, 900)).not.toBe(''); expect(Lodging.restReason(f.g, f.c, 28960)).not.toBe('');
});
test('lodging expiry is absolute even away, refunds nothing and releases only the original berth without custody', () => {
  const f = fixture(); book(f); advance(f, 160); Lodging.observe(f.g, f.c, 160); const report = copy(lodging(f).observation);
  f.c.local = false; advance(f, 50000); expect(permission(f, 50000)).toBeNull(); expect(lodging(f).berth.reservedBy).toBeNull();
  expect(f.wallet.money).toBe(480); expect(lodging(f).money).toBe(20); expect(lodging(f).stays[0].releasedAt).toBe(28960);
  expect(Lodging.observe(f.g, f.c, 50000)).toEqual(report); expect(lodging(f)).not.toHaveProperty('custody');
  const length = lodging(f).history.length; advance(f, 60000); expect(lodging(f).history).toHaveLength(length);
});
test('lodging coarse updates date actual check-in and expiry, never granting a fresh eight hours at render time', () => {
  const f = fixture(); book(f); f.c.visitorPermit = null; advance(f, 60000); expect(lodging(f).stays[0]).toMatchObject({ issuedAt: 160, expiresAt: 28960, releasedAt: 28960 });
  expect(permission(f, 60000)).toBeNull(); expect(lodging(f).berth.reservedBy).toBeNull(); expect(f.g.receptionWorkSeconds).toBe(14340);
});
test('lodging shared reception queue, checkpoints, death freezing and replacement-body refund refusal preserve originals', () => {
  const f = fixture(); book(f); expect(Lodging.nextEvent(f.g, f.c, 100)).toMatchObject({ time: 160, type: 'travel' });
  expect(Visitor.begin(f.g, null, Visitor.quote(f.g, f.c), f.c, f.wallet, 100)).toBe(false); expect(f.wallet.money).toBe(480);
  advance(f, 130); f.c.alive = false; const before = copy(f); advance(f, 99999); expect(Lodging.cancel(f.g, f.c, f.wallet, 99999)).toBe(false); expect(f).toEqual(before);
  f.c.alive = true; f.c.bodyEpoch = 1; expect(Lodging.cancel(f.g, f.c, f.wallet, 140)).toBe(false); advance(f, 140); expect(lodging(f).job.progress).toBe(30);
});

function identityFixture() {
  const market = { homeId: 'a' }; Registry.provision(market, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = market.identityOffices[0];
  const c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(identity, market.identityOffices, c, 0);
  return { identity, offices: market.identityOffices };
}
const network = () => ({ homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
  ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
], routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] });
async function finish(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
    const s = d.intercityPassengerSnapshot(), task = s.tasks.find(t => !t.reason); if (!task) return;
    d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
  } throw new Error('Physical work did not finish'); });
}
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignLodgingSnapshot());
async function start(page, renderer) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  const identity = identityFixture();
  await page.evaluate(({ renderer, source, identity, network }) => {
    const d = window.helixHeresyDebug;
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', currentPopulation: 100, services: { transport: 'functional' } }, network,
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Transport', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.setMapRenderer(renderer); d.setForeignReceptionTestContext({ source, ...identity });
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Boarding failed');
  }, { renderer, source: source(), identity, network: network() });
  await finish(page); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect((await snap(page)).quote).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignReceptionSnapshot(); return d.foreignReceptionAction('review', s.quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignReceptionSnapshot(); return d.foreignReceptionAction('accept', s.gate.visitorAdmission.offers.at(-1)); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  if (!await page.locator('[data-intercity-passenger]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`lodging controls physically check in and rest with independent expiry through ${renderer}`, async ({ page }) => {
  test.setTimeout(240000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, renderer);
  const panel = page.locator('[data-foreign-lodging]'), before = await snap(page); expect(before.quote.total).toBe(20);
  await panel.getByRole('button', { name: 'Reserve Eight-Hour Guest Berth ($20)', exact: true }).click();
  expect((await snap(page)).money).toBe(before.money - 20); expect((await snap(page)).permission).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(30));
  expect((await snap(page)).gate.visitorLodging.job.progress).toBe(30);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(30));
  const checked = await snap(page); expect(checked.permission.expiresAt - checked.permission.issuedAt).toBe(28800);
  expect(checked.gate.clerk.id).toBe(before.gate.clerk.id); expect(checked.gate.receptionWorkSeconds).toBe(before.gate.receptionWorkSeconds - 60);
  expect(checked.gate.visitorAdmission.permits).toEqual(before.gate.visitorAdmission.permits);
  await panel.getByRole('button', { name: 'Walk to Paid Guest Berth', exact: true }).click(); await finish(page);
  const atBed = await snap(page); expect(atBed.cell).toEqual(atBed.gate.visitorLodging.berth.cell);
  await panel.getByRole('button', { name: 'Rest at Guest Berth (15 minutes)', exact: true }).click();
  expect((await snap(page)).tasks.some(t => t.type === 'rest' && t.data.foreignLodging)).toBe(true); await finish(page);
  const rested = await snap(page); expect(rested.needs.thirst).toBeGreaterThan(atBed.needs.thirst); expect(rested.tasks.some(t => t.type === 'rest')).toBe(false);
  expect(rested.gate.visitorLodging.berth.id).toBe(before.gate.visitorLodging.berth.id);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignLodgingSnapshot(); d.advanceForeignReceptionTestTime(s.gate.visitorAdmission.permits.at(-1).expiresAt - s.clock); });
  const visitorExpired = await snap(page); expect(visitorExpired.permission).not.toBeNull();
  expect((await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot())).permission).toBeNull();
  expect(visitorExpired.gate.visitorLodging.berth.id).toBe(before.gate.visitorLodging.berth.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignLodgingAction('rest'))).toBe(true); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignLodgingSnapshot(); d.advanceForeignReceptionTestTime(s.permission.expiresAt - s.clock); });
  const expired = await snap(page); expect(expired.permission).toBeNull(); expect(expired.roomId).toBe(before.gate.annexRoomId);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignLodgingAction('rest'))).toBe(false);
  expect(expired.money).toBe(before.money - 20); expect(expired.gate.visitorLodging.berth.reservedBy).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('exit'))).toBe(true); await finish(page);
  expect((await snap(page)).roomId).toBe(before.gate.checkpointRoomId); expect(errors).toEqual([]);
});
test('lodging controls refund interrupted check-in, preserve damaged berth, and freeze escrow on death', async ({ page }) => {
  test.setTimeout(180000); await start(page, 'dom'); const before = await snap(page), panel = page.locator('[data-foreign-lodging]');
  await panel.getByRole('button', { name: 'Reserve Eight-Hour Guest Berth ($20)', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(30));
  await panel.getByRole('button', { name: 'Cancel Unfinished Lodging Check-In (Full Refund)', exact: true }).click();
  const cancelled = await snap(page); expect(cancelled.money).toBe(before.money); expect(cancelled.gate.receptionWorkSeconds).toBe(before.gate.receptionWorkSeconds - 30);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').visitorLodging.berth.condition = 10; d.importSurveyExpeditionTestState(s); });
  expect((await snap(page)).quote).toBeNull(); await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap(page)).gate.visitorLodging.berth.condition).toBe(10);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').visitorLodging.berth.condition = 100; d.importSurveyExpeditionTestState(s); });
  const ready = await snap(page); expect(await page.evaluate(q => window.helixHeresyDebug.foreignLodgingAction('book', q), ready.quote)).toBe(true);
  const running = await snap(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceForeignReceptionTestTime(99999); });
  const dead = await snap(page); expect(dead.gate.visitorLodging).toEqual(running.gate.visitorLodging); expect(dead.money).toBe(running.money);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignLodgingAction('cancel'))).toBe(false);
});
