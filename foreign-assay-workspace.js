(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./leased-annex') : root.HelixLeasedAnnex);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignAssayWorkspace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Lease) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const banned = c => (c.bans || []).some(b => b.status === 'active' && (b.cityId === c.cityId
    || (b.recognizedBy || []).some(r => r.cityId === c.cityId && r.status === 'active' && r.localOrderId && r.institutionId)));
  const PURPOSE = 'Manual analysis of sealed nonliving sample portions and personal calibration of the tenant\'s usable Assay Case only. No instrument repair or other instrument calibration. No genetic modification, creature creation, animancy, extraction, fabrication, hazardous bulk processing or tenant staffing.';
  function diagnosticScopeReason(workflowId, instrumentId) {
    return workflowId === 'assaySample' || workflowId === 'calibrateInstrument' && instrumentId === 'assayCase'
      ? '' : 'Only manual sealed nonliving assays and personal Assay Case calibration are authorized at this foreign bench.';
  }
  function supportingBranch(city, standings, authority) {
    if (!city?.cityId || !Number.isFinite(city.currentPopulation) || city.currentPopulation < 4
      || city.physicalCondition === 'ruined' || ['abandoned', 'destroyed'].includes(city.habitationStatus)
      || !authority?.currentAuthority || !authority.administrationId || authority.cityId !== city.cityId) return null;
    return standings?.find(e => e.network?.category === 'research' && e.network.id && e.branch?.id
      && e.branch.organizationForm === 'localLaboratory' && e.branch.publicPhysicalPresence === true
      && (e.branch.currentCityId || e.branch.cityId) === city.cityId
      && ['licensed', 'chartered'].includes(e.standing) && e.branch.operationalStatus === 'active'
      && !['destroyed', 'ruined'].includes(e.branch.physicalCondition)
      && ['functional', 'strong', 'regionalHub'].includes(e.branch.capacityBand)) || null;
  }
  const route = s => ({ ok: true, municipal: true, cityId: s.property.cityId, distanceKm: 0 });
  function create(city, standings, authority, location, seed, now, theme) {
    const e = supportingBranch(city, standings, authority); if (!e) return null;
    const s = Lease.create(seed, { id: city.cityId, name: location.cityName }, route({ property: { cityId: city.cityId } }), now, theme);
    if (!s) return null;
    s.source = { branchId: e.branch.id, networkId: e.network.id, administrationId: authority.administrationId, people: 1 };
    s.roomId = `foreign-assay-${String(city.cityId).replace(/[^a-zA-Z0-9_-]/g, '-')}`; s.approachRoomId = `${s.roomId}-approach`; s.benchId = `${s.roomId}-bench`;
    s.property.id = s.roomId; s.property.name = `${e.branch.publicName} Manual Assay Workspace`;
    s.property.fixtureIds = [s.benchId]; s.property.distanceKm = .003; s.property.tenantStaffAuthorized = false; s.property.purpose = PURPOSE;
    s.property.privacy = 'The named research branch knows the tenant identity and declared assay purpose, not hidden laboratories or unrelated experiments. This is not a secrecy guarantee or research license.';
    s.actor = { id: `${e.branch.id}:assay-representative`, name: s.property.landlord.name, actorKind: 'foreignAssayRepresentative', kind: 'visitor',
      status: 'alive', health: 100, maxHealth: 100, fatigue: 0, present: true, roomId: s.roomId, mapCell: copy(location.representativeCell) };
    s.property.landlord.id = s.actor.id; s.permission = null; s.invitation = null;
    return s;
  }
  function current(s, c) { return Boolean(s && c.authority?.currentAuthority && c.authority.administrationId === s.source.administrationId
    && supportingBranch(c.city, c.standings, c.authority)?.branch.id === s.source.branchId); }
  function body(s, c) { return Boolean(c.alive && c.capable && c.originalBody && !c.custody && c.cityId === s?.property.cityId && c.local); }
  function contact(s, c) { return body(s, c) && c.atDesk && c.contact && !c.busy && s.actor.id === s.property.landlord.id
    && s.actor.status === 'alive' && s.actor.health >= 50 && s.actor.fatigue < 80; }
  function access(s, c, now) {
    if (!body(s, c) || s.lease?.settled) return false;
    const p = s.permission;
    if (p && p.bodyEpoch === c.bodyEpoch && p.propertyId === s.property.id && !s.lease?.settled) return true;
    const i = s.invitation;
    return Boolean(i && i.bodyEpoch === c.bodyEpoch && i.visitId === c.visitId && now < i.expiresAt && current(s, c));
  }
  function invite(s, c, now) {
    if (!body(s, c) || c.busy || banned(c) || !current(s, c) || !c.visitorPermit || c.visitorPermit.expiresAt <= now || c.visitorPermit.issuedAt > now
      || c.visitorPermit.cityId !== c.cityId || c.visitorPermit.bodyEpoch !== c.bodyEpoch || c.visitorPermit.visitId !== c.visitId
      || c.visitorPermit.scope !== 'visitorHallOnly' || s.lease?.settled) return false;
    s.invitation = { propertyId: s.property.id, bodyEpoch: c.bodyEpoch, visitId: c.visitId, issuedAt: now,
      expiresAt: c.visitorPermit.expiresAt, scope: 'Named workspace inspection desk and reception approach only; no work, lodging, trading or city roaming.' };
    return true;
  }
  function request(s, c, now) {
    if (!contact(s, c) || banned(c) || !access(s, c, now) || !current(s, c)) return { ok: false, reason: 'Reach the original branch representative under separate workspace access; current local authority and branch support are required.' };
    const q = Lease.request(s, route(s), now);
    if (q.ok) { Object.assign(s.quote, { bodyEpoch: c.bodyEpoch, visitId: c.visitId, tenant: c.tenant,
      branchId: s.source.branchId, administrationId: s.source.administrationId,
      permission: 'Named workspace and its reception approach only. Expiry stops assay and calibration work, not egress or belongings retrieval. No visitor-hall, trading, lodging or unrestricted city access.' }); return copy(s.quote); }
    return q;
  }
  function sign(s, c, expected, wallet, now) {
    if (!contact(s, c) || banned(c) || !access(s, c, now) || !current(s, c) || !Number.isFinite(wallet?.money)
      || expected?.bodyEpoch !== c.bodyEpoch || expected?.visitId !== c.visitId || expected?.tenant !== c.tenant) return { ok: false, reason: 'The original body must personally accept its current exact terms with the branch representative.' };
    const result = Lease.sign(s, route(s), expected, wallet, now, c.tenant);
    if (result.ok) s.permission = { id: `${s.lease.id}:${s.property.id}`, propertyId: s.property.id, bodyEpoch: c.bodyEpoch,
      issuerId: s.source.administrationId, branchId: s.source.branchId, issuedAt: now, scope: expected.permission };
    return result;
  }
  function workReason(s, c, now) {
    if (!body(s, c) || !c.atProperty || s?.permission?.bodyEpoch !== c.bodyEpoch) return 'The original tenant must physically attend this foreign workspace, free of custody or incapacity.';
    if (banned(c)) return 'A current local ban prevents operating this workspace; the lease grants no immunity.';
    if (!current(s, c)) return 'Current city authority or the licensed research branch no longer supports operating access; belongings and egress remain.';
    return Lease.usable(s, now) ? '' : 'Prepaid workspace lease expired or ended; only egress and belongings retrieval remain.';
  }
  function handBack(s, c, wallet, now) {
    if (!contact(s, c) || !c.atProperty || s?.permission?.bodyEpoch !== c.bodyEpoch || !c.inspected || !Number.isFinite(c.benchCondition) || !Number.isFinite(wallet?.money))
      return { ok: false, reason: 'Original tenant and representative must personally inspect and empty the workspace; no remote refund.' };
    return Lease.handBack(s, c, wallet, now);
  }
  function publicView(s, now) {
    if (!s) return null;
    return copy({ property: s.property, source: s.source, quote: s.quote, lease: s.lease, permission: s.permission,
      invitation: s.invitation, observation: s.observation, history: s.history, workAccess: Lease.usable(s, now) });
  }
  return { PURPOSE, diagnosticScopeReason, supportingBranch, create, current, body, access, invite, request, sign, workReason, handBack, publicView };
});
