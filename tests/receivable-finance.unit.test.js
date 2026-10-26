const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../receivable-finance');
const T = require('../intercity-trade');
const N = require('../network-operations');
const C = require('../network-capabilities');
const Carrier = require('../local-exchange-carrier');
const { inputs } = require('./helpers/municipal-fuel-source');
const Definitions = require('../strategic-non-state-networks').NETWORK_DEFINITIONS;
const Communications = require('../civic-communications');
const { addCommunications } = require('./helpers/civic-communication-source');
const copy = x => JSON.parse(JSON.stringify(x));
const defs = [{ id: 'steel', section: 'resources', key: 'steel', basePrice: 100, supply: 50, liquidity: 10, buyable: true, sellable: true }];
function fixture(collect = true) {
  const { map } = inputs(), binding = { worldId: 'w', runId: 'r' }, profile = cityId => ({ cityId, cityName: cityId,
    productionSources: [], workshopCapacity: 1, listings: { steel: { targetSupply: 50, targetDemand: 1 } } });
  const route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 38, supportCapable: true, continuity: 'operational' };
  const trade = T.create(profile('a'), [profile('b')], [route], [{ corridorId: 'ab', approvals: ['a', 'b'].map(cityId => ({ cityId, allowed: true })) }], defs, 0);
  const stack = { id: 'original-lot', section: 'resources', key: 'steel', quantity: 3, reservedTaskId: '' };
  const offer = T.exportOffer(trade, 'wholesaler:ab', 'steel', stack, 3, defs, 0, 2), sh = T.bookExport(trade, offer, stack, defs, 0, 2).shipment;
  const con = { id: 'original-consignment', exportShipmentId: sh.id, direction: 'outbound', quantity: sh.quantity, total: offer.net, status: collect ? 'awaitingExport' : 'awaitingCarrier' };
  sh.consignmentId = con.id;
  if (collect) { sh.collected = true; assert.equal(T.receiveExport(trade, sh.id, stack, 0), offer.localFreight); }
  const networks = N.create(N.sources(map, 'original-finance'), binding, 0), s = F.create(F.sources(map, 'a', Definitions), binding, 'a', 0);
  const wallet = { money: 1000 }, c = { ...binding, alive: true, capable: true, local: true, atCounter: true, clerkPresent: true, lineOfSight: true,
    authorizedSeller: true, cityId: 'a', channel: true, otherBusy: false, violence: false, bodyEpoch: 0,
    cell: { x: 17, y: 8, z: 6 }, officeId: 'original-counter', counterWork: 3600, counterPower: 12, counterAssignment: null, wallet };
  const f = { s, networks, trade, consignments: [con], sh, con, stack, offer, wallet, c, map, at: 0, home: { steel: { supply: 50, demand: 1 } }, supplier: Carrier.support(Carrier.create('a')).supplier };
  f.a = () => f.networks.accounts.find(a => a.id === 'branch:a');
  f.h = { alive: () => c.alive, counterWork: (dt, id, activate) => { c.counterWork -= dt; if (activate) c.counterPower--; c.counterAssignment = id; },
    releaseCounter: id => { if (c.counterAssignment === id) c.counterAssignment = null; } };
  f.tick = seconds => { f.at += seconds; return F.advance(f.s, f.networks, f.trade, f.consignments, defs, () => c, f.at, f.h); };
  f.quote = (amount = 100) => F.quote(f.s, f.networks, f.trade, f.consignments, defs, c, f.s.sources[0].id, sh.id, amount, f.at);
  f.begin = (quote = f.quote()) => F.begin(f.s, f.networks, f.trade, f.consignments, defs, c, quote, f.at);
  f.deliver = () => { T.advance(f.trade, 3 * 3600, f.home, f.supplier, defs); assert.equal(sh.delivered, true); };
  return f;
}
test('financiers require actual original finance functions, lawful original premises and owned conserved accounts, not commercial labels or a city treasury', () => {
  const f = fixture(); assert.equal(f.s.sources.length, 1);
  for (const change of [m => m.strategicNonStateNetworkHistory.networkRows[0].sourceDefinitionId = 'non-state-network.grim.continuity-combine',
    m => m.strategicNonStateNetworkHistory.branchRows[0].consolidatedIntoBranchId = 'other',
    m => m.strategicNonStateNetworkHistory.branchRows[0].organizationForm = 'contractDepot',
    m => m.strategicNonStateNetworkHistory.networkRows[0].organizationalContinuity = false]) {
    const map = copy(f.map); change(map); assert.deepEqual(F.sources(map, 'a', Definitions), []);
  }
  assert.equal(f.a().money, 240); assert.equal(f.trade.neighbors[0].treasury, 10000 - f.offer.gross);
});
test('only the actual collected exact legal private funded receivable qualifies; no quote, municipal cargo, substituted package, duplicate pledge or delivered sale is financed', () => {
  assert.equal(fixture(false).quote(), null);
  for (const mutate of [f => f.sh.cargoManifest.id = 'substitute', f => f.sh.cargoManifest.cityOwnerId = 'a',
    f => f.sh.playerEscrow--, f => f.sh.delivered = true, f => f.trade.operators[0].shipment = null,
    f => f.con.status = 'failed', f => f.sh.receivableAssignment = { id: 'earlier-claim' }]) {
    const f = fixture(); mutate(f); assert.equal(f.quote(), null);
  }
});
test('quote reserves nothing; exact review, own funds, 60-percent cover and fixed discount constrain the advance', () => {
  const f = fixture(), before = copy([f.networks, f.trade, f.wallet]); const q = f.quote();
  assert.equal(q.claimAmount, 110); assert.equal(q.discount, 10); assert.deepEqual([f.networks, f.trade, f.wallet], before);
  assert.equal(f.begin({ ...q, advance: 101 }), false);
  assert.equal(f.quote(200), null); f.a().money = 99; assert.equal(f.begin(q), false);
  f.a().money = 240; f.at = 601; assert.equal(f.begin(q), false);
});
test('partial acceptance reserves only the same financier capital, consumes actual original work and counter activation, persists and pays no early advance', () => {
  const f = fixture(); assert.equal(f.begin(), true); assert.equal(f.a().money, 140); assert.equal(f.wallet.money, 1000);
  f.tick(23); assert.equal(f.s.claims.length, 0); assert.equal(f.s.job.progress, 23); assert.equal(f.c.counterPower, 11);
  f.s = F.normalize(f.s); f.networks = N.normalize(f.networks); f.tick(37);
  assert.equal(f.wallet.money, 1100); assert.equal(f.s.claims.length, 1); assert.equal(f.a().operator.workSeconds, 14340);
  assert.equal(f.a().terminal.powerSeconds, 14340); assert.equal(f.c.counterWork, 3540); assert.equal(f.c.counterPower, 11);
  assert.equal(f.sh.receivableAssignment.id, f.s.claims[0].id); assert.equal(f.sh.receivableReservation, undefined);
  assert.equal(f.quote(), null); assert.equal(f.sh.playerEscrow, f.offer.net);
});
test('movement, changed body/terms, original staff loss and actual receipt before completion cancel without spending a second advance or refunding counter work', () => {
  for (const mutate of [f => f.c.cell.y++, f => f.c.bodyEpoch++, f => f.a().operator.status = 'dead',
    f => f.c.authorizedSeller = false, f => f.a().source.charter.scope = [], f => f.sh.delivered = true,
    f => f.c.counterClerkAssignment = 'other-original-work']) {
    const f = fixture(); f.begin(); f.tick(20); mutate(f); f.tick(40);
    assert.equal(f.wallet.money, 1000); assert.equal(f.a().money, 240); assert.equal(f.s.job, null);
    assert.equal(f.s.claims.length, 0); assert.equal(f.sh.receivableReservation, undefined); assert.equal(f.c.counterWork, 3580);
  }
});
test('an actual communications outage pauses the same reserved acceptance without new spending and resumes without replayed work', () => {
  const f = fixture(); let available = true; f.c.communicate = () => available;
  f.begin(); f.tick(23); const before = copy([f.wallet, f.a(), f.c.counterWork, f.c.counterPower]); available = false;
  f.tick(100); assert.equal(f.s.job.progress, 23); assert.deepEqual([f.wallet, f.a(), f.c.counterWork, f.c.counterPower], before);
  available = true; f.tick(37); assert.equal(f.wallet.money, 1100); assert.equal(f.s.claims.length, 1);
});
test('actual adopted original civic path authenticates branch finance work, pauses on outage and preserves old unexpanded scopes', () => {
  for (const enrolled of [false, true]) {
    const f = fixture(), binding = { worldId: 'w', runId: 'r' }, city = { cityId: 'a', populationSourceId: 'population:a', charterId: 'charter:a',
      institutions: [{ role: 'publicWorksAndProvisioning', id: 'original-works:a' }] };
    const map = addCommunications(f.map, city), comm = Communications.create(Communications.sources(map, Definitions), binding, 0);
    f.networks = N.create(N.sources(map, 'original-finance'), binding, 0);
    const rule = { ...binding, id: 'rule:a', source: city, handoverId: 'original-handover:a', operatorWorkSeconds: 28800 };
    const c = { ...f.c, reportersPresent: true, authority: true, sourceCurrent: true, institutionsAvailable: true };
    const port = comm.ports.find(p => comm.sources.some(r => r.id === p.id && r.kind === 'municipal'));
    assert.equal(Communications.begin(comm, rule, f.networks, c, port.id, enrolled ? ['receivableFinance'] : ['technicalGuidance'], false, 0), true);
    Communications.advance(comm, rule, f.networks, () => c, 60); f.at = 60;
    f.c.communicate = (data, at) => Communications.transfer(comm, f.networks, Communications.packet(comm, binding, data), at);
    assert.equal(f.begin(), true); f.tick(23); const before = copy([f.a(), f.wallet, f.c.counterWork, port.powerSeconds]); port.outage = true;
    f.tick(100);
    if (enrolled) {
      assert.equal(f.s.job.progress, 23); assert.deepEqual([f.a(), f.wallet, f.c.counterWork, port.powerSeconds], before);
      port.outage = false; f.tick(37); assert.equal(comm.sessions.find(s => s.purpose === 'receivableFinance').through, 60);
    } else {
      assert.equal(f.s.job, null); assert.deepEqual(comm.profiles[0].purposes, ['technicalGuidance']); assert.equal(port.powerSeconds, before[3]);
    }
    assert.equal(f.wallet.money, 1100); assert.equal(f.s.claims.length, 1);
  }
});
test('foreign receipt distributes the real original escrow once: seller gets remainder, financier recovers principal plus discount, and no ordinary settlement bypass exists', () => {
  const f = fixture(); f.begin(); f.tick(60); const dated = copy(f.s.report); f.deliver();
  assert.equal(T.settleExport(f.trade, f.sh.id), 0); assert.equal(f.sh.settled, undefined);
  const paid = F.settle(f.s, f.networks, f.trade, f.sh.id, 3 * 3600); assert.equal(paid.assigned, 110); assert.equal(paid.seller, f.offer.net - 110);
  f.wallet.money += paid.seller;
  assert.equal(f.wallet.money, 1000 + f.offer.net - 10); assert.equal(f.a().money, 250);
  assert.equal(f.sh.playerEscrow, 0); assert.equal(f.s.claims[0].discountEarned, 10); assert.deepEqual(f.s.report, dated);
  assert.equal(F.settle(f.s, f.networks, f.trade, f.sh.id, 4 * 3600), null); assert.equal(T.settleExport(f.trade, f.sh.id), 0);
});
test('real transport failure/stranding consumes original support, not the claim, buyer escrow or unrelated money; there is no interest, personal debt, seizure or invented loss', () => {
  const f = fixture(); f.begin(); f.tick(60); T.advance(f.trade, 3600, f.home, f.supplier, defs);
  f.trade.operators[0].route.supportCapable = false;
  T.advance(f.trade, 40 * 3600, f.home, f.supplier, defs);
  assert.equal(f.sh.delivered, false); assert.equal(f.sh.cargoManifest.quantity, 3); assert.equal(f.sh.playerEscrow, f.offer.net);
  assert.equal(F.settle(f.s, f.networks, f.trade, f.sh.id, 40 * 3600), null);
  assert.equal(f.a().money, 140); assert.equal(f.wallet.money, 1100); assert.equal(f.s.claims[0].claimAmount, 110);
  assert.equal(f.s.claims[0].status, 'active'); assert.equal(f.trade.operators[0].crew.every(c => c.status === 'alive'), true);
});
test('missing original creditor records retain reserved or settled cash in original-owner custody rather than spawning an account, paying the scientist or erasing the claim', () => {
  const f = fixture(); f.begin(); f.tick(20); const original = f.a(); f.networks.accounts = f.networks.accounts.filter(a => a.id !== original.id);
  f.tick(1); assert.equal(f.s.refunds[0].amount, 100); assert.equal(f.wallet.money, 1000);
  f.networks.accounts.push(original); f.tick(1); assert.equal(original.money, 240); f.tick(1); assert.equal(original.money, 240);
  const g = fixture(); g.begin(); g.tick(60); g.deliver(); const owner = g.a(); g.networks.accounts = g.networks.accounts.filter(a => a.id !== owner.id);
  const split = F.settle(g.s, g.networks, g.trade, g.sh.id, 10800); assert.equal(split.assigned, 110); assert.equal(g.s.claims[0].heldProceeds, 110);
  g.networks.accounts.push(owner); g.tick(1); assert.equal(owner.money, 250); assert.equal(g.s.claims[0].heldProceeds, 0);
});
test('missing finance accounting cannot release an assigned receivable, and current contract refusal cannot retroactively confiscate old proceeds', () => {
  const f = fixture(); f.begin(); f.tick(60); f.deliver();
  assert.equal(F.settle(null, f.networks, f.trade, f.sh.id, 10800), null); assert.equal(T.settleExport(f.trade, f.sh.id), 0);
  f.a().source.charter.scope = []; f.a().operator.status = 'dead';
  assert.equal(F.settle(f.s, f.networks, f.trade, f.sh.id, 10800).assigned, 110); assert.equal(f.a().money, 250);
});
test('source-bound private accounting references actual assigned claims without new cash, mandates or worldwide qualification; dated reports reveal only agreed terms', () => {
  const f = fixture(); f.begin(); f.tick(60); F.register(f.s, f.networks); F.register(f.s, f.networks);
  const assessment = C.assess(f.networks.capabilityAccounting, f.networks, 'original-network');
  assert.equal(assessment.references.filter(r => r.assetId === f.s.claims[0].id).length, 1); assert.equal(assessment.strategicComplete, false);
  assert.equal(f.networks.accounts.every(a => !a.mandate), true); assert.doesNotMatch(JSON.stringify(f.s.report), /initialMoney|workSeconds|original-undisclosed|populationSourceId|fuelKm/);
  const copyRun = F.rebind(f.s, { worldId: 'w', runId: 'r' }, { worldId: 'w', runId: 'copy' }); assert.deepEqual(copyRun.claims, f.s.claims);
  assert.equal(F.rebind(f.s, { worldId: 'w', runId: 'fresh' }, { worldId: 'w', runId: 'copy' }), null);
});
test('fine and coarse acceptance agree; final death freezes the reserved original funds, attendance and creditor rights', () => {
  const a = fixture(), b = fixture(); a.begin(); b.begin(); a.tick(60); for (let i = 0; i < 60; i++) b.tick(1);
  assert.deepEqual(a.s, b.s); assert.deepEqual(a.networks, b.networks); assert.deepEqual(a.wallet, b.wallet);
  const f = fixture(); f.begin(); f.tick(23); f.c.alive = false; const frozen = copy([f.s, f.networks, f.trade, f.wallet]);
  f.tick(120); assert.deepEqual([f.s, f.networks, f.trade, f.wallet], frozen);
});
test('malformed retained finance records stay unknown instead of throwing, refreshing capital or losing shipment protection', () => {
  const f = fixture(); f.begin(); f.tick(60); f.deliver();
  for (const corrupt of [s => s.claims.push(copy(s.claims[0])), s => s.claims[0] = null,
    s => s.refunds = [null], s => s.serial = -1, s => s.sources.push(copy(s.sources[0])), s => s.claims[0].heldProceeds = 111]) {
    const saved = copy(f.s); corrupt(saved); const invalid = F.normalize(saved);
    assert.equal(invalid.invalid, true); assert.equal(F.account(invalid, f.networks, 'missing'), null);
    assert.equal(T.settleExport(f.trade, f.sh.id), 0); assert.equal(f.sh.playerEscrow, f.offer.net);
  }
});
