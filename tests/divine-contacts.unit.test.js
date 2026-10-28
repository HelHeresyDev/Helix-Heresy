const { test } = require('node:test');
const assert = require('node:assert/strict');
const Contacts = require('../divine-contacts');
const Owners = require('../divine-capabilities');
const Religion = require('../religious-recognition');
const Terms = require('../divine-nonintervention');
const Faiths = require('../strategic-faiths');
const { patronSource } = require('./helpers/patron-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
const binding = { worldId: 'world', runId: 'run' };
function fixture() {
  const home = patronSource(), same = patronSource('b', 'charter:b'), other = patronSource('b', 'charter:b');
  same.branch.id = 'branch:a:b';
  other.branch.id = 'branch:b'; other.branch.traditionId = other.faith.id = 'faith:b';
  other.faith.godId = other.god.id = 'god:b'; other.god.divineCore.repeatableSignature = 'original:b'; other.godName = 'Boreal';
  const book = Owners.create({ complete: true, rows: [home, other].map(s => ({ godId: s.god.id, god: s.god, faith: s.faith })) }, binding, 0, true);
  const office = cityId => ({ id: `office:${cityId}`, cityId, institutionId: `admin:${cityId}`, active: true, channelPowered: true,
    maintenanceReady: true, power: 20, workSeconds: 3600, clerk: { id: `clerk:${cityId}`, status: 'alive', health: 100 }, assignment: null });
  const a = office('a'), b = office('b'), root = Religion.create(home, a); assert(Owners.link(book, root));
  const context = { alive: true, capable: true, receiveAtCounter: true, free: true, busy: false, serviceAvailable: true,
    sourceCurrent: true, sameGround: true, bodyEpoch: 0, branchAvailable: true, channelAvailable: true,
    representativeAtChannel: true, representativeAble: true, clerkAtChannel: true, representativeWitness: true };
  const ground = { roomId: 'original:b:checkpoint', gateId: 'gate:b', counter: { x: 10, y: 7, z: 17 } };
  const open = source => Contacts.open(book, source, b, ground, context, 0, () => ({ x: 12, y: 6, z: 17 }), root);
  return { book, root, a, b, same, other, context, ground, open };
}
function begin(f, contact, at = 0) {
  const s = Contacts.scope(f.book, contact), r = contact.religion;
  r.actor.facilitationPolicy = 'considerScopedPetition';
  const p = Terms.propose(s, r, f.b, f.context, at); assert(p); assert(Terms.begin(s, r, f.b, f.context, p, at)); return s;
}
test('original branches share one god, attention and cooldown; another god keeps a separate finite account', () => {
  const f = fixture(), same = f.open(f.same), other = f.open(f.other);
  assert(same && other); assert.equal(same.religion.god, f.root.god);
  f.root.god.power.reserve -= 13; f.root.attentionSeconds -= 70; f.root.channelAvailableAt = 100;
  assert.equal(same.religion.god.power.reserve, 87); assert.equal(same.religion.attentionSeconds, 530);
  assert.equal(same.religion.channelAvailableAt, 100); assert.equal(other.religion.attentionSeconds, 600);
  const s = Contacts.scope(f.book, same); same.religion.actor.facilitationPolicy = 'considerScopedPetition';
  const p = Terms.propose(s, same.religion, f.b, f.context, 0);
  assert.equal(Terms.begin(s, same.religion, f.b, f.context, p, 0), false);
  assert.equal(f.open(f.same), same); assert.equal(Contacts.actors(f.book).length, 2);
});
test('a permitted counter conversation needs no abdication, government or civic claim and preserves all existing root work', () => {
  const f = fixture(), contact = f.open(f.other); f.book.job = { id: 'old-home-job' };
  const local = begin(f, contact); assert.equal(local.job, contact.job); assert.equal(f.book.job.id, 'old-home-job');
  Terms.advance(local, contact.religion, f.b, f.context, 180);
  assert.equal(contact.job, null); assert.equal(f.book.job.id, 'old-home-job'); assert.equal(f.book.agreements.length, 1);
  assert.equal(f.book.reports[0].branchId, f.other.branch.id); assert.equal(f.root.god.power.reserve, 100);
  assert.equal(contact.religion.god.power.reserve, 93); assert.equal(f.b.workSeconds, 3420);
  assert.equal(f.b.clerk.assignment, null); assert.equal(contact.religion.covenants.length, 0);
});
test('the existing foreign reception adapter debits actual shared power/work and retains its original clerk without a government', () => {
  const Regional = require('../regional-government'), f = fixture(), g = { id: 'gate:b', cityId: 'b', institutionId: 'admin:b',
    clerk: f.b.clerk, powerSeconds: 200, receptionWorkSeconds: 2000, receptionAssignment: null };
  const contact = Contacts.open(f.book, f.other, Regional.office(g), f.ground, f.context, 0, () => ({ x: 12, y: 6, z: 17 }));
  contact.religion.actor.facilitationPolicy = 'considerScopedPetition'; const s = Contacts.scope(f.book, contact);
  assert(Regional.useOffice(g, office => {
    assert.equal(office.clerk, g.clerk);
    const p = Terms.propose(s, contact.religion, office, f.context, 0);
    return Terms.begin(s, contact.religion, office, f.context, p, 0);
  }));
  assert.equal(g.powerSeconds, 199); assert.equal(g.receptionWorkSeconds, 2000); assert.equal(g.receptionAssignment, contact.job.id);
  Regional.useOffice(g, office => Terms.advance(s, contact.religion, office, f.context, 180));
  assert.equal(g.powerSeconds, 19); assert.equal(g.receptionWorkSeconds, 1820); assert.equal(g.receptionAssignment, null);
  assert.equal(g.clerk.assignment, null); assert.equal(f.book.agreements.length, 1); assert.equal(g.regionalGovernment, undefined);
  assert.equal(Regional.office(g).workSeconds, 19); assert.equal(f.book.records[1].god.power.reserve, 93);
});
test('absence, closed services, wrong original branch and missing physical post do not create contacts', () => {
  for (const key of ['alive', 'capable', 'receiveAtCounter', 'free', 'sourceCurrent', 'serviceAvailable']) {
    const f = fixture(); f.context[key] = false; assert.equal(f.open(f.same), null); assert.equal(f.book.contacts.length, 0);
  }
  const f = fixture(); assert.equal(f.open(f.root.source), null);
  f.b.assignment = 'other-original-work'; assert.equal(f.open(f.other), null); f.b.assignment = null;
  assert.equal(Contacts.open(f.book, f.other, f.b, f.ground, f.context, 0, () => null), null);
  assert.equal(f.book.records[1].linked, false);
});
test('original representative refusal remains stable, does not claim a divine reply or create new consent', () => {
  const f = fixture(), contact = f.open(f.same), s = Contacts.scope(f.book, contact);
  contact.religion.actor.facilitationPolicy = 'declinePoliticalPetitions';
  assert.equal(Terms.propose(s, contact.religion, f.b, f.context, 0), null);
  assert.match(contact.reply.text, /representative declines/); assert.equal(f.book.proposals.length, 0);
  const saved = Owners.normalize(copy(f.book)); Contacts.hydrate(saved, f.root);
  const c = saved.contacts[0]; assert.equal(Terms.propose(Contacts.scope(saved, c), c.religion, f.b, f.context, 1000), null);
  assert.equal(c.religion.god.power.reserve, 100); assert.equal(saved.reports.length, 0);
});
test('partial work, original identity, outages, absence and branch-specific exact proposals survive hydration', () => {
  const f = fixture(), contact = f.open(f.other), s = begin(f, contact);
  Terms.advance(s, contact.religion, f.b, f.context, 25);
  const saved = copy(f.book); assert.equal(saved.contacts[0].religion.god, undefined);
  assert.equal(saved.contacts[0].religion.attentionSeconds, undefined);
  f.book = Owners.normalize(saved); Contacts.hydrate(f.book, f.root); const c = f.book.contacts[0], scope = Contacts.scope(f.book, c);
  f.context.sameGround = false; Terms.advance(scope, c.religion, f.b, f.context, 100);
  assert.equal(c.job.progress, 25); f.context.sameGround = true; Terms.advance(scope, c.religion, f.b, f.context, 200);
  assert.equal(c.job.progress, 25); Terms.advance(scope, c.religion, f.b, f.context, 355);
  assert.equal(c.job, null); assert.equal(f.book.agreements.length, 1); assert.equal(c.religion.attentionSeconds, 420);
  assert.equal(c.religion.god.power.reserve, 93); assert.equal(c.religion.actor.id, `${f.other.branch.id}:representative`);
});
test('unreceived breach travels through only its own branch while other contacts and their held accounts remain independent', () => {
  const f = fixture(), one = f.open(f.same), two = f.open(f.other);
  const s1 = begin(f, one); Terms.advance(s1, one.religion, f.b, f.context, 180);
  const s2 = begin(f, two, 180); Terms.advance(s2, two.religion, f.b, f.context, 360);
  const held = Terms.publicView(f.book);
  assert(Terms.observe(s1, one.religion, { id: 'original-strike', actionId: 'strike', actorId: 'scientist', targetId: one.religion.actor.id }, f.context, 400));
  assert.equal(Terms.advance(s2, two.religion, f.b, f.context, 400), false); assert.equal(two.job, null);
  assert(Terms.advance(s1, one.religion, f.b, f.context, 400));
  f.context.sameGround = false; Terms.advance(s1, one.religion, f.b, f.context, 520);
  assert.equal(f.book.agreements[0].breachedAt, 520); assert.equal(f.book.agreements[1].breachedAt, null);
  assert.deepEqual(Terms.publicView(f.book), held); assert.equal(one.religion.god.power.reserve, 86); assert.equal(two.religion.god.power.reserve, 93);
  f.context.sameGround = true; assert(Terms.receive(s1, one.religion, f.context, 521));
  assert.equal(f.book.reports.at(-1).state, 'receivedBreach'); assert.match(Terms.evidence(f.book).at(-1).seriesId, /branch:a:b/);
});
test('continued imports rebind all contact references without refilling; independent runs inherit none', () => {
  const f = fixture(), c = f.open(f.other); begin(f, c);
  const book = Owners.rebind(copy(f.book), binding, { worldId: 'copied-world', runId: 'continued' });
  Contacts.hydrate(book); const other = book.contacts[0]; assert(!other.invalid);
  assert.equal(other.religion.godRef.runId, 'continued'); assert.equal(other.religion.god.power.reserve, 93);
  assert.equal(other.religion.attentionSeconds, 420); assert.equal(other.job.progress, 0);
  assert.equal(Owners.create({ complete: true, rows: f.book.originals }, { ...binding, runId: 'new' }, 0, true).contacts.length, 0);
});
test('known contacts retain received dates rather than revealing unseen bodies, private resources or the uncontacted roster', () => {
  const f = fixture(), c = f.open(f.other), known = Contacts.known(f.book);
  assert.equal(known.length, 1); assert.equal(known[0].openedAt, 0);
  c.religion.actor.health = 0; c.religion.actor.status = 'dead'; c.religion.actor.workSeconds = 0;
  c.religion.god.power.reserve = 0; c.religion.attentionSeconds = 0;
  assert.deepEqual(Contacts.known(f.book), known);
  for (const key of ['reserve', 'attentionSeconds', 'health', 'divineCore', 'god:a', 'originals'])
    assert.equal(JSON.stringify(known).includes(key), false);
  assert.deepEqual(Terms.publicView(f.book), []);
});
test('missing saved contacts or references cannot respawn original people or refill missing accounts', () => {
  const f = fixture(), c = f.open(f.other); begin(f, c); Terms.release(Contacts.scope(f.book, c), c.religion, f.b);
  f.book.contacts = []; assert.equal(f.open(f.other), null); assert.equal(f.book.records[1].god.power.reserve, 93);
  const g = fixture(); g.open(g.other); const missing = copy(g.book); delete missing.contacts[0].religion.godRef;
  const restored = Owners.normalize(missing); Contacts.hydrate(restored);
  assert.equal(restored.contacts[0].invalid, true); assert.equal(Contacts.actors(restored).length, 0);
  assert.equal(Contacts.open(restored, g.other, g.b, g.ground, g.context, 0, () => ({ x: 12, y: 6, z: 17 })), null);
});
test('legacy saved attention migrates once with the actual spent account; a fresh branch never recreates missing budget', () => {
  const f = fixture(), legacy = Owners.create({ complete: true, rows: f.book.originals }, binding, 0, false);
  const old = Religion.create(f.root.source, f.a); old.attentionSeconds = 90; old.channelAvailableAt = 1000; old.god.power.reserve = 10;
  assert(Owners.preserveContact(legacy, old)); assert.equal(old.attentionSeconds, 90); assert.equal(legacy.records[0].channelAvailableAt, 1000);
  const book = copy(f.book); delete book.records[0].attentionInitialized; delete book.records[0].attentionSeconds;
  delete book.records[0].channelAvailableAt;
  const restored = Owners.normalize(book), fresh = Religion.create(f.same, f.b);
  assert(Owners.link(restored, fresh, { newContact: true })); assert.equal(fresh.attentionSeconds, 0);
  assert.equal(fresh.channelAvailableAt, Infinity);
});
test('public confirmed branch discovery does not require founding patron status, disclose hidden gods or invent migrant branches', () => {
  const f = fixture(), sources = [f.same, f.other], map = {
    strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 3000, physicalJurisdictionExists: true }] },
    cityGovernments: { governments: [{ cityId: 'b', charter: { id: 'charter:b' } }] },
    publicReligiousInstitutionHistoryDirectory: { currentBranchRows: sources.map(s => copy(s.branch)), traditionRows: sources.map(s => ({ id: s.faith.id, kind: 'confirmedDivineFaith' })) },
    strategicDivineHistory: { currentGodRows: sources.map(s => copy(s.god)), currentFaithRows: sources.map(s => ({ faithId: s.faith.id, confirmationState: 'activelyConfirmed' })) },
    publicReligionDirectory: { gods: sources.map(s => ({ id: s.god.id, name: s.godName, communication: { methods: s.communicationMethods } })) }
  };
  // Supply the public directory dependency, not a replacement discovery result.
  const context = { HelixStrategicWorld: require('../strategic-world'), HelixThemeContent: require('../theme-content'),
    HelixStrategicFaiths: { ...Faiths, publicFaithDirectory: () => ({ faiths: sources.map(s => s.faith) }) } };
  require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../religious-recognition'), 'utf8'), context);
  const discover = context.HelixReligiousRecognition.branchSources;
  assert.equal(discover(map, 'b').length, 2);
  map.publicReligiousInstitutionHistoryDirectory.currentBranchRows[0].originalCityId = 'a';
  assert.equal(discover(map, 'b').length, 1);
  map.publicReligionDirectory.gods = []; assert.equal(discover(map, 'b').length, 0);
});
