(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports
    ? [require('./surface-workers'), require('./diagnostic-system'), require('./local-services'), require('./confidential-services'), require('./resource-surveys'), require('./environmental-monitoring')]
    : [root.HelixSurfaceWorkers, root.HelixDiagnosticSystem, root.HelixLocalServices, root.HelixConfidentialServices, root.HelixResourceSurveys, root.HelixEnvironmentalMonitoring]);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLaboratoryAssistant = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dependencies) {
  'use strict';
  const [Workers, Diagnostics, Industrial, Confidential, Resources, Environment] = dependencies;
  const copy = x => JSON.parse(JSON.stringify(x));
  const CATEGORIES = Object.freeze(['airVial', 'industrialBatchPortion', 'confidentialChemicalPortion', 'resourceSurfaceSample', 'resourceShallowCore', 'surfaceSwab', 'runoffSample', 'soilCore']);
  function create(seed, city, theme, at = 0) { return Workers.create(seed, city, theme, at, 'laboratoryTechnician'); }
  const normalize = Workers.normalize;
  function validDisclosure(d) {
    return d?.underground === true && d.confidentialityRequested === true && d.noLivingWork === true
      && d.benchId && d.workspaceRoomId && Array.isArray(d.roomIds) && d.roomIds.includes(d.workspaceRoomId)
      && d.roomIds.length > 1 && Array.isArray(d.hazards) && d.hazards.length > 0
      && JSON.stringify(d.sampleCategories) === JSON.stringify(CATEGORIES);
  }
  function request(state, route, hours, disclosure, now) {
    const q = Workers.quote(state, route, hours, now);
    if (!q.ok || !validDisclosure(disclosure)) { if (state) state.quote = null; return q.ok ? { ok: false, reason: 'A complete underground workplace and hazard disclosure is required.' } : q; }
    state.quote = { ...q, disclosure: copy(disclosure) }; return state.quote;
  }
  function hire(state, route, expected, disclosure, consent, wallet, now) {
    if (!consent || !validDisclosure(disclosure) || JSON.stringify(disclosure) !== JSON.stringify(expected?.disclosure)
      || JSON.stringify(expected) !== JSON.stringify(state?.quote)) return { ok: false, reason: 'Review the exact workplace, scope, known hazards and confidentiality request, then explicitly confirm informed agreement.' };
    const result = Workers.hire(state, route, expected, wallet, now);
    if (result.ok) { state.contract.disclosure = copy(disclosure); state.contract.consented = true; }
    return result;
  }
  function category(sample) {
    if (!sample || !CATEGORIES.includes(sample.methodId) || ['slime', 'scientist'].includes(sample.targetKind)) return '';
    const c = sample.captured || {};
    if (sample.methodId === 'airVial' && c.environment) return sample.methodId;
    if (c.industrialService || c.confidentialService || c.resourceSurvey || c.environmentalExposure) return sample.methodId;
    return '';
  }
  function eligible(sample, stack, reservation = '') {
    return Boolean(category(sample) && stack?.key === 'diagnosticSample' && stack.id === sample.stackId && stack.quantity === 1
      && !stack.carriedBy && !stack.containerId && (!stack.reservedTaskId || stack.reservedTaskId === reservation)
      && stack.tags?.includes('sealed') && !(stack.tags || []).some(t => /(^|[-_ ])(living|soul|biological|unsealed|broken)([-_ ]|$)/i.test(t)));
  }
  function assign(state, plan, now, reserve) {
    const a = state?.actor, c = state?.contract;
    if (!a?.present || a.status === 'dead' || a.health < 35 || c?.status !== 'onSite' || !c.consented || !validDisclosure(c.disclosure)
      || state.orders.some(o => o.status === 'active')) return { ok: false, reason: 'A capable, consenting on-site technician with no active assignment is required.' };
    if (!plan?.ok || !eligible(plan.sample, plan.stack) || plan.benchId !== c.disclosure.benchId
      || !c.disclosure.sampleCategories.includes(category(plan.sample))) return { ok: false, reason: plan?.reason || 'Stage an exact sealed nonliving sample and supplies within the agreed scope.' };
    const id = `technician-assay-${state.nextOrder}`;
    const pickups = reserve(plan, id);
    if (!pickups) return { ok: false, reason: 'The original sample, reagent, instrument or bench was claimed before authorization.' };
    const order = { id, kind: 'assay', key: 'diagnosticSample', amount: 1, delivered: 0, status: 'active', stage: 'collect',
      sampleId: plan.sample.id, sampleLabel: plan.sample.targetLabel, benchId: plan.benchId, benchCell: copy(plan.benchCell),
      instrumentInstanceId: plan.instrumentInstanceId, pickups: copy(pickups), pickupIndex: 0, carriedStackIds: [],
      workSeconds: 0, requiredSeconds: 30, createdAt: now, completedAt: null, receivedAt: null, reportStackId: '', result: null, reason: '' };
    state.nextOrder++; state.orders.push(order);
    state.history.push({ at: now, summary: `Authorized one sealed sample assay at the disclosed bench. No living procedures, automatic conclusions or external report submission.` });
    return { ok: true, order };
  }
  function assess(sample, actor, instrument, record, now) {
    if (!category(sample) || !instrument || instrument.current <= 0) return null;
    // Both qualifications belong to this technician, not the scientist.
    const skill = Math.min(100, Math.min(actor.skills.analysis || 0, actor.skills.alchemy || 0) * 10 + 20);
    const stable = sample.captured.industrialService || sample.captured.confidentialService ? 86400 : 0;
    const score = Diagnostics.confidenceScore({ calibration: record.calibration, condition: instrument.current / Math.max(1, instrument.max) * 100,
      skill, methodQuality: Diagnostics.SAMPLE_METHOD_BY_ID[sample.methodId].quality, sampleAgeSeconds: Math.max(0, now - sample.collectedAt - stable) });
    const c = sample.captured, band = Diagnostics.confidenceBand(score).label;
    let readings;
    if (c.confidentialService) {
      const r = Confidential.assay(c.confidentialService.signal, score);
      readings = [{ key: 'samplePurity', label: 'Sample purity', value: `${r.purity.low.toFixed(1)}–${r.purity.high.toFixed(1)}%`, band },
        { key: 'sampleContamination', label: 'Contaminant load', value: `${r.contamination.low.toFixed(2)}–${r.contamination.high.toFixed(2)} assay units`, band: r.finding }];
    } else if (c.industrialService) readings = [{ key: 'industrialContamination', label: 'Captured batch contamination', value: Industrial.assay(c.industrialService.burden, score).summary, band }];
    else if (c.resourceSurvey) readings = Resources.assess(c.resourceSurvey, score).map(r => ({ key: r.familyId, label: r.label, value: r.summary, band: r.confidence }));
    else if (c.environmentalExposure) {
      const r = Environment.assaySample(c.environmentalExposure, score); if (!r) return null;
      readings = [{ key: 'environmentalBurden', label: 'Sampled burden', value: r.detected ? r.burden : 'No material detected', band },
        { key: 'environmentalIdentity', label: 'Sample identity', value: r.identity === 'substance' ? r.substanceId : r.identity === 'family' ? r.family : r.identity, band }];
    } else {
      const air = c.environment.airborne || {}, burden = Object.values(air).reduce((n, v) => n + Number(v || 0), 0);
      const spread = Math.max(1, burden * Diagnostics.uncertaintyFraction(score));
      readings = [{ key: 'contamination', label: 'Captured air burden', value: score < 28 ? 'Burden indeterminate' : `${Math.max(0, burden - spread).toFixed(1)}–${(burden + spread).toFixed(1)} assay units`, band },
        { key: 'airborneIdentity', label: 'Airborne identity', value: score >= 66 ? Object.keys(air).join(', ') || 'No detectable airborne material' : 'Mixture identity indeterminate', band }];
    }
    return Diagnostics.normalizeResult({ id: `assistant-result:${sample.id}`, workflowId: 'assaySample', targetKind: sample.targetKind,
      targetId: sample.targetId, targetLabel: sample.targetLabel, cell: sample.cell, measuredAt: now, sampleCollectedAt: sample.collectedAt,
      instrumentId: 'assayCase', instrumentInstanceId: instrument.id, confidenceScore: score, readings,
      summary: readings.map(r => `${r.label}: ${r.value}`).join('; '),
      factors: [`Technician ${actor.name}: Analysis ${actor.skills.analysis}, Alchemy ${actor.skills.alchemy}; joint contribution ${skill}%`,
        `Actual calibration ${record.calibration}/100`, `Actual condition ${instrument.current}/${instrument.max}`, 'One historical sealed portion only; no legal classification or live remote measurement.'] });
  }
  function publicView(state, now) {
    const view = Workers.publicView(state, now); if (!view) return null;
    view.orders = state.orders.map(o => ({ id: o.id, sampleLabel: o.sampleLabel, benchId: o.benchId, status: o.status,
      stage: o.stage, reason: o.reason, createdAt: o.createdAt, completedAt: o.completedAt, receivedAt: o.receivedAt,
      reportStackId: o.reportStackId, result: o.receivedAt == null ? null : copy(o.result) }));
    return view;
  }
  return { CATEGORIES, create, normalize, validDisclosure, request, hire, category, eligible, assign, assess, publicView,
    active: Workers.active, advance: Workers.advance, cancel: Workers.cancel, withdraw: Workers.withdraw };
});
