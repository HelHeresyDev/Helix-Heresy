const { test, expect } = require('@playwright/test');
const Assistant = require('../laboratory-assistant');
const Workers = require('../surface-workers');
const Diagnostics = require('../diagnostic-system');
const Resources = require('../resource-surveys');
const clone = x => JSON.parse(JSON.stringify(x));
const city = { id: 'a', name: 'Local City', supported: true };
const route = { ok: true, cityId: 'a', distanceKm: 1, municipal: true };
const disclosure = () => ({ underground: true, confidentialityRequested: true, noLivingWork: true,
  benchId: 'bench', workspaceRoomId: 'lab', roomIds: ['loading', 'passage', 'lab'],
  hazards: ['Contained specimens present; unsafe air and loose specimens require withdrawal.'], sampleCategories: [...Assistant.CATEGORIES] });
function fixture() {
  const saved = Assistant.create('seed', city, 'madcap', 0), wallet = { money: 500 };
  const hooks = { dead: false, enter: a => { a.roomId = 'loading'; a.mapCell = { x: 0, y: 0, z: 1 }; return true; },
    exit: () => ({ done: true }), haul: () => ({ reason: 'Original instrument blocked' }), release: () => {} };
  return { saved, wallet, hooks };
}
function hire(f) { const q = Assistant.request(f.saved, route, 2, disclosure(), 0);
  expect(Assistant.hire(f.saved, route, q, disclosure(), true, f.wallet, 0).ok).toBe(true); }
function arrive(f) { hire(f); Assistant.advance(f.saved, route, f.wallet, 900, f.hooks); }
function sample() { return Diagnostics.normalizeSample({ id: 'portion', stackId: 'sample-stack', methodId: 'airVial',
  targetKind: 'tile', targetId: 'tile:1', targetLabel: 'Historical air portion', cell: { x: 1, y: 1, z: 0 }, collectedAt: 0,
  captured: { environment: { airborne: { chemicalVapor: 2 } } } }); }
const stack = () => ({ id: 'sample-stack', key: 'diagnosticSample', quantity: 1, tags: ['sealed'], carriedBy: '', reservedTaskId: '' });
const plan = () => ({ ok: true, sample: sample(), stack: stack(), benchId: 'bench', benchCell: { x: 1, y: 1, z: 0 }, instrumentInstanceId: 'case' });
const reserve = () => [{ stackId: 'sample-stack', quantity: 1, kind: 'input' }, { stackId: 'reagent', quantity: 1, kind: 'input' }, { stackId: 'tool', quantity: 1, kind: 'instrument' }];

test('the qualified technician is a separate persistent theme-selected individual, never a promoted porter', () => {
  const porter = Workers.create('seed', city, 'madcap');
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const s = Assistant.create('seed', city, theme);
    expect(s.actor.id).not.toBe(porter.actor.id); expect(s.actor.actorKind).toBe('laboratoryAssistant');
    expect(s.actor.skills).toMatchObject({ analysis: 6, alchemy: 5 }); expect(s.actor.skills.hauling).toBeUndefined();
    s.actor.health = 40; s.actor.food = .1; s.actor.observations.push({ roomId: 'lab', at: 10 });
    expect(Assistant.normalize(clone(s))).toEqual(s);
  }
  expect(Assistant.create('seed', { ...city, supported: false }, 'madcap')).toBeNull();
  expect(porter.actor.skills.analysis).toBeUndefined();
});

