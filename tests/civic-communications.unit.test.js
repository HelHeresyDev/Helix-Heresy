const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../civic-communications');
const N = require('../network-operations');
const Caps = require('../network-capabilities');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
const { world } = require('./helpers/network-operating-source');
const { addCommunications } = require('./helpers/civic-communication-source');
const copy = x => JSON.parse(JSON.stringify(x));
test('configuration belongs to its actual city and received relay records remain separately dated', () => {
  const f = fixture(), other = copy(f.rule); other.id = 'rule:b'; other.source.cityId = 'b'; other.source.populationSourceId = 'population:b';
  assert.equal(C.begin(f.s, f.rule, f.networks, f.c, f.provider, C.PURPOSES, false, 0), true);
  f.tick(23); const before = copy([f.s, f.rule, other, f.networks]);
  assert.equal(C.advance(f.s, other, f.networks, () => f.c, 60), false);
  assert.equal(C.release(f.s, other, f.networks), false); assert.deepEqual([f.s, f.rule, other, f.networks], before);
  f.tick(37); const dated = C.publicView(f.s, 'a'); assert.ok(dated); assert.equal(C.publicView(f.s, 'b'), null);
  assert.equal(C.receive(f.s, other, f.c, 75), true); assert.deepEqual(C.publicView(f.s, 'a'), dated);
  assert.equal(C.publicView(f.s, 'b').at, 75); assert.equal(C.publicView(C.normalize(f.s), 'a').at, 60);
});
function fixture() {
  const binding = { worldId: 'w', runId: 'r' }, city = { cityId: 'a', populationSourceId: 'population:a', charterId: 'charter:a',
    institutions: [{ role: 'publicWorksAndProvisioning', id: 'original-works:a' }] };
  const map = addCommunications(world(), city), source = C.sources(map, Definitions), networks = N.create(N.sources(map, 'original-communications'), binding, 0);
  const s = C.create(source, binding, 0), rule = { ...binding, id: 'rule:a', source: city, handoverId: 'original-handover:a', operatorWorkSeconds: 28800 };
  const c = { alive: true, capable: true, local: true, atCounter: true, reportersPresent: true, authority: true, sourceCurrent: true,
    institutionsAvailable: true, otherBusy: false, violence: false, bodyEpoch: 0, cell: { x: 17, y: 8, z: 6 } };
  const f = { binding, map, s, rule, networks, c, at: 0, provider: source.find(r => r.kind === 'provider').id,
    municipal: source.find(r => r.kind === 'municipal').id };
  f.tick = seconds => { f.at += seconds; return C.advance(f.s, rule, f.networks, () => c, f.at); };
  f.adopt = (id = f.provider, purposes = C.PURPOSES, rotate = false) => {
    assert.equal(C.begin(f.s, rule, f.networks, c, id, purposes, rotate, f.at), true); f.tick(60); assert.equal(f.s.job, null);
  };
  f.data = (sessionId = 'original-instruction', sequence = 1, purpose = 'fuelProcurement') => ({ purpose, sessionId, sequence,
    fromCityId: 'a', toCityId: 'a', signer: 'city', charterId: city.charterId, handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch });
  f.send = data => C.transfer(f.s, f.networks, C.packet(f.s, binding, data), ++f.at);
  return f;
}
test('actual original commissioned gateway, relay role, activated service and independent owner allocations are required; labels and ownership of a city site do not supply a constellation', () => {
  const f = fixture(), before = copy(f.map); assert.equal(f.s.sources.length, 2); assert.deepEqual(f.map, before);
  for (const change of [m => m.strategicNonStateNetworkHistory.branchRows.at(-1).organizationForm = 'relayStudio',
    m => m.strategicNonStateNetworkHistory.eventRows = [], m => m.strategicNonStateNetworkHistory.branchRows.at(-1).consolidatedIntoBranchId = 'other',
    m => m.strategicNonStateNetworkHistory.networkRows.at(-1).sourceDefinitionId = 'non-state-network.shared.meridian-holdings']) {
    const map = copy(f.map); change(map); assert.equal(C.sources(map, Definitions).filter(s => s.kind === 'provider').length, 0);
  }
  const noBackbone = copy(f.map); noBackbone.strategicCapabilityHistory.milestoneRows = []; assert.deepEqual(C.sources(noBackbone, Definitions), []);
  const fragile = copy(f.map); fragile.strategicCapabilityHistory.milestoneRows[0].infrastructureRows[0].hiddenConditionBand = 'fragile';
  const actual = C.create(C.sources(fragile, Definitions), f.binding, 0); assert.equal(actual.backbones[0].condition, 65);
  C.register(f.s, f.networks); C.register(f.s, f.networks);
  const assessment = Caps.assess(f.networks.capabilityAccounting, f.networks, 'original-relay-network');
  assert.equal(assessment.references.filter(r => r.family === 'mediaReach').length, 2);
  assert.equal(assessment.strategicComplete, false); assert.equal(f.networks.accounts.find(a => a.id === 'original-relay-office').allocations.length, 1);
});
test('configuration uses original municipal/provider work and power, preserves partial work, issues no early key and never refills access capacity', () => {
  const f = fixture(), a = f.networks.accounts.find(a => a.id === 'original-relay-office');
  assert.equal(C.begin(f.s, f.rule, f.networks, f.c, f.provider, C.PURPOSES, false, f.at), true); f.tick(23);
  assert.equal(f.s.profiles.length, 0); assert.equal(f.rule.operatorWorkSeconds, 28800 - 23);
  f.s = C.normalize(f.s); f.tick(37); assert.equal(f.s.profiles.length, 1); assert.equal(a.operator.workSeconds, 14340);
  const power = f.s.ports.find(p => p.id === f.provider).powerSeconds;
  f.adopt(); assert.equal(f.s.ports.find(p => p.id === f.provider).powerSeconds, power - 60);
  assert.equal(f.rule.operatorServiceAssignment, null); assert.equal(a.operator.assignment, null);
});
test('changed bodies, absent original parties and stolen work reservations interrupt without new credentials or refunds', () => {
  for (const change of [f => f.c.cell.y++, f => f.c.bodyEpoch++, f => f.c.authority = false,
    f => f.rule.handoverId = 'other', f => f.c.reportersPresent = false, f => f.rule.operatorServiceAssignment = 'different-work']) {
    const f = fixture(); C.begin(f.s, f.rule, f.networks, f.c, f.provider, C.PURPOSES, false, f.at); f.tick(20); change(f); f.tick(40);
    assert.equal(f.s.job, null); assert.equal(f.s.profiles.length, 0); assert.equal(f.rule.operatorWorkSeconds, 28800 - 20);
    if (f.rule.operatorServiceAssignment) assert.equal(f.rule.operatorServiceAssignment, 'different-work');
  }
});
test('unadopted links retain original consumer checks, and selected scopes do not install compulsory routing for other services', () => {
  const f = fixture(), untouched = copy(f.s.ports); assert.equal(f.send(f.data()), true); assert.deepEqual(f.s.ports, untouched);
  f.adopt(f.provider, ['technicalGuidance']); const power = f.s.ports.find(p => p.id === f.provider).powerSeconds;
  assert.equal(f.send(f.data()), true); assert.equal(f.s.ports.find(p => p.id === f.provider).powerSeconds, power);
  assert.equal(f.send(f.data('real-guidance', 1, 'technicalGuidance')), true); assert.equal(f.s.ports.find(p => p.id === f.provider).powerSeconds, power - 1);
});
test('delivery is atomic, replay-safe and finite; unsupported issuer, scope, sequence and run claims cannot create authority or spend resources', () => {
  const f = fixture(); f.adopt(); const data = f.data(), packet = C.packet(f.s, f.binding, data), power = f.s.ports[1].powerSeconds;
  for (const patch of [{ bodyEpoch: 4 }, { handoverId: 'other' }, { charterId: 'wrong-city' }, { runId: 'fresh' },
    { purpose: 'sovereignty' }, { keys: { a: 'unissued-key' } }, { sequence: 2 }, { signer: 'branch', senderId: 'imaginary-clerk' }])
    assert.equal(C.transfer(f.s, f.networks, { ...packet, ...patch }, ++f.at), false);
  assert.equal(C.transfer(f.s, f.networks, packet, ++f.at), true);
  const p = f.s.ports.find(p => p.id === f.provider), spent = p.spentSeconds;
  p.condition = 0; assert.equal(C.transfer(f.s, f.networks, packet, ++f.at), true); assert.equal(p.spentSeconds, spent);
  assert.equal(f.send(f.data('original-instruction', 2)), false); assert.equal(f.s.sessions[0].through, 1);
  assert.ok(power > 0); assert.equal(f.networks.accounts.every(a => !a.mandate), true);
});
test('original municipal failover preserves credentials and unfinished delivery; key rotation affects new messages, never acknowledged obligations', () => {
  const f = fixture(); f.adopt(); assert.equal(f.send(f.data()), true); const oldKey = f.s.profiles[0].keyId;
  f.s.ports.find(p => p.id === f.provider).condition = 0; assert.equal(f.send(f.data('original-instruction', 2)), false);
  f.adopt(f.municipal); assert.equal(f.s.profiles[0].keyId, oldKey); assert.equal(f.send(f.data('original-instruction', 2)), true);
  const old = C.packet(f.s, f.binding, f.data('old-pending'));
  const accepted = C.packet(f.s, f.binding, f.data()); f.adopt(f.municipal, C.PURPOSES, true);
  assert.notEqual(f.s.profiles[0].keyId, oldKey); assert.equal(C.transfer(f.s, f.networks, old, ++f.at), false);
  assert.equal(C.transfer(f.s, f.networks, accepted, ++f.at), true);
});
test('one finite access interface shares actual bandwidth across consumers, preserves originals on loss, and does not leak private capacity in dated receipts', () => {
  const f = fixture(); f.adopt(); const at = ++f.at;
  for (let n = 0; n < 4; n++) assert.equal(C.transfer(f.s, f.networks, C.packet(f.s, f.binding, f.data(`actual-${n}`)), at), true);
  assert.equal(C.transfer(f.s, f.networks, C.packet(f.s, f.binding, f.data('capacity-held')), at), false);
  assert.equal(C.receive(f.s, f.rule, f.c, at), true); const dated = copy(f.s.report);
  f.send(f.data('later')); assert.deepEqual(f.s.report, dated);
  assert.doesNotMatch(JSON.stringify(f.s.report), /powerSeconds|keyId|original-undisclosed|condition|populationSourceId/);
  const lost = copy(f.s); lost.ports.pop(); assert.equal(C.normalize(lost).invalid, true);
});
test('two enrolled endpoints reserve together; a disconnected receiver cannot consume sender capacity or backfill delivery at enrollment time', () => {
  const f = fixture(); f.adopt();
  // A second actual original path allocation with the same city-source rules.
  const r = { ...copy(f.s.sources[0]), id: 'b:original-interface', cityId: 'b', populationSourceId: 'population:b' };
  f.s.sources.push(r); f.s.ports.push({ id: r.id, condition: 100, powerSeconds: 10, initialPowerSeconds: 14400, spentSeconds: 14390 });
  f.s.profiles.push({ cityId: 'b', pathId: r.id, purposes: copy(C.PURPOSES), charterId: 'b', handoverId: 'b', bodyEpoch: 0, keyId: 'b-key', at: f.at });
  const data = { ...f.data(), toCityId: 'b', civicCityIds: ['a', 'b'] }, packet = C.packet(f.s, f.binding, data);
  assert.equal(C.transfer(f.s, f.networks, packet, f.at), false);
  f.s.ports.at(-1).condition = 0; const before = copy(f.s.ports[1]); assert.equal(C.transfer(f.s, f.networks, packet, ++f.at), false);
  assert.deepEqual(f.s.ports[1], before); f.s.ports.at(-1).condition = 100;
  assert.equal(C.transfer(f.s, f.networks, packet, ++f.at), true); assert.equal(f.s.ports.at(-1).powerSeconds, 9);
});
test('copied runs preserve keys, capacity, partial configuration and acknowledgements; fresh binding and final death cannot advance or replenish them', () => {
  const f = fixture(); f.adopt(); f.send(f.data());
  const continued = C.rebind(f.s, f.binding, { worldId: 'w', runId: 'continued' }); assert.deepEqual(continued.ports, f.s.ports);
  assert.deepEqual(continued.sessions, f.s.sessions); assert.equal(C.rebind(f.s, { worldId: 'other', runId: 'r' }, f.binding), null);
  C.begin(f.s, f.rule, f.networks, f.c, f.municipal, C.PURPOSES, false, f.at); f.tick(20); f.c.alive = false;
  const before = copy([f.s, f.rule, f.networks]); f.tick(120); assert.deepEqual([f.s, f.rule, f.networks], before);
});
test('a city does not acquire private branch connections; both local access alternatives still depend on the same real original backbone', () => {
  const f = fixture(); f.adopt();
  const privateMessage = { purpose: 'networkCorrespondence', sessionId: 'private-original-office', sequence: 1,
    fromCityId: 'a', toCityId: 'b', civicCityIds: [], signer: 'branch', senderId: 'branch:a', charterId: 'branch:a:operating-charter' };
  f.s.ports.find(p => p.id === f.provider).outage = true;
  const ports = copy(f.s.ports); assert.equal(f.send(privateMessage), true); assert.deepEqual(f.s.ports, ports);
  f.adopt(f.municipal); assert.equal(f.send(f.data()), true);
  assert.equal(f.s.backbones.length, 1); f.s.backbones[0].outage = true;
  const before = copy(f.s.ports); assert.equal(f.send(f.data('held-by-shared-backbone')), false); assert.deepEqual(f.s.ports, before);
  assert.equal(C.begin(f.s, f.rule, f.networks, f.c, f.provider, C.PURPOSES, false, f.at), false);
  const lost = copy(f.s); lost.backbones = []; assert.equal(C.normalize(lost).invalid, true);
});
test('adopting a route midway through existing work acknowledges only newly received units, without backdating or replaying the earlier consumer', () => {
  const f = fixture(); const old = f.data('continuing-original-work', 44, 'technicalGuidance');
  assert.equal(f.send(old), true); assert.equal(f.s.sessions[0].through, 1);
  f.adopt(); assert.equal(f.send({ ...old, sequence: 45 }), true);
  assert.equal(f.s.sessions[0].through, 2); assert.equal(f.s.sessions[0].segments.length, 2);
  const spent = f.s.ports.find(p => p.id === f.provider).spentSeconds;
  assert.equal(f.send({ ...old, sequence: 45 }), true); assert.equal(f.s.ports.find(p => p.id === f.provider).spentSeconds, spent);
});
test('authority over new branch contracts cannot retroactively cancel the already accepted scoped access service', () => {
  const f = fixture(); f.adopt(); const a = f.networks.accounts.find(a => a.id === 'original-relay-office');
  a.source.charter.scope = [];
  assert.equal(C.begin(f.s, f.rule, f.networks, f.c, f.provider, C.PURPOSES, false, f.at), false);
  assert.equal(f.send(f.data()), true); C.register(f.s, f.networks);
  assert.equal(a.allocations[0].contractId, f.s.profiles[0].id);
});
