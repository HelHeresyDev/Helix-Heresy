(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./sovereign-bargains') : root.HelixSovereignBargains);
  if (node) module.exports = api;
  if (root) root.HelixForeignCivicBargains = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Bargains) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const ACCESS_SECONDS = 60, ACCESS_WINDOW = 3 * 86400, QUEUE_SECONDS = 300;
  const POSITION = 'The scientist fundamentally opposes the gods and their authority. This practical supply exchange promises no worship, conversion, allegiance or hidden campaign support.';
  const SCOPE = 'Named foreign civic supply counter only: audience, exact defense-supply handover and attended copying of a fulfilled restricted approach extract. No visitor-hall trading, lodging, residence, research, unrestricted city access, political recognition, command or divine endorsement.';
  const able = a => a?.status === 'alive' && Number.isFinite(a.health) && a.health >= 50 && Number.isFinite(a.fatigue ?? 0) && (a.fatigue || 0) < 80 && a.present !== false;
  const officeId = g => `${g.id}:foreign-civic-counter`;
  function sourceFromWorld(map, g) {
    const routes = (map?.routeGraph?.routes || []).filter(r => r.endpointIds?.includes(g?.cityId) && r.cellPath?.length >= 3);
    const source = Bargains.sourceFromWorld(map && { ...map, routeGraph: { ...map.routeGraph, routes } }, g?.cityId, { cityId: g?.cityId, institutionId: g?.institutionId });
    const gov = map?.cityGovernments?.governments?.find(r => r.cityId === g?.cityId);
    const row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === g?.cityId);
    if (!source?.populationSourceId || !Number.isFinite(row?.currentPopulation) || row.currentPopulation < 6) return null;
    for (const id of [source.administrationId, source.defenseId]) {
      const i = gov.institutions.find(i => i.id === id), current = map.strategicCivicHistory?.currentInstitutionRows?.find(r => r.institutionId === id);
      if (!['functional', 'strong', 'exceptional'].includes(current?.currentCapacityBand || i?.capacityBand)
        || map.strategicCivicHistory && !current) return null;
    }
    const route = map.routeGraph.routes.find(r => r.id === source.archive.routeId);
    const outward = route.endpointIds[0] === g.cityId ? route.cellPath : [...route.cellPath].reverse();
    // Even a short corridor cannot disclose its neighboring city's endpoint or
    // become a complete-route reward. There must be an actual approach segment.
    const allowed = new Set(outward.slice(0, Math.min(3, outward.length - 1)));
    source.archive.coverage = source.archive.coverage.filter(c => allowed.has(c.cellId));
    if (source.archive.coverage.length < 2) return null;
    const defense = gov.institutions.find(i => i.id === source.defenseId);
    source.defenseName = defense.publicName || defense.name;
    source.archive.source = `${source.defenseName} retained approach chart`;
    return source;
  }
  function create(g, source, options = {}) {
    if (!g?.materialized || !g.visitorAdmission || source?.cityId !== g.cityId || source.administrationId !== g.institutionId || !source.populationSourceId) return null;
    const counter = { x: 10, y: 7, z: g.z };
    const bargain = Bargains.create(source, { id: officeId(g), cityId: g.cityId, institutionId: g.institutionId }, { ...options,
      location: { roomId: g.checkpointRoomId, counter, label: `${g.label} named civic supply counter at 10,7`,
        representativeCell: { x: 9, y: 8, z: g.z }, defenderCell: { x: 11, y: 8, z: g.z } } });
    if (!bargain) return null;
    return { originalClerkId: g.clerk.id, bargain, serial: 0, accessJob: null, accessOffer: null, permits: [], knowledge: null,
      message: '', position: POSITION, scope: SCOPE, introduction: null };
  }
  function current(g, s, c) {
    const source = c.source, saved = s?.bargain.source;
    return Boolean(source && saved && c.authorityCurrent && ['cityId', 'charterId', 'administrationId', 'defenseId', 'populationSourceId'].every(k => source[k] === saved[k])
      && source.authority?.id && source.authority.id === saved.authority.id && g.institutionId === saved.administrationId);
  }
  function permission(g, c, now) {
    return g?.foreignCivic?.permits.find(p => p.cityId === g.cityId && p.bodyEpoch === c.bodyEpoch && p.visitId === c.visitId
      && p.scope === 'foreignCivicSupplyCounterOnly' && p.issuedAt <= now && now < p.expiresAt) || null;
  }
  function reason(g, s, c, now, ownJob = null) {
    if (!s || !current(g, s, c)) return 'No current foreign city charter, administration, defense authority and retained approach archive support this civic exchange.';
    if (!c.alive || !c.capable || !c.originalBody || c.custodyActive || !c.local || !c.atDesk || !c.clerkPresent || !c.lineOfSight
      || c.cityId !== g.cityId) return 'Personally attend the original foreign reception desk with the free capable original visiting body.';
    if ((c.bans || []).some(b => b.status === 'active' && (b.cityId === g.cityId || b.recognizedBy?.some(r => r.cityId === g.cityId && r.localOrderId && r.institutionId && r.status === 'active')))) return 'A current local exclusion prevents new civic access; no immunity follows from a bargain.';
    if (g.clerk.id !== s.originalClerkId || !able(g.clerk) || !Number.isFinite(g.receptionWorkSeconds) || g.receptionWorkSeconds <= 0
      || !Number.isFinite(g.powerSeconds) || g.powerSeconds <= 1 || c.otherBusy || g.receptionAssignment && g.receptionAssignment !== ownJob)
      return 'The original clerk, finite duty, powered terminal or shared exclusive queue is unavailable.';
    return '';
  }
  function quote(g, c, now) {
    const s = g?.foreignCivic;
    if (reason(g, s, c, now) || s.accessJob || s.bargain.job || permission(g, c, now)
      || Math.min(g.receptionWorkSeconds, g.powerSeconds) < ACCESS_SECONDS * 2) return null;
    return { cityId: g.cityId, charterId: s.bargain.source.charterId, authorityId: s.bargain.source.authority.id, clerkId: s.originalClerkId,
      bodyEpoch: c.bodyEpoch, visitId: c.visitId, scope: SCOPE, position: POSITION, reviewSeconds: ACCESS_SECONDS, acceptanceSeconds: ACCESS_SECONDS, window: ACCESS_WINDOW };
  }
  function release(g, s, now) {
    if (g.receptionAssignment === s.accessJob?.id) g.receptionAssignment = null;
    s.accessJob = null; s.message = 'Civic access attendance ended; spent original clerk duty and power remain spent.';
  }
  function office(g) {
    // Adapter over the SAME reception balances/queue, never a second staff or
    // terminal allocation. Bargain startup costs one terminal second; all duty
    // spent on attended work or receiving also consumes original terminal power.
    return { id: officeId(g), cityId: g.cityId, institutionId: g.institutionId, active: true, channelPowered: g.powerSeconds > 1,
      clerk: { ...g.clerk, locationId: officeId(g) }, maintenanceReady: true, power: Number.isFinite(g.powerSeconds) ? Math.max(0, g.powerSeconds) : 0,
      workSeconds: [g.receptionWorkSeconds, g.powerSeconds].every(Number.isFinite) ? Math.max(0, Math.min(g.receptionWorkSeconds, g.powerSeconds - 1)) : 0, assignment: g.receptionAssignment, availableAt: 0 };
  }
  function useOffice(g, fn) {
    const o = office(g), work = o.workSeconds, power = o.power, result = fn(o);
    const spent = work - o.workSeconds;
    if (spent > 0) g.receptionWorkSeconds -= spent;
    if (spent + power - o.power > 0) g.powerSeconds -= spent + power - o.power;
    g.receptionAssignment = o.assignment;
    return result;
  }
  function context(g, s, c, now) {
    const b = s.bargain;
    return { ...c, atCounter: c.atDesk, visitPermission: Boolean(permission(g, c, now)), authorityId: current(g, s, c) ? c.source.authority.id : null,
      administrationAvailable: !reason(g, s, c, now, b.job?.id), defenseAvailable: current(g, s, c),
      participantsPresent: Boolean(c.participantsPresent) && [b.representative, b.defender].every(a => able(a) && a.roomId === g.checkpointRoomId
        && a.locationId === officeId(g)) && b.representative.id === `${b.source.authority.id}:supply-representative`
        && b.defender.id === `${b.source.defenseId}:ward-defender`, busy: Boolean(c.otherBusy || s.accessJob) };
  }
  function action(g, c, kind, expected, now, stacks = []) {
    const s = g?.foreignCivic; if (!s || !c.alive) return false;
    advance(g, c, now);
    if (kind === 'cancel') {
      if (s.accessJob && s.accessJob.bodyEpoch === c.bodyEpoch && s.accessJob.visitId === c.visitId) { release(g, s, now); return true; }
      if (s.bargain.job?.bodyEpoch === c.bodyEpoch) return useOffice(g, o => Bargains.cancel(s.bargain, o, now));
      return false;
    }
    if (kind === 'reviewAccess' || kind === 'acceptAccess') {
      if (reason(g, s, c, now) || s.accessJob || s.bargain.job) return false;
      const q = kind === 'reviewAccess' ? quote(g, c, now) : s.accessOffer;
      if (!q || JSON.stringify(q) !== JSON.stringify(expected) || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId
        || kind === 'acceptAccess' && now >= q.expiresAt || Math.min(g.receptionWorkSeconds, g.powerSeconds) < ACCESS_SECONDS) return false;
      const id = `${g.id}:foreign-civic-access-${++s.serial}`;
      s.accessJob = { id, kind, quote: copy(q), bodyEpoch: c.bodyEpoch, visitId: c.visitId, clerkId: s.originalClerkId,
        progress: 0, seconds: ACCESS_SECONDS, lastAt: now, wasReady: true };
      g.receptionAssignment = id; s.message = 'One attended minute at the original clerk; no civic access or information before separate acceptance.'; return true;
    }
    if (kind === 'introduce') {
      const q = c.introduction;
      if (reason(g, s, c, now) || s.introduction || s.accessJob || s.bargain.job || !q?.reportId || !q.officerId || q.cityId !== g.cityId
        || q.bodyEpoch !== c.bodyEpoch || q.receivedAt > now || JSON.stringify(q) !== JSON.stringify(expected)
        || Math.min(g.receptionWorkSeconds, g.powerSeconds) < ACCESS_SECONDS) return false;
      g.receptionWorkSeconds -= ACCESS_SECONDS; g.powerSeconds -= ACCESS_SECONDS;
      s.introduction = { ...copy(q), presentedAt: now, scope: 'Optional identified municipal advisory-report introduction only; no political endorsement or access grant.' };
      s.message = 'Explicitly presented the identified municipal report receipt; no findings, laboratory records or hidden discoveries disclosed. No civic access or endorsement granted.';
      return true;
    }
    const ctx = context(g, s, c, now);
    if (reason(g, s, c, now, s.bargain.job?.id) || !ctx.visitPermission) return false;
    const b = s.bargain;
    const result = useOffice(g, o => kind === 'request' ? Bargains.request(b, o, ctx, now, now + QUEUE_SECONDS)
      : kind === 'attend' ? Bargains.attend(b, o, ctx, now)
        : kind === 'sign' ? Bargains.sign(b, o, expected, ctx, now)
          : kind === 'decline' ? Bargains.decline(b, o, ctx, now)
            : kind === 'deliver' ? Bargains.deliver(b, o, stacks, ctx, now)
              : kind === 'claim' ? Bargains.claim(b, o, ctx, now) : false);
    s.message = b.message;
    if (result && kind === 'request') s.disclosedAt = now;
    return result;
  }
  function advance(g, c, now) {
    const s = g?.foreignCivic; if (!s || !c.alive) return false;
    let changed = false;
    const j = s.accessJob;
    if (j && now >= j.lastAt) {
      const elapsed = now - j.lastAt; j.lastAt = now;
      if (j.bodyEpoch !== c.bodyEpoch || j.visitId !== c.visitId || !c.originalBody) { release(g, s, now); changed = true; }
      else if (reason(g, s, c, now, j.id)) { if (g.receptionAssignment === j.id) g.receptionAssignment = null; j.wasReady = false; }
      else {
        g.receptionAssignment = j.id;
        const work = j.wasReady ? Math.min(elapsed, j.seconds - j.progress, g.receptionWorkSeconds, g.powerSeconds,
          j.kind === 'acceptAccess' ? Math.max(0, j.quote.expiresAt - (now - elapsed)) : Infinity) : 0;
        j.wasReady = true; j.progress += work; g.receptionWorkSeconds -= work; g.powerSeconds -= work;
        if (j.progress + 1e-8 >= j.seconds) {
          const completedAt = now - elapsed + work;
          if (j.kind === 'reviewAccess') s.accessOffer = { ...copy(j.quote), id: `${j.id}:offer`, issuedAt: completedAt, expiresAt: completedAt + 3600 };
          else if (completedAt < j.quote.expiresAt) {
            s.permits.push({ id: `${j.id}:permit`, cityId: g.cityId, bodyEpoch: j.bodyEpoch, visitId: j.visitId,
              issuedAt: completedAt, expiresAt: completedAt + ACCESS_WINDOW, scope: 'foreignCivicSupplyCounterOnly', authorityId: s.bargain.source.authority.id });
            s.accessOffer = null;
          }
          release(g, s, now); s.message = j.kind === 'reviewAccess' ? 'Separate civic-counter terms reviewed; accept personally within one hour.'
            : completedAt < j.quote.expiresAt ? 'Three-day civic supply counter access signed. Trading, lodging and research remain separately restricted.'
              : 'Unsigned civic access offer expired; no permission granted and spent attendance remains spent.';
          changed = true;
        } else if (j.kind === 'acceptAccess' && now >= j.quote.expiresAt) { release(g, s, now); changed = true; }
      }
      if (s.accessJob === j && j.kind === 'acceptAccess' && now >= j.quote.expiresAt) { release(g, s, now); s.message = 'Unsigned civic access offer expired; no permission granted.'; changed = true; }
    }
    const b = s.bargain, before = b.copies.length;
    changed = useOffice(g, o => Bargains.advance(b, o, context(g, s, c, now), now)) || changed;
    if (b.terms) b.terms.disclosure = `Exact supply terms and delivered manifests; no laboratory records, identity history or unrelated discoveries. ${POSITION}`;
    if (b.copies.length > before) s.message = 'Original supplies fully received; restricted dated approach extract physically handed over. No onward travel right, current safety or divine endorsement follows.';
    observe(g, c, now); return changed;
  }
  function observe(g, c, now) {
    const s = g?.foreignCivic;
    if (s && !reason(g, s, c, now, s.accessJob?.id || s.bargain.job?.id)) s.knowledge = { at: now, position: POSITION, scope: SCOPE,
      permit: copy(permission(g, c, now)), accessOffer: copy(s.accessOffer), accessWork: s.accessJob ? { kind: s.accessJob.kind, progress: s.accessJob.progress, seconds: s.accessJob.seconds } : null,
      ...(c.participantsPresent ? { bargain: copy(Bargains.publicView(s.bargain)) } : { bargain: copy(s.knowledge?.bargain || null) }), message: s.message };
    return s?.knowledge ? copy(s.knowledge) : null;
  }
  function knownAlignment(s) {
    return (s?.bargain.copies || []).map(r => ({ id: r.id, cityId: s.bargain.source.cityId, issuedAt: r.issuedAt, sourceDate: r.sourceDate,
      issuerId: r.issuerId, source: r.contents.source, routeId: r.contents.routeId, coverage: copy(r.contents.coverage), notes: copy(r.contents.notes), limitations: r.limitations }));
  }
  return { ACCESS_SECONDS, ACCESS_WINDOW, QUEUE_SECONDS, POSITION, SCOPE, sourceFromWorld, create, permission, reason, quote, action, advance, observe, knownAlignment };
});
