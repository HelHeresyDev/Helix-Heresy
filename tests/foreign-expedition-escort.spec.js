const { test, expect } = require('@playwright/test');
const Foreign = require('../foreign-expedition-escort');
const Escorts = require('../expedition-escorts');
const Survival = require('../wilderness-survival');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const excursion = { source: { cityId: 'b', populationSourceId: 'population:b' }, roomId: 'foreign-ground:b', entry: { z: 21 },
    wilderness: { roomId: 'foreign-wild:b', gate: { x: 20, y: 12, z: 21 } } };
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact' };
  const entry = { standing: 'licensed', network: { id: 'military:b', category: 'military', roles: ['escortContracting'], prohibitions: ['claiming police authority'] },
    branch: { id: 'chapter:b', publicName: 'Birch Escort Chapter', currentCityId: 'b', organizationForm: 'escortChapter', publicPhysicalPresence: true, operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } };
  const source = Foreign.source(city, [entry], excursion), saved = Foreign.create(source, excursion, 'seed', 0); saved.actor.needs = Survival.defaultState(0);
  const c = { source, alive: true, capable: true, originalBody: true, custody: false, atGround: true, local: true, near: true,
    originalTrip: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip', declaredOpposition: true, busy: false, escortIncapacitated: false };
  return { excursion, city, entry, saved, c, wallet: { money: 500 } };
}
test('foreign professional requires real local functioning recognized escort chapter and population, without mutating its sources', () => {
  const f = fixture(), before = copy(f);
  expect(f.saved.source).toMatchObject({ people: 1, populationId: 'population:b', branchId: 'chapter:b' });
  expect(f.saved.actor).toMatchObject({ id: 'chapter:b:field-survey-professional', cityId: 'b', roomId: 'foreign-ground:b', mapCell: { x: 12, y: 10, z: 21 } });
  expect(Foreign.create(f.c.source, f.excursion, 'seed', 0).actor.id).toBe(f.saved.actor.id);
  expect(copy(f)).toEqual(before);
  for (const wrong of [{ assetId: null }, { currentPopulation: 7 }, { physicalCondition: 'ruined' }, { habitationStatus: 'destroyed' }, { cityId: 'a' }])
    expect(Foreign.source({ ...f.city, ...wrong }, [f.entry], f.excursion)).toBeNull();
  for (const wrong of [{ organizationForm: 'trainingHall' }, { currentCityId: 'a' }, { publicPhysicalPresence: false }, { operationalStatus: 'relocated' }, { capacityBand: 'limited' }, { physicalCondition: 'destroyed' }])
    expect(Foreign.source(f.city, [{ ...f.entry, branch: { ...f.entry.branch, ...wrong } }], f.excursion)).toBeNull();
  expect(Foreign.source(f.city, [{ ...f.entry, standing: 'tolerated' }], f.excursion)).toBeNull();
  expect(Foreign.source(f.city, [{ ...f.entry, network: { ...f.entry.network, category: 'research' } }], f.excursion)).toBeNull();
});
test('exact personal reviewed terms bind original provider, body, visit, trip, price and finite duty', () => {
  const { saved: s, c, wallet } = fixture();
  expect(Foreign.hire(s, c, null, wallet, 0)).toBe(false);
  const q = Foreign.review(s, c, 0); expect(q).toMatchObject({ upfront: 140, scope: Foreign.SCOPE });
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { custody: true }, { atGround: false }, { near: false }, { originalTrip: false }, { busy: true }, { escortIncapacitated: true }, { bodyEpoch: 2 }, { tripId: 'other' }, { visitId: 'other' }])
    expect(Foreign.hire(s, { ...c, ...wrong }, q, wallet, 1)).toBe(false);
  expect(Foreign.hire(s, c, { ...q, upfront: 1 }, wallet, 1)).toBe(false);
  expect(Foreign.hire(s, c, q, wallet, 60)).toBe(false);
  expect(wallet.money).toBe(500); expect(Foreign.hire(s, c, q, wallet, 1)).toBe(true); expect(wallet.money).toBe(360);
  expect(Foreign.hire(s, c, q, wallet, 2)).toBe(false);
});
test('actual published religious client restrictions stably refuse declared opposition without invented patron support', () => {
  const f = fixture(); f.entry.network.clientRestrictions = [{ id: 'oath:faithful', text: 'This sworn chapter refuses service to declared opponents of its god.', refusesDeclaredOpposition: true }];
  f.c.source = Foreign.source(f.city, [f.entry], f.excursion);
  for (const now of [0, 10, 100]) expect(Foreign.review(f.saved, f.c, now)).toBeNull();
  expect(Object.keys(f.saved.decisions)).toHaveLength(1); expect(f.saved.received.willingness.rule.id).toBe('oath:faithful');
  const restored = copy(f.saved); expect(Foreign.review(restored, f.c, 200)).toBeNull(); expect(Object.keys(restored.decisions)).toHaveLength(1);
  // A genuinely different published policy can change a decision, not unchanged requests or reloads.
  f.c.source = { ...f.c.source, restrictions: [] };
  expect(Foreign.review(restored, f.c, 201)).toBeTruthy(); expect(Object.keys(restored.decisions)).toHaveLength(2);
  expect(restored.received.willingness.reason).toContain('no support');
});
test('policy changes after review invalidate acceptance; depleted original duty and unavailable source supply no contract', () => {
  const f = fixture(), q = Foreign.review(f.saved, f.c, 0);
  f.saved.budgetHours = 2; expect(Foreign.hire(f.saved, f.c, q, f.wallet, 1)).toBe(false); f.saved.budgetHours = 4;
  const id = f.saved.actor.id; f.saved.actor.id = 'replacement'; expect(Foreign.hire(f.saved, f.c, q, f.wallet, 1)).toBe(false); f.saved.actor.id = id;
  f.saved.actor.needs.thirst = 90; expect(Foreign.hire(f.saved, f.c, q, f.wallet, 1)).toBe(false); f.saved.actor.needs.thirst = 0;
  expect(Foreign.hire(f.saved, { ...f.c, source: { ...f.c.source, restrictions: [{ id: 'new', text: 'No divine opponents', refusesDeclaredOpposition: true }] } }, q, f.wallet, 1)).toBe(false);
  f.saved.dutySeconds = 100;
  expect(Foreign.review(f.saved, f.c, 2)).toBeNull(); expect(f.saved.received.reason).toContain('finite duty');
  expect(Foreign.review(f.saved, { ...f.c, source: null }, 2)).toBeNull(); expect(f.wallet.money).toBe(500);
});
test('finite wages and duty, physical withdrawal, original body and custody remain independent of provider health and kit', () => {
  const f = fixture(), q = Foreign.review(f.saved, f.c, 0); Foreign.hire(f.saved, f.c, q, f.wallet, 0);
  const initialDuty = f.saved.dutySeconds; Foreign.advance(f.saved, f.c, 60);
  expect(f.saved.contract.earned).toBeCloseTo(1 / 3); expect(f.saved.dutySeconds).toBe(initialDuty - 60);
  Foreign.advance(f.saved, { ...f.c, capable: false }, 61); expect(f.saved.contract.status).toBe('active'); // Can physically help the same living incapacitated body.
  expect(Foreign.control(f.saved, { ...f.c, custody: true })).toBe(false);
  Foreign.advance(f.saved, { ...f.c, custody: true }, 62); expect(f.saved.contract.status).toBe('returning');
  expect(f.saved.actor.roomId).toBe('foreign-ground:b'); expect(f.saved.actor.health).toBe(100); expect(f.saved.actor.initializedKit).toBe(false);
  Foreign.advance(f.saved, f.c, 20000); expect(f.saved.contract.earned).toBe(f.saved.contract.wageReserve);
  expect(Foreign.control(f.saved, { ...f.c, bodyEpoch: 2 })).toBe(false);
  const refund = Escorts.finish(f.saved.contract, 20000); expect(refund).toBe(0); expect(Escorts.finish(f.saved.contract, 20001)).toBe(0);
});
test('death freezes duty and wages; changed sources request safe return without spawning replacement people or resetting resources', () => {
  const f = fixture(); Foreign.hire(f.saved, f.c, Foreign.review(f.saved, f.c, 0), f.wallet, 0);
  const before = copy(f.saved); expect(Foreign.advance(f.saved, { ...f.c, alive: false }, 500)).toBe(false); expect(f.saved).toEqual(before);
  Foreign.advance(f.saved, { ...f.c, source: null }, 1); expect(f.saved.contract.status).toBe('returning'); expect(f.saved.contract.returnReason).toContain('backing');
  expect(f.saved.actor.id).toBe(before.actor.id); expect(f.saved.dutySeconds).toBe(before.dutySeconds - 1);
});
