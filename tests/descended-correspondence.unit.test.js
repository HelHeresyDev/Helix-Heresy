const { test } = require('node:test');
const assert = require('node:assert/strict');
const Mail = require('../descended-correspondence');
const Owners = require('../divine-capabilities');
const Ports = require('../civic-communications');
const { ordinaryMap } = require('./helpers/ordinary-correspondence-source');
const copy = x => JSON.parse(JSON.stringify(x));
const binding = { worldId: 'world', runId: 'run' };
function fixture() {
  const map = ordinaryMap(), ports = Ports.create(Ports.sources(map), binding, 0), book = Owners.create(Owners.sources(map), binding, 0, true),
    s = Mail.create(Mail.sources(map, ports.sources), book, ports, 0),
    office = { id: 'office:a', cityId: 'a', active: true, channelPowered: true, maintenanceReady: true, power: 40, workSeconds: 14400,
      clerk: { id: 'clerk:a', name: 'Original clerk', status: 'alive', health: 100 }, assignment: null },
    c = { alive: true, capable: true, receiveAtCounter: true, free: true, busy: false, sourceCurrent: true, serviceAvailable: true, clerkAtChannel: true, bodyEpoch: 0, witness: true },
    ground = { cityId: 'a', gateId: null, roomId: 'actual-counter', counter: { x: 17, y: 8, z: 6 } };
  return { map, ports, book, s, office, c, ground, at: 0,
    id: s.endpoints.find(e => e.source.branchName === 'Retained Auriel Archive').source.id };
}
function begin(f, kind, id = f.id, expected = null) { return Mail.begin(f.s, f.book, f.ports, id, f.office, f.c, kind, f.at, expected, f.ground); }
function tick(f, dt, id = f.id) { f.at += dt; return Mail.advance(f.s, f.book, f.ports, id, f.office, f.c, f.at); }
function contact(f, id = f.id) { assert(begin(f, 'discover', id)); tick(f, 60, id); return Mail.row(f.s, id).contact; }
function offer(f) {
  contact(f); assert(begin(f, 'request')); tick(f, 60); tick(f, 120);
  assert(begin(f, 'receive')); tick(f, 60); return Mail.row(f.s, f.id).contact.offer;
}
function agree(f, receive = true) {
  const exact = offer(f); assert(exact); assert(begin(f, 'accept', f.id, exact)); tick(f, 60); tick(f, 120);
  if (receive) { assert(begin(f, 'receive')); tick(f, 60); }
}
function fact(f) { return Owners.advance(f.book, { ...binding, divineCapabilities: f.book, clock: f.at }, f.at, { alive: f.c.alive, bodyEpoch: f.c.bodyEpoch })[0]; }
test('retained ordinary sources need original public identity, historical branch INTERNET custody and actual original uplink, never event coordinates', () => {
  const f = fixture(); assert.equal(f.s.endpoints.length, 4); assert.equal(f.book.originals.length, 2);
  for (const change of [m => delete m.publicReligionDirectory, m => m.strategicDivineHistory.currentGodRows[0].lifecycle.lifeState = 'dead',
    m => m.strategicDivineHistory.currentGodRows[0].lifecycle.divinityState = 'divine', m => m.publicReligiousInstitutionHistoryDirectory.traditionRows[0].kind = 'unconfirmedSuccessorTradition',
    m => m.publicReligiousInstitutionHistoryDirectory.currentBranchRows.forEach(b => b.internetContinuity = false),
    m => m.publicReligiousInstitutionHistoryDirectory.currentBranchRows.forEach(b => b.currentCityId = 'historical-battle'),
    m => m.publicReligiousInstitutionHistoryDirectory.currentBranchRows.forEach(b => b.divineRelationship = 'estranged'),
    m => m.publicReligiousInstitutionHistoryDirectory.currentBranchRows.forEach(b => b.currentStanding = 'proscribed')]) {
    const m = copy(f.map); change(m); assert.equal(Mail.sources(m, f.ports.sources).some(r => r.godId === 'god:01'), false);
  }
  assert.deepEqual(Mail.sources(f.map, []), []);
  f.map.strategicDivineHistory.eventRows.push({ kind: 'forcedDescent', godId: 'god:01', cityId: 'remote-battle' });
  assert(Mail.sources(f.map, f.ports.sources).every(r => r.cityId === 'a' && !JSON.stringify(r).includes('remote-battle')));
});
test('original custodian disclosure and actual personal reply are separate, paid, received-only records', () => {
  const f = fixture(), initial = copy(f.book.records);
  assert.deepEqual(Mail.publicView(f.s), []); const c = contact(f); assert.equal(c.state, 'known');
  assert(Mail.publicView(f.s)[0].address); assert(begin(f, 'request')); tick(f, 60);
  const held = Mail.publicView(f.s); assert.equal(f.s.accounts[0].attentionSeconds, 480);
  f.c.receiveAtCounter = false; tick(f, 120);
  assert.deepEqual(Mail.publicView(f.s), held); assert.equal(c.state, 'replyReady'); assert.equal(c.offer, null);
  assert.equal(begin(f, 'receive'), false); f.c.receiveAtCounter = true;
  assert(begin(f, 'receive')); tick(f, 60); assert.equal(c.state, 'offered'); assert.equal(f.book.agreements.length, 0);
  assert.equal(c.offer.terms, Mail.TERMS); assert.deepEqual(f.book.records, initial); assert.equal(Mail.evidence(f.s).length, 0);
  assert.equal(f.office.workSeconds, 14400 - 300); assert.equal(f.ports.ports[0].spentSeconds, 300);
});
test('withheld address is stable and spends no original recipient attention; no reroll or fallback location', () => {
  const f = fixture(), id = f.s.endpoints.find(e => e.source.disclosure === 'withholdAddress').source.id;
  const c = contact(f, id); assert.equal(c.state, 'withheld'); assert.equal(Mail.publicView(f.s)[0].address, null);
  assert.equal(begin(f, 'request', id), false); assert.equal(begin(f, 'discover', id), false);
  assert.equal(f.s.accounts[0].attentionSeconds, 600); assert.equal(f.s.accounts[0].spentAttention, 0);
  f.s = Mail.normalize(copy(f.s), f.book, f.ports); assert(!f.s.invalid); assert.equal(begin(f, 'discover', id), false);
});
test('descent is not friendship: default heretic rejection is an actual independent received refusal', () => {
  const f = fixture(), id = f.s.endpoints.find(e => e.source.godName === 'Boreal').source.id;
  const c = contact(f, id); assert(begin(f, 'request', id)); tick(f, 60, id); tick(f, 120, id);
  assert(!Mail.publicView(f.s)[0].reply.text.includes('refuses')); assert(begin(f, 'receive', id)); tick(f, 60, id);
  assert.equal(c.state, 'refused'); assert.match(c.reply.text, /refuses/); assert.equal(c.offer, null); assert.equal(f.book.agreements.length, 0);
  assert.equal(f.s.accounts.find(a => a.godId === 'god:02').attentionSeconds, 480);
});
test('actual exact acceptance and original assent qualify only one individual; received evidence never issues a global award', () => {
  const f = fixture(); agree(f, false); assert.equal(f.book.agreements.length, 1); assert.equal(f.s.reports.length, 0);
  assert.equal(fact(f).state, 'qualifying'); assert.equal(f.book.records[0].god.power.reserve, 0);
  assert.equal(f.s.accounts[0].attentionSeconds, 360); const a = f.book.agreements[0];
  assert.equal(a.payload.expiresAt, a.payload.at + Mail.DURATION); assert.equal(a.payload.scope, 'ownTerrestrialIntervention');
  assert(begin(f, 'receive')); tick(f, 60); assert.equal(f.s.reports.length, 1); assert.equal(Mail.evidence(f.s)[0].status, 'unverified');
  assert.equal(Owners.assessment(f.book, { ...binding, divineCapabilities: f.book, clock: f.at }, f.at, { alive: true, bodyEpoch: 0 })[1].fact.state, 'unverified');
  const report = copy(f.s.reports); f.c.receiveAtCounter = false; tick(f, Mail.DURATION + 1);
  assert.deepEqual(f.s.reports, report); assert.equal(fact(f).state, 'unverified');
});
test('tampered terms, stale offers and body changes never generate assent', () => {
  for (const change of [p => p.terms = 'Worship and command all followers', p => p.duration++, p => p.godId = 'god:02', p => p.scope = 'divineSubmission',
    p => p.protectedId = 'unrelated-person', p => p.branchId = 'unrelated-branch', p => p.offerExpiresAt++, p => p.endpointId = 'different-address']) {
    const f = fixture(), p = offer(f); const old = copy(p); change(p); assert.equal(begin(f, 'accept', f.id, old), false); assert.equal(f.book.agreements.length, 0);
    assert.equal(begin(f, 'accept', f.id, copy(p)), false);
  }
  const f = fixture(), p = offer(f); f.at = p.offerExpiresAt; assert.equal(begin(f, 'accept', f.id, p), false);
  const g = fixture(), q = offer(g); g.c.bodyEpoch++; assert.equal(begin(g, 'accept', g.id, q), false);
});
test('replacement staff, missing actual attendance, lost source, competing shared ports and finite shortages cannot start work', () => {
  for (const change of [f => f.c.alive = false, f => f.c.capable = false, f => f.c.receiveAtCounter = false,
    f => f.c.sourceCurrent = false, f => f.c.serviceAvailable = false, f => f.c.clerkAtChannel = false, f => f.c.busy = true,
    f => f.c.free = false, f => f.office.clerk.status = 'dead', f => f.office.clerk.health = 49, f => f.office.clerk.assignment = 'other-duty',
    f => f.office.power = 0, f => f.office.workSeconds = 59, f => f.ports.ports[0].assignment = 'other-routing',
    f => f.ports.ports[0].outage = true, f => f.ports.backbones[0].outage = true, f => f.ports.ports[0].powerSeconds = 0]) {
    const f = fixture(); change(f); assert.equal(begin(f, 'discover'), false);
    assert.equal(f.s.endpoints.find(e => e.source.id === f.id).contact, null); assert.equal(f.s.accounts[0].spentAttention, 0);
  }
  const f = fixture(); contact(f); f.office.clerk.id = 'replacement'; assert.equal(begin(f, 'request'), false);
});
test('walking away pauses attended work; outages pause remote reply and restoration does not backfill', () => {
  const f = fixture(); contact(f); assert(begin(f, 'request')); tick(f, 25); const spent = f.ports.ports[0].spentSeconds;
  f.c.receiveAtCounter = false; tick(f, 600); assert.equal(f.s.accounts[0].job.progress, 25);
  f.c.receiveAtCounter = true; tick(f, 600); assert.equal(f.s.accounts[0].job.progress, 25); tick(f, 35);
  assert.equal(f.s.accounts[0].job.kind, 'answer'); f.ports.backbones[0].outage = true; tick(f, 600);
  assert.equal(f.s.accounts[0].job.progress, 0); f.ports.backbones[0].outage = false; tick(f, 600);
  assert.equal(f.s.accounts[0].job.progress, 0); tick(f, 120); assert.equal(f.s.accounts[0].job, null);
  assert.equal(f.ports.ports[0].spentSeconds, spent + 35 + 120);
});
test('multiple retained branches conserve ONE ordinary recipient account and the SAME civic port', () => {
  const f = fixture(), second = f.s.endpoints.find(e => e.source.branchName === 'Second Auriel Archive').source.id;
  contact(f); contact(f, second); const initial = f.s.accounts[0].attentionSeconds;
  assert(begin(f, 'request')); assert.equal(begin(f, 'request', second), false);
  assert.equal(f.ports.ports[0].assignment, f.s.accounts[0].job.id); tick(f, 60); tick(f, 120);
  assert(begin(f, 'request', second)); tick(f, 60, second); tick(f, 120, second);
  assert.equal(f.s.accounts.length, 2); assert.equal(f.s.accounts[0].attentionSeconds, initial - 240);
  assert.equal(f.ports.ports[0].spentSeconds, 480); assert.equal(f.book.records[0].god.power.reserve, 0);
});
test('a lost original work reservation is unavailable, not silently reacquired from a saved job', () => {
  const f = fixture(); contact(f); assert(begin(f, 'request')); tick(f, 25);
  f.ports.ports[0].assignment = null; const before = f.ports.ports[0].spentSeconds;
  tick(f, 600); assert.equal(f.s.accounts[0].job.progress, 25); assert.equal(f.ports.ports[0].spentSeconds, before);
  assert.equal(f.ports.ports[0].assignment, null);
});
test('partial saves, continued imports and reascension retain original identity, all debts and exact promises without renewed confirmation', () => {
  const f = fixture(); contact(f); assert(begin(f, 'request')); tick(f, 25);
  const saved = copy(f.s); f.s = Mail.normalize(saved, f.book, f.ports); assert(!f.s.invalid); assert.equal(f.s.accounts[0].job.progress, 25);
  tick(f, 35); tick(f, 120); assert(begin(f, 'receive')); tick(f, 60);
  const p = Mail.row(f.s, f.id).contact.offer; assert(begin(f, 'accept', f.id, p)); tick(f, 60); tick(f, 120); assert(begin(f, 'receive')); tick(f, 60);
  const reports = copy(f.s.reports), agreements = copy(f.book.agreements), at = f.at, accounts = copy(f.s.accounts);
  f.book.records[0].god.lifecycle.divinityState = 'divine'; f.book.records[0].god.divineCore.state = 'stable';
  assert.equal(fact(f).state, 'qualifying'); assert.deepEqual(f.book.agreements, agreements); assert.deepEqual(f.s.accounts, accounts);
  assert(f.s.endpoints.every(e => e.source.faith.confirmation.state === 'historicallyConfirmed'));
  const to = { worldId: 'world', runId: 'continued' };
  const continuedBook = Owners.rebind(copy(f.book), binding, to), continuedPorts = Ports.rebind(copy(f.ports), binding, to),
    continued = Mail.normalize(Mail.rebind(f.s, binding, to), continuedBook, continuedPorts);
  assert(!continued.invalid); assert.deepEqual(continued.reports, reports); assert.deepEqual(continued.accounts, accounts);
  assert.equal(Owners.assessment(continuedBook, { ...to, divineCapabilities: continuedBook, clock: at }, at, { alive: true, bodyEpoch: 0 })[0].fact.state, 'qualifying');
  const fresh = fixture(); assert.equal(fresh.s.accounts[0].spentAttention, 0); assert.equal(fresh.book.agreements.length, 0); assert.deepEqual(Mail.publicView(fresh.s), []);
});
test('missing, duplicated or corrupt original accounts and interfaces fail closed without historical reconstruction', () => {
  const f = fixture(); agree(f);
  for (const change of [s => s.accounts.pop(), s => s.accounts.push(copy(s.accounts[0])), s => s.accounts[0].attentionSeconds++,
    s => s.endpoints.push(copy(s.endpoints[0])), s => s.endpoints[0].source.address = 'made-up-location', s => delete s.reports,
    s => s.endpoints.find(e => e.contact).contact.officeId = null, s => s.reports[0].observedAt++, s => s.reports[0].state = 'divineSubmission',
    s => s.endpoints[0] = null, s => s.accounts[0] = null, s => s.reports[0] = null, s => s.incidents.push(null)]) {
    const s = copy(f.s); change(s); assert(Mail.normalize(s, f.book, f.ports).invalid);
  }
  assert.equal(Mail.normalize(null, f.book, f.ports), null);
  assert(Mail.normalize(f.s, f.book, { ...f.ports, ports: [], sources: [] }).invalid);
  const legacy = Owners.create(Owners.sources(f.map), binding, 0, false);
  assert.equal(Mail.create(Mail.sources(f.map, f.ports.sources), legacy, f.ports, 0), null);
});
test('received witnessed aggression takes real original breach-transmission work and persists after reascension', () => {
  const f = fixture(); agree(f); const reports = copy(f.s.reports);
  assert.equal(Mail.observe(f.s, f.book, { id: 'unseen', actorId: 'scientist', targetId: f.office.clerk.id }, { ...f.c, witness: false }, f.at), false);
  assert(Mail.observe(f.s, f.book, { id: 'strike:1', actorId: 'scientist', targetId: f.office.clerk.id, actionId: 'strike' }, f.c, f.at));
  assert.equal(f.book.agreements[0].breachedAt, null);
  assert(Mail.beginBreach(f.s, f.book, f.ports, f.id, f.office, f.c, f.at)); f.c.receiveAtCounter = false;
  tick(f, 119); assert.equal(f.book.agreements[0].breachedAt, null); tick(f, 1); assert.equal(fact(f).state, 'unverified');
  f.book.records[0].god.lifecycle.divinityState = 'divine'; assert.equal(fact(f).state, 'unverified'); assert.deepEqual(f.s.reports, reports);
  f.c.receiveAtCounter = true; assert(begin(f, 'receive')); tick(f, 60); assert.equal(f.s.reports.at(-1).state, 'receivedBreach');
});
test('final death freezes original resources, work, pending replies and received records', () => {
  const f = fixture(); contact(f); assert(begin(f, 'request')); tick(f, 60); const before = copy({ s: f.s, book: f.book, ports: f.ports, office: f.office });
  f.c.alive = false; tick(f, 5000); assert.deepEqual({ s: f.s, book: f.book, ports: f.ports, office: f.office }, before);
});
