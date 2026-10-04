(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoThreats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const words = {
    threaten: 'I will hit you now.', argue: 'This is unfair. I will complain about you.',
    refuse: 'I refuse to discuss this.', explain: 'I need help understanding this appointment.', silent: ''
  };
  function provision(o, at) {
    if (o.threatPolicy) return;
    o.threatPolicy = { id: `${o.id}:immediate-threat-procedure`, active: true, publishedAt: at,
      text: 'An identified immediate threat requires specific threatened harm, observed physical conduct, apparent means and current opportunity. Insults, refusal, silence and unresolved contrary explanations are insufficient. Separate local judicial review; peaceful execution only; prompt review and six-hour maximum custody. No conviction.' };
  }
  function begin(g, j, p, site, at) {
    const o = g.custodyOffice, layout = site.encounter;
    const choice = p.threatPreferences?.response;
    if (!Object.hasOwn(words, choice) || !layout || !Number.isFinite(layout.separationMeters) || layout.separationMeters < 1
      || layout.separationMeters > 20 || !site.publicAccess || o.officers.length !== 2
      || o.officers.some(x => !able(x) || x.locationId !== site.id) || !able(p)) return false;
    j.encounter = { id: `${j.id}:encounter`, at, lastAt: at, siteId: site.id, cityId: g.cityId, personId: p.id,
      targetId: o.officers[0].id, witnessId: o.officers[1].id, document: copy(j.document),
      startDistanceMeters: layout.separationMeters, distanceMeters: layout.separationMeters,
      statement: words[choice], stance: choice === 'threaten' && p.physicalCapabilities?.unarmedStrike === true ? 'raisedFist' : 'neutral',
      explanation: String(p.threatPreferences?.explanation || '').slice(0, 400), updates: [], movedMeters: 0 };
    // This is local movement at the known desk, not detention or a trip elsewhere.
    p.assignment = j.id; p.locationId = j.personLocation = site.id;
    p.localPosition = { encounterId: j.encounter.id, targetId: j.encounter.targetId, distanceMeters: layout.separationMeters };
    j.ground = 'immediateThreat'; j.phase = 'threatEncounter'; j.wasReady = true;
    return true;
  }
  function update(g, j, p, site, at) {
    const e = j.encounter;
    if (!e || j.custodyActive || e.endedAt != null || at < e.lastAt) return;
    e.lastAt = at;
    const reaction = p?.threatPreferences?.reaction;
    let text = '';
    if (reaction === 'retract') text = 'I withdraw that threat. I will not attack.';
    if (reaction === 'explain') text = String(p.threatPreferences.explanation || 'That gesture was not an attempt to threaten you.').slice(0, 400);
    if (reaction === 'disengage') text = 'I will lower my hands and end this encounter.';
    const witnessed = able(p) && p.locationId === e.siteId
      && g.custodyOffice.officers.some(x => x.id === e.witnessId && able(x) && x.locationId === e.siteId);
    if (text && witnessed) {
      e.updates.push({ at, witnessId: e.witnessId, statement: text }); e.endedAt = at; e.stance = 'neutral';
      if (reaction === 'explain') e.explanation = text;
    }
    if (!witnessed || !site?.publicAccess || !site.encounter?.visible || site.encounter.barrier || p?.locationId !== e.siteId) e.endedAt ??= at;
  }
  function observe(g, d, j, p, site, at, seconds) {
    const o = g.custodyOffice, e = j.encounter;
    if (!e || !able(p) || p.assignment !== j.id || p.locationId !== e.siteId
      || o.officers.some(x => !able(x) || x.locationId !== e.siteId)) return false;
    update(g, j, p, site, at);
    const canApproach = e.stance === 'raisedFist' && e.endedAt == null && site.encounter.visible && !site.encounter.barrier;
    const used = canApproach ? Math.min(seconds, Math.max(0, e.distanceMeters - 1), p.provisions * 28800,
      ...o.officers.map(x => Math.min(x.workSeconds, x.provisions * 28800))) : 0;
    e.distanceMeters -= used; e.movedMeters += used; p.provisions -= used / 28800; p.fatigue += used / 3600;
    p.localPosition.distanceMeters = e.distanceMeters;
    for (const x of o.officers) { x.workSeconds -= used; x.provisions -= used / 28800; }
    if (canApproach && e.distanceMeters > 1 && at < e.at + 60) return false;
    e.reportedAt = at;
    const report = { id: `${e.id}:observation`, encounterId: e.id, at, validUntil: at + 300,
      cityId: g.cityId, siteId: e.siteId, personId: p.id, actorId: d.actorId, appearanceId: d.appearance.id,
      document: copy(j.document), witnessId: e.witnessId, targetId: e.targetId, statement: e.statement,
      stance: e.stance, distanceMeters: e.distanceMeters, movedMeters: e.movedMeters,
      visibility: site.encounter.visible ? 'clear' : 'obstructed', barrier: site.encounter.barrier,
      means: e.stance === 'raisedFist' && p.physicalCapabilities?.unarmedStrike === true ? 'observedFunctionalUnarmedStrike' : 'noneObserved',
      explanation: e.explanation, updates: copy(e.updates),
      limit: 'One firsthand observation and its retained copy, not independent corroboration. No inferred private intent, magical power, attack, injury or guilt.' };
    o.witnessRecords.push({ report: copy(report), status: 'retained' }); j.submission = copy(report);
    return true;
  }
  function supported(g, d, j) {
    const o = g.custodyOffice, r = j.submission, e = j.encounter;
    const originals = o.witnessRecords.filter(x => x.report.id === r?.id);
    return Boolean(o.threatPolicy?.active && r && e && originals.length === 1 && originals[0].status === 'retained'
      && same(originals[0].report, r) && r.encounterId === e.id && r.personId === j.personId
      && r.actorId === d.actorId && r.appearanceId === d.appearance.id && r.cityId === g.cityId && r.siteId === j.location.siteId
      && same(r.document, j.document) && same(r.document, d.appearance.document)
      && r.witnessId === e.witnessId && r.targetId === e.targetId
      && new Set([r.personId, r.witnessId, r.targetId, g.cargoCourt.judge.id]).size === 4
      && o.officers.some(x => x.id === r.witnessId) && o.officers.some(x => x.id === r.targetId)
      && r.statement === words.threaten && r.stance === 'raisedFist' && r.means === 'observedFunctionalUnarmedStrike'
      && r.statement === e.statement && r.distanceMeters === e.distanceMeters && r.movedMeters === e.movedMeters && r.at === e.reportedAt
      && Number.isFinite(r.distanceMeters) && r.distanceMeters >= 0 && r.distanceMeters <= 1 && r.movedMeters > 0
      && r.visibility === 'clear' && r.barrier === false && !r.explanation && !e.explanation && !r.updates.length
      && !e.updates.length && o.threatPolicy.publishedAt <= e.at && r.at >= e.at && r.validUntil === r.at + 300);
  }
  function current(g, j, p, site, at) {
    const e = j.encounter;
    return Boolean(e && e.endedAt == null && at < j.submission?.validUntil && able(p)
      && p.assignment === j.id && p.locationId === e.siteId && p.physicalCapabilities?.unarmedStrike === true
      && p.localPosition?.encounterId === e.id && p.localPosition.distanceMeters <= 1
      && site.publicAccess && site.encounter?.visible && !site.encounter.barrier
      && g.custodyOffice.officers.every(x => able(x) && x.locationId === e.siteId));
  }
  return { provision, begin, update, observe, supported, current };
});
