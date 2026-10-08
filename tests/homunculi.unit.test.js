const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../homunculi');
const R = require('../research-system');
const context = () => ({ research: true, morphogenesis: true, medicine: 101, alchemy: 101, chamber: true, condition: 100, inspected: true, services: true,
  quality: 90, template: { family: 'human', donorId: 'scientist', examined: true } });
function fixture(mode = 'body', overrides = {}) {
  const s = H.create(), support = { ok: true, roomId: 'lab', cell: { x: 1, y: 1, z: 0 } }, consumed = {}, releases = [];
  const hooks = { support: () => support, consume: (r, amounts) => { for (const [key, n] of Object.entries(amounts)) consumed[key] = (consumed[key] || 0) + n; return true; }, release: r => releases.push(r.id), environment: () => ({ floor: true, temperature: 20, hazard: false }) };
  const result = H.begin(s, mode, 'chamber', { ...context(), ...overrides }, 0, (id, costs) => Object.entries(costs).map(([key, quantity]) => ({ key, quantity, stackId: key })));
  function advance(hours, care = true) {
    let left = hours * H.HOUR;
    while (left > 0) { if (care) H.care(s, result.run, s.lastAt); const step = Math.min(left, 11 * H.HOUR); H.advance(s, s.lastAt + step, hooks); left -= step; }
  }
  return { s, result, hooks, support, consumed, releases, advance };
}
test('advanced requirements reject slime templates, missing research, skill, inspection and real services before loading', () => {
  for (const change of [{ template: { family: 'slime', examined: true } }, { research: false }, { morphogenesis: false }, { medicine: 100 }, { alchemy: 100 }, { inspected: false }, { condition: 79 }, { services: false }]) {
    let calls = 0; assert.equal(H.begin(H.create(), 'body', 'x', { ...context(), ...change }, 0, () => { calls++; }).ok, false); assert.equal(calls, 0);
  }
  const s = H.create(); assert.equal(H.begin(s, 'body', 'x', context(), 0, () => null).ok, false); assert.equal(s.runs.length, 0);
});
test('72-hour causal growth incorporates exact finite inputs and develops a unique inexperienced individual', () => {
  const f = fixture(); f.advance(24); assert.equal(H.stage(f.result.run), 'Organ formation'); assert.equal(f.s.individuals.length, 0);
  f.advance(36); const a = f.s.individuals[0]; assert.equal(a.status, 'developing'); assert.equal(H.stage(f.result.run), 'Physiological stabilization');
  assert.equal(H.cancel(f.s, f.result.run, f.s.lastAt, f.hooks), false);
  f.advance(12); assert.equal(f.result.run.status, 'completed'); assert.deepEqual(f.consumed, H.MODES.body.inputs); assert.equal(f.releases.length, 1);
  assert.equal(a.soulOrigin, 'naturally-developed'); assert.notEqual(a.id, a.donorId); assert.deepEqual(a.skills, {}); assert.deepEqual(a.memories, []); assert.equal(a.language, null); assert.equal(a.agreement, null);
  assert.equal(a.maturity, 1); assert.equal(a.health, 100);
});
test('culture trial is not a person; cancellation preserves progressive incorporation without refund', () => {
  const f = fixture('culture'); f.advance(4); assert.equal(H.cancel(f.s, f.result.run, f.s.lastAt, f.hooks), true); const consumed = { ...f.consumed };
  f.advance(24); assert.deepEqual(f.consumed, consumed); assert.equal(f.consumed.biomass, 1); assert.equal(f.s.individuals.length, 0); assert.equal(f.releases.length, 1);
  assert.equal(H.begin(f.s, 'culture', 'chamber', context(), f.s.lastAt, () => []).ok, false);
  const good = fixture('culture'); good.advance(12); assert.equal(good.result.run.status, 'completed'); assert.equal(good.s.individuals.length, 0);
});
test('short interruption consumes a nonrenewable buffer; prolonged outages causally kill', () => {
  const f = fixture(); f.advance(2); const progress = f.result.run.progress; f.support.ok = false;
  f.advance(1 / 6); assert.equal(f.result.run.damage, 0); assert.equal(f.result.run.progress, progress); assert.equal(f.result.run.buffer, 600);
  f.support.ok = true; f.advance(1); f.support.ok = false; f.advance(1 / 3); assert.equal(f.result.run.buffer, 0); assert.ok(f.result.run.damage > 0);
  f.advance(10); assert.equal(f.result.run.status, 'failed'); assert.equal(f.releases.length, 1);
});
test('neglect and contaminated medium do not yield random hostility or free progress', () => {
  const f = fixture(); f.advance(13, false); assert.ok(f.result.run.damage > 0); assert.ok(f.result.run.progress < 13 / 72);
  const bad = fixture('body', { quality: 40 }); bad.advance(10); assert.equal(bad.result.run.progress, 0); assert.equal(bad.result.run.status, 'failed'); assert.equal(bad.s.individuals.length, 0);
});
test('reload preserves buffer, injury, original stocks, progress and individual identity', () => {
  const f = fixture(); f.advance(60); f.support.ok = false; f.advance(1); const saved = H.normalize(f.s); assert.deepEqual(saved, f.s);
  H.care(saved, saved.runs[0], saved.lastAt); H.advance(saved, saved.lastAt + H.HOUR, f.hooks);
  assert.equal(saved.individuals[0].id, f.s.individuals[0].id); assert.equal(saved.runs[0].buffer, 0); assert.ok(saved.individuals[0].health < f.s.individuals[0].health);
  assert.deepEqual(saved.runs[0].stocks, f.s.runs[0].stocks);
});
test('post-growth nutrition, habitat and injury remain physical; scientist death freezes lifecycle', () => {
  const f = fixture(); f.advance(72); const a = f.s.individuals[0]; f.advance(25); assert.ok(a.health < 100); assert.equal(a.waterHours, 0);
  const frozen = JSON.stringify(f.s); H.advance(f.s, f.s.lastAt + H.HOUR, { ...f.hooks, dead: true }); assert.equal(JSON.stringify(f.s), frozen);
  H.injury(a, 100, 'Soul-bearing body destroyed', f.s.lastAt); assert.equal(a.status, 'dead'); assert.equal(f.s.individuals.length, 1);
});
test('observations are dated snapshots, not live hidden quality or supply readouts', () => {
  const f = fixture(); f.advance(2); const view = H.observe(f.s, f.result.run, f.s.lastAt); f.advance(1);
  assert.deepEqual(f.s.observations[f.result.run.id], view); assert.equal('quality' in view, false); assert.equal('stocks' in view, false);
});
test('new research requires examined template and actual surviving culture evidence, not campaign checklists', () => {
  const culture = R.PROJECT_BY_ID.tissueCultureMethods, body = R.PROJECT_BY_ID.homunculusMorphogenesis;
  assert.deepEqual(culture.minimumSkills, { medicine: 101, alchemy: 101 }); assert.equal(culture.evidence[0].methods[0], 'humanTemplateExam');
  assert.equal(body.evidence[0].methods[0], 'tissueCultureTrial'); assert.ok(body.prerequisites.includes(culture.id));
  assert.equal(H.requirements('body', { ...context(), morphogenesis: false }).includes('Morphogenesis'), true);
});
test('the shared human-derived body definition is selected centrally and saved for every world theme', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const s = H.create(0, { theme, seed: 'same-run' }); assert.equal(s.sourceTheme, 'shared'); assert.equal(s.definitionId, 'non-slime.shared.human-homunculus');
  }
});
test('utility reserve cannot excuse neglected care, destroyed equipment or vanished loaded material', () => {
  const f = fixture(); f.advance(12, false); f.support.ok = false; f.advance(1 / 6, false);
  assert.ok(f.result.run.damage > 0); assert.equal(f.result.run.buffer, 600);
  const broken = fixture(); broken.support.ok = false; broken.support.destroyed = true; broken.advance(1 / 6); assert.ok(broken.result.run.damage > 0);
  const missing = fixture(); missing.hooks.consume = () => false; missing.advance(1); assert.equal(missing.result.run.progress, 0); assert.ok(missing.result.run.damage > 0);
});
test('active physical work is not bodily rest; genuine idle recovery still reduces fatigue', () => {
  const f = fixture(); f.advance(72); const a = f.s.individuals[0]; a.fatigue = 10;
  f.hooks.environment = () => ({ floor: true, temperature: 20, hazard: false, working: true });
  f.advance(1); assert.equal(a.fatigue, 10);
  f.hooks.environment = () => ({ floor: true, temperature: 20, hazard: false, working: false });
  f.advance(1); assert.ok(a.fatigue < .01);
});
