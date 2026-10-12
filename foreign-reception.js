(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./city-approach') : root.HelixCityApproach);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignReception = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Approach) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const FEE = 40, REVIEW = 180, ACCEPT = 60, VISIT = 21600;
  const LIMITS = 'Visitor hall and information counter only. No residence, employment, research, immunity, diplomatic recognition, city command, maps or resource surveys. Bring your own provisions; return transport is separate.';
  function publish(g, source, at) {
    if (g.visitorAdmission) return g.visitorAdmission;
    if (!source || source.cityId !== g.cityId || source.currentPopulation < 2 || source.physicalCondition === 'ruined'
      || !source.administrationId || source.administrationId !== g.institutionId || !source.lawId || !source.currentAuthority) return null;
    g.receptionWorkSeconds ??= 14400;
    g.visitorAdmission = { rule: { id: `${g.id}:visitor-rule`, cityId: g.cityId, authorityId: source.administrationId,
      lawId: source.lawId, publishedAt: at, fee: FEE, reviewSeconds: REVIEW, acceptanceSeconds: ACCEPT, visitSeconds: VISIT,
      scope: LIMITS, contact: { institutionId: source.administrationId, name: source.administrationName },
      localRules: copy(source.localRules || []) }, decisions: [], offers: [], permits: [], job: null, serial: 0, knowledge: null, message: '' };
    return g.visitorAdmission;
  }
  function fingerprint(c, includeConnection = true) {
    const { connection, ...evidence } = c.evidence || {};
    return JSON.stringify({ bodyEpoch: c.bodyEpoch, evidence: includeConnection ? { ...evidence, connection } : evidence, description: c.description,
      bans: c.bans, authorityCurrent: c.authorityCurrent });
  }
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  function present(g, c) {
    return c.alive && c.capable && c.local && c.atDesk && c.clerkPresent && c.lineOfSight && c.cityId === g.cityId;
  }
  function resources(g, c, job = null) {
    const own = job?.id;
    return present(g, c) && c.authorityCurrent && able(g.clerk) && g.powerSeconds > 0 && g.receptionWorkSeconds > 0
      && (!g.receptionAssignment || g.receptionAssignment === own) && !c.otherBusy
      && (!job || job.clerkId === g.clerk.id && job.bodyEpoch === c.bodyEpoch);
  }
  function issuerReady(o, id = null) {
    return o?.active && o.channelPowered && o.maintenanceReady !== false && able(o.clerk)
      && o.clerk.locationId === o.id && (!o.assignment || o.assignment === id) && o.workSeconds > 0;
  }
  function quote(g, c) {
    const s = g?.visitorAdmission;
    if (!s || s.job || !present(g, c)) return null;
    return { ruleId: s.rule.id, cityId: g.cityId, documentNumber: c.evidence?.sourceRecordId || null,
      fee: FEE, reviewSeconds: REVIEW, acceptanceSeconds: ACCEPT, visitSeconds: VISIT, scope: LIMITS,
      verificationConsent: true, facts: fingerprint(c) };
  }
  function release(g, issuer, j, at) {
    if (g.receptionAssignment === j.id) g.receptionAssignment = null;
    if (issuer?.assignment === j.id) { issuer.assignment = null; issuer.availableAt = at; }
  }
  function begin(g, issuer, expected, c, wallet, at) {
    const s = g?.visitorAdmission, q = quote(g, c);
    if (!q || !same(expected, q) || !resources(g, c) || wallet.money < FEE) return false;
    const previous = s.decisions.find(d => d.facts === q.facts);
    if (previous && ['pending', 'refused'].includes(previous.status)) { s.message = 'Unchanged facts retain the recorded decision; no new fee or reroll.'; return false; }
    if (s.offers.some(o => o.facts === q.facts && !o.acceptedAt && at < o.expiresAt)
      || s.permits.some(p => p.bodyEpoch === c.bodyEpoch && p.visitId === c.visitId && at < p.expiresAt)) return false;
    const verify = Boolean(c.evidence?.present && c.evidence.connection && ['automatic', 'verified', 'domestic'].includes(c.evidence.recognition));
    if (verify && (!issuerReady(issuer) || issuer.power < 1 || issuer.workSeconds < REVIEW || issuer.availableAt > at)) return false;
    const id = `${g.id}:visitor-work:${++s.serial}`;
    if (verify) { issuer.assignment = id; issuer.power--; }
    wallet.money -= FEE; g.visitorFees = (g.visitorFees || 0) + FEE; g.receptionAssignment = id;
    s.job = { id, kind: 'review', clerkId: g.clerk.id, bodyEpoch: c.bodyEpoch, visitId: c.visitId,
      issuerId: verify ? issuer.id : null, facts: q.facts, grounds: fingerprint(c, false), quote: copy(q), progress: 0, seconds: REVIEW, lastAt: at, wasReady: true };
    s.message = 'Processing started. $40 is nonrefundable; only the presented identity record may be verified. Remain at the original desk.';
    return true;
  }
  function accept(g, expected, c, at) {
    const s = g?.visitorAdmission, o = s?.offers.find(o => o.id === expected?.id);
    if (!o || !same(o, expected) || s.job || o.acceptedAt != null || at >= o.expiresAt || o.facts !== fingerprint(c)
      || o.bodyEpoch !== c.bodyEpoch || o.visitId !== c.visitId || !resources(g, c)) return false;
    const id = `${g.id}:visitor-work:${++s.serial}`; g.receptionAssignment = id;
    s.job = { id, kind: 'accept', clerkId: g.clerk.id, bodyEpoch: c.bodyEpoch, visitId: c.visitId,
      offerId: o.id, facts: o.facts, grounds: fingerprint(c, false), progress: 0, seconds: ACCEPT, lastAt: at, wasReady: true };
    return true;
  }
  function cancel(g, issuer, at, reason = 'Cancelled; partial work and processing fee remain spent.') {
    const j = g?.visitorAdmission?.job; if (!j) return false;
    release(g, issuer, j, at); g.visitorAdmission.job = null; g.visitorAdmission.message = reason; return true;
  }
  function advance(g, issuer, c, at) {
    const s = g?.visitorAdmission; if (!s || !c.alive) return false;
    let changed = false;
    for (const p of s.permits) if (!p.warned && p.bodyEpoch === c.bodyEpoch && p.visitId === c.visitId && c.local && at >= p.expiresAt - 900) {
      p.warned = true; s.message = at >= p.expiresAt ? 'Visitor permission expired. Walk back to the outer stand; no eviction or custody is invented.' : 'Visitor permission expires in fifteen minutes. The outer stand remains accessible.'; changed = true;
    }
    const j = s.job;
    if (!j) return changed;
    if (at < j.lastAt) return changed;
    const previousAt = j.lastAt, elapsed = Math.max(0, at - previousAt); j.lastAt = at;
    if (j.bodyEpoch !== c.bodyEpoch || j.visitId !== c.visitId || j.grounds !== fingerprint(c, false)) {
      cancel(g, issuer, at, 'The original body, visit or presented facts changed. Partial work and fees remain; no approval was invented.'); return true;
    }
    const offer = s.offers.find(o => o.id === j.offerId);
    const ready = resources(g, c, j) && (!j.issuerId || issuer?.id === j.issuerId && issuerReady(issuer, j.id));
    if (!ready) {
      if (j.kind === 'accept' && at >= offer.expiresAt) { cancel(g, issuer, at, 'Unsigned offer expired; no visitor permission created.'); return true; }
      release(g, issuer, j, at); j.wasReady = false; return changed;
    }
    g.receptionAssignment = j.id; if (j.issuerId) issuer.assignment = j.id;
    if (!j.wasReady) { j.wasReady = true; return true; }
    const work = Math.min(elapsed, j.kind === 'accept' ? Math.max(0, offer.expiresAt - previousAt) : Infinity,
      j.seconds - j.progress, g.receptionWorkSeconds, g.powerSeconds,
      j.issuerId ? issuer.workSeconds : Infinity);
    j.progress += work; g.receptionWorkSeconds -= work; g.powerSeconds -= work;
    if (j.issuerId) issuer.workSeconds -= work;
    const completedAt = previousAt + work;
    if (j.progress + 1e-8 < j.seconds || j.kind === 'accept' && completedAt >= offer.expiresAt) {
      if (j.kind === 'accept' && at >= offer.expiresAt) { cancel(g, issuer, at, 'Unsigned offer expired; partial acceptance work remains spent, with no permission created.'); return true; }
      return changed || work > 0;
    }
    if (j.kind === 'review') {
      const evidence = { ...c.evidence, connection: ['automatic', 'verified', 'domestic'].includes(c.evidence.recognition) ? Boolean(j.issuerId && c.evidence.connection) : c.evidence.connection };
      const d = Approach.decision({ id: 'scientist' }, g, evidence, c.bans || [], completedAt);
      const record = { ...d, id: `${j.id}:finding`, facts: j.facts, bodyEpoch: j.bodyEpoch, visitId: j.visitId,
        scope: ['conditional', 'admitted'].includes(d.status) ? 'visitorHallOnly' : null };
      s.decisions.push(record);
      if (['conditional', 'admitted'].includes(d.status)) s.offers.push({ id: `${j.id}:offer`, decisionId: record.id,
        facts: j.facts, bodyEpoch: j.bodyEpoch, visitId: j.visitId, expiresAt: completedAt + 3600, acceptedAt: null,
        scope: LIMITS, visitSeconds: VISIT, contact: copy(s.rule.contact) });
      s.message = ['conditional', 'admitted'].includes(d.status) ? 'Limited visitor-hall terms offered for one hour. Separate attended acceptance and physical gate passage are required.' : d.reason;
    } else {
      offer.acceptedAt = completedAt;
      s.permits.push({ id: `${j.id}:permit`, offerId: offer.id, bodyEpoch: j.bodyEpoch, visitId: j.visitId,
        cityId: g.cityId, issuedAt: completedAt, expiresAt: completedAt + VISIT, scope: 'visitorHallOnly', warned: false });
      s.message = 'Six-hour visitor-hall permission signed. Physically walk through the gate; supplies, maps and onward access are not included.';
    }
    release(g, issuer, j, at); s.job = null; return true;
  }
  function permission(g, bodyEpoch, visitId, at) {
    return g?.visitorAdmission?.permits.find(p => p.bodyEpoch === bodyEpoch && p.visitId === visitId && p.issuedAt <= at && at < p.expiresAt) || null;
  }
  function observe(g, c, at) {
    const s = g?.visitorAdmission; if (!s || !present(g, c) || !able(g.clerk)) return s?.knowledge || null;
    const view = { at, rule: copy(s.rule), message: s.message, clerkName: g.clerk.name,
      decisions: s.decisions.map(({ facts, bodyEpoch, ...r }) => copy(r)),
      offers: s.offers.map(({ facts, bodyEpoch, ...o }) => copy(o)),
      permits: s.permits.map(({ bodyEpoch, ...p }) => copy(p)),
      working: s.job ? { kind: s.job.kind, progress: s.job.progress, seconds: s.job.seconds } : null };
    s.knowledge = view; return view;
  }
  return { FEE, REVIEW, ACCEPT, VISIT, LIMITS, publish, fingerprint, quote, begin, accept, cancel, advance, permission, observe };
});
