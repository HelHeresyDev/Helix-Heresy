const { test, expect } = require('@playwright/test');
const Foothold = require('../civic-foothold');
const Campaign = require('../campaign');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const site = { worldId: 'world', cityId: 'city', cityName: 'Aster', officeId: 'office', installationId: 'office:service-channel' };
  const c = { alive: true, capable: true, free: true, local: true, atCounter: true, visible: true, supported: true, visitPermission: true,
    knownSite: true, cityId: 'city', officeId: 'office', bodyEpoch: 1 };
  const k = { succession: { source: { cityId: 'city' }, reportedAt: 10, operative: true,
    handover: { id: 'handover', cityId: 'city', at: 5, bodyEpoch: 1 }, agreements: [{ personId: 'official', at: 4, roles: ['publicWorksAndProvisioning'], scope: 'Original duties only' }],
    directive: { id: 'directive', status: 'completed' }, privateDisposition: 'PRIVATE_MOTIVE', population: 1000000 },
    administration: { installation: { id: site.installationId }, reportedAt: 10, availability: 'Counter service available',
      resistance: { commandStatus: 'active', notice: null }, exactStock: 99999, privatePolicy: 'PRIVATE_POLICY' } };
  return { site, c, k, observed: { powered: true, serviceable: true } };
}
const assess = (f, before = null, at = 10) => Foothold.assess(before, f.site, f.k, f.observed, f.c, at);
test('a read-only six-dimensional assessment records limited capability, not ownership or an accomplishment', () => {
  const f = fixture(), before = copy(f), r = assess(f);
  expect(r.conclusion).toBe('limited'); expect(r.recognition[0]).toMatchObject({ id: 'handover', at: 5, status: 'recorded' });
  expect(r.commands.find(r => r.id === 'successionDirective').status).toBe('exhausted');
  expect(r.access).toMatchObject({ status: 'supported', at: 10 }); expect(r.opposition).toEqual([]);
  expect(r.limitations).toContain('Unknown opposition remains unknown'); expect(f).toEqual(before);
  expect(Campaign.accomplishments({ civicFoothold: r })).toEqual([]);
  expect(JSON.stringify(r)).not.toMatch(/PRIVATE|99999|1000000|privatePolicy|canonical|workSeconds|wardMana/);
  expect(Foothold.normalize(copy(r))).toEqual(r);
});
test('unknown, remote, unsupported, forbidden, incapacitated and dead attendance cannot refresh a report', () => {
  const f = fixture(), r = assess(f);
  for (const wrong of [{ alive: false }, { capable: false }, { free: false }, { local: false }, { atCounter: false }, { visible: false },
    { supported: false }, { visitPermission: false }, { knownSite: false }, { cityId: 'other' }, { officeId: 'other' }]) {
    expect(assess({ ...f, c: { ...f.c, ...wrong } }, r, 100)).toEqual(r);
    expect(assess({ ...f, c: { ...f.c, ...wrong } }, null, 100)).toBeNull();
  }
  expect(assess({ ...f, site: null }, r, 100)).toEqual(r);
});
test('local observation does not require powered services, a clerk, a fee, a signature, duty or a timer', () => {
  const f = fixture(); f.observed = { powered: false, serviceable: false };
  Object.assign(f.c, { clerkPresent: false, money: 0, power: 0, workSeconds: 0, busy: true });
  const r = assess(f); expect(r.conclusion).toBe('blocked'); expect(r.recognition[0].id).toBe('handover');
  expect(r.support.find(r => r.id === 'visiblePower')).toMatchObject({ status: 'blocked', at: 10 });
  expect(r.commands.find(r => r.id === 'publicWorksMaintenance').status).toBe('supported'); // Authorization and operability are different facts.
});
test('fresh local access/power never re-dates older reports or claims unseen current command capacity', () => {
  const f = fixture(), r = assess(f, null, 200);
  expect(r.at).toBe(200); expect(r.access.at).toBe(200); expect(r.support.find(r => r.id === 'visiblePower').at).toBe(200);
  expect(r.support.find(r => r.id === 'reportedService').at).toBe(10);
  expect(r.commands.find(r => r.id === 'publicWorksMaintenance').at).toBe(10); expect(r.conclusion).toBe('unverified');
});
test('unreceived objections, private reserves and uncommunicated watch reports are not evidence', () => {
  const f = fixture(); f.k.administration.resistance = { commandStatus: 'suspended', privateDisposition: 'SECRET',
    notice: { id: 'unheard', at: 8, receivedAt: null, finding: 'SECRET_NOTICE' } };
  f.k.watch = { privateReports: [{ id: 'hidden-report', detail: 'SECRET_REPORT' }], reports: [{ id: 'unheard-report', at: 8, communicatedAt: null, detail: 'SECRET_REPORT' }] };
  const r = assess(f); expect(r.opposition).toEqual([]); expect(r.commands.find(r => r.id === 'publicWorksMaintenance').status).toBe('supported');
  expect(JSON.stringify(r)).not.toMatch(/SECRET|unheard/);
});
test('received refusal remains separate from repaired machinery; historical objections and signatures survive later records', () => {
  const f = fixture(); f.k.administration.resistance = { commandStatus: 'suspended',
    notice: { id: 'objection', at: 6, receivedAt: 8, finding: 'Discretionary duties declined; no criminal guilt.' } };
  f.k.works = { reportedAt: 10, permissionCurrent: true, receipt: { id: 'works', at: 5, cityId: 'city' } };
  f.observed.powered = false; const failed = assess(f); expect(failed.conclusion).toBe('blocked');
  f.observed.powered = true; const repaired = assess(f, failed, 20);
  expect(repaired.commands.find(r => r.id === 'publicWorksAndProvisioning').status).toBe('withdrawn');
  expect(repaired.commands.find(r => r.id === 'publicWorksMaintenance').status).toBe('withdrawn');
  expect(repaired.recognition).toEqual(failed.recognition); expect(repaired.opposition[0].at).toBe(8);
  f.k.administration.resistance = { commandStatus: 'active', notice: null, renewals: [{ id: 'renewal', at: 21 }] };
  const renewed = assess(f, repaired, 22); expect(renewed.opposition.map(r => r.id)).toEqual(expect.arrayContaining(['objection', 'renewal']));
  expect(renewed.recognition).toEqual(repaired.recognition);
});
test('coerced and stale administrative records do not confer unrelated role permission; one-use duties stay exhausted', () => {
  const f = fixture(); f.k.succession = null;
  f.k.abdication = { receipt: { id: 'claim', cityId: 'city', at: 1 }, reports: [] };
  f.k.charter = { reportedAt: 10, recognition: { id: 'records', at: 3, cityId: 'city', bodyEpoch: 1 }, recordsPermissionCurrent: true,
    originalFindingCurrent: true, instruction: { id: 'entered-memorandum' } };
  f.k.watch = { reportedAt: 10, permissionCurrent: true, receipt: { id: 'watch', cityId: 'city', at: 4 }, completions: [{ id: 'done' }] };
  f.k.defense = { reportedAt: 10, permissionCurrent: true, receipt: { id: 'defense', cityId: 'city', at: 4 }, duty: { status: 'covering' } };
  const r = assess(f); expect(r.recognition.find(r => r.id === 'claim').status).toBe('disputed');
  expect(r.commands.find(r => r.id === 'centralAdministration').status).toBe('exhausted');
  expect(r.commands.find(r => r.id === 'civilWatch').status).toBe('exhausted');
  expect(r.commands.find(r => r.id === 'militaryDefenseCommand').status).toBe('underway');
  expect(r.commands.some(r => r.id === 'publicWorksMaintenance')).toBe(false);
  f.k.charter.reconsideration = { status: 'completed' }; f.k.charter.personalReaffirmationRequired = true; f.k.charter.recordsPermissionCurrent = false;
  const changed = assess(f, r, 20); expect(changed.commands.find(r => r.id === 'centralAdministration').status).toBe('blocked');
  expect(changed.recognition.find(r => r.id === 'findingCurrency').status).toBe('disputed');
});
test('changed bodies cannot inherit supported duties, and other-world/site records never inherit old opposition', () => {
  const f = fixture(), r = assess(f); f.c.bodyEpoch = 2;
  expect(assess(f, r, 10).commands.some(r => r.status === 'supported')).toBe(false);
  const fresh = { ...f, site: { ...f.site, worldId: 'new-world', cityId: 'other-city', officeId: 'other-office', installationId: 'other' },
    c: { ...f.c, cityId: 'other-city', officeId: 'other-office' }, k: {} };
  expect(assess(fresh, r).recognition).toEqual([]); expect(assess(fresh, r).opposition).toEqual([]);
  expect(Foothold.normalize(null)).toBeNull();
});
test('report normalization drops extra canonical data and cannot create sovereignty, live telemetry or campaign progress', () => {
  const f = fixture(), r = assess(f);
  const n = Foothold.normalize({ ...r, score: 100, cityOwned: true, population: 5000, secret: 'PRIVATE',
    commands: r.commands.map(row => ({ ...row, actorCell: { x: 5, y: 5 }, policy: 'PRIVATE' })) });
  expect(n).toEqual(r); expect(Foothold.normalize({ ...r, at: NaN })).toBeNull(); expect(Foothold.normalize({ ...r, cityId: '' })).toBeNull();
});
test('future-dated source records cannot enter an earlier report or backdate an already received assessment', () => {
  const f = fixture(), r = assess(f);
  expect(assess(f, r, 9)).toEqual(r);
  f.k.succession.handover.at = 11;
  const earlier = assess(f); expect(earlier.recognition.some(r => r.id === 'handover')).toBe(false);
  expect(Foothold.normalize({ ...r, opposition: [{ id: 'future', status: 'recorded', at: 11, text: 'Not yet known', sourceId: 'later' }] }).opposition).toEqual([]);
});
test('received role refusals and observed local protests appear without their private dispositions or live positions', () => {
  const f = fixture();
  f.k.works = { response: { decision: 'refused', reason: 'Declined this bounded agreement', at: 8, privateFacts: 'SECRET' } };
  f.k.appointments = { opposition: { formed: { at: 6, objective: 'Retain access to the original installation' }, phase: 'occupying', reportedAt: 9,
    members: [{ name: 'Known former official', cell: { x: 15, y: 10 }, privatePolicy: 'SECRET' }] }, previousObjections: [{ at: 4, finding: 'Original received objection' }] };
  const r = assess(f);
  expect(r.opposition.some(r => r.id === 'refusal:publicWorksAndProvisioning:8')).toBe(true);
  expect(r.opposition.find(r => r.id === 'receiving-approach:6')).toMatchObject({ at: 9, status: 'recorded' });
  expect(r.opposition.some(r => r.id === 'archived-objection:4')).toBe(true);
  expect(JSON.stringify(r)).not.toMatch(/SECRET|privateFacts|"cell"|privatePolicy/);
});