test('informed agreement freezes exact underground access, hazards, confidentiality and finite technician wages', () => {
  const f = fixture(), q = Assistant.request(f.saved, route, 2, disclosure(), 0);
  expect(q).toMatchObject({ fee: 40, hourly: 24, reserve: 48, upfront: 88 });
  for (const defect of ['consent', 'bench', 'hazards', 'scope', 'date', 'route', 'budget']) {
    const g = fixture(), quote = Assistant.request(g.saved, route, 2, disclosure(), 0), d = disclosure(), usedRoute = { ...route };
    if (defect === 'bench') d.benchId = 'other';
    if (defect === 'hazards') d.hazards.push('Additional observed hazard');
    if (defect === 'scope') d.sampleCategories.push('fluidSample');
    if (defect === 'route') usedRoute.distanceKm = 2;
    if (defect === 'budget') g.wallet.money = 0;
    const before = clone(g);
    expect(Assistant.hire(g.saved, usedRoute, quote, d, defect !== 'consent', g.wallet, defect === 'date' ? 3601 : 0).ok).toBe(false);
    expect(clone(g)).toEqual(before);
  }
  hire(f); expect(f.wallet.money).toBe(412); expect(f.saved.contract).toMatchObject({ consented: true, hourly: 24, disclosure: disclosure() });
  Assistant.advance(f.saved, route, f.wallet, 900, f.hooks);
  Assistant.advance(f.saved, route, f.wallet, 4500, f.hooks); expect(f.saved.contract.earned).toBeCloseTo(24);
});

test('the agreed first assay excludes living, biological, unsealed, carried and claimed samples', () => {
  expect(Assistant.eligible(sample(), stack())).toBe(true);
  expect(Assistant.eligible(sample(), { ...stack(), tags: ['sealed', 'nonliving'] })).toBe(true);
  expect(Assistant.eligible(sample(), { ...stack(), tags: ['sealed', 'living-creature'] })).toBe(false);
  for (const defect of ['living', 'biological', 'unsealed', 'carried', 'claimed', 'missing', 'merged', 'unsupported']) {
    const s = sample(), item = stack();
    if (defect === 'living') s.targetKind = 'slime';
    if (defect === 'biological') { s.methodId = 'fluidSample'; s.captured = { bodyIntegrity: 100 }; }
    if (defect === 'unsealed') item.tags = [];
    if (defect === 'carried') item.carriedBy = 'scientist';
    if (defect === 'claimed') item.reservedTaskId = 'scientist-work';
    if (defect === 'missing') item.quantity = 0;
    if (defect === 'merged') item.quantity = 2;
    if (defect === 'unsupported') s.captured = { exposure: { current: 10 } };
    expect(Assistant.eligible(s, item)).toBe(false);
  }
});

test('an exact assay starts only after consent and an atomic reservation of the actual supplies and disclosed bench', () => {
  const f = fixture(); arrive(f);
  for (const defect of ['bench', 'path', 'reservation', 'consent']) {
    const p = plan(); if (defect === 'bench') p.benchId = 'secret-bench'; if (defect === 'path') p.ok = false;
    f.saved.contract.consented = defect !== 'consent'; const before = clone(f.saved);
    expect(Assistant.assign(f.saved, p, 900, defect === 'reservation' ? () => null : reserve).ok).toBe(false);
    expect(f.saved).toEqual(before);
  }
  f.saved.contract.consented = true;
  expect(Assistant.assign(f.saved, plan(), 900, reserve).ok).toBe(true);
  expect(f.saved.orders[0]).toMatchObject({ amount: 1, delivered: 0, kind: 'assay', stage: 'collect', workSeconds: 0 });
  expect(Assistant.assign(f.saved, plan(), 900, reserve).ok).toBe(false);
});

test('assay confidence uses the technician qualifications, actual wear and calibration, and original sample age', () => {
  const actor = fixture().saved.actor, tool = { id: 'case', current: 80, max: 90 }, record = { calibration: 90 };
  const r = Assistant.assess(sample(), actor, tool, record, 900);
  expect(r).toMatchObject({ id: 'assistant-result:portion', targetLabel: 'Historical air portion', measuredAt: 900, sampleCollectedAt: 0 });
  expect(r.readings.map(v => v.key)).toEqual(['contamination', 'airborneIdentity']);
  expect(r.confidenceScore).toBeGreaterThan(Assistant.assess(sample(), { ...actor, skills: { analysis: 1, alchemy: 1 } }, tool, record, 900).confidenceScore);
  expect(r.confidenceScore).toBeGreaterThan(Assistant.assess(sample(), actor, { ...tool, current: 10 }, { calibration: 10 }, 900).confidenceScore);
  expect(r.confidenceScore).toBeGreaterThan(Assistant.assess(sample(), actor, tool, record, 20000).confidenceScore);
  expect(Assistant.assess(sample(), actor, { ...tool, current: 0 }, record, 900)).toBeNull();
  expect(Assistant.assess(sample(), actor, tool, record, 900)).toEqual(r);
});

