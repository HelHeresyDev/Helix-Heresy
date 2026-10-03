const { expect } = require('@playwright/test');
const Trial = require('../../cargo-trial');
const Referrals = require('../../cargo-criminal-referrals');
const { fixture } = require('./cargo-appearance-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
function trialFixture(base) {
  const f = base || fixture({ trialSources: true });
  if (!base) f.until('complete');
  const records = f.a.recipientFindings[0].events.map(document => ({ document: copy(document), observerId: 'carrier-witness' }));
  f.state.operators.push({ id: 'carrier', sourceId: 'a', location: 'a', assignment: null,
    crew: [{ id: 'carrier-witness', status: 'alive', health: 100, fatigue: 0 }],
    carrierService: { contact: { accountId: 'carrier', handle: 'carrier-channel' }, channelPowered: true, credentialActive: true,
      trialConsent: true, interviewConsent: true, policy: 'protectCompletedClients', power: 10, workSeconds: 10000, recipientRecords: records } });
  f.gate.authorizations = [];
  f.gate.examinationLab = { id: 'lab', locationId: 'gate', institutionId: 'court', channelPowered: true, trialConsent: true,
    power: 10, testimonySeconds: 10000, examiner: { id: 'examiner', status: 'alive', health: 100, locationId: 'gate' },
    records: [{ report: copy(f.e.reports[0]), sample: copy(f.e.samples[0]) }] };
  let now = f.now();
  const step = (seconds = 60) => { now += seconds; Trial.advance(f.state, f.gate, now, Referrals.findings); };
  const until = phase => { for (let i = 0; i < 1700 && f.d.trial?.phase !== phase; i++) step(); expect(f.d.trial?.phase).toBe(phase); };
  return { ...f, step, untilTrial: until, clock: () => now };
}
module.exports = { trialFixture };
