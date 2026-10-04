(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoWitnessInterference = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  const requests = {
    falseAccount: 'You have found me here. Tell the court you did not find me here.',
    suppress: 'Keep your observation of finding me here out of your account to the court.',
    correct: 'Please check your account for errors and correct any mistakes.',
    disagree: 'I disagree with your interpretation of this visit.', refuse: 'I decline to discuss your account.', silent: ''
  };
  const replies = {
    refuse: 'I will not change or withhold what I personally observed.', report: 'I will report this request with my original account.',
    clarify: 'Are you asking me to correct an error? That needs clarification.', disengage: 'I am ending this conversation.',
    mislead: 'I will submit a different account saying I did not find you here.'
  };
  function provision(o, at) {
    if (o.interferencePolicy) return;
    o.interferencePolicy = { id: `${o.id}:witness-interference-procedure`, publishedAt: at, active: true,
      text: 'Specific witnessed attempts to induce a known witness to falsify or suppress a relevant account require separate review. Temporary custody additionally requires observed persistence and current opportunity. Correction requests, disagreement, silence, contradictions alone and unresolved explanations are insufficient. Peaceful local execution and prompt six-hour release safeguards only; no conviction.' };
    o.encounterAccounts = []; o.accountAmendments = [];
    o.officers.forEach(p => { p.interferencePreferences = { response: 'refuse', reaction: 'remain' }; });
  }
  function participants(g, j, p, site) {
    const e = j.interference, o = g.custodyOffice;
    return Boolean(e && able(p) && p.assignment === j.id && p.locationId === e.siteId
      && site?.id === e.siteId && site.publicAccess && site.encounter?.visible && !site.encounter.barrier
      && Number.isFinite(site.encounter.separationMeters) && site.encounter.separationMeters > 0 && site.encounter.separationMeters <= 5
      && o.officers.length === 2 && o.officers.every(x => able(x) && x.locationId === e.siteId)
      && o.officers[0].id === e.targetId && o.officers[1].id === e.observerId);
  }
  function begin(g, j, p, site, at, d) {
    const o = g.custodyOffice, attempt = j.attempts.at(-1), choice = p.interferencePreferences?.request;
    if (!Object.hasOwn(requests, choice) || !o.interferencePolicy || !site.publicAccess || !site.encounter?.visible
      || site.encounter.barrier || !(site.encounter.separationMeters > 0) || site.encounter.separationMeters > 5
      || o.officers.length !== 2 || o.officers.some(x => !able(x) || x.locationId !== site.id)
      || attempt?.outcome !== 'identified' || attempt.at !== at || attempt.siteId !== site.id
      || attempt.witnessId !== o.officers[0].id || attempt.personId !== p.id || !able(p)) return false;
    const id = `${j.id}:interference`, account = { id: `${id}:original-account`, at, personId: p.id,
      witnessId: o.officers[0].id, siteId: site.id, cityId: g.cityId, appearanceId: d.appearance.id,
      document: copy(j.document), observation: copy(attempt), statement: 'I personally found and identified this representative at the public receiving desk.',
      scope: 'This visit only. No firsthand knowledge of the earlier cargo transaction follows.' };
    o.encounterAccounts.push({ account: copy(account), status: 'retained' });
    j.interference = { id, at, lastAt: at, personId: p.id, targetId: o.officers[0].id, observerId: o.officers[1].id,
      siteId: site.id, account: copy(account), statement: requests[choice], explanation: String(p.interferencePreferences.explanation || '').slice(0, 400),
      statements: [], updates: [], progress: 0, stage: 'request' };
    j.ground = 'witnessInterference'; j.phase = 'interferenceEncounter'; j.wasReady = true;
    p.assignment = j.id; p.locationId = j.personLocation = site.id;
    return true;
  }
  function update(g, j, p, site, at) {
    const e = j.interference;
    if (!e || j.custodyActive || e.endedAt != null || at < e.lastAt) return;
    e.lastAt = at;
    if (!participants(g, j, p, site)) { e.endedAt = at; return; }
    const witnessReaction = g.custodyOffice.officers[0].interferencePreferences?.reaction;
    if (['disengage', 'clarify'].includes(witnessReaction)) {
      e.updates.push({ at, observerId: e.observerId, speakerId: e.targetId, statement: replies[witnessReaction] });
      if (witnessReaction === 'clarify') e.explanation = replies.clarify;
      e.endedAt = at; return;
    }
    const reaction = p.interferencePreferences?.reaction;
    if (['stop', 'explain'].includes(reaction)) {
      const statement = reaction === 'stop' ? 'I withdraw my request and will stop approaching you about that account.'
        : String(p.interferencePreferences.explanation || 'I was asking for an accurate correction, not concealment.').slice(0, 400);
      e.updates.push({ at, observerId: e.observerId, speakerId: p.id, statement }); e.endedAt = at;
      if (reaction === 'explain') e.explanation = statement;
    }
  }
  function observe(g, d, j, p, site, at, seconds) {
    const o = g.custodyOffice, e = j.interference;
    update(g, j, p, site, at);
    if (at > e.at + 120) e.endedAt ??= at;
    if (e.endedAt == null && participants(g, j, p, site)) {
      const work = Math.min(seconds, 30 - e.progress, p.provisions * 28800,
        ...o.officers.map(x => Math.min(x.workSeconds, x.provisions * 28800)));
      e.progress += work; p.provisions -= work / 28800;
      o.officers.forEach(x => { x.workSeconds -= work; x.provisions -= work / 28800; });
      if (e.progress < 30 && at < e.at + 120) return false;
      if (e.progress >= 30) {
        e.statements.push({ at, speakerId: p.id, observerId: e.observerId, accountId: e.account.id, statement: e.statement });
        if (e.stage === 'request') {
          const response = o.officers[0].interferencePreferences?.response;
          if (!Object.hasOwn(replies, response)) { e.endedAt = at; }
          else {
            e.reply = { at, speakerId: e.targetId, observerId: e.observerId, statement: replies[response] };
            if (response === 'mislead') {
              const amendment = { id: `${e.id}:amendment`, originalId: e.account.id, witnessId: e.targetId, at,
                statement: 'I did not find this representative at the public receiving desk.',
                scope: 'Later witness account; original retained. Contradiction requires examination, not automatic proof of falsity or guilt.' };
              o.accountAmendments.push(copy(amendment)); e.amendment = copy(amendment);
            }
            if (response === 'clarify') { e.explanation ||= replies.clarify; e.endedAt = at; }
            if (response === 'disengage') e.endedAt = at;
          }
          if (e.endedAt == null && p.interferencePreferences?.continuePressing === true) {
            e.stage = 'repeat'; e.progress = 0; return false;
          }
        }
      }
    }
    e.reportedAt = at;
    const report = { id: `${e.id}:report`, at, validUntil: at + 300, encounterId: e.id, personId: p.id, actorId: d.actorId,
      cityId: g.cityId, siteId: e.siteId, appearanceId: d.appearance.id, document: copy(j.document),
      account: copy(e.account), statements: copy(e.statements), reply: copy(e.reply || null), amendment: copy(e.amendment || null),
      explanation: e.explanation, observerId: e.observerId, targetId: e.targetId,
      limit: 'One observed approach and its retained copy. The witness and their original/amended account are one source for the visit. No private choices, inferred intent, underlying cargo guilt or automatic finding that an amendment is false.' };
    o.witnessRecords.push({ report: copy(report), status: 'retained' }); j.submission = copy(report); return true;
  }
  function supported(g, d, j) {
    const o = g.custodyOffice, e = j.interference, r = j.submission;
    const sources = o.witnessRecords.filter(x => x.report.id === r?.id), accounts = o.encounterAccounts.filter(x => x.account.id === e?.account.id);
    const amendment = e?.amendment;
    return Boolean(e && r && o.interferencePolicy?.active && o.interferencePolicy.publishedAt <= e.at
      && sources.length === 1 && sources[0].status === 'retained' && same(sources[0].report, r)
      && accounts.length === 1 && accounts[0].status === 'retained' && same(accounts[0].account, e.account) && same(r.account, e.account)
      && same(e.account.observation, j.attempts.find(x => x.at === e.account.at && x.outcome === 'identified'))
      && e.account.observation.personId === j.personId && e.account.observation.witnessId === e.targetId
      && e.account.personId === j.personId && e.account.witnessId === e.targetId && e.account.siteId === j.location.siteId
      && e.account.cityId === g.cityId && e.account.appearanceId === d.appearance.id && same(e.account.document, j.document)
      && r.actorId === d.actorId && r.personId === j.personId && r.encounterId === e.id && r.cityId === g.cityId
      && r.siteId === e.siteId && r.appearanceId === d.appearance.id && same(r.document, d.appearance.document)
      && r.observerId === e.observerId && r.targetId === e.targetId
      && new Set([r.personId, e.observerId, e.targetId, g.cargoCourt.judge.id]).size === 4
      && o.officers.some(x => x.id === e.observerId) && o.officers.some(x => x.id === e.targetId)
      && same(r.statements, e.statements) && same(r.reply, e.reply || null) && same(r.amendment, amendment || null)
      && (!amendment || (o.accountAmendments.filter(x => x.id === amendment.id).length === 1 && same(o.accountAmendments.find(x => x.id === amendment.id), amendment)))
      && e.statements.length === 2 && e.statements[1].at > e.statements[0].at && e.reply?.at === e.statements[0].at
      && e.statements.every(x => Number.isFinite(x.at) && x.at >= e.at && x.at <= r.at && x.speakerId === j.personId && x.observerId === e.observerId && x.accountId === e.account.id
        && [requests.falseAccount, requests.suppress].includes(x.statement))
      && !r.explanation && !e.explanation && !e.updates.length && r.at === e.reportedAt && r.validUntil === r.at + 300);
  }
  function current(g, j, p, site, at) {
    return Boolean(j.interference?.endedAt == null && at < j.submission?.validUntil && participants(g, j, p, site));
  }
  return { provision, begin, update, observe, supported, current };
});
