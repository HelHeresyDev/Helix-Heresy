const { expect } = require('@playwright/test');
const { fixture } = require('./cargo-appearance-fixture');
const Buyer = require('../../buyer-corroboration');
const Custody = require('../../cargo-custody');
const Referrals = require('../../cargo-criminal-referrals');
function destructionFixture(action = 'delete') {
  const f = fixture();
  const sh = { id: 'recorded-shipment', manifest: { entries: [{ amount: 2, stack: { id: 'lot', chemicalBatch: { label: 'Private formulation' } } }] } };
  Buyer.record(f.buyer, sh, 'orderAcknowledged', f.now());
  const record = f.buyer.buyerService.records[0];
  Object.assign(f.person.recordPreferences, { action, recordId: record.document.id, acknowledgeRelevance: true });
  f.person.courtPreferences.attend = false;
  f.until('awaitingAttendance'); f.advance(86401);
  const step = (seconds = 30) => { f.advance(seconds); Custody.advance(f.state, f.gate, f.now(), Referrals.findings); };
  const until = phase => {
    for (let n = 0; n < 2000 && f.d.custodyCase?.phase !== phase; n++) step();
    expect(f.d.custodyCase?.phase).toBe(phase);
  };
  return { ...f, sh, record, step, until, job: () => f.d.custodyCase, office: () => f.gate.custodyOffice,
    terminal: f.buyer.buyerService.recordsTerminal };
}
module.exports = { destructionFixture };
