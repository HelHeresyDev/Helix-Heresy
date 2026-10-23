const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../founding-works');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const c = { worldId: 'world', runId: 'run', alive: true, free: true, capable: true, busy: false, bodyEpoch: 1,
    safe: true, atCamp: true, atCounter: false, workFit: true, cell: { x: 26, y: 13, z: 6 },
    observedIds: [], observedParts: [], withdrawContact: true };
  const s = W.create(c, { worldId: 'world', runId: 'run', id: 'original-project', demonstratedAt: 20, camp: { crateId: 'original-crate' },
    plan: { siteId: 'original-site', origin: { x: 26, y: 12, z: 6 }, route: [c.cell], home: { roomId: 'home', cell: c.cell } } },
  { cityId: 'original-city', populationSourceId: 'original-population', population: 100 });
  s.layout = W.layout(s.plan.origin); s.supportPath = [c.cell]; s.supportInspectedAt = 20;
  s.investigations = { stone: { at: 10, estimatedStoneTonnes: 12000 }, water: { at: 15, testLitresPerDay: 10000 },
    ground: { at: 20, testedSquareMetres: 100, cultivableSquareMetres: 60 } };
  const f = { c, s, at: 100, effort: 0, observations: 0, a: { id: 'original-protector', assignment: s.id, status: 'alive' } };
  f.h = { effort: () => { f.effort++; return true; }, observe: () => { f.observations++; return f.c; } };
  return f;
}
function tick(f, n = 1, wrong = {}) { f.at += n; return W.advanceFoundationAssessment(f.s, { ...f.c, ...wrong }, f.h, f.at); }
function assess(f) { assert.equal(W.beginFoundationAssessment(f.s, f.c, f.c.cell, f.at), true); for (let n = 0; n <= W.ASSESSMENT_SECONDS; n++) tick(f); return f.s.foundation.report; }
function party(f) {
  f.s.phase = 'works'; f.s.agreement = { actorId: f.a.id, endsAt: 20000, acceptedAt: 50 };
  f.s.people = [0, 1, 2, 3].map(n => ({ phase: 'resident', duty: 28000 - n, earned: n, settled: false, kitId: `original-kit:${n}`,
    actor: { id: `original-resident:${n}`, name: `Resident ${n}`, health: 90, status: 'alive', needs: { thirst: 35 } } }));
  f.s.ledger = { allocated: 4, departed: f.s.people.map(p => p.actor.id), returned: [], deaths: [] };
}
test('assessment requires personal safe capable attendance, no live construction and a bound original body', () => {
  const f = fixture();
  for (const wrong of [{ atCamp: false }, { safe: false }, { capable: false }, { alive: false }, { free: false }, { busy: true }, { workFit: false }, { runId: 'other' }])
    assert.equal(W.beginFoundationAssessment(f.s, { ...f.c, ...wrong }, f.c.cell, f.at), false);
  f.s.job = { running: true }; assert.equal(W.beginFoundationAssessment(f.s, f.c, f.c.cell, f.at), false);
  f.s.job = null; assert.equal(W.beginFoundationAssessment(f.s, f.c, { x: NaN }, f.at), false);
  assert.equal(W.beginFoundationAssessment(f.s, f.c, f.c.cell, f.at), true);
  assert.equal(W.beginFoundationAssessment(f.s, f.c, f.c.cell, f.at), false); assert.equal(f.observations, 0);
});
test('partial assessment survives normalization; interruptions and gaps never backfill work or publish an early report', () => {
  const f = fixture(); W.beginFoundationAssessment(f.s, f.c, f.c.cell, f.at); tick(f); for (let n = 0; n < 20; n++) tick(f);
  assert.equal(f.s.foundation.job.progress, 20);
  for (const wrong of [{ atCamp: false }, { safe: false }, { bodyEpoch: 2 }, { cell: { ...f.c.cell, x: 27 } }, { busy: true }, { workFit: false }]) {
    tick(f, 1, wrong); tick(f); assert.equal(f.s.foundation.job.progress, 20);
  }
  tick(f, 500); tick(f); assert.equal(f.s.foundation.job.progress, 20); assert.equal(f.observations, 0);
  assert.equal(W.controlFoundationAssessment(f.s, f.c, 'pause'), true);
  f.s = W.normalize(f.s); assert.equal(f.s.foundation.job.progress, 20);
  tick(f); assert.equal(f.s.foundation.job.progress, 20);
  assert.equal(W.controlFoundationAssessment(f.s, { ...f.c, bodyEpoch: 2 }, 'resume'), false);
  assert.equal(W.controlFoundationAssessment(f.s, f.c, 'resume'), true);
  tick(f); for (let n = 0; n < 40; n++) tick(f);
  assert.equal(f.s.foundation.job, null); assert.equal(f.observations, 1); assert.equal(f.effort, 60);
  assert.equal(f.s.foundation.report.verdict, 'notViable');
});
test('failed effort earns no assessment progress and irreversible scientist death freezes it', () => {
  const f = fixture(); W.beginFoundationAssessment(f.s, f.c, f.c.cell, f.at); tick(f);
  f.h.effort = () => false; tick(f); assert.equal(f.s.foundation.job.progress, 0);
  const before = copy(f.s); tick(f, 10, { alive: false }); assert.deepEqual(f.s, before);
});
test('even completed compound and excellent estimates do not create a city or proven production', () => {
  const f = fixture(); party(f); f.s.milestoneAt = 80;
  f.s.parts = Object.fromEntries(f.s.layout.parts.map(p => [p.id, { completeAt: 80, progress: p.seconds }]));
  f.c.observedParts = [{ id: 'visible-only', condition: 100, progress: 3600 }];
  const before = copy({ people: f.s.people, agreement: f.s.agreement, parts: f.s.parts, ledger: f.s.ledger });
  const r = assess(f); assert.equal(r.constructionMilestoneAt, 80); assert.equal(r.verdict, 'notViable');
  assert.equal(r.findings.length, 8); assert.equal(r.findings.find(x => x.id === 'resourcePurpose').status, 'unverified');
  assert.match(r.findings.find(x => x.id === 'settlement').text, /temporary/);
  assert.match(r.findings.find(x => x.id === 'independence').text, /neither allegiance nor alliance/);
  assert.deepEqual({ people: f.s.people, agreement: f.s.agreement, parts: f.s.parts, ledger: f.s.ledger }, before);
  for (const key of ['city', 'sovereignty', 'market', 'dominationCredit']) assert.equal(f.s[key], undefined);
});
test('capture uses end-of-attendance observations only and never reveals unseen original deaths or remote readiness', () => {
  const f = fixture(); party(f); f.s.people[0].actor.status = 'dead'; f.s.people[0].actor.health = 0;
  f.c.routeOpen = false; f.c.observedIds = [f.s.people[1].actor.id];
  const r = assess(f); assert.deepEqual(r.observedPeople.map(p => p.id), [f.s.people[1].actor.id]);
  assert.deepEqual(r.observedParts, []); assert.equal(r.deaths, undefined); assert.equal(r.phase, undefined);
  assert.equal(r.findings.find(x => x.id === 'support').status, 'unverified');
  const dated = copy(r); f.c.observedIds = f.s.people.map(p => p.actor.id); f.s.people[2].actor.health = 0; tick(f, 100);
  assert.deepEqual(f.s.foundation.report, dated);
});
test('absent evidence remains unverified and damaged camps need no magical restoration to be assessed', () => {
  const f = fixture(); f.s.investigations = {}; f.c.campIntact = false; f.c.sourceCurrent = false;
  const r = assess(f); for (const id of ['resourcePurpose', 'water', 'food']) assert.equal(r.findings.find(x => x.id === id).status, 'unverified');
});
test('defer binds the exact received assessment and neither pauses the world nor renews people, energy or commitments', () => {
  const f = fixture(); party(f); const r = assess(f), saved = copy({ agreement: f.s.agreement, people: f.s.people, ledger: f.s.ledger, actor: f.a });
  for (const [c, expected] of [[{ ...f.c, atCamp: false }, r], [{ ...f.c, bodyEpoch: 2 }, r], [f.c, { ...r, at: r.at - 1 }]])
    assert.equal(W.decideFoundation(f.s, f.a, c, 'defer', expected, f.at), false);
  assert.equal(W.decideFoundation(f.s, f.a, f.c, 'defer', r, f.at), true);
  assert.equal(W.decideFoundation(f.s, f.a, f.c, 'defer', r, f.at), false);
  assert.equal(f.s.phase, 'works'); assert.equal(W.active(f.s), true);
  assert.deepEqual({ agreement: f.s.agreement, people: f.s.people, ledger: f.s.ledger, actor: f.a }, saved);
});
test('abandon needs actual contact, issues original withdrawal, retains losses/partial property and cannot restart', () => {
  const f = fixture(); party(f); f.s.job = { running: false, attended: false, claims: { toolId: 'original-hammer' }, progress: 50, seconds: 3600 };
  f.s.parts.original = { progress: 50, physicalId: 'original-wall' }; const r = assess(f), before = copy(f.s.people);
  assert.equal(W.decideFoundation(f.s, f.a, { ...f.c, withdrawContact: false }, 'abandon', r, f.at), false);
  assert.equal(W.decideFoundation(f.s, { ...f.a, id: 'replacement' }, f.c, 'abandon', r, f.at), false);
  assert.equal(W.decideFoundation(f.s, f.a, f.c, 'abandon', r, f.at), true); assert.equal(f.s.phase, 'returning');
  assert.equal(f.a.assignment, f.s.id); assert.deepEqual(f.s.ledger.returned, []); assert.equal(f.s.parts.original.progress, 50);
  assert.deepEqual(f.s.people.map(p => ({ ...p, phase: 'resident' })), before);
  assert.equal(W.beginPart(f.s, f.c, f.s.layout.parts[0].id, { toolId: 'hammer' }, () => { throw Error('must not pay'); }, f.at), false);
  assert.equal(W.decideFoundation(f.s, f.a, f.c, 'defer', r, f.at), false); assert.equal(W.decideFoundation(f.s, f.a, f.c, 'abandon', r, f.at), false);
  assert.match(W.reviewReason(f.s, f.a, f.c), /abandoned/); assert.equal(f.s.runEnded, undefined);
});
test('unfunded proposals can be closed; an already retreating party needs no second remote order', () => {
  const f = fixture(); const r = assess(f); assert.equal(W.decideFoundation(f.s, f.a, f.c, 'abandon', r, f.at), true);
  assert.equal(f.s.phase, 'closed'); assert.equal(f.s.agreement, null); assert.equal(f.s.people.length, 0);
  const g = fixture(); party(g); const gr = assess(g); W.interrupt(g.s, g.at, 'original retreat');
  assert.equal(W.decideFoundation(g.s, g.a, { ...g.c, atCamp: false, atCounter: true, withdrawContact: false }, 'abandon', gr, g.at), true);
  assert.equal(g.s.phase, 'returning'); assert.deepEqual(g.s.ledger.returned, []);
});
test('legacy saves, continued bindings and independent new runs retain the knowledge boundary', () => {
  const f = fixture(); const legacy = copy(f.s); delete legacy.foundation;
  assert.deepEqual(W.normalize(legacy).foundation, { job: null, report: null, decision: null });
  const r = assess(f); W.decideFoundation(f.s, f.a, f.c, 'abandon', r, f.at);
  const rebound = W.rebind(f.s, f.c, { worldId: 'continued', runId: 'continued' });
  assert.deepEqual(rebound.foundation, f.s.foundation); assert.equal(rebound.plan.worldId, 'continued');
  assert.equal(W.bound(rebound, f.c), false); assert.equal(W.bound(f.s, { ...f.c, runId: 'new-run' }), false);
  assert.deepEqual(fixture().s.foundation, { job: null, report: null, decision: null });
});
