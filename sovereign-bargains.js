(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent,
    typeof module === 'object' && module.exports ? require('./strategic-world') : root.HelixStrategicWorld);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSovereignBargains = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme, World) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const registry = Theme.createRegistry([{ id: 'bargain.shared.defense-supply', kind: 'civicBargain', compatibility: 'shared',
    contentTags: ['science', 'survival'], template: 'Defense supplies for a restricted approach extract', fallback: true }]);
  const COUNTER = Object.freeze({ x: 17, y: 8, z: 6 });
  const AUDIENCE_SECONDS = 900, COPY_SECONDS = 300, OFFER_SECONDS = 86400, DELIVERY_SECONDS = 259200;
  const LIMITS = 'Dated restricted approach extract only. No resource surveys, live threats, force totals, ownership, immunity, onward travel permission, command, neighboring sovereignty or joint-stronghold control. Divine patrons have not consented merely because a civic representative signed.';
  const capable = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const readyOffice = o => o?.active && o.channelPowered && o.maintenanceReady !== false && capable(o.clerk) && o.clerk.locationId === o.id;

  // Resolve existing charter/institution/route facts, never manufacture a sovereign
  // for a stronghold, an unsupported legacy city, or a displaced administration.
  function sourceFromWorld(map, cityId, office) {
    const g = map?.cityGovernments?.governments.find(g => g.cityId === cityId);
    const p = map?.cityPolities?.polities.find(p => p.cityId === cityId);
    const settlement = map?.strategicPlayableSettlementState?.cityRows.find(r => r.cityId === cityId);
    if (!g?.charter?.id || g.sovereigntyScope !== 'cityOnly' || !p?.authority?.id
      || !settlement || settlement.currentPopulation < 2 || settlement.physicalCondition === 'ruined' || settlement.services?.fortifications === 'failed'
      || office?.cityId !== cityId || office.institutionId !== g.roleAssignments.centralAdministration) return null;
    const roles = ['centralAdministration', 'militaryDefenseCommand'];
    const institutions = roles.map(role => g.institutions.find(i => i.id === g.roleAssignments[role]));
    if (institutions.some(i => !i)) return null;
    const current = institutions.map(i => map.strategicCivicHistory?.currentInstitutionRows.find(r => r.institutionId === i.id));
    if (current.some(r => r && (['displaced', 'disrupted'].includes(r.operationalStatus) || r.actualControlStatus !== 'localCharter'))) return null;
    const route = (map.routeGraph?.routes || []).filter(r => r.endpointIds?.includes(cityId) && r.cellPath?.length > 1)
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!route) return null;
    const cells = route.endpointIds[0] === cityId ? route.cellPath : [...route.cellPath].reverse();
    const city = map.humanGeography?.cities.find(c => c.id === cityId);
    const coverage = cells.slice(0, 3).map(id => {
      const c = World.cellSnapshot(map, World.cellIndex(id));
      return c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) ? { cellId: id, latitude: c.latitude, longitude: c.longitude } : null;
    });
    if (coverage.some(c => !c)) return null;
    return { cityId, cityName: city?.name || cityId, charterId: g.charter.id, authority: copy(p.authority),
      administrationId: institutions[0].id, defenseId: institutions[1].id, populationSourceId: settlement.assetId,
      defenseName: institutions[1].name, succession: g.charter.successionPrinciple || p.successionPrinciple,
      archive: { routeId: route.id, source: `${institutions[1].name} retained approach chart`, sourceDate: null, coverage,
        notes: ['Only the city-end segment is released. Other route sections and material surveys are withheld.', 'This historical alignment is not a promise of current route continuity or jurisdiction.'] } };
  }
  function create(source, office, options = {}) {
    if (!source?.charterId || !source.authority?.id || !source.defenseId || !source.archive?.coverage?.length
      || office?.cityId !== source.cityId || office.institutionId !== source.administrationId) return null;
    const content = Theme.selectContent(registry, { kind: 'civicBargain', worldTheme: options.theme || 'madcap', seed: options.seed || source.cityId, required: true });
    if (!content.ok) return null;
    const n = [...source.defenseId].reduce((a, c) => a + c.charCodeAt(0), 0);
    const person = (id, name, role, cell) => ({ id, name, role, status: 'alive', health: 100, fatigue: 0,
      locationId: office.id, roomId: 'supportedSurveyGround', mapCell: cell, workSeconds: 3600 });
    return { definitionId: content.definitionId, sourceTheme: content.sourceTheme, source: copy(source), officeId: office.id,
      representative: person(`${source.authority.id}:supply-representative`, ['Aderyn Vale', 'Cerys Reed', 'Iven Holt', 'Rysa Ash'][n % 4],
        source.authority.kind === 'collective' ? 'Authorized representative of the ruling collective' : 'Authorized sovereign representative', { x: 18, y: 9, z: 6 }),
      defender: { ...person(`${source.defenseId}:ward-defender`, ['Kael Farwatch', 'Hessa Ironveil', 'Orin Brightwire', 'Tavia Ashward'][n % 4],
        'Exceptional city defender — walls-and-wards duty', { x: 19, y: 9, z: 6 }), exceptionalCapabilities: ['city-scale ward defense'], institutionId: source.defenseId },
      // A bounded run-local maintenance requisition at an existing defense branch,
      // not an army, a new wall, or supplies awarded to either party.
      depot: { id: `${source.defenseId}:maintenance-receiving`, label: `${source.defenseName} wall-maintenance receiving desk`,
        required: 6, key: 'metalParts', stock: 0, receipts: [] },
      allocation: { populationSourceId: source.populationSourceId || null, people: 2, institutionId: source.defenseId },
      audience: null, terms: null, priorAudiences: [], priorTerms: [], job: null, contacts: [], copies: [], history: [], message: '', nextNumber: 1 };
  }
  function normalize(s) { return s?.source?.charterId && s.depot && Array.isArray(s.copies) ? copy(s) : null; }
  function note(s, at, kind, text) { s.history.push({ at, kind, text }); s.history = s.history.slice(-40); s.message = text; }
  function localReason(s, office, c) {
    if (!s || office?.id !== s.officeId || office.institutionId !== s.source.administrationId || office.cityId !== s.source.cityId) return 'No supported sovereign audience at this administration.';
    if (!c.alive || !c.capable || !c.atCounter || !c.clerkPresent || !c.lineOfSight || c.cityId !== s.source.cityId || !c.visitPermission || c.busy) return 'Attend the authorized civic counter in person, fit and free of other work.';
    if (!readyOffice(office) || !c.administrationAvailable || !c.defenseAvailable || c.authorityId !== s.source.authority.id) return 'The original administration or defense authority is unavailable; no replacement authority is invented.';
    if (![s.representative, s.defender].every(a => capable(a) && a.locationId === office.id) || !c.participantsPresent) return 'The named representative and defender must both be present and capable.';
    if (s.representative.assignment || s.defender.assignment) return 'The original representative or defender is allocated to other civic duties.';
    if (office.assignment && office.assignment !== s.job?.id) return 'The shared civic counter is assigned to other work.';
    return '';
  }
  function recordContacts(s, at) {
    for (const a of [s.representative, s.defender]) {
      let r = s.contacts.find(r => r.personId === a.id);
      if (!r) { r = { personId: a.id, firstMetAt: at }; s.contacts.push(r); }
      Object.assign(r, { name: a.name, role: a.role, lastConfirmedAt: at, institutionId: a === s.defender ? s.source.defenseId : s.source.administrationId,
        location: 'Municipal civic counter at 17,8', source: 'Personal attendance; role confirmed by the city administration' });
    }
  }
  function release(s, office, at) {
    if (office?.assignment === s.job?.id) { office.assignment = null; office.availableAt = at; }
    s.job = null;
  }
  function cancel(s, office, at) {
    if (!s?.job) return false;
    if (s.job.kind === 'audience') s.audience.status = 'interrupted';
    release(s, office, at); note(s, at, 'interruption', 'Attendance ended. Spent staff work remains spent; delivered goods and existing copies remain.'); return true;
  }
  function begin(s, office, kind, seconds, c, at) {
    if (localReason(s, office, c) || s.job || office.power < 1 || office.workSeconds < seconds
      || s.representative.workSeconds < seconds || s.defender.workSeconds < seconds || at < (office.availableAt || 0)) return false;
    const id = `${s.officeId}:sovereign-work:${s.nextNumber++}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: at, wasReady: true, bodyEpoch: c.bodyEpoch,
      representativeId: s.representative.id, defenderId: s.defender.id };
    office.power--; office.assignment = id; return true;
  }
  const canRequest = s => Boolean(s && !s.job && s.depot.stock < s.depot.required && !s.copies.length
    && (!s.audience || s.audience.status === 'expired' || ['declined', 'expired'].includes(s.terms?.status)));
  function request(s, office, c, at, readyAt) {
    const reason = localReason(s, office, c);
    if (reason || !canRequest(s) || !Number.isFinite(readyAt)) {
      if (s) s.message = reason || 'The one maintenance requisition already has an audience or is filled; repeated applications cannot reroll terms.';
      return false;
    }
    if (s.audience) s.priorAudiences.push(copy(s.audience));
    if (s.terms) s.priorTerms.push(copy(s.terms));
    s.terms = null;
    s.audience = { id: `${s.officeId}:supply-audience:${s.nextNumber++}`, status: 'queued', filedAt: at, readyAt, expiresAt: readyAt + OFFER_SECONDS };
    recordContacts(s, at); note(s, at, 'request', 'Requested a sovereign supply audience through the existing administration. No fee, criminal allegation, appointment or surrender follows from asking.'); return true;
  }
  function attend(s, office, c, at) {
    const a = s?.audience;
    if (!a || !['queued', 'interrupted'].includes(a.status) || at < a.readyAt || at >= a.expiresAt
      || !begin(s, office, 'audience', AUDIENCE_SECONDS, c, at)) return false;
    a.status = 'attending'; note(s, at, 'attendance', 'Audience started with the authorized representative and exceptional defender. Remain at the counter; no information has been released.'); return true;
  }
  function sign(s, office, expected, c, at) {
    const t = s?.terms;
    if (localReason(s, office, c) || !t || t.status !== 'offered' || at >= t.expiresAt || t.bodyEpoch !== c.bodyEpoch || JSON.stringify(t) !== JSON.stringify(expected)) return false;
    t.status = 'signed'; t.signedAt = at; t.deliverBy = at + DELIVERY_SECONDS; t.bodyEpoch = c.bodyEpoch;
    note(s, at, 'signature', 'Signed the exact finite maintenance-supply exchange. No goods moved, map was released or command was granted.'); return true;
  }
  function decline(s, office, c, at) {
    if (localReason(s, office, c) || !s.terms || !['offered', 'signed'].includes(s.terms.status) || s.job) return false;
    s.terms.status = 'declined'; note(s, at, 'decline', 'Declined the exchange without a criminal allegation. Any already accepted maintenance supplies remain at the stated defense installation; no automatic refund or map grant.'); return true;
  }
  function deliver(s, office, stacks, c, at) {
    const t = s?.terms;
    if (localReason(s, office, c) || !t || t.status !== 'signed' || at > t.deliverBy || t.bodyEpoch !== c.bodyEpoch || s.job) return false;
    const eligible = stacks.filter(i => i.carriedBy === 'scientist' && !i.reservedTaskId && i.key === t.key && i.quantity > 0
      && !i.toolInstanceId && !i.fixtureId && !i.containerId && !i.tags?.includes('contaminated'));
    const amount = Math.min(t.quantity - s.depot.stock, eligible.reduce((n, i) => n + Math.floor(i.quantity), 0));
    const work = 60 + amount * 30;
    if (amount <= 0 || office.workSeconds < work || s.defender.workSeconds < work) return false;
    let remaining = amount; const manifest = [];
    for (const i of eligible) {
      const n = Math.min(remaining, Math.floor(i.quantity)); if (!n) continue;
      manifest.push({ stackId: i.id, key: i.key, quantity: n }); i.quantity -= n; i.knownQuantity = Math.min(i.knownQuantity ?? i.quantity, i.quantity); remaining -= n;
    }
    s.depot.stock += amount; office.workSeconds -= work; s.defender.workSeconds -= work;
    s.depot.receipts.push({ id: `${t.id}:delivery:${s.depot.receipts.length + 1}`, at, quantity: amount, manifest,
      custodianId: s.defender.id, destinationId: s.depot.id });
    recordContacts(s, at); note(s, at, 'delivery', `Received ${amount} metal parts at the identified defense installation (${s.depot.stock}/${t.quantity}). No map until the whole consignment is received and the copy is prepared.`); return true;
  }
  function claim(s, office, c, at) {
    if (!s?.terms || s.terms.status !== 'signed' || s.terms.bodyEpoch !== c.bodyEpoch || s.depot.stock !== s.terms.quantity
      || !begin(s, office, 'copy', COPY_SECONDS, c, at)) return false;
    // Fulfilled deliveries remain claimable after the delivery deadline.
    note(s, at, 'copyStarted', 'The fulfilled consignment authorizes one restricted copy. Remain while the existing office prepares it.'); return true;
  }
  function advance(s, office, c, at) {
    if (!s || !c.alive) return false;
    let changed = false;
    if (s.audience && ['queued', 'interrupted'].includes(s.audience.status) && at >= s.audience.expiresAt) {
      s.audience.status = 'expired'; note(s, at, 'expiry', 'The audience window expired; no information, guilt or authority was created.'); changed = true;
    }
    if (s.terms?.status === 'offered' && at >= s.terms.expiresAt || s.terms?.status === 'signed' && s.depot.stock < s.terms.quantity && at > s.terms.deliverBy) {
      s.terms.status = 'expired'; note(s, at, 'expiry', 'The unfulfilled exchange expired. Received supplies remain in defense custody; no map, fine or criminal conviction is invented.'); changed = true;
    }
    const j = s.job;
    if (!j || at < j.lastAt) return changed;
    if (!c.atCounter || !c.visitPermission || !c.capable || c.bodyEpoch !== j.bodyEpoch || c.cityId !== s.source.cityId) return cancel(s, office, at);
    const available = !localReason(s, office, c) && s.representative.id === j.representativeId && s.defender.id === j.defenderId
      && office.workSeconds > 0 && s.representative.workSeconds > 0 && s.defender.workSeconds > 0;
    if (!available) { if (office?.assignment === j.id) office.assignment = null; j.wasReady = false; j.lastAt = at; s.message = 'Original participants or shared resources unavailable; no retroactive work.'; return changed; }
    office.assignment = j.id;
    const start = Math.max(j.lastAt, office.availableAt || 0);
    const work = j.wasReady ? Math.min(Math.max(0, at - start), j.seconds - j.progress, office.workSeconds, s.representative.workSeconds, s.defender.workSeconds) : 0;
    office.workSeconds -= work; s.representative.workSeconds -= work; s.defender.workSeconds -= work;
    j.progress += work; j.lastAt = at; j.wasReady = true;
    if (j.progress < j.seconds) return changed;
    const completedAt = start + work;
    recordContacts(s, completedAt);
    if (j.kind === 'audience') {
      s.audience.status = 'completed'; s.audience.completedAt = completedAt;
      s.terms = { id: `${s.audience.id}:terms`, status: 'offered', offeredAt: completedAt, expiresAt: completedAt + OFFER_SECONDS,
        charterId: s.source.charterId, authorityId: s.source.authority.id, representativeId: s.representative.id, defenderId: s.defender.id, bodyEpoch: j.bodyEpoch,
        destinationId: s.depot.id, destinationLabel: s.depot.label, key: s.depot.key, quantity: s.depot.required,
        compensation: 'One restricted city-end approach extract; no money or city control', routeId: s.source.archive.routeId,
        deliverySeconds: DELIVERY_SECONDS, partialDelivery: 'Accepted portions remain at the installation if you decline or miss the deadline. No refund or information for partial fulfilment.',
        disclosure: 'Only these terms and the delivered stack manifests; no laboratory records, identity history or unrelated discoveries.', limitations: LIMITS };
      note(s, completedAt, 'offer', 'Exact terms offered: six metal parts, physically received within three days, for one limited approach extract. Review before signing or decline without penalty.');
    } else {
      s.copies.push({ id: `${s.terms.id}:copy`, issuedAt: completedAt, sourceDate: s.source.archive.sourceDate,
        issuerId: s.source.defenseId, suppliedBy: copy(s.contacts), contents: copy(s.source.archive), limitations: LIMITS });
      s.terms.status = 'fulfilled'; note(s, completedAt, 'fulfilled', 'The exact consignment was received and the dated limited extract handed over. No current route safety, sovereignty or patron approval is inferred.');
    }
    release(s, office, completedAt); return true;
  }
  function publicView(s) {
    if (!s) return null;
    // Never publish the unreleased archive or unseen actor/resource changes.
    return { authority: copy(s.source.authority), charterId: s.source.charterId, succession: s.source.succession || 'Published charter procedure',
      contacts: copy(s.contacts), audience: s.audience ? copy(s.audience) : null, terms: s.terms ? copy(s.terms) : null,
      received: s.depot.receipts.reduce((n, r) => n + r.quantity, 0), receipts: copy(s.depot.receipts), copies: copy(s.copies),
      working: s.job ? { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds } : null, message: s.message, history: copy(s.history), limitations: LIMITS };
  }
  return { COUNTER, AUDIENCE_SECONDS, COPY_SECONDS, OFFER_SECONDS, DELIVERY_SECONDS, LIMITS, sourceFromWorld, create, normalize,
    localReason, canRequest, request, attend, sign, decline, deliver, claim, cancel, advance, publicView };
});
