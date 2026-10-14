const { test, expect } = require('@playwright/test');
const Workspace = require('../foreign-assay-workspace');
const Lease = require('../leased-annex');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const city = { cityId: 'b', currentPopulation: 100, physicalCondition: 'intact' };
  const standings = [{ standing: 'licensed', network: { id: 'research', category: 'research' }, branch: { id: 'research:b', publicName: 'B Research',
    organizationForm: 'localLaboratory', currentCityId: 'b', publicPhysicalPresence: true, operationalStatus: 'active', capacityBand: 'functional' } }];
  const authority = { cityId: 'b', currentAuthority: true, administrationId: 'admin:b' };
  const s = Workspace.create(city, standings, authority, { cityName: 'B', representativeCell: { x: 9, y: 13, z: 20 } }, 'seed', 0, 'madcap');
  const c = { city, standings, authority, alive: true, capable: true, originalBody: true, custody: false, local: true, cityId: 'b',
    bodyEpoch: 0, visitId: 'visit', tenant: 'Mira', atProperty: true, atDesk: true, contact: true, busy: false, inspected: true,
    empty: true, benchCondition: 100, visitorPermit: { cityId: 'b', bodyEpoch: 0, visitId: 'visit', expiresAt: 21600, scope: 'visitorHallOnly' } };
  return { s, c, wallet: { money: 1000 } };
}
function sign(f, now = 100) { Workspace.invite(f.s, f.c, now); const q = Workspace.request(f.s, f.c, now); return Workspace.sign(f.s, f.c, q, f.wallet, now); }
test('foreign diagnostic scope permits only sealed assays and personal Assay Case calibration', () => {
  expect(Workspace.diagnosticScopeReason('assaySample', 'assayCase')).toBe('');
  expect(Workspace.diagnosticScopeReason('calibrateInstrument', 'assayCase')).toBe('');
  for (const [workflow, instrument] of [['calibrateInstrument', 'thaumometer'], ['calibrateInstrument', 'environmentalSurveyKit'],
    ['calibrateInstrument', ''], ['fieldSurvey', 'assayCase'], ['collectSample', 'assayCase'], ['repair', 'assayCase'], ['', 'assayCase']])
    expect(Workspace.diagnosticScopeReason(workflow, instrument)).not.toBe('');
  const f = fixture(); sign(f);
  expect(f.s.property.purpose).toContain('personal calibration');
  expect(f.s.property.purpose).toContain('No instrument repair');
  expect(f.s.permission.scope).toContain('calibration work');
});
test('foreign workspace requires an actual active locally authorized laboratory and existing people', () => {
  const f = fixture(); expect(f.s.property.tenantStaffAuthorized).toBe(false); expect(f.s.actor.id).not.toBe('original-clerk');
  for (const change of [c => c.city.currentPopulation = 3, c => c.city.currentPopulation = NaN, c => c.city.physicalCondition = 'ruined',
    c => c.authority.currentAuthority = false, c => c.authority.cityId = 'a', c => c.standings[0].standing = 'tolerated',
    c => c.standings[0].network.category = 'commercial', c => c.standings[0].branch.organizationForm = 'standardsBureau',
    c => c.standings[0].branch.currentCityId = 'a', c => c.standings[0].branch.publicPhysicalPresence = false,
    c => c.standings[0].branch.operationalStatus = 'defunct', c => c.standings[0].branch.capacityBand = 'failed']) {
    const c = copy(f.c); change(c); expect(Workspace.supportingBranch(c.city, c.standings, c.authority)).toBeNull();
  }
});
test('workspace inspection invitation is explicit, body and visit bound, and separate from work permission', () => {
  const f = fixture(); expect(Workspace.access(f.s, f.c, 100)).toBe(false); expect(Workspace.request(f.s, f.c, 100).ok).toBe(false);
  expect(Workspace.invite(f.s, f.c, 100)).toBe(true); expect(Workspace.access(f.s, f.c, 100)).toBe(true);
  expect(Workspace.workReason(f.s, f.c, 100)).not.toBe(''); expect(f.s.permission).toBeNull();
  for (const field of ['bodyEpoch', 'visitId']) { const c = { ...f.c, [field]: 'other' }; expect(Workspace.access(f.s, c, 100)).toBe(false); }
  expect(Workspace.access(f.s, f.c, 21600)).toBe(false);
  for (const change of [c => c.visitorPermit = null, c => c.visitorPermit.scope = 'lodging', c => c.custody = true, c => c.originalBody = false]) {
    const c = copy(f.c); change(c); expect(Workspace.invite(f.s, c, 100)).toBe(false);
  }
});
test('workspace exact terms debit once and disclose only named tenant and manual assay purpose', () => {
  const f = fixture(); Workspace.invite(f.s, f.c, 100); const q = Workspace.request(f.s, f.c, 100);
  expect(q).toMatchObject({ days: 3, rent: 225, deposit: 150, total: 375, tenant: 'Mira' });
  expect(q.purpose).toContain('No genetic modification'); expect(q.permission).toContain('No visitor-hall');
  const before = copy(f.s); expect(Workspace.sign(f.s, f.c, { ...q, total: 0 }, f.wallet, 100).ok).toBe(false); expect(f.s).toEqual(before);
  expect(Workspace.sign(f.s, f.c, q, f.wallet, 100).ok).toBe(true); expect(f.wallet.money).toBe(625);
  expect(Workspace.sign(f.s, f.c, q, f.wallet, 100).ok).toBe(false); expect(f.wallet.money).toBe(625);
  expect(f.s.permission.issuerId).toBe('admin:b'); expect(Workspace.workReason(f.s, f.c, 101)).toBe('');
});
test('workspace quotes fail closed for changed body, source, named representative, incapacity and invalid funds', () => {
  for (const change of [f => f.c.bodyEpoch++, f => f.c.visitId = 'other', f => f.c.tenant = 'Other', f => f.c.authority.currentAuthority = false,
    f => f.c.atDesk = false, f => f.c.contact = false, f => f.c.busy = true, f => f.c.custody = true, f => f.c.alive = false,
    f => f.s.actor.id = 'replacement', f => f.s.actor.health = 49, f => f.wallet.money = NaN]) {
    const f = fixture(); Workspace.invite(f.s, f.c, 100); const q = Workspace.request(f.s, f.c, 100); change(f);
    expect(Workspace.sign(f.s, f.c, q, f.wallet, 101).ok).toBe(false);
  }
  const f = fixture(); Workspace.invite(f.s, f.c, 100); const q = Workspace.request(f.s, f.c, 100);
  expect(Workspace.sign(f.s, f.c, q, f.wallet, 400).ok).toBe(false);
});
test('workspace expiry preserves retrieval independent of visitor or lodging expiry, with explicit prepaid renewal', () => {
  const f = fixture(); sign(f); const end = f.s.lease.endsAt; f.c.visitorPermit = null; f.c.visitId = 'later-visit';
  Lease.expire(f.s, end); expect(Workspace.workReason(f.s, f.c, end)).toContain('expired'); expect(Workspace.access(f.s, f.c, end)).toBe(true);
  f.s = copy(f.s); const q = Workspace.request(f.s, f.c, end); expect(q).toMatchObject({ rent: 225, deposit: 0, total: 225 });
  expect(Workspace.sign(f.s, f.c, q, f.wallet, end).ok).toBe(true); expect(f.wallet.money).toBe(400); expect(f.s.lease.endsAt).toBe(end + 3 * Lease.DAY);
  expect(Workspace.workReason(f.s, f.c, end + 1)).toBe('');
  f.c.authority.currentAuthority = false; expect(Workspace.access(f.s, f.c, end + 1)).toBe(true); expect(Workspace.workReason(f.s, f.c, end + 1)).not.toBe('');
});
test('workspace actual inspected handback preserves goods, charges original damage and settles deposit exactly once', () => {
  const f = fixture(); sign(f);
  for (const change of [c => c.atProperty = false, c => c.empty = false, c => c.inspected = false, c => c.contact = false, c => c.busy = true]) {
    const c = copy(f.c); change(c); expect(Workspace.handBack(f.s, c, f.wallet, 200).ok).toBe(false);
  }
  f.c.benchCondition = 60; expect(Workspace.handBack(f.s, f.c, f.wallet, 200)).toEqual({ ok: true, refund: 90, damage: 60 });
  expect(f.wallet.money).toBe(715); expect(f.s.property.landlord.damageReceived).toBe(60);
  expect(Workspace.handBack(f.s, f.c, f.wallet, 201).ok).toBe(false); expect(Workspace.access(f.s, f.c, 21601)).toBe(false);
  expect(Workspace.request(f.s, f.c, 21601).ok).toBe(false);
});
test('workspace public view keeps dated observation without exposing a live representative or creating goods', () => {
  const f = fixture(); f.s.observation = { at: 100, goods: [], benchCondition: 60 };
  const v = Workspace.publicView(f.s, 200); expect(v.observation.at).toBe(100); expect(v).not.toHaveProperty('actor');
  v.observation.benchCondition = 100; expect(f.s.observation.benchCondition).toBe(60);
  expect(f.s).not.toHaveProperty('inventory'); expect(f.s).not.toHaveProperty('staff');
});
test('workspace agreement cannot erase locally recognized bans, replace people, or charge after death', () => {
  const f = fixture(); sign(f); const before = copy(f.s);
  f.c.bans = [{ cityId: 'a', status: 'active' }]; expect(Workspace.workReason(f.s, f.c, 101)).toBe('');
  f.c.bans[0].recognizedBy = [{ cityId: 'b', status: 'active', localOrderId: 'order:b', institutionId: 'court:b' }];
  expect(Workspace.workReason(f.s, f.c, 101)).toContain('local ban'); expect(Workspace.request(f.s, f.c, 101).ok).toBe(false);
  expect(Workspace.access(f.s, f.c, 101)).toBe(true); // Ownership and egress are not erased by operating refusal.
  f.c.bans = []; f.s.actor.status = 'dead'; expect(Workspace.request(f.s, f.c, 101).ok).toBe(false);
  f.s = copy(before); f.c.alive = false;
  expect(Workspace.request(f.s, f.c, 101).ok).toBe(false); expect(Workspace.handBack(f.s, f.c, f.wallet, 101).ok).toBe(false);
  expect(f.s).toEqual(before); expect(f.wallet.money).toBe(625);
});
