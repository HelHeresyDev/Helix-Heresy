(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoCharging = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const able = person => person?.status === 'alive' && person.health >= 50;
  function provision(gate, at) {
    const intake = gate.criminalIntake;
    if (!gate.chargingOffice && intake?.institutionId && intake.cityId === gate.cityId && gate.jurisdiction === 'city') {
      gate.chargingOffice = { institutionId: intake.institutionId, cityId: gate.cityId, locationId: gate.id,
        prosecutor: { id: `${gate.id}:charging-prosecutor`, name: `${intake.institutionId} charging prosecutor`, status: 'alive', health: 100 },
        active: true, channelPowered: true, power: 12, workSeconds: 21600, lastAt: at, wasReady: false, job: null };
    }
  }
  function current(r) {
    const i = r.investigation, a = i?.assessments.at(-1);
    if (!a || r.reviewedRevision !== r.revisions.length || a.sourceRevision !== r.reviewedRevision
      || i.assessedSignature !== `${r.reviewedRevision}:${i.submissions.length}:${i.corrections.length}`) return null;
    return { assessment: a, evidence: r.revisions[r.reviewedRevision - 1].evidence,
      key: `${i.assessedSignature}:${i.assessments.length}`, at: a.at };
  }
  // Only independently observed people are candidates. An account, claimant channel,
  // named counterparty or matching string is not a person attribution bridge.
  function observedIds(e, a) {
    const ids = new Set((e.personObservations || []).map(p => p.id));
    for (const f of a.recipientFindings || []) for (const event of f.events || []) if (event.observationId) ids.add(event.observationId);
    for (const f of a.scientistIdentityFindings || []) for (const c of f.comparisons || []) if (c.receipt?.observationId) ids.add(c.receipt.observationId);
    for (const f of a.accountAccessFindings || []) for (const c of f.comparisons || [])
      if (c.receipt?.kind === 'accountAccessObservation') ids.add(c.receipt.id);
    for (const f of a.principalFindings || []) for (const c of f.comparisons || []) if (c.receipt?.kind === 'purchasingAuthority') {
      ids.add(`${c.receipt.id}:principal`);
      if (!c.receipt.sameAttendee) ids.add(`${c.receipt.id}:representative`);
    }
    return ids;
  }
  function screen(gate, r, input, intakeFindings) {
    const e = input.evidence, a = input.assessment, ids = observedIds(e, a);
    const local = e.cityId === gate.cityId && e.law?.cityId === gate.cityId;
    const actors = a.actors.filter(actor => ids.has(actor.id));
    return actors.map(actor => {
      const elements = copy(intakeFindings.elements);
      // None of the current source adapters observes knowing unlawful commerce.
      // Do not interpret assessment prose, payment, instructions, identity or an
      // assay as a structured finding of this person's transaction/mental state.
      for (const element of elements) if (['transaction', 'knowledge'].includes(element.id)) element.support = [];
      const gaps = [
        { element: 'transaction', sourceNeeded: 'An independently authenticated observation linking this person to a completed transaction in this city involving the identified goods.' },
        { element: 'knowledge', sourceNeeded: 'A person-attributable source establishing knowledge or deliberate disregard at that transaction, not after the inquiry.' }
      ];
      if (!intakeFindings.elements.find(x => x.id === 'contraband')?.support.length)
        gaps.push({ element: 'contraband', sourceNeeded: 'Reliable identification of the transaction goods under an applicable prospective published local criminal rule.' });
      const declined = !local || intakeFindings.status === 'declined';
      return { actor: copy(actor), allegation: 'Knowing local contraband commerce', eventAt: e.arrivedAt,
        cityId: gate.cityId, sourceRevision: a.sourceRevision, lawId: e.law?.id || null,
        status: declined ? 'declined' : 'returnedForEvidence', elements, gaps: declined ? [] : gaps,
        reason: !local ? 'The allegation lacks an applicable law of this reviewing city.' : declined ? intakeFindings.reason : 'No charge proposed: evidence does not connect this observed person to knowing unlawful commerce. The named gaps require new sources; waiting and silence cannot supply them.',
        defenses: { authorization: copy(e.authorization), examinationChallenges: copy(e.challenges || []),
          corrections: copy(a.correctionFindings || []), paymentFindings: copy(a.paymentFindings || []),
          principalFindings: copy(a.principalFindings || []) },
        sourceIds: [...new Set([...actor.sourceIds, ...elements.flatMap(x => x.support)])] };
    });
  }
  function advance(gate, at, findings) {
    provision(gate, at);
    const office = gate.chargingOffice;
    if (!office || !Number.isFinite(at) || at < office.lastAt) return;
    const ready = Boolean(gate.active && gate.jurisdiction === 'city' && office.active && office.channelPowered
      && office.cityId === gate.cityId && office.locationId === gate.id && able(office.prosecutor)
      && gate.criminalIntake?.active && office.institutionId === gate.criminalIntake.institutionId
      && office.workSeconds > 0 && (office.job || office.power >= 1));
    let cursor = office.lastAt;
    const elapsedReady = ready && office.wasReady;
    office.lastAt = at; office.wasReady = ready;
    if (!ready) return;
    for (const r of gate.criminalIntake.referrals) {
      const input = current(r);
      if (office.job?.referralId === r.id && (!input || office.job.key !== input.key)) office.job = null;
      if (!input || r.charging?.reviewedKey === input.key) continue;
      if (office.job && office.job.referralId !== r.id) continue;
      if (!office.job) {
        if (office.power < 1 || office.workSeconds <= 0) return;
        office.power--;
        office.job = { referralId: r.id, key: input.key, progress: 0, startedAt: Math.max(cursor, input.at), prosecutorId: office.prosecutor.id };
      }
      const job = office.job;
      if (job.prosecutorId !== office.prosecutor.id) { office.job = null; return; }
      const start = Math.max(cursor, input.at, job.startedAt);
      const work = Math.min(1800 - job.progress, office.workSeconds, elapsedReady ? Math.max(0, at - start) : 0);
      office.workSeconds -= work; job.progress += work;
      if (job.progress < 1800) return;
      cursor = start + work;
      r.charging ||= { reviews: [], notices: [], reviewedKey: '' };
      const result = { id: `${r.id}:screening:${r.charging.reviews.length + 1}`, at: cursor,
        institutionId: office.institutionId, prosecutorId: job.prosecutorId, prosecutorName: office.prosecutor.name,
        sourceRevision: r.reviewedRevision, assessmentAt: input.at,
        disclosure: copy({ evidence: input.evidence, assessment: input.assessment }),
        counts: screen(gate, r, input, findings(input.evidence)),
        reason: 'Actor-specific prosecution screening. Charging support is distinct from proof beyond reasonable doubt. No charge, warrant, appearance obligation or custody authority is created.',
        unresolved: 'Accounts, unverified document names and the remote property claimant are not merged with observed people. No automatic right to represent those people is conferred.' };
      r.charging.reviews.push(result);
      // The already served inquiry channel receives only this bounded informational
      // disposition, not a defendant identity or procedural-service presumption.
      r.charging.notices.push(copy(result)); r.charging.reviewedKey = input.key; office.job = null;
    }
  }
  return { provision, advance };
});
