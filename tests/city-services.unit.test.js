const { test } = require('node:test');
const assert = require('node:assert/strict');
const CS = require('../city-services');
const M = require('../powerworks-maintenance');
const S = require('../powerworks-standards');
const R = require('../city-rule');
const N = require('../network-operations');
const I = require('../network-inventories');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
const { inputs } = require('./helpers/powerworks-source');
const { sources } = require('./helpers/regional-government-source');
const copy = x => JSON.parse(JSON.stringify(x));
const binding = { worldId: 'w', runId: 'r' };
function fixture() {
  const map = inputs();
  map.strategicNonStateNetworkHistory.branchRows.splice(1);
  map.strategicCapabilityHistory.milestoneRows[0].infrastructureRows.push({ id: 'power:b', cityId: 'b', function: 'powerWorks', operationalAtPlayableYear: true });
  const records = ['a', 'b'].map(cityId => {
    const src = sources(cityId).operation; if (cityId === 'a') src.powerId = 'original-power:a';
    src.powerCondition = 80;
    const people = R.ROLES.map(role => ({ id: `${cityId}:${role}`, institutionId: src.institutions.find(i => i.role === role).id,
      roles: [role], health: 100, status: 'alive' }));
    const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: `${cityId}:terms` }));
    const succession = { source: { cityId, charterId: src.charterId, authority: { id: src.baselineAuthorityId } }, officeId: `office:${cityId}`,
      handover: { id: `handover:${cityId}`, termsId: `${cityId}:terms`, bodyEpoch: 0 }, agreements,
      control: { recognizedAuthorityId: 'scientist', sourceReceiptId: `handover:${cityId}`, bodyEpoch: 0, commandRelationships: copy(agreements) } };
    return { rule: R.createAggregate(src, succession, binding, 0, { id: `ward:${cityId}`, initialEnergy: 69120 }), succession, people };
  });
  const networks = N.create(N.sources(map, 'original-powerworks'), binding, 0, { originalInventory: true });
  const run = { cityRule: records[0].rule, penalFlights: { assistance: { cityApproach: { gates: [
    { regionalGovernment: { rule: records[1].rule, services: {} } }
  ] } } } };
  let adoptions = 0;
  for (const e of CS.entries(run)) e.owner.powerworksMaintenance = CS.install(run, binding, 'maintenance',
    M.create(M.sources(map, e.rule.source, Definitions, true), e.rule, 0), (kind, s) => { adoptions++; return I.adopt(networks, kind, s, binding); });
  const wallet = { money: 1000 }, c = { alive: true, capable: true, local: true, free: true, authority: true, sourceCurrent: true,
    institutionsAvailable: true, atCounter: true, reportersPresent: true, atWorkface: true, workAccessible: true,
    otherBusy: false, violence: false, bodyEpoch: 0, cell: copy(M.WORKFACE), channelAvailable: true,
    wallet, stamina: 100, skills: { analysis: 40, materialsScience: 40 }, calibrations: {} };
  const stacks = [], tools = ['environmentalSurveyKit', 'thaumometer', 'masonryHammer'].map(key => {
    const id = `tool:${key}`, stack = { id: `${id}:stack`, key, toolInstanceId: id, quantity: 1, carriedBy: 'scientist' };
    stacks.push(stack); c.calibrations[id] = 90; return { key, stack, tool: { id, current: 70, carriedBy: 'scientist' } };
  });
  const hooks = { alive: () => c.alive, stacks: () => stacks, tools: () => tools, work: n => { c.stamina -= n; } };
  return { map, run, records, networks, wallet, c, stacks, tools, hooks, adoptions };
}
test('two source-bound plants share one original specialist/bench and one inventory transfer, not their local records', () => {
  const f = fixture(), [a, b] = CS.entries(f.run), ma = a.owner.powerworksMaintenance, mb = b.owner.powerworksMaintenance;
  assert.ok(ma && mb); assert.equal(f.adoptions, 1); assert.equal(ma.sources.length, 1); assert.equal(mb.sources.length, 1);
  assert.equal(mb.sources[0].cityId, 'a'); assert.equal(mb.sources[0].targetCityId, 'b');
  assert.equal(ma.providers[0].technician, mb.providers[0].technician); assert.equal(ma.providers[0].bench, mb.providers[0].bench);
  assert.equal(M.target(ma, b.rule), false); assert.equal(M.target(mb, a.rule), false);
  const worker = ma.providers[0].technician, duty = worker.workSeconds, bench = ma.providers[0].bench.workSeconds;
  assert.equal(M.begin(mb, b.rule, f.networks, f.c, 'inspect', mb.sources[0].id, f.stacks, f.tools, f.wallet, 0), true);
  assert.equal(CS.personal(f.run, 'maintenance', 'a'), true); assert.equal(CS.personal(f.run, 'maintenance', 'b'), false);
  assert.equal(M.begin(ma, a.rule, f.networks, f.c, 'inspect', ma.sources[0].id, f.stacks, f.tools, f.wallet, 0), false);
  M.advance(mb, b.rule, f.networks, () => f.c, 120, f.hooks);
  assert.equal(worker.workSeconds, duty - 120); assert.equal(ma.providers[0].bench.workSeconds, bench - 120);
  assert.equal(f.wallet.money, 988); assert.equal(ma.inspection, null); assert.equal(mb.inspection.powerId, b.rule.source.powerId);
  const dated = M.publicView(mb); M.advance(mb, b.rule, f.networks, () => ({ ...f.c, local: false }), 500, f.hooks);
  assert.deepEqual(M.publicView(mb), dated); assert.equal(M.publicView(ma), null);
  I.observe(f.networks, f.run, binding);
  for (const id of [worker.id, ma.providers[0].bench.id]) {
    const observed = f.networks.inventories.observed.filter(r => r.id === id);
    assert.equal(observed.length, 1); assert.equal(observed[0].conflict, false);
    assert.equal(f.networks.inventories.assets.find(a => a.id === id).lost, false);
  }
});
test('save restores exact shared resources once, active reservations and continued bindings; loss never refills methods or workers', () => {
  const f = fixture(), [a, b] = CS.entries(f.run), ma = a.owner.powerworksMaintenance, mb = b.owner.powerworksMaintenance;
  M.begin(mb, b.rule, f.networks, f.c, 'inspect', mb.sources[0].id, f.stacks, f.tools, f.wallet, 0);
  M.advance(mb, b.rule, f.networks, () => f.c, 43, f.hooks);
  const saved = copy(f.run); assert.equal(saved.powerworksMaintenance.providers[0].technician, undefined);
  assert.equal(saved.cityServices.assets.filter(a => a.kind === 'technician').length, 1);
  CS.restore(saved, binding); const [sa, sb] = CS.entries(saved).map(e => e.owner.powerworksMaintenance);
  assert.equal(sa.providers[0].technician, sb.providers[0].technician); assert.equal(sb.job.progress, 43);
  assert.equal(sb.providers[0].technician.assignment, sb.job.id);
  M.advance(sb, CS.entries(saved)[1].rule, f.networks, () => f.c, 120, f.hooks); assert.equal(sb.inspection.at, 120);
  assert.equal(sb.job, null); assert.equal(f.wallet.money, 988);
  // A retained independent method is city-specific knowledge, not a provider.
  assert.equal(M.begin(sb, CS.entries(saved)[1].rule, f.networks, f.c, 'learn', sb.sources[0].id, f.stacks, f.tools, f.wallet, 120), true);
  M.advance(sb, CS.entries(saved)[1].rule, f.networks, () => f.c, 1320, f.hooks); assert.ok(sb.method);
  const lost = copy(saved); delete lost.cityServices;
  CS.restore(lost, binding); const lm = CS.entries(lost)[1].owner.powerworksMaintenance;
  assert.deepEqual(lm.method, sb.method); assert.equal(lm.providers[0].technician.workSeconds, 0);
  assert.equal(CS.ensure(lost, binding), null); assert.equal(lost.cityServices, undefined);
  assert.equal(M.begin(lm, CS.entries(lost)[1].rule, f.networks, f.c, 'inspect', '', f.stacks, f.tools, f.wallet, 1320), true);
  M.advance(lm, CS.entries(lost)[1].rule, f.networks, () => f.c, 1440, f.hooks); assert.equal(lm.inspection.at, 1440);
  assert.equal(lm.providers[0].technician.workSeconds, 0);
  const continued = copy(saved), to = { worldId: 'continued-world', runId: 'continued-run' };
  CS.restore(continued, binding);
  for (const e of CS.entries(continued)) Object.assign(e.rule, to);
  continued.powerworksMaintenance = M.rebind(continued.powerworksMaintenance, binding, to);
  CS.rebind(continued, binding, to); const models = CS.entries(continued).map(e => e.owner.powerworksMaintenance);
  assert.equal(models[0].providers[0].technician, models[1].providers[0].technician);
  assert.equal(models[1].runId, to.runId); assert.deepEqual(models[1].method, sb.method);
});
test('legacy shared disagreements, wrong source refs and corrupt resources fail closed without a healthy replacement', () => {
  const f = fixture(), legacy = copy(f.run); delete legacy.cityServices; delete legacy.cityServicesInitialized;
  for (const e of CS.entries(legacy)) for (const p of e.owner.powerworksMaintenance.providers) {
    const original = CS.entries(f.run)[0].owner.powerworksMaintenance.providers[0];
    p.technician = copy(original.technician); p.bench = copy(original.bench); delete p.resourceRefs;
  }
  CS.entries(legacy)[1].owner.powerworksMaintenance.providers[0].technician.workSeconds--;
  CS.restore(legacy, binding); assert.equal(legacy.cityServices.conflict, true);
  for (const e of CS.entries(legacy)) assert.equal(e.owner.powerworksMaintenance.providers[0].technician.workSeconds, 0);
  const corrupt = copy(f.run); corrupt.cityServices.assets.find(a => a.kind === 'technician').value.workSeconds = 999999;
  CS.restore(corrupt, binding);
  for (const e of CS.entries(corrupt)) assert.equal(e.owner.powerworksMaintenance.providers[0].technician.workSeconds, 0);
  const wrong = copy(f.run); wrong.powerworksMaintenance.providers[0].resourceRefs.technician = 'another-owner';
  CS.restore(wrong, binding); assert.equal(wrong.powerworksMaintenance.providers[0].technician.workSeconds, 0);
  const lostPolicy = copy(f.run); delete lostPolicy.cityServices.assets.find(a => a.kind === 'technician').value.serviceAccepting;
  CS.restore(lostPolicy, binding);
  for (const e of CS.entries(lostPolicy)) assert.equal(e.owner.powerworksMaintenance.providers[0].accepting, false);
  const brokenView = copy(f.run); brokenView.powerworksMaintenance.providers = [null];
  CS.restore(brokenView, binding); assert.equal(brokenView.powerworksMaintenance.invalid, true);
});
test('direct continued rebind hydrates saved references and an early import does not poison future original services', () => {
  const f = fixture(), saved = copy(f.run), to = { worldId: 'copy-world', runId: 'copy-run' };
  for (const e of CS.entries(saved)) Object.assign(e.rule, to);
  CS.rebind(saved, binding, to);
  const models = CS.entries(saved).map(e => e.owner.powerworksMaintenance);
  assert.equal(models[0].providers[0].technician, models[1].providers[0].technician);
  assert.ok(models.every(m => m.runId === to.runId && !m.invalid));
  const early = {}; CS.rebind(early, binding, to);
  assert.ok(CS.ensure(early, to)); assert.equal(early.cityServices.assets.length, 0);
  const noPolicy = { cityRule: f.records[0].rule, powerworksStandards: null };
  CS.restore(noPolicy, binding); assert.equal(noPolicy.powerworksStandards, null);
  assert.equal(S.permits(noPolicy.powerworksStandards, noPolicy.cityRule, { key: 'metalParts' }, null), true);
});
test('optional refusal does not manufacture a city failure, actual depleted necessities do, death grants no progress', () => {
  const f = fixture(), [a, b] = CS.entries(f.run);
  a.owner.powerworksMaintenance.providers[0].accepting = false;
  assert.equal(b.owner.powerworksMaintenance.providers[0].accepting, false);
  assert.equal(CS.outcome(a).state, 'noCurrentServiceFailure'); assert.equal(CS.outcome(b).state, 'noCurrentServiceFailure');
  const rb = f.records[1];
  R.advance(b.rule, rb.succession, rb.people, () => ({ ...f.c, coverageVerified: true, counterpower: 'noEstablishedChallenge',
    defenseAvailable: true, pilotSupplied: true, pilotDefended: true, routes: { 'farm:b': true } }), 6 * 86400);
  assert.equal(b.rule.energy, 0); assert.equal(CS.outcome(b).state, 'unmetGovernmentRequirement');
  assert.equal(CS.outcome(a).state, 'noCurrentServiceFailure');
  const mb = b.owner.powerworksMaintenance; mb.providers[0].accepting = true;
  M.begin(mb, b.rule, f.networks, f.c, 'inspect', mb.sources[0].id, f.stacks, f.tools, f.wallet, 0);
  const before = copy(f.run); f.c.alive = false;
  assert.equal(M.advance(mb, b.rule, f.networks, () => f.c, 120, f.hooks), false); assert.deepEqual(copy(f.run), before);
});
test('remote provider eligibility needs an actual target plant, not a plant in the provider city or a cloned standards bureau', () => {
  const f = fixture(), [a, b] = CS.entries(f.run);
  f.map.strategicCapabilityHistory.milestoneRows[0].infrastructureRows.shift();
  const rows = M.sources(f.map, b.rule.source, Definitions, true); assert.equal(rows.length, 1); assert.equal(rows[0].cityId, 'a');
  const h = f.map.strategicNonStateNetworkHistory;
  h.networkRows[0].category = 'standards'; h.networkRows[0].sourceDefinitionId = 'non-state-network.shared.common-measure';
  h.branchRows[0].organizationForm = 'standardsBureau';
  const sr = S.sources(f.map, b.rule.source, Definitions, true); assert.equal(sr.length, 1);
  assert.equal(sr[0].cityId, 'a'); assert.equal(sr[0].targetCityId, 'b');
  const sb = S.create(sr, b.rule, 0); assert.ok(sb); assert.equal(S.target(sb, a.rule), false);
  f.map.strategicCapabilityHistory.milestoneRows[0].infrastructureRows[0].operationalAtPlayableYear = false;
  assert.deepEqual(M.sources(f.map, b.rule.source, Definitions, true), []); assert.deepEqual(S.sources(f.map, b.rule.source, Definitions, true), []);
});
test('two prospective local standards policies share the original reviewer and bench, not test jigs or destructive samples', () => {
  const f = fixture(), h = f.map.strategicNonStateNetworkHistory;
  h.networkRows[0].category = 'standards'; h.networkRows[0].sourceDefinitionId = 'non-state-network.shared.common-measure';
  h.branchRows[0].organizationForm = 'standardsBureau';
  const networks = N.create(N.sources(f.map, 'original-powerworks'), binding, 0, { originalInventory: true });
  const run = { cityRule: f.records[0].rule, penalFlights: { assistance: { cityApproach: { gates: [
    { regionalGovernment: { rule: f.records[1].rule, services: {} } }
  ] } } } };
  let transfers = 0;
  for (const e of CS.entries(run)) e.owner.powerworksStandards = CS.install(run, binding, 'standards',
    S.create(S.sources(f.map, e.rule.source, Definitions, true), e.rule, 0), (kind, s) => { transfers++; return I.adopt(networks, kind, s, binding); });
  const [a, b] = CS.entries(run), sa = a.owner.powerworksStandards, sb = b.owner.powerworksStandards;
  assert.ok(sa && sb); assert.equal(transfers, 1); assert.equal(sa.providers[0].reviewer, sb.providers[0].reviewer);
  assert.equal(sa.providers[0].bench, sb.providers[0].bench); assert.notEqual(sa.reference.id, sb.reference.id);
  const offer = S.review(sb, b.rule, f.c, 'adopt', sb.sources[0].id, 0);
  assert.equal(S.begin(sb, b.rule, networks, f.c, 'adopt', '', '', f.stacks, f.tools, offer, 0), true);
  S.advance(sb, b.rule, networks, () => f.c, 60, f.hooks);
  assert.ok(sb.policy); assert.equal(sa.policy, null); assert.equal(sa.reference.sampleTests, 24);
  f.stacks.push({ id: 'actual-lot', section: 'resources', key: 'metalParts', quantity: 5, carriedBy: 'scientist' },
    { id: 'actual-reagent', section: 'resources', key: 'assayReagent', quantity: 1, carriedBy: 'scientist' });
  const duty = sa.providers[0].reviewer.workSeconds;
  assert.equal(S.begin(sb, b.rule, networks, f.c, 'test', sb.sources[0].id, 'actual-lot', f.stacks, f.tools, null, 60), true);
  S.advance(sb, b.rule, networks, () => f.c, 360, f.hooks);
  assert.equal(sb.job, null); assert.equal(sb.reference.sampleTests, 23); assert.equal(sa.reference.sampleTests, 24);
  assert.equal(sa.providers[0].reviewer.workSeconds, duty - 300); assert.equal(f.wallet.money, 980);
  assert.equal(f.stacks.find(i => i.id === 'actual-lot').quantity, 4); assert.equal(sb.assessments.length, 1); assert.equal(sa.assessments.length, 0);
  const saved = copy(run); CS.restore(saved, binding);
  const restored = CS.entries(saved).map(e => e.owner.powerworksStandards);
  assert.equal(restored[0].providers[0].reviewer, restored[1].providers[0].reviewer);
  assert.deepEqual(restored[1].policy, sb.policy); assert.deepEqual(restored[1].assessments, sb.assessments);
  I.observe(networks, saved, binding); assert.equal(networks.inventories.observed.find(r => r.id === sa.providers[0].reviewer.id).conflict, false);
});
