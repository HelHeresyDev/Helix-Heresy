(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoEvidenceDestruction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const acknowledgment = 'I understand this named record relates to the case; I am deleting it to prevent its use.';
  function provision(o, at) {
    o.destructionPolicy ||= { id: `${o.id}:evidence-destruction-procedure`, publishedAt: at, active: true,
      text: 'Knowing interference with a specifically relevant record requires witnessed conduct and separate review. Temporary custody additionally requires a current opportunity for further interference. Missing records, ordinary disposal, correction, silence and unresolved explanations are insufficient. Peaceful production and six-hour release only; no conviction, search or seizure power.' };
  }
  const record = (b, e) => b?.buyerService?.records.find(r => (r.document || r.header)?.id === e?.recordId);
  function access(j, p, site, b) {
    const e = j.destruction, t = b?.buyerService?.recordsTerminal, r = record(b, e);
    return Boolean(e && able(p) && p.assignment === j.id && p.locationId === site?.id && site.id === e.siteId
      && t?.id === e.terminalId && t.ownerId === b.id && t.locationId === site.id && t.job === e.id
      && t.powered && t.condition >= 50 && t.energySeconds > 0 && t.workSeconds > 0 && p.provisions > 0
      && t.permissions.some(x => x.personId === p.id && x.read && x.delete) && r?.document && r.status !== 'deleted');
  }
  function visible(g, j, site, b) {
    return Boolean(site?.publicAccess && site.encounter?.visible && !site.encounter.barrier
      && site.encounter.separationMeters > 0 && site.encounter.separationMeters <= 5
      && b?.buyerService?.recordsTerminal?.publicDisplay && g.custodyOffice.officers.length === 2
      && g.custodyOffice.officers.every(x => able(x) && x.locationId === site.id && x.workSeconds > 0 && x.provisions > 0)
      && g.custodyOffice.officers[1].id === j.destruction.observerId);
  }
  function stop(j, b, at, outcome) {
    const e = j.destruction, t = b?.buyerService?.recordsTerminal;
    if (!e || e.endedAt != null) return;
    e.endedAt = at; e.outcome = outcome;
    if (t?.job === e.id) t.job = null;
  }
  function begin(g, j, p, site, at, d, b) {
    const pref = p.recordPreferences, t = b?.buyerService?.recordsTerminal;
    const r = b?.buyerService?.records.find(r => r.document?.id === pref?.recordId && r.status !== 'deleted');
    if (!['preserve', 'correct', 'dispose', 'delete', 'abandon'].includes(pref?.action) || !r || !t || t.job
      || t.ownerId !== b.id || t.locationId !== site.id || !t.powered || t.condition < 50 || t.energySeconds <= 0 || t.workSeconds <= 0
      || !t.permissions.some(x => x.personId === p.id && x.read) || !able(p)
      || g.custodyOffice.officers.length !== 2) return false;
    const e = j.destruction = { id: `${j.id}:record-operation`, at, lastAt: at, personId: p.id, siteId: site.id,
      terminalId: t.id, recordId: r.document.id, observerId: g.custodyOffice.officers[1].id,
      action: pref.action, progress: 0, observedSeconds: 0, observations: [] };
    j.ground = 'evidenceDestruction'; j.phase = 'destructionEncounter'; j.wasReady = true;
    p.assignment = j.id; p.locationId = j.personLocation = site.id; t.job = e.id;
    e.authorizedDisposal = t.disposalPermissions.some(x => x.recordId === e.recordId && x.personId === p.id && x.ownerId === b.id && x.grantedAt <= at);
    if (visible(g, j, site, b)) {
      const stackId = d.proposals.at(-1)?.disclosure?.evidence?.observation?.stackId;
      if (stackId && r.document.items.some(x => x.stackId === stackId)) {
        e.notice = { at, recordId: e.recordId, stackId, docketId: d.id, witnessId: e.observerId,
          statement: 'This displayed record references the cargo identified in this case. This notice grants no search or seizure authority.' };
        e.statement = pref.acknowledgeRelevance === true && pref.action === 'delete' ? acknowledgment : 'I am handling this local record.';
      }
      e.explanation = String(pref.explanation || '').slice(0, 400);
    }
    if (pref.action === 'correct') t.correctionRequests.push({ at, recordId: e.recordId, personId: p.id,
      text: String(pref.explanation || 'Please check this record for errors.').slice(0, 400), status: 'requested' });
    if (['preserve', 'correct', 'abandon'].includes(pref.action)) stop(j, b, at, pref.action);
    if (pref.action === 'dispose' && !e.authorizedDisposal) stop(j, b, at, 'noDisposalPermission');
    e.wasReady = access(j, p, site, b) && e.endedAt == null;
    e.wasVisible = visible(g, j, site, b);
    return true;
  }
  function update(g, j, p, site, at, b) {
    const e = j.destruction;
    if (!e || e.endedAt != null || at < e.lastAt) return;
    const dt = at - e.lastAt; e.lastAt = at;
    if (j.custodyActive || ['releaseReturn', 'officerReturn', 'closed'].includes(j.phase)) { stop(j, b, at, 'ended'); return; }
    if (['stop', 'explain'].includes(p?.recordPreferences?.reaction)) { stop(j, b, at, 'abandoned'); return; }
    const ready = access(j, p, site, b);
    if (!ready || at > e.at + 600) { stop(j, b, at, 'interrupted'); return; }
    const t = b.buyerService.recordsTerminal;
    const work = e.wasReady ? Math.min(dt, 180 - e.progress, t.workSeconds, t.energySeconds, p.provisions * 28800) : 0;
    e.wasReady = ready; e.progress += work; t.workSeconds -= work; t.energySeconds -= work; p.provisions -= work / 28800;
    const seen = visible(g, j, site, b);
    if (work > 0 && seen && e.wasVisible) {
      const witnessed = Math.min(work, ...g.custodyOffice.officers.map(x => Math.min(x.workSeconds, x.provisions * 28800)));
      g.custodyOffice.officers.forEach(x => { x.workSeconds -= witnessed; x.provisions -= witnessed / 28800; });
      e.observedSeconds += witnessed;
      e.observations.push({ at, recordId: e.recordId, witnessId: e.observerId, action: 'local deletion in progress', seconds: witnessed });
    }
    e.wasVisible = seen;
    if (e.progress >= 180) {
      const r = record(b, e); r.document = null; r.status = 'deleted';
      r.deletion = { at, terminalId: t.id, personId: p.id };
      if (visible(g, j, site, b)) e.observations.push({ at, recordId: e.recordId, witnessId: e.observerId, action: 'terminal confirms local deletion' });
      stop(j, b, at, 'deleted');
    }
  }
  function observe(g, d, j, p, site, at, seconds, b) {
    const e = j.destruction;
    if (e.endedAt == null && e.progress < 30) return false;
    const report = { id: `${e.id}:report`, at, validUntil: at + 300, cityId: g.cityId, actorId: d.actorId,
      personId: p.id, encounterId: e.id, siteId: e.siteId, appearanceId: d.appearance.id, document: copy(j.document),
      observerId: e.observerId, notice: copy(e.notice || null), statement: e.statement || '', explanation: e.explanation || '',
      observations: copy(e.observations),
      limit: 'Visible local operation and spoken notice only; no recovered contents, inferred intent, remote deletion, conviction or automatic authority over remaining records.' };
    e.report = copy(report); j.submission = copy(report);
    g.custodyOffice.witnessRecords.push({ report: copy(report), status: 'retained' }); return true;
  }
  function supported(g, d, j) {
    const e = j.destruction, r = j.submission, o = g.custodyOffice;
    const sources = o.witnessRecords.filter(x => x.report.id === r?.id);
    return Boolean(e && r && o.destructionPolicy.active && o.destructionPolicy.publishedAt <= e.at
      && sources.length === 1 && sources[0].status === 'retained' && same(sources[0].report, r) && same(e.report, r)
      && r.actorId === d.actorId && r.personId === j.personId && r.cityId === g.cityId && r.siteId === j.location.siteId
      && r.appearanceId === d.appearance.id && same(r.document, d.appearance.document) && r.encounterId === e.id
      && r.observerId === e.observerId && o.officers.some(x => x.id === r.observerId) && r.observerId !== g.cargoCourt.judge.id
      && new Set([j.personId, ...o.officers.map(x => x.id), g.cargoCourt.judge.id]).size === 4
      && j.attempts.some(x => x.at === e.at && x.personId === j.personId && x.siteId === e.siteId && x.outcome === 'identified')
      && r.notice?.recordId === e.recordId && r.notice.docketId === d.id && r.notice.witnessId === r.observerId
      && r.notice.at === e.at && same(r.notice, e.notice)
      && r.notice.stackId === d.proposals.at(-1)?.disclosure?.evidence?.observation?.stackId
      && r.statement === acknowledgment && !r.explanation && !e.authorizedDisposal
      && r.observations.some(x => x.recordId === e.recordId && x.witnessId === r.observerId && x.action === 'local deletion in progress' && x.seconds > 0)
      && r.validUntil === r.at + 300);
  }
  function current(g, j, p, site, at, b) {
    return Boolean(j.destruction?.endedAt == null && at < j.submission?.validUntil && access(j, p, site, b) && visible(g, j, site, b));
  }
  return { provision, begin, update, observe, supported, current, stop };
});
