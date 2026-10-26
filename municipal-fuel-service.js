(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./local-market-production') : root.HelixLocalMarketProduction);
  if (node) module.exports = api;
  if (root) root.HelixMunicipalFuelService = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Production) {
  'use strict';
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const bound = (a, b) => Boolean(a && b && a.worldId === b.worldId && a.runId === b.runId);
  const KEY = 'arcaneFeedstock', SIGN = 120, REPORT = 60, BROKER = 4, FREIGHT = 8, DUTY = 28800;
  const ENTRY = Object.freeze({ x: 19, y: 16, z: 6 }), DOCK = Object.freeze({ x: 17, y: 16, z: 6 });
  const TRUCK = Object.freeze({ x: 19, y: 17, z: 6 });
  const TERMS = 'Standing local powerworks fuel procurement and delivery only. Market-price and per-trip ceilings apply. Paid cargo becomes municipal property and paid trips continue after cancellation. The provider may stop new work for unavailable support, insufficient prepaid funds or an authenticated surviving driver\'s witnessed attack account. No sovereignty, immunity, worship, municipal vehicle ownership or wider network nonintervention is agreed.';
  const LIMITS = 'One original city powerworks and an optional local service. Original market stock, producer trucks/drivers, procurement office, fuel, food, duty and municipal operator work remain finite. A contract, cancellation or shipment is not energy, government defeat, network-wide resolution or an ending. Reports are dated personal receipts.';
  const validSource = s => s && ['id', 'cityId', 'populationSourceId', 'powerId', 'branchId', 'networkId', 'facilityId', 'label'].every(k => typeof s[k] === 'string' && s[k]);
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const able = d => d?.status === 'alive' && d.health >= 50 && (d.fatigue || 0) < 80
    && d.fuelDutySeconds > 0 && d.fuelProvisionsSeconds > 0;
  function sources(map, city, production, definitions) {
    const h = map?.strategicNonStateNetworkHistory, row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === city?.cityId);
    const facility = production?.facilities?.find(f => f.kind === 'crystalWorks' && f.condition >= 50 && f.labour > 0 && f.utilities > 0
      && f.routeOpen && f.expertise.includes('crystalPreparation') && production.workshops.some(w => w.id === KEY && w.facilityId === f.id && !w.accountLost));
    if (!h || !facility || production.cityId !== city.cityId || !row?.physicalJurisdictionExists || row.currentPopulation < 32
      || row.assetId !== city.populationSourceId || row.physicalCondition === 'ruined'
      || !production.sources.some(s => s.family === 'manaCrystals')) return [];
    return h.branchRows.filter(b => b.currentCityId === city.cityId && b.publicPhysicalPresence && !b.consolidatedIntoBranchId
      && b.operationalStatus === 'active' && !['ruined', 'destroyed'].includes(b.physicalCondition)
      && ['registeredOffice', 'contractDepot'].includes(b.organizationForm) && ['licensed', 'chartered'].includes(b.currentStanding)
      && ['functional', 'strong', 'regionalHub'].includes(b.currentCapacityBand)).flatMap(b => {
      const n = h.networkRows.find(n => n.networkId === b.networkId), def = definitions?.find(d => d.id === n?.sourceDefinitionId);
      return n?.category === 'commercial' && n.organizationalContinuity && !['defunct', 'dormant'].includes(n.lifecycleStatus)
        && ['established', 'strong', 'exceptional'].includes(n.actualCapacityBand) && def?.roles.includes('procurement')
        ? [{ id: `${b.id}:local-power-fuel`, cityId: city.cityId, populationSourceId: city.populationSourceId, powerId: city.powerId,
          branchId: b.id, networkId: n.networkId, facilityId: facility.id, label: b.publicName }] : [];
    }).sort((a, b) => a.id.localeCompare(b.id));
  }
  function create(sourceRows, rule, at, production) {
    if (!rule?.worldId || !rule.runId || !sourceRows?.length || !sourceRows.every(validSource) || !production?.trucks?.length
      || sourceRows.some(r => r.cityId !== rule.source.cityId || r.populationSourceId !== rule.source.populationSourceId || r.powerId !== rule.source.powerId)) return null;
    const s = { worldId: rule.worldId, runId: rule.runId, id: `${rule.id}:fuel-service`, ruleId: rule.id,
      sources: copy(sourceRows), lastAt: at, serial: 0, quote: null, job: null, contract: null, balance: 0,
      deposited: 0, refunded: 0, spent: 0, mission: null, missions: [], contracts: [], deliveries: [],
      notices: [], noticeJob: null, suspended: [], hold: '', report: null };
    s.originalDrivers = production.trucks.map(t => ({ truckId: t.id, driverId: t.driver.id, radioId: t.driver.cabRadio?.id || null }));
    for (const t of production.trucks) if (t.driver.fuelDutySeconds == null) {
      t.driver.fuelDutySeconds = Math.max(0, DUTY * (1 - Math.min(80, t.driver.fatigue || 0) / 80));
      t.driver.fuelProvisionsSeconds = 0;
    }
    return s;
  }
  function normalize(s) {
    if (s == null) return null;
    if (s.invalid || !s.worldId || !s.runId || !s.ruleId || !s.id || !Array.isArray(s.sources) || !s.sources.length || !s.sources.every(validSource)
      || !['lastAt', 'balance', 'deposited', 'refunded', 'spent'].every(k => Number.isFinite(s[k]) && s[k] >= 0)
      || !['missions', 'contracts', 'deliveries', 'notices', 'suspended', 'originalDrivers'].every(k => Array.isArray(s[k]))
      || Math.abs(s.deposited - s.refunded - s.spent - s.balance) > 1e-6
      || new Set(s.originalDrivers.map(r => r.truckId)).size !== s.originalDrivers.length
      || new Set(s.originalDrivers.map(r => r.driverId)).size !== s.originalDrivers.length
      || s.originalDrivers.some(r => !r.truckId || !r.driverId)
      || s.mission && (!Number.isInteger(s.mission.quantity) || s.mission.quantity < 1 || !Number.isInteger(s.mission.remaining)
        || s.mission.remaining < 0 || s.mission.remaining > s.mission.quantity))
      return { worldId: s.worldId || '', runId: s.runId || '', invalid: true };
    return copy(s);
  }
  function rebind(s, from, to) { s = normalize(s); return bound(s, from) ? { ...s, worldId: to.worldId, runId: to.runId } : null; }
  function settings(v) { return v && Number.isInteger(v.threshold) && v.threshold >= 1 && v.threshold <= 24
    && Number.isInteger(v.quantity) && v.quantity >= 1 && v.quantity <= 12
    && ['maxUnitPrice', 'maxTripSpend'].every(k => Number.isFinite(v[k]) && v[k] > 0 && v[k] <= 10000); }
  const sourceFor = (s, id) => s.sources.find(r => r.id === id);
  function account(s, networks, sourceId) {
    const source = s && !s.invalid && sourceFor(s, sourceId), a = networks?.accounts?.find(a => a.id === source?.branchId && !a.lost);
    return source && bound(s, networks) && a?.source.networkId === source.networkId && a.source.cityId === source.cityId
      && a.source.populationSourceId === source.populationSourceId && a.source.hostId === a.id ? a : null;
  }
  function target(s, rule) { return bound(s, rule) && s.ruleId === rule.id && s.sources.every(r => r.cityId === rule.source.cityId
    && r.powerId === rule.source.powerId && r.populationSourceId === rule.source.populationSourceId); }
  function personal(s, rule, c) { return Boolean(s && !s.invalid && target(s, rule) && c.alive && c.capable && c.authority && c.atCounter
    && c.local && c.reportersPresent && !c.otherBusy && !c.violence && !rule.command && !rule.recharge); }
  function working(p, source) {
    const f = p?.facilities?.find(f => f.id === source?.facilityId);
    return p?.cityId === source?.cityId && f?.condition >= 50 && f.labour > 0 && f.utilities > 0 && f.routeOpen
      && f.expertise.includes('crystalPreparation') && p.workshops.some(w => w.id === KEY && w.facilityId === f.id && !w.accountLost);
  }
  function offer(s, rule, networks, p, c, sourceId, limits, at) {
    if (!s || !personal(s, rule, c) || s.job || s.mission && !s.mission.returnedAt || s.contract && !s.contract.cancelledAt
      || s.balance > 0 || !settings(limits) || s.suspended.some(r => r.sourceId === sourceId)) return null;
    const source = sourceFor(s, sourceId), a = source && account(s, networks, sourceId);
    if (!a || !a.source.charter.scope.includes('ownNewContracts') || !working(p, source) || a.operator.status !== 'alive' || a.operator.assignment || a.operator.workSeconds < SIGN
      || a.terminal.powerSeconds < SIGN || rule.operatorWorkSeconds < SIGN) return null;
    s.quote = { sourceId, limits: copy(limits), handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch,
      charterId: a.source.charter.id, terms: TERMS, brokerFee: BROKER, freight: FREIGHT, at, expiresAt: at + 3600 };
    return copy(s.quote);
  }
  function begin(s, rule, networks, p, c, kind, expected, deposit, wallet, at) {
    if (!personal(s, rule, c) || s.job || rule.operatorServiceAssignment) return false;
    const sourceId = kind === 'sign' ? s.quote?.sourceId : s.contract?.sourceId;
    const a = account(s, networks, sourceId), seconds = kind === 'sign' ? SIGN : REPORT;
    if (!['sign', 'report'].includes(kind) || !a || a.operator.status !== 'alive' || a.operator.assignment
      || a.operator.workSeconds < seconds || a.terminal.powerSeconds < seconds || rule.operatorWorkSeconds < seconds) return false;
    if (kind === 'sign' && (!s.quote || JSON.stringify(expected) !== JSON.stringify(s.quote) || at > s.quote.expiresAt
      || s.contract && !s.contract.cancelledAt || s.balance > 0 || s.mission && !s.mission.returnedAt
      || s.suspended.some(r => r.sourceId === sourceId)
      || !a.source.charter.scope.includes('ownNewContracts')
      || !working(p, sourceFor(s, sourceId)) || s.quote.charterId !== a.source.charter.id || s.quote.handoverId !== rule.handoverId || s.quote.bodyEpoch !== c.bodyEpoch
      || !Number.isFinite(deposit) || deposit <= 0 || wallet.money < deposit)) return false;
    s.job = { id: `${s.id}:attendance:${++s.serial}`, kind, sourceId, at, progress: 0, seconds, cell: copy(c.cell),
      bodyEpoch: c.bodyEpoch, handoverId: rule.handoverId, deposit, quote: kind === 'sign' ? copy(s.quote) : null };
    a.operator.assignment = rule.operatorServiceAssignment = s.job.id; return true;
  }
  function release(s, rule, networks) {
    const j = s.job, a = j && account(s, networks, j.sourceId);
    if (a?.operator.assignment === j?.id) a.operator.assignment = null;
    if (rule.operatorServiceAssignment === j?.id) rule.operatorServiceAssignment = null;
    s.job = null;
  }
  function action(s, rule, networks, c, wallet, kind, amount = 0) {
    if (!s || !personal(s, rule, c) || s.job || !s.contract) return false;
    if (kind === 'cancel' && !s.contract.cancelledAt) { s.contract.cancelledAt = c.at; s.quote = null; receive(s, rule, c.at); return true; }
    if (kind === 'refund' && s.contract.cancelledAt && s.balance > 0) {
      wallet.money += s.balance; s.refunded += s.balance; s.balance = 0; receive(s, rule, c.at); return true;
    }
    if (kind === 'deposit' && !s.contract.cancelledAt && Number.isFinite(amount) && amount > 0 && wallet.money >= amount) {
      wallet.money -= amount; s.balance += amount; s.deposited += amount; receive(s, rule, c.at); return true;
    }
    return false;
  }
  function receive(s, rule, at) {
    s.report = { at, sourceLabel: sourceFor(s, s.contract.sourceId).label, limits: copy(s.contract.limits),
      contractAt: s.contract.at, cancelledAt: s.contract.cancelledAt || null, balance: s.balance, deposited: s.deposited,
      spent: s.spent, refunded: s.refunded, cityOwnedFuel: rule.powerFuel.stock, processed: rule.powerFuel.processed,
      deliveries: copy(s.deliveries), notices: copy(s.notices), procurementHold: s.hold, procurementCheckedAt: s.holdAt ?? null, scope: LIMITS };
  }
  function prepareDrivers(s, p) {
    for (const t of p?.trucks || []) if (!s.originalDrivers.some(r => r.truckId === t.id && r.driverId === t.driver.id)
      || !Number.isFinite(t.driver.fuelDutySeconds) || !Number.isFinite(t.driver.fuelProvisionsSeconds)) {
      t.driver.fuelDutySeconds = 0; t.driver.fuelProvisionsSeconds = 0; t.driver.fuelSupportLost = true;
    }
  }
  function register(s, networks, p) {
    if (!s || s.invalid || !bound(s, networks)) return;
    for (const src of s.sources) {
      const a = account(s, networks, src.id); if (!a) continue;
      let r = a.allocations.find(r => r.id === src.id);
      if (!r) a.allocations.push(r = { id: src.id, kind: 'essentialFuelService', external: true });
      r.powerId = src.powerId; r.facilityId = src.facilityId;
      r.truckIds = s.originalDrivers.map(r => r.truckId); r.actorIds = s.originalDrivers.map(r => r.driverId);
      r.radioIds = s.originalDrivers.map(r => r.radioId).filter(Boolean);
      r.contractId = s.contract?.sourceId === src.id ? s.contract.id : null;
      r.assignment = s.mission?.sourceId === src.id && !s.mission.returnedAt ? s.mission.id : null;
      r.scope = 'References to independent producer assets, not network ownership, extra trucks or wider nonintervention.';
    }
  }
  function procurement(s, rule, networks, p, listings, c, at) {
    const contract = s.contract, src = sourceFor(s, contract.sourceId), a = account(s, networks, src.id);
    if (!c.authority || !c.sourceCurrent || contract.handoverId !== rule.handoverId || contract.bodyEpoch !== c.bodyEpoch
      || !a || !a.source.charter.scope.includes('ownNewContracts') || a.source.charter.id !== contract.charterId) return 'Original contracting authority is unavailable.';
    if (s.suspended.some(r => r.sourceId === src.id)) return 'Provider suspended new service after an authenticated witnessed contract breach.';
    if (a.operator.status !== 'alive' || a.operator.assignment || a.operator.workSeconds < 1 || a.terminal.powerSeconds < 1
      || a.operator.lastOperatingWorkAt >= at) return 'Original procurement operator or powered settlement channel is unavailable.';
    if (!working(p, src) || c.routeOpen !== true) return 'Original facility or local delivery route is unavailable.';
    const store = rule.powerFuel, quantity = contract.limits.quantity;
    if (store.stock + (store.progress ? 1 : 0) >= contract.limits.threshold) return '';
    if (store.capacity - store.stock - (store.progress ? 1 : 0) < quantity) return 'Municipal fuel-store capacity is reserved or full.';
    const t = Production.serviceTruck({ ...p, trucks: p.trucks.filter(t => !t.driver.assignment && !t.driver.fuelSupportLost
      && s.originalDrivers.some(r => r.truckId === t.id && r.driverId === t.driver.id)
      && t.driver.fuelDutySeconds >= 2 * Production.HOUR + quantity * 60 + 600) }, quantity + 2);
    if (!t || t.driver.fuelDutySeconds < 2 * Production.HOUR + quantity * 60 + 600) return 'Original producer truck/driver, fuel, duty or shared assignment unavailable.';
    const food = t.driver.fuelProvisionsSeconds < 2 * Production.HOUR + quantity * 60 + 600;
    const cargo = [{ key: KEY, quantity }, ...(food ? [{ key: 'fieldRation', quantity: 1 }, { key: 'drinkingWater', quantity: 1 }] : [])];
    let cost = BROKER + FREIGHT;
    for (const r of cargo) {
      r.unitPrice = c.marketPrice ? c.marketPrice(r.key) : Production.price(p, listings, r.key, false);
      if (!(listings[r.key]?.supply >= r.quantity) || !Number.isFinite(r.unitPrice)) return 'Actual exchange stock or price is unavailable.';
      cost += r.unitPrice * r.quantity;
    }
    cost = Math.ceil(cost);
    if (cargo[0].unitPrice > contract.limits.maxUnitPrice || cost > contract.limits.maxTripSpend) return 'Current market price or landed cost exceeds the agreed ceiling.';
    if (s.balance < cost) return 'Prepaid service allowance cannot fund this actual purchase and trip.';
    if (c.communicate && !c.communicate({ purpose: 'fuelProcurement', sessionId: `${contract.id}:purchases`,
      sequence: (s.purchaseSequence || 0) + 1, fromCityId: rule.source.cityId, toCityId: src.cityId, civicCityIds: [rule.source.cityId], signer: 'city',
      charterId: rule.source.charterId, handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch }, at))
      return 'The selected civic path could not deliver this authenticated purchase instruction. No new purchase or payment was made.';
    // The existing service booking reserves exactly the same original carrier.
    const sh = Production.bookServiceCargo(p, src.facilityId, KEY, quantity, at, null, t.id);
    if (!sh || sh.truckId !== t.id) return 'Original shared carrier became unavailable.';
    s.purchaseSequence = (s.purchaseSequence || 0) + 1;
    // A standing instruction is not a replacement operator or an unpowered
    // payment channel. Settlement shares this same second with other users.
    a.operator.workSeconds--; a.terminal.powerSeconds--; a.operator.lastOperatingWorkAt = at;
    sh.externallyManaged = 'municipalFuelService'; sh.target = 'municipalPowerworks';
    sh.cityOwnerId = rule.source.cityId; sh.powerId = rule.source.powerId; sh.remaining = quantity;
    t.driver.assignment = sh.id;
    for (const r of cargo) listings[r.key].supply -= r.quantity;
    const goodsCost = cost - BROKER - FREIGHT;
    p.finance.exchangeMoney += goodsCost; p.finance.money += FREIGHT; p.finance.earned += FREIGHT;
    a.money += BROKER; s.balance -= cost; s.spent += cost;
    p.finance.ledger.push({ at, kind: 'municipalFuelFreight', missionId: sh.id, amount: FREIGHT });
    a.income ||= []; a.income.push({ id: `${sh.id}:broker-income`, at, purpose: 'municipalPowerFuelService', amount: BROKER });
    if (food) t.driver.fuelProvisionsSeconds += 28800;
    s.mission = { id: sh.id, sourceId: src.id, contractId: contract.id, truckId: t.id, driverId: t.driver.id, at,
      phase: 'outbound', progress: 0, quantity, remaining: quantity, cost, cargo: copy(cargo), positionKm: 0,
      deliveredAt: null, returnedAt: null, handling: 0, travelledKm: 0 };
    return '';
  }
  function advance(s, rule, networks, p, listings, context, to, h) {
    if (!s || s.invalid || !target(s, rule) || !bound(s, networks) || !h.alive() || to <= s.lastAt) return false;
    prepareDrivers(s, p);
    while (s.lastAt < to && h.alive()) {
      const dt = Math.min(1, to - s.lastAt), at = s.lastAt + dt; s.lastAt = at;
      const c = context();
      if (s.job) {
        const j = s.job, a = account(s, networks, j.sourceId);
        if (!personal(s, rule, c) || !same(j.cell, c.cell) || j.bodyEpoch !== c.bodyEpoch || j.handoverId !== rule.handoverId
          || !a || a.operator.assignment !== j.id || rule.operatorServiceAssignment !== j.id || a.operator.status !== 'alive'
          || j.kind === 'sign' && j.quote.charterId !== a.source.charter.id
          || a.operator.workSeconds < dt || a.terminal.powerSeconds < dt || rule.operatorWorkSeconds < dt) release(s, rule, networks);
        else if (!(a.operator.lastOperatingWorkAt >= at) && !(rule.operatorWorkedUntil >= at)
          && (!c.communicate || c.communicate({ purpose: 'fuelProcurement', sessionId: j.id,
            sequence: Math.ceil(j.progress + dt), fromCityId: rule.source.cityId, toCityId: a.source.cityId, civicCityIds: [rule.source.cityId], signer: 'city',
            charterId: rule.source.charterId, handoverId: rule.handoverId, bodyEpoch: c.bodyEpoch }, at))) {
          a.operator.workSeconds -= dt; a.terminal.powerSeconds -= dt; a.operator.lastOperatingWorkAt = at;
          rule.operatorWorkSeconds -= dt; rule.operatorWorkedUntil = at; j.progress += dt;
          if (j.progress >= j.seconds) {
            if (j.kind === 'sign' && c.wallet.money >= j.deposit) {
              if (s.contract) s.contracts.push(copy(s.contract));
              c.wallet.money -= j.deposit; s.balance += j.deposit; s.deposited += j.deposit;
              s.contract = { ...copy(j.quote), id: `${s.id}:contract:${++s.serial}`, at, cancelledAt: null };
              rule.powerFuel.enabled = true; rule.powerFuel.handoverId = rule.handoverId; s.quote = null;
            }
            const completed = j.kind === 'report' || j.kind === 'sign' && s.contract?.at === at;
            release(s, rule, networks); if (completed) receive(s, rule, at);
          }
        }
      }
      const m = s.mission && !s.mission.returnedAt ? s.mission : null;
      if (m) {
        const t = p.trucks.find(t => t.id === m.truckId), d = t?.driver, sh = p.shipments.find(r => r.id === m.id), src = sourceFor(s, m.sourceId);
        if (!t || !sh || t.shipment !== m.id || sh.externallyManaged !== 'municipalFuelService') { s.hold = 'Original shipment account missing; carrier and cargo remain unresolved.'; continue; }
        if (d.status === 'alive') { d.fuelDutySeconds = Math.max(0, d.fuelDutySeconds - dt); d.fuelProvisionsSeconds = Math.max(0, d.fuelProvisionsSeconds - dt); }
        if (able(d) && !h.incapacitated(d) && t.condition >= 50 && c.routeOpen && (m.phase === 'returning' || c.targetExists)) {
          if (['outbound', 'returning'].includes(m.phase)) {
            const movement = Math.min(dt, Math.max(0, Production.HOUR - m.progress));
            m.progress += movement; m.positionKm = 4 * Math.min(1, m.progress / Production.HOUR); m.travelledKm += 4 * movement / Production.HOUR;
            if (m.progress >= Production.HOUR) {
              if (m.phase === 'outbound') { if (h.arrive(d, t, at)) { m.phase = 'walkingToDock'; m.progress = 0; } }
              else {
                m.returnedAt = at; sh.returned = true; sh.returnedAt = at; t.shipment = null;
                s.missions.push(copy(m)); d.assignment = null;
              }
            }
          } else if (m.phase === 'walkingToDock') {
            if (same(d.mapCell, DOCK)) m.phase = 'unloading'; else h.move(d, DOCK, at);
          } else if (m.phase === 'unloading' && same(d.mapCell, DOCK) && h.safe(d)) {
            m.handling += dt;
            if (m.handling >= 60 && rule.powerFuel.stock + (rule.powerFuel.progress ? 1 : 0) < rule.powerFuel.capacity) {
              m.handling = 0; m.remaining--; sh.remaining = m.remaining; rule.powerFuel.stock++; rule.powerFuel.received++;
              s.deliveries.push({ at, missionId: m.id, quantity: 1, cityOwnerId: rule.source.cityId, powerId: rule.source.powerId });
              if (!m.remaining) { m.phase = 'walkingToTruck'; m.deliveredAt = at; sh.delivered = true; sh.deliveredAt = at; }
            }
          } else if (m.phase === 'walkingToTruck') {
            if (same(d.mapCell, ENTRY)) { d.mapCell = null; d.roomId = null; t.mapCell = null; t.roomId = null; h.depart?.(); m.phase = 'returning'; m.progress = 0; }
            else h.move(d, ENTRY, at);
          }
        }
        // Only a surviving original witness can send this specific attack account.
        if (!s.noticeJob && d.status === 'alive' && d.fuelServiceAttack?.missionId === m.id
          && !s.notices.some(n => n.causeId === d.fuelServiceAttack.id)) {
          const a = account(s, networks, m.sourceId);
          if (a?.operator.status === 'alive' && !a.operator.assignment) {
            s.noticeJob = { id: `${m.id}:attack-notice`, sourceId: m.sourceId, causeId: d.fuelServiceAttack.id, at, progress: 0 };
            a.operator.assignment = s.noticeJob.id;
          }
        }
      }
      if (s.noticeJob) {
        const n = s.noticeJob, a = account(s, networks, n.sourceId);
        const witnessTruck = p.trucks.find(t => t.driver.fuelServiceAttack?.id === n.causeId), witness = witnessTruck?.driver;
        const radio = witness?.cabRadio;
        const available = a?.operator.status === 'alive' && a.operator.workSeconds >= dt && a.terminal.powerSeconds >= dt
          && witness?.status === 'alive' && witness.health >= 50 && !h.incapacitated(witness) && witnessTruck.condition >= 50
          && radio?.condition >= 50 && radio.chargeSeconds >= dt
          && s.originalDrivers.some(r => r.driverId === witness.id && r.radioId === radio.id)
          && (!h.radioPath || h.radioPath(witness, witnessTruck));
        if (!available && a?.operator.assignment === n.id) a.operator.assignment = null;
        if (available && !a.operator.assignment) a.operator.assignment = n.id;
        if (available && a.operator.assignment === n.id
          && a.terminal.powerSeconds >= dt && !(a.operator.lastOperatingWorkAt >= at) && at > n.at) {
          a.operator.workSeconds -= dt; a.terminal.powerSeconds -= dt; radio.chargeSeconds -= dt; a.operator.lastOperatingWorkAt = at; n.progress += dt;
          if (n.progress >= 60) {
            s.suspended.push({ at, sourceId: n.sourceId, causeId: n.causeId });
            s.notices.push({ at, causeId: n.causeId, text: 'Original provider authenticated the surviving driver\'s witnessed attack account. New discretionary service suspended; paid cargo and municipal property are unchanged.' });
            a.operator.assignment = null; s.noticeJob = null;
          }
        }
      }
      for (const t of p.trucks.filter(t => !t.shipment && t.driver.status === 'alive')) {
        const d = t.driver, fed = Math.min(dt, d.fuelProvisionsSeconds);
        d.fuelProvisionsSeconds -= fed; d.fuelDutySeconds = Math.min(DUTY, d.fuelDutySeconds + fed / 2);
      }
      if (s.contract && !s.contract.cancelledAt && !s.job && (!s.mission || s.mission.returnedAt) && at > s.contract.at && at >= (s.nextCheckAt || 0)) {
        s.nextCheckAt = at + 60; if (s.mission) s.mission = null;
        s.hold = procurement(s, rule, networks, p, listings, c, at); s.holdAt = at;
      }
    }
    register(s, networks, p); return true;
  }
  const active = s => Boolean(s && !s.invalid && (s.job || s.noticeJob || s.mission && !s.mission.returnedAt || s.contract && !s.contract.cancelledAt));
  return { KEY, SIGN, REPORT, BROKER, FREIGHT, DUTY, ENTRY, DOCK, TRUCK, TERMS, LIMITS, bound, validSource, sources, create, normalize, rebind,
    settings, account, target, offer, begin, action, release, advance, register, prepareDrivers, active, able, publicView: s => copy(s?.report) };
});
