(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityRuleHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const INTERVAL = 3 * 86400;
  const copy = v => JSON.parse(JSON.stringify(v));
  const id = s => typeof s === 'string' && s.length > 0 && s.length <= 1000;
  const time = n => Number.isFinite(n) && n >= 0;
  function scope(v, sourceId) {
    if (!v || !['cityId', 'sourceId', 'charterId', 'populationSourceId', 'handoverId'].every(k => id(v[k]))
      || v.sourceId !== sourceId || !Number.isSafeInteger(v.bodyEpoch) || v.bodyEpoch < 0
      || !Array.isArray(v.issuerIds) || !v.issuerIds.length || !v.issuerIds.every(id)
      || new Set(v.issuerIds).size !== v.issuerIds.length) return null;
    return { cityId: v.cityId, sourceId, charterId: v.charterId, populationSourceId: v.populationSourceId,
      handoverId: v.handoverId, bodyEpoch: v.bodyEpoch, issuerIds: [...v.issuerIds].sort() };
  }
  function issue(rule, report) {
    const own = scope({ cityId: rule.source.cityId, sourceId: rule.id, charterId: rule.source.charterId,
      populationSourceId: rule.source.populationSourceId, handoverId: rule.handoverId, bodyEpoch: rule.bodyEpoch,
      issuerIds: [...new Set((rule.source.institutions || []).map(i => i.id))] }, rule.id);
    rule.cityReportSerial = (Number.isSafeInteger(rule.cityReportSerial) && rule.cityReportSerial >= 0 ? rule.cityReportSerial : 0) + 1;
    report.receiptId = `${rule.id}:received-report:${report.at}:${rule.cityReportSerial}`;
    if (own) report.cityScope = own;
    return report;
  }
  function period(v, e) {
    return v?.kind === 'reportedCityRule' && time(v.startAt) && v.endAt === v.startAt + INTERVAL
      && v.endAt <= e.observedAt && e.temporal === 'historical' && e.status === 'control'
      && scope(e.cityScope, e.sourceId) && e.seriesId === `city-rule-history:${e.cityScope.cityId}:${e.cityScope.handoverId}:${e.cityScope.bodyEpoch}`
      ? { kind: v.kind, startAt: v.startAt, endAt: v.endAt } : null;
  }
  // Input is a personally RECEIVED report, never the live operating account.
  // An interval can only come from its explicitly reported accomplishment.
  function project(r) {
    if (!r || !id(r.sourceId) || !id(r.cityId) || !id(r.status) || !time(r.at)) return [];
    const own = scope(r.cityScope, r.sourceId), account = { issuer: `Municipal operating account — ${r.cityId}`, scope: 'Named city operating control',
      findings: [`The dated operating account reports: ${r.status}.`],
      limits: 'This received account is not a current remote observation, worldwide coverage, institutional submission or divine nonintervention.' };
    const e = { id: id(r.receiptId) ? r.receiptId : `city-rule:${r.sourceId}:${r.at}`, sourceId: r.sourceId, label: `Received city operating account — ${r.cityId}`,
      status: r.status === 'established' && r.foodKg > 0 && r.waterLiters > 0 && r.energy > 0 ? 'control'
        : r.status === 'contested' ? 'challenge' : 'unverified', observedAt: r.at, receivedAt: r.at,
      seriesId: `city-control:${r.cityId}`, account, ...(own && own.cityId === r.cityId ? { cityScope: own } : {}) };
    const rows = [e], a = r.accomplishment;
    if (!own || own.cityId !== r.cityId || a?.sourceId !== r.sourceId || a.cityId !== r.cityId || !time(a.since)
      || a.at !== a.since + INTERVAL || a.at > r.at) return rows;
    const history = { id: `city-rule-history:${r.sourceId}:${own.handoverId}:${own.bodyEpoch}:${a.since}:${a.at}`,
      sourceId: r.sourceId, label: `Received historical local-rule account — ${r.cityId}`, status: 'control',
      observedAt: r.at, receivedAt: r.at, temporal: 'historical', cityScope: own,
      seriesId: `city-rule-history:${r.cityId}:${own.handoverId}:${own.bodyEpoch}`,
      period: { kind: 'reportedCityRule', startAt: a.since, endAt: a.at },
      account: { issuer: account.issuer, scope: 'Reported completed local-rule interval',
        findings: ['The received municipal account reports a completed three-day period of supported local city operation.',
          'The reported past period and present control are separate claims.'],
        limits: 'This is the original issuer’s scoped historical account, not continuous worldwide proof, later control, divine assent or a world-domination accomplishment.' } };
    rows.push(history); return rows;
  }
  const sameScope = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);
  function intervals(evidence) {
    return (evidence || []).filter(e => e.temporal === 'historical' && period(e.period, e)).map(e => ({
      evidenceId: e.id, cityScope: copy(e.cityScope), startAt: e.period.startAt, endAt: e.period.endAt,
      observedAt: e.observedAt, receivedAt: e.receivedAt,
      conflictingEvidenceIds: evidence.filter(x => x.temporal !== 'historical' && x.status === 'challenge'
        && sameScope(x.cityScope, e.cityScope) && x.observedAt >= e.period.startAt && x.observedAt <= e.period.endAt).map(x => x.id)
    }));
  }
  return { INTERVAL, scope, issue, period, project, intervals };
});