test('service, environmental and resource portions retain their existing finite confidence-limited protocols', () => {
  const f = fixture(), tool = { id: 'case', current: 80, max: 90 }, record = { calibration: 90 };
  const s = sample(); s.methodId = 'industrialBatchPortion'; s.targetKind = 'industrialService'; s.captured = { industrialService: { burden: 0 } };
  expect(Assistant.assess(s, f.saved.actor, tool, record, 900).readings[0].key).toBe('industrialContamination');
  s.methodId = 'confidentialChemicalPortion'; s.targetKind = 'confidentialService'; s.captured = { confidentialService: { signal: { purity: 85, contamination: .1 } } };
  expect(Assistant.assess(s, f.saved.actor, tool, record, 900).readings.map(r => r.key)).toEqual(['samplePurity', 'sampleContamination']);
  s.methodId = 'runoffSample'; s.targetKind = 'surfaceExposure'; s.captured = { environmentalExposure: { kind: 'environmentalExposure', methodId: 'runoffSample', amount: 1, amountBand: 'small', substanceId: 'chemicalVapor', tags: ['chemical'] } };
  expect(Assistant.assess(s, f.saved.actor, tool, record, 900).readings[0].key).toBe('environmentalBurden');
  s.methodId = 'resourceSurfaceSample'; s.targetKind = 'tile';
  s.captured = { resourceSurvey: Resources.capture({ worldId: 'world', siteId: 'site', strategicCellId: 'cell:1', seed: 'seed',
    truth: { potentialPermille: { ferrousOre: 800 }, surfaceAccessibilityPermille: 800 } }, s.cell, 'surfaceSample', 0, 70) };
  expect(Assistant.assess(s, f.saved.actor, tool, record, 900).readings).toHaveLength(6);
});

test('interruption and reload retain supplies, instrument custody and partial work without invented results', () => {
  const f = fixture(); arrive(f); Assistant.assign(f.saved, plan(), 900, reserve);
  f.hooks.haul = (a, o) => { o.workSeconds += 10; return {}; };
  Assistant.advance(f.saved, route, f.wallet, 910, f.hooks); expect(f.saved.orders[0].workSeconds).toBe(10);
  f.saved = Assistant.normalize(clone(f.saved));
  f.hooks.haul = () => ({ reason: 'Broken instrument' }); Assistant.advance(f.saved, route, f.wallet, 1000, f.hooks);
  expect(f.saved.orders[0].workSeconds).toBe(10); expect(f.saved.orders[0].result).toBeNull();
  let released = 0; f.hooks.release = () => released++;
  expect(Assistant.cancel(f.saved, f.hooks, 1000)).toBe(true); expect(Assistant.cancel(f.saved, f.hooks, 1000)).toBe(false); expect(released).toBe(1);
  Assistant.withdraw(f.saved, f.hooks, 1000); Assistant.advance(f.saved, route, f.wallet, 2000, f.hooks);
  expect(f.saved.contract.status).toBe('completed'); expect(f.wallet.money + f.saved.actor.money).toBeCloseTo(500);
});

test('public reports never expose private captured material or unread findings, and death freezes all authorized state', () => {
  const f = fixture(); arrive(f); Assistant.assign(f.saved, plan(), 900, reserve);
  const order = f.saved.orders[0]; order.sampleRecord = sample(); order.result = { summary: 'Private outcome' }; order.status = 'completed'; order.reportStackId = 'actual-record';
  let view = Assistant.publicView(f.saved, 1000);
  expect(view.orders[0].result).toBeNull(); expect(view.orders[0].sampleRecord).toBeUndefined(); expect(view.orders[0].pickups).toBeUndefined();
  order.receivedAt = 1010; view = Assistant.publicView(f.saved, 1010); expect(view.orders[0].result.summary).toBe('Private outcome');
  f.hooks.dead = true; const before = clone(f); Assistant.advance(f.saved, route, f.wallet, 20000, f.hooks); expect(clone(f)).toEqual(before);
});
