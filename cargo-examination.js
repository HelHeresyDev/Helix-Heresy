(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoExamination = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v)), SAMPLE = .01;
  function provision(gate) {
    if (gate.examinationLab) return;
    gate.examinationLab = { id: `${gate.id}:examination`, locationId: gate.id, institutionId: gate.judiciary.institutionId,
      examiner: { id: `${gate.id}:examiner`, health: 100, status: 'alive', skill: 80 },
      instrument: { id: `${gate.id}:spectrometer`, condition: 100, calibration: 90 },
      funds: 200, power: 40, reagents: 12, seals: 12, assignment: null };
  }
  function authorize(gate, sh, at) {
    if (!gate.examinationLab || sh.examination || sh.living) return;
    const o = sh.propertyOrder;
    sh.examination = { id: `${o.id}:examination`, phase: 'awaitingScreen', lastAt: at, progress: 0,
      authorization: { orderId: o.id, institutionId: o.institutionId, cityId: o.cityId, stackId: o.evidence.stackId,
        batchId: sh.manifest.entries.find(v => v.stack?.id === o.evidence.stackId)?.stack.chemicalBatch?.id,
        scope: 'chemicalIdentification', maximumSample: SAMPLE, issuedAt: at, expiresAt: o.expiresAt },
      samples: [], reports: [], challenges: [], reason: '' };
  }
  function sampled(sh) {
    return (sh.examination?.samples || []).filter(s => s.sourceStackId === sh.propertyOrder?.evidence.stackId && s.status !== 'returnedToLot').reduce((n, s) => n + s.quantity, 0);
  }
  function stop(gate, sh, at, reason) {
    const e = sh.examination; if (!e || ['complete', 'stopped'].includes(e.phase)) return;
    e.phase = 'stopped'; e.stoppedAt = at; e.reason = reason;
    if (gate?.examinationLab?.assignment === e.id) gate.examinationLab.assignment = null;
    // Return an intact, untested sample at the same gate, never recreate consumed material.
    for (const s of e.samples.filter(s => s.status === 'sealed')) {
      const entry = sh.manifest?.entries.find(v => v.stack?.id === s.sourceStackId);
      const intact = validChain(s);
      if (entry && intact && sh.inspection?.gateId === s.locationId) {
        const old = sh.manifest.amount; entry.amount = Number((entry.amount + s.quantity).toFixed(8));
        entry.stack.quantity = entry.amount; entry.stack.knownQuantity = entry.amount;
        sh.manifest.amount = Number((old + s.quantity).toFixed(8));
        if (old > 0) for (const key of ['massKg', 'volumeL']) sh.cargo[key] *= sh.manifest.amount / old;
        s.status = 'returnedToLot';
      } else s.status = 'releasedAtGate';
      s.releasedAt = at; s.custody.push({ at, action: s.status, custodian: s.status === 'returnedToLot' ? sh.custodian : s.locationId });
    }
  }
  const capable = lab => lab?.examiner.status === 'alive' && lab.examiner.health >= 50 && lab.examiner.skill >= 60 && lab.instrument.condition >= 50 && lab.instrument.calibration >= 60;
  function tick(gate, sh, at) {
    const e = sh.examination, o = sh.propertyOrder, lab = gate?.examinationLab;
    if (!e || ['complete', 'stopped'].includes(e.phase)) return;
    const elapsed = Math.max(0, at - e.lastAt); e.lastAt = Math.max(e.lastAt, at);
    if (o.status !== 'active' || at >= o.expiresAt || at >= e.authorization.expiresAt || e.authorization.scope !== 'chemicalIdentification' || e.authorization.maximumSample < SAMPLE || e.authorization.cityId !== o.cityId || e.authorization.stackId !== o.evidence.stackId || e.authorization.orderId !== o.id || e.authorization.institutionId !== gate?.judiciary?.institutionId) { stop(gate, sh, at, 'Examination authority ended; no custody extension.'); return; }
    const entry = sh.manifest?.entries.find(v => v.stack?.id === e.authorization.stackId);
    if (!entry || !capable(lab) || lab.institutionId !== o.institutionId || lab.locationId !== gate.id || (lab.assignment && lab.assignment !== e.id)) { e.reason = 'Awaiting the actual authorized cargo, capable examiner and calibrated local equipment. Custody expiry unchanged.'; return; }
    if (e.phase === 'awaitingScreen') {
      if (lab.funds < 2 || lab.power < 1) { e.reason = 'Institution lacks finite screening funds or power.'; return; }
      lab.funds -= 2; lab.power--; lab.assignment = e.id; e.phase = 'screening'; e.progress = 0; e.startedAt = at; e.reason = ''; return;
    }
    if (e.phase === 'awaitingConfirmation') {
      if (lab.funds < 5 || lab.power < 2 || lab.reagents < 1 || lab.seals < 1 || entry.amount <= SAMPLE) { e.reason = 'Confirmation requires finite institutional supplies and a lot larger than the authorized 0.01-unit sample.'; return; }
      lab.funds -= 5; lab.power -= 2; lab.reagents--; lab.seals--; lab.assignment = e.id;
      const batch = entry.stack.chemicalBatch;
      const sample = { id: `${e.id}:sample`, sourceStackId: entry.stack.id, sourceBatchId: batch.id, quantity: SAMPLE,
        owner: sh.owner, locationId: gate.id, status: 'sealed', sealId: `${e.id}:seal`,
        examinerId: lab.examiner.id, labId: lab.id,
        composition: { productId: batch.productId, purity: batch.purity },
        custody: [{ at, action: 'drawnAndSealed', custodian: lab.examiner.id, from: entry.stack.id, sealId: `${e.id}:seal` }] };
      e.samples.push(sample);
      entry.amount = Number((entry.amount - SAMPLE).toFixed(8)); entry.stack.quantity = entry.amount;
      entry.stack.knownQuantity = Math.min(entry.stack.knownQuantity ?? entry.amount, entry.amount);
      const originalAmount = sh.manifest.amount; sh.manifest.amount = Number((originalAmount - SAMPLE).toFixed(8));
      if (originalAmount > 0) for (const key of ['massKg', 'volumeL']) sh.cargo[key] *= sh.manifest.amount / originalAmount;
      e.phase = 'confirming'; e.progress = 0; e.sampledAt = at; e.reason = ''; sh.examinationChangedLot = true; return;
    }
    e.progress += elapsed;
    const required = e.phase === 'screening' ? 1800 : 7200;
    if (e.progress < required) return;
    const screening = e.phase === 'screening', sample = e.samples[0], batch = screening ? entry.stack.chemicalBatch : sample.composition;
    const chainIntact = screening || sample.status === 'sealed' && validChain(sample) && sample.examinerId === lab.examiner.id && sample.sourceStackId === e.authorization.stackId && sample.sourceBatchId === e.authorization.batchId;
    const measurable = Boolean(batch?.productId) && Number.isFinite(batch?.purity);
    const match = measurable && batch.productId === o.rule.productId;
    const report = { id: `${e.id}:report:${e.reports.length + 1}`, at, method: screening ? 'nonDestructiveSpectralScreen' : 'sealedSampleConfirmatoryAssay',
      examinerId: lab.examiner.id, instrumentId: lab.instrument.id, institutionId: lab.institutionId, locationId: gate.id,
      sampleId: screening ? null : sample.id, sourceStackId: entry.stack.id, sourceBatchId: entry.stack.chemicalBatch.id,
      quality: { skill: lab.examiner.skill, calibration: lab.instrument.calibration }, chainIntact,
      result: !measurable || !chainIntact ? 'inconclusive' : screening ? (match ? 'consistentScreen' : 'inconsistentScreen') : (match ? 'targetDetected' : 'targetNotDetected'),
      uncertainty: screening ? 'Presumptive screen only; cannot establish product identity for forfeiture.' : 'Applies only to the tested sample; purity estimate has a five-point margin. No conclusion about origin, knowledge or guilt.',
      purityRange: !screening && measurable && chainIntact ? [Math.max(0, batch.purity - 5), Math.min(100, batch.purity + 5)] : null, supported: measurable && chainIntact };
    e.reports.push(report); lab.instrument.condition = Math.max(0, lab.instrument.condition - 1);
    if (screening) { e.phase = measurable ? 'awaitingConfirmation' : 'complete'; e.progress = 0; if (!measurable) lab.assignment = null; }
    else { sample.status = 'consumedByAssay'; sample.consumedAt = at; sample.custody.push({ at, action: 'consumedByAssay', custodian: lab.id }); e.phase = 'complete'; lab.assignment = null; }
  }
  function validChain(sample) {
    const first = sample.custody[0], last = sample.custody[1];
    return Boolean(first && first.action === 'drawnAndSealed' && first.sealId === sample.sealId && first.from === sample.sourceStackId && first.custodian === sample.examinerId
      && (sample.status === 'sealed' ? sample.custody.length === 1 : sample.status === 'consumedByAssay' && sample.custody.length === 2 && last.action === 'consumedByAssay' && last.custodian === sample.labId && last.at >= first.at));
  }
  function challenge(sh, reportId, kind, at) {
    const e = sh?.examination, report = e?.reports.find(r => r.id === reportId);
    if (!report || !['identity', 'custody', 'method'].includes(kind) || e.challenges.some(c => c.reportId === reportId && c.kind === kind)) return false;
    const sample = e.samples.find(s => s.id === report.sampleId);
    const invalidIdentity = report.sourceStackId !== e.authorization.stackId || report.sourceBatchId !== e.authorization.batchId || sample && (sample.sourceStackId !== report.sourceStackId || sample.sourceBatchId !== report.sourceBatchId);
    const invalidChain = !report.chainIntact || sample && !validChain(sample);
    const invalidMethod = report.method !== 'sealedSampleConfirmatoryAssay' || report.quality.skill < 60 || report.quality.calibration < 60 || report.result === 'inconclusive';
    const sustained = kind === 'identity' ? invalidIdentity : kind === 'custody' ? invalidChain : invalidMethod;
    e.challenges.push({ reportId, kind, at, result: sustained ? 'sustained' : 'notEstablished',
      reason: sustained ? 'The claimed evidentiary use is unsupported; retain the report with its limitation, never erase the record.' : 'Saved source identity, custody and method records do not substantiate this objection. This is not a guilt finding.' });
    if (sustained) report.supported = false;
    return true;
  }
  return { provision, authorize, tick, stop, sampled, challenge };
});
