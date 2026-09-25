(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-examination') : root.HelixCargoExamination);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoForfeiture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Exam) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  function publish(gate, code, at) {
    if (gate.forfeitureRules || code?.legalStatus !== 'prohibited') return;
    gate.forfeitureRules = gate.propertyRules.map(r => ({ id: `${r.id}:forfeiture`, productId: r.productId, cityId: gate.cityId,
      active: true, publishedAt: at, effectiveAt: at, scope: 'unauthorizedGatePossession',
      text: `${r.label}: unauthorized possession at this city gate is subject to property forfeiture only after proof of identity, representative confirmation, absence of specific authorization, hearing and appeal. No criminal guilt follows. No custody extension.` }));
    gate.propertyBench = { judge: { id: `${gate.id}:property-judge`, active: true }, appealReviewer: { id: `${gate.id}:property-reviewer`, active: true } };
    gate.forfeitureStore = { id: `${gate.id}:property-store`, owner: gate.judiciary.institutionId, locationId: gate.id, capacityKg: 120, capacityL: 240, usedKg: 0, usedL: 0, lots: [] };
  }
  function findings(gate, sh, at) {
    const f = sh.forfeiture, o = sh.propertyOrder, r = gate?.forfeitureRules?.find(r => r.id === f.rule.id);
    const report = sh.examination?.reports.find(r => r.id === f.reportId), sample = sh.examination?.samples.find(s => s.id === report?.sampleId);
    const entry = sh.manifest?.entries.find(e => e.stack?.id === f.stackId), rep = sample?.representation;
    const results = [];
    const check = (name, passed, reason) => results.push({ name, passed: Boolean(passed), reason });
    check('jurisdiction', gate?.active && gate.jurisdiction === 'city' && gate.cityId === o.cityId && gate.cityId === sh.destinationId && gate.judiciary?.active && gate.judiciary.cityId === gate.cityId && gate.judiciary.institutionId === f.institutionId && sh.inspection.gateId === gate.id && sh.positionKm >= sh.distanceKm - 1e-8 && sh.owner === f.owner, 'Competent local court and actual destination-gate custody required.');
    check('publishedGround', r?.active && r.cityId === o.cityId && r.scope === 'unauthorizedGatePossession' && r.productId === o.rule.productId && r.publishedAt <= sh.inspection.arrivedAt && r.effectiveAt <= sh.inspection.arrivedAt, 'A prospective property-specific rule, not mere inspection power, must cover the product and conduct.');
    check('identity', entry && sample && report?.sourceStackId === f.stackId && sample.sourceStackId === f.stackId && report.sourceBatchId === entry.stack.chemicalBatch?.id && sample.sourceBatchId === report.sourceBatchId, 'Report, sample and retained physical lot must have the same source identity.');
    check('confirmation', report?.supported && report.method === 'sealedSampleConfirmatoryAssay' && report.result === 'targetDetected' && report.institutionId === f.institutionId && report.locationId === gate.id && report.chainIntact && sample && Exam.validChain(sample) && report.quality.skill >= 60 && report.quality.calibration >= 60, 'Supported confirmatory evidence and intact custody required; screening or silence supplies no proof.');
    check('representativeLot', rep?.method === 'mixedSingleLiquidBatchAliquot' && rep.stackId === f.stackId && rep.batchId === entry?.stack.chemicalBatch?.id && entry?.stack.chemicalBatch.phase === 'liquid' && Math.abs(rep.quantity - (entry?.amount + sample?.quantity)) < 1e-8, 'Recorded mixing and sampling must represent this single retained liquid lot; unrelated batches are excluded.');
    const authorized = gate?.authorizations?.some(d => d.status === 'active' && d.cityId === o.cityId && d.issuerId === f.institutionId && d.holderId === f.owner && d.productId === r?.productId && d.scope === 'destinationGateCargo' && d.validFrom <= o.evidence.at && d.expiresAt > o.evidence.at && d.quantity >= o.evidence.quantity);
    check('authorization', !authorized && Array.isArray(gate?.authorizations), 'The local authorization registry must establish absence of a covering permit; missing player paperwork is insufficient.');
    return results;
  }
  function file(sh, kind, at) {
    const f = sh?.forfeiture;
    if (!f || at >= f.expiresAt || !['identity', 'confirmation', 'representativeLot', 'publishedGround', 'jurisdiction', 'authorization'].includes(kind)) return false;
    if (f.status === 'noticed' && at < f.hearingAt && !f.responses.includes(kind)) { f.responses.push(kind); return true; }
    if (f.status === 'judgment' && at < f.appealBy && !f.appeal) { f.appeal = { kind, filedAt: at, reviewAt: at + 7200 }; f.status = 'appealed'; return true; }
    return false;
  }
  function tick(gate, sh, at, custodyReason = '') {
    const o = sh.propertyOrder;
    let f = sh.forfeiture;
    if (!f && !custodyReason && at < o.expiresAt && !sh.living) {
      const rule = gate?.forfeitureRules?.find(r => r.active && r.productId === o.rule.productId && r.publishedAt <= sh.inspection.arrivedAt && r.effectiveAt <= sh.inspection.arrivedAt);
      const report = sh.examination?.reports.find(r => r.method === 'sealedSampleConfirmatoryAssay' && r.result === 'targetDetected');
      if (rule && report) f = sh.forfeiture = { id: `${o.id}:forfeiture`, status: 'noticed', institutionId: o.institutionId, owner: sh.owner,
        rule: copy(rule), stackId: report.sourceStackId, quantity: sh.manifest.entries.find(e => e.stack?.id === report.sourceStackId)?.amount, reportId: report.id, noticeAt: at, hearingAt: at + 7200, expiresAt: o.expiresAt,
        judgeId: gate.propertyBench.judge.id, appealReviewerId: gate.propertyBench.appealReviewer.id, responses: [], decisions: [], appeal: null };
    }
    if (!f || ['released', 'final'].includes(f.status)) return '';
    const release = reason => { f.status = 'released'; f.releasedAt = at; f.reason = reason; return reason; };
    if (custodyReason || at >= o.expiresAt) return release(custodyReason || 'Proceedings unfinished at the original custody deadline; property released without forfeiture.');
    const appeal = f.status === 'appealed', due = f.status === 'noticed' ? f.hearingAt : appeal ? f.appeal.reviewAt : null;
    if (due != null && at >= due) {
      const reviewer = appeal ? gate?.propertyBench?.appealReviewer : gate?.propertyBench?.judge;
      if (!reviewer?.active || reviewer.id !== (appeal ? f.appealReviewerId : f.judgeId) || appeal && reviewer.id === f.judgeId) { f.reason = 'Awaiting the assigned independent reviewer; custody deadline is unchanged.'; return ''; }
      const proof = findings(gate, sh, at), supported = proof.every(p => p.passed);
      f.decisions.push({ at, reviewerId: reviewer.id, stage: appeal ? 'appeal' : 'hearing', findings: proof,
        result: supported ? 'forfeitureJudgment' : 'release', reason: supported ? 'All property-specific findings supported. No criminal guilt determined.' : proof.filter(p => !p.passed).map(p => p.reason).join(' ') });
      if (!supported) return release(f.decisions.at(-1).reason);
      f.status = appeal ? 'transferPending' : 'judgment';
      if (appeal) f.transferAt = at + 300; else f.appealBy = at + 7200;
    }
    if (f.status === 'judgment' && at >= f.appealBy) { f.status = 'transferPending'; f.transferAt = at + 300; }
    if (f.status !== 'transferPending' || at < f.transferAt) return '';
    const proof = findings(gate, sh, at); if (!proof.every(p => p.passed)) return release('Final transfer refused: ' + proof.filter(p => !p.passed).map(p => p.reason).join(' '));
    const entry = sh.manifest.entries.find(e => e.stack?.id === f.stackId), store = gate.forfeitureStore;
    const fraction = entry.amount / sh.manifest.amount, massKg = sh.cargo.massKg * fraction, volumeL = sh.cargo.volumeL * fraction;
    if (!store || store.locationId !== gate.id || store.owner !== f.institutionId || store.usedKg + massKg > store.capacityKg || store.usedL + volumeL > store.capacityL || gate.officer?.status !== 'alive' || gate.officer.health < 50) { f.reason = 'Physical transfer held: capable local handler and finite institutional storage required. No custody extension.'; return ''; }
    store.lots.push({ id: `${f.id}:lot`, entry, owner: store.owner, custodian: store.id, locationId: gate.id, transferredAt: at, orderId: f.id, massKg, volumeL });
    store.usedKg += massKg; store.usedL += volumeL;
    sh.manifest.entries = sh.manifest.entries.filter(e => e !== entry); sh.manifest.amount = Math.max(0, sh.manifest.amount - entry.amount);
    sh.cargo.massKg -= massKg; sh.cargo.volumeL -= volumeL;
    f.status = 'final'; f.finalAt = at; f.storeId = store.id; f.reason = 'Final property judgment physically executed at the gate store; no public-market sale, destruction or criminal conviction.';
    o.status = 'forfeited'; o.reason = f.reason;
    if (!sh.manifest.entries.length) { sh.owner = store.owner; sh.custodian = store.id; }
    return '';
  }
  return { publish, tick, file, findings };
});
