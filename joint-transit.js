(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixJointTransit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const WINDOW = 4 * 3600, DUTY = 8 * 3600, TOTAL = 20;
  const KEYS = ['metalParts', 'drinkingWater'];
  const SCOPE = 'One four-hour ground-passenger receiving/inspection watch, not the whole fort or an army. Both original cities retain staffing and upkeep responsibility, local administration and separate passage restrictions. No exclusive sovereignty, independent diplomacy, map, refuge ownership, immunity or guaranteed road safety. Unserved vehicles wait or physically turn back; independent walkers retain actual terrain/access/survival limits. Other fleets receive no automatic support.';
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80 && a.workSeconds > 0;
  function validSource(s) {
    return Boolean(s?.id && s.corridorId && s.cellId && s.populationId && s.population >= 4 && s.administration
      && ['groundConvoy', 'mixedFleet'].includes(s.serviceMode) && s.independentlySovereign === false && s.independentDiplomacy === false
      && s.sponsors?.length === 2 && new Set(s.sponsors.map(a => a.cityId)).size === 2
      && s.sponsors.every(a => a.cityId && a.charterId && a.authorityId && a.institutionId && a.populationId
        && Number.isFinite(a.staffingPercent) && a.staffingPercent > 0 && Number.isInteger(TOTAL * a.upkeepPercent / 100) && a.upkeepPercent > 0)
      && s.sponsors.reduce((n, a) => n + a.staffingPercent, 0) === 100 && s.sponsors.reduce((n, a) => n + a.upkeepPercent, 0) === 100
      && s.endpointCityIds?.length === 2 && s.endpointCityIds.every(id => s.sponsors.some(a => a.cityId === id))
      && Number.isFinite(s.positionKm) && s.positionKm > 0 && s.positionKm < s.distanceKm);
  }
  function sourceFromWorld(map, route, distance) {
    const r = map?.routeGraph?.routes?.find(r => r.id === route?.id), history = map?.cityExpansionHistory;
    if (!r?.cellPath?.length || route.endpointCityIds?.length !== 2 || JSON.stringify(r.endpointIds) !== JSON.stringify(route.endpointCityIds)
      || !Number.isFinite(route.distanceKm) || route.distanceKm <= 0) return null;
    const h = history?.strongholdRows.filter(h => h.corridorId === r.id && ['groundConvoy', 'mixedFleet'].includes(h.serviceMode)).sort((a, b) => a.ordinal - b.ordinal)[0];
    const row = map.strategicPlayableSettlementState?.strongholdRows.find(row => row.strongholdId === h?.id);
    const index = h && r.cellPath.indexOf(h.cellId);
    if (!h || !row || row.currentPopulation < 4 || row.physicalCondition === 'ruined' || index <= 0 || index >= r.cellPath.length - 1
      || JSON.stringify(h.sponsorCityIds) !== JSON.stringify(r.endpointIds)) return null;
    const lengths = r.cellPath.slice(1).map((id, i) => distance(r.cellPath[i], id));
    if (!lengths.every(n => Number.isFinite(n) && n > 0)) return null;
    const sponsors = h.sponsorContributionRows.map(([cityId, staffingPercent, upkeepPercent]) => {
      const g = map.cityGovernments?.governments.find(g => g.cityId === cityId), p = map.cityPolities?.polities.find(p => p.cityId === cityId);
      const c = map.strategicPlayableSettlementState.cityRows.find(c => c.cityId === cityId);
      const institutionId = g?.roleAssignments.publicWorksAndProvisioning;
      if (!g?.charter?.id || !p?.authority?.id || !institutionId || !c?.currentPopulation || c.physicalCondition === 'ruined') return null;
      return { cityId, charterId: g.charter.id, authorityId: p.authority.id, institutionId, populationId: c.assetId, staffingPercent, upkeepPercent };
    });
    if (sponsors.some(s => !s)) return null;
    const source = { id: h.id, name: row.name, corridorId: r.id, cellId: h.cellId, populationId: row.assetId, population: row.currentPopulation,
      endpointCityIds: copy(r.endpointIds), sponsors, administration: h.administration, serviceMode: h.serviceMode,
      independentlySovereign: false, independentDiplomacy: false, physicalCondition: row.physicalCondition, services: copy(row.services),
      distanceKm: route.distanceKm, positionKm: route.distanceKm * lengths.slice(0, index).reduce((a, b) => a + b, 0) / lengths.reduce((a, b) => a + b, 0) };
    return validSource(source) ? source : null;
  }
  const position = (s, originId) => s.endpointCityIds[0] === originId ? s.positionKm : s.distanceKm - s.positionKm;
  function create(source, binding, layout, at) {
    if (!validSource(source) || !binding?.worldId || !binding.runId || !layout?.roomId || !layout.post || !layout.entry || !layout.homes?.length) return null;
    return { ...copy(binding), id: source.id, source: copy(source), layout: copy(layout), createdAt: at, lastAt: at, serial: 0,
      members: source.sponsors.map((a, i) => ({ id: `${source.id}:posted-transit-${a.cityId}`, name: `${a.cityId} posted transit officer`,
        actorKind: 'civicOfficeholder', sponsorCityId: a.cityId, roomId: layout.roomId, mapCell: copy(layout.homes[i]), status: 'alive', health: 100,
        maxHealth: 100, physicalControl: true, fatigue: 0, workSeconds: DUTY, assignment: null, money: 0, willing: true })),
      powerSeconds: ['functional', 'strong'].includes(source.services?.utilities) ? 2 * WINDOW : 0,
      stockIds: [], job: null, operation: null, cover: null, windows: [], receipts: [], history: [], report: null, nextMoveAt: at + 1 };
  }
  function normalize(s) {
    return validSource(s?.source) && s.worldId && s.runId && s.id === s.source.id && s.layout?.roomId && s.members?.length === 2
      && s.members.every((a, i) => a.id === `${s.id}:posted-transit-${s.source.sponsors[i].cityId}` && Number.isFinite(a.workSeconds) && a.workSeconds >= 0)
      && Number.isFinite(s.lastAt) && Number.isFinite(s.powerSeconds) && s.powerSeconds >= 0 && Array.isArray(s.receipts) && Array.isArray(s.history) ? copy(s) : null;
  }
  function rebind(s, from, to) { const n = normalize(s); return n && n.worldId === from?.worldId && n.runId === from?.runId ? { ...n, ...copy(to) } : null; }
  function normalizeState(v) {
    if (!v?.worldId || !v.runId) return null;
    const stations = (v.stations || []).map(normalize).filter(s => s && s.worldId === v.worldId && s.runId === v.runId);
    return { worldId: v.worldId, runId: v.runId, stations: stations.filter((s, i) => stations.findIndex(t => t.id === s.id) === i),
      preparedSources: (v.preparedSources || []).filter(validSource).map(copy), visit: v.visit && copy(v.visit) };
  }
  function rebindState(v, from, to) {
    const s = normalizeState(v); if (!s || s.worldId !== from?.worldId || s.runId !== from?.runId) return null;
    return { ...s, ...copy(to), stations: s.stations.map(s => rebind(s, from, to)) };
  }
  const active = (s, at) => Boolean(s?.operation && s.operation.startedAt <= at && at < s.operation.endsAt);
  const operator = (s, at) => active(s, at) ? s.operation.coverage[at - s.operation.startedAt < WINDOW * s.source.sponsors[0].staffingPercent / 100 ? 0 : 1] : null;
  function current(s, c) { return Boolean(c.alive && c.worldId === s.worldId && c.runId === s.runId && c.current
    && c.source && JSON.stringify(c.source.sponsors) === JSON.stringify(s.source.sponsors) && c.source.id === s.id && c.source.corridorId === s.source.corridorId); }
  function contact(s, c) { return current(s, c) && c.local && c.near && c.capable && c.free && !c.busy && c.bodyEpoch != null; }
  function stock(s, items, sponsor, key) {
    return items.filter(i => s.stockIds.includes(i.id) && i.key === key && i.quantity > 0 && !i.carriedBy && !i.containerId && !i.reservedTaskId
      && i.roomId === s.layout.roomId && i.cityOwnerId === s.source.sponsors[sponsor].cityId && i.civicCustody === s.id
      && !i.tags?.some(t => /contaminated|stolen/i.test(t)) && same(i.cell, s.layout.bins[sponsor]));
  }
  function costs(s) {
    const result = [0, 0]; s.source.sponsors.forEach((a, i) => { result[s.cover?.payer ?? i] += TOTAL * a.upkeepPercent / 100; }); return result;
  }
  function openingReason(s, c, items) {
    if (!current(s, c)) return 'The original two sponsor cities, compact, population and run must still support this receiving station.';
    if (!c.operational || s.powerSeconds < WINDOW) return 'Original checkpoint utilities or physical installation cannot support four hours; no free repair or energy refill.';
    const coverage = s.cover ? [s.cover.payer, s.cover.payer] : [0, 1], required = [0, 0];
    s.source.sponsors.forEach((a, i) => { required[coverage[i]] += WINDOW * a.staffingPercent / 100; });
    if (required.some((n, i) => n && (!able(s.members[i]) || c.incapacitatedIds?.includes(s.members[i].id) || !s.members[i].willing
      || s.members[i].workSeconds < n + 120 || s.members[i].assignment && s.members[i].assignment !== s.operation?.id)))
      return 'Both recorded staffing shares need real consenting capable posted officers and sufficient remaining duty. No replacement or mandatory obedience.';
    if (costs(s).some((quantity, i) => KEYS.some(key => stock(s, items, i, key).reduce((n, item) => n + item.quantity, 0) < quantity)))
      return 'Original sponsor bins lack their recorded upkeep shares of actual metal parts or drinking water; signing creates no supplies.';
    return '';
  }
  function service(s, c, at) {
    const i = operator(s, at), a = i != null && s.members[i];
    return Boolean(current(s, c) && c.operational && c.passageAllowed && active(s, at) && s.powerSeconds > 0 && able(a)
      && !c.incapacitatedIds?.includes(a.id) && a.willing && a.assignment === s.operation.id && same(a.mapCell, s.layout.post));
  }
  function note(s, at, kind, text) { s.history.push({ id: `${s.id}:record:${++s.serial}`, at, kind, text }); }
  function request(s, c, items, at) {
    if (!contact(s, c) || s.job || !c.passageAllowed || !c.journeyId || !c.carrierId
      || s.receipts.some(r => r.journeyId === c.journeyId && r.bodyEpoch === c.bodyEpoch && r.operationId === s.operation?.id && active(s, at))) return false;
    if (!active(s, at) && openingReason(s, c, items)) return false;
    s.job = { id: `${s.id}:service:${++s.serial}`, bodyEpoch: c.bodyEpoch, journeyId: c.journeyId, carrierId: c.carrierId,
      phase: active(s, at) ? 'inspection' : 'opening', progress: 0, seconds: active(s, at) ? 30 : 60, lastAt: at };
    note(s, at, 'request', 'Requested ordinary passage under the original joint compact; no new diplomacy, title or supplies.'); return true;
  }
  function cover(s, c, payer, at) {
    const a = s?.source.sponsors[payer], officer = s?.members[payer];
    if (!contact(s, c) || s.job || active(s, at) || !a || s.cover || !c.coverAuthorization
      || c.coverAuthorization.cityId !== a.cityId || c.coverAuthorization.charterId !== a.charterId || !c.coverAuthorization.receiptId
      || c.coverAuthorization.bodyEpoch !== c.bodyEpoch || s.source.administration === 'dividedSponsorFacilities'
      || !able(officer) || !officer.willing || officer.assignment || officer.workSeconds < WINDOW + 120) return false;
    officer.workSeconds -= 60;
    s.cover = { payer, at, authority: copy(c.coverAuthorization), memberId: officer.id, scope: 'One window only; extra original upkeep and voluntary staffing, no change of either sponsor responsibility or passage restriction.' };
    note(s, at, 'compensation', 'An authenticated sponsor explicitly covered both finite obligations with its existing posted volunteer and own supplies. The other city retains its rights and responsibility.'); return true;
  }
  function cancel(s, at, reason = 'Actual attendance, body or source changed; spent work and accepted supplies remain spent.') {
    if (!s.job) return false; s.job = null; note(s, at, 'interrupted', reason); return true;
  }
  function observe(s, c, items, at) {
    if (!contact(s, { ...c, busy: false })) return false;
    s.report = { at, id: s.id, name: s.source.name, administration: s.source.administration, sponsors: copy(s.source.sponsors),
      active: active(s, at), available: service(s, c, at), endsAt: active(s, at) ? s.operation.endsAt : null,
      reason: active(s, at) ? service(s, c, at) ? 'Original receiving/inspection service available.' : 'Original attending staff, passage conditions or physical service unavailable.' : openingReason(s, c, items),
      bins: s.source.sponsors.map((a, i) => ({ cityId: a.cityId, items: Object.fromEntries(KEYS.map(key => [key, stock(s, items, i, key).reduce((n, item) => n + item.quantity, 0)])) })),
      receipts: copy(s.receipts), history: copy(s.history), scope: SCOPE }; return true;
  }
  function advance(s, at, context, hooks) {
    if (!s || at <= s.lastAt || !context().alive) return false;
    while (s.lastAt < at && context().alive) {
      const currentOperator = operator(s, s.lastAt), split = s.operation && s.operation.startedAt + WINDOW * s.source.sponsors[0].staffingPercent / 100;
      const settled = !s.job && active(s, s.lastAt) && s.members.every((a, i) => same(a.mapCell, i === currentOperator ? s.layout.post : s.layout.homes[i]) || !able(a));
      const boundary = settled ? Math.min(s.operation.endsAt, split > s.lastAt ? split : Infinity) : s.lastAt + 1;
      const dt = Math.min(Math.max(.001, boundary - s.lastAt), at - s.lastAt), now = s.lastAt + dt; s.lastAt = now;
      const c = context(), items = hooks.items(), op = s.operation;
      const i = operator(s, now - dt / 2), working = i != null && s.members[i];
      if (i != null && current(s, c) && c.operational) {
        s.powerSeconds = Math.max(0, s.powerSeconds - dt);
        if (able(working) && !c.incapacitatedIds?.includes(working.id) && working.willing
          && (!working.assignment || working.assignment === op.id)) working.assignment = op.id;
        if (working.assignment === op.id && able(working) && same(working.mapCell, s.layout.post)) {
          const work = Math.min(dt, working.workSeconds); working.workSeconds -= work; op.staffSpent[i] += work;
        }
      }
      if (now >= s.nextMoveAt) {
        for (let n = 0; n < s.members.length; n++) {
          const a = s.members[n], goal = active(s, now) && n === operator(s, now) ? s.layout.post : s.layout.homes[n];
          if (able(a) && !c.incapacitatedIds?.includes(a.id) && (!a.assignment || a.assignment === op?.id) && !same(a.mapCell, goal)
            && hooks.move(a, goal)) a.workSeconds = Math.max(0, a.workSeconds - 1);
        }
        s.nextMoveAt = now + 1;
      }
      if (s.job) {
        const j = s.job;
        if (!contact(s, c) || j.bodyEpoch !== c.bodyEpoch || j.journeyId !== c.journeyId || j.carrierId !== c.carrierId || !c.passageAllowed)
          cancel(s, now);
        else if (j.phase === 'opening') {
          if (openingReason(s, c, items)) cancel(s, now, openingReason(s, c, items));
          else {
            const clerk = s.members[s.cover?.payer ?? 0], work = Math.min(dt, j.seconds - j.progress, clerk.workSeconds);
            clerk.workSeconds -= work; j.progress += work;
            if (j.progress >= j.seconds) {
              const manifest = [];
              costs(s).forEach((quantity, sponsor) => KEYS.forEach(key => {
                let remaining = quantity;
                for (const item of stock(s, items, sponsor, key)) { const n = Math.min(remaining, item.quantity); if (!n) break;
                  item.quantity -= n; remaining -= n; manifest.push({ stackId: item.id, quantity: n, key, sponsorCityId: s.source.sponsors[sponsor].cityId }); }
              }));
              s.operation = { id: `${s.id}:watch:${++s.serial}`, startedAt: now, endsAt: now + WINDOW, staffSpent: [0, 0],
                coverage: s.cover ? [s.cover.payer, s.cover.payer] : [0, 1], compensation: copy(s.cover), manifest };
              j.phase = 'inspection'; j.progress = 0; j.seconds = 30;
              note(s, now, 'opened', 'Both original staffing and upkeep obligations funded one finite watch; actual operator must physically reach the service post.');
            }
          }
        } else if (service(s, c, now)) {
          const work = Math.min(dt, j.seconds - j.progress); j.progress += work;
          if (j.progress >= j.seconds) {
            const r = { id: j.id, at: now, journeyId: j.journeyId, carrierId: j.carrierId, bodyEpoch: j.bodyEpoch,
              strongholdId: s.id, operationId: s.operation.id, kind: 'one-passenger-crossing', scope: SCOPE };
            s.receipts.push(r); s.job = null; hooks.pass?.(r); note(s, now, 'passage', 'Original inspection completed for this one actual passenger journey and body. No enduring admission or other fleet clearance.');
          }
        } else j.progress = 0;
      }
      if (op && now >= op.endsAt && !op.endedAt) {
        op.endedAt = op.endsAt; s.windows.push(copy(op));
        for (const a of s.members) if (a.assignment === op.id) a.assignment = null;
        s.cover = null; note(s, op.endsAt, 'ended', 'The four-hour receiving watch expired. Original people, spent duty and installed supplies remain; no automatic renewal.');
      }
      observe(s, context(), items, now);
      if (!s.job && !active(s, now) && s.members.every((a, i) => same(a.mapCell, s.layout.homes[i]) || !able(a) || a.assignment)) s.lastAt = at;
    }
    return true;
  }
  return { WINDOW, DUTY, TOTAL, KEYS, SCOPE, same, able, validSource, sourceFromWorld, position, create, normalize, rebind, normalizeState, rebindState,
    active, operator, current, contact, stock, costs, openingReason, service, request, cover, cancel, observe, advance };
});
