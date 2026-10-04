const { expect } = require('@playwright/test');
const { fineFixture } = require('./cargo-fine-payment-fixture');
const Commitment = require('../../cargo-commitment');
function commitmentFixture() {
  const f = fineFixture({ policy: { ordinarySanctions: ['finitePrison'], finitePrisonRangeMonths: { minimum: 2, maximum: 36 } } });
  f.gate.correctionsAuthority = { active: true, role: 'longTermCorrectionsAuthority', cityId: 'b', institutionId: 'corrections',
    jailInstitutionId: 'temporary-jail', name: 'Local Corrections', capacityBand: 'adequate' };
  let at = f.fineClock(); Commitment.provision(f.gate, at);
  const step = (seconds = 60) => { at += seconds; Commitment.advance(f.state, f.gate, at); };
  const until = phase => { for (let n = 0; n < 100 && f.d.commitment?.phase !== phase; n++) step(); expect(f.d.commitment?.phase).toBe(phase); };
  return { ...f, stepCommitment: step, untilCommitment: until, commitmentClock: () => at };
}
module.exports = { commitmentFixture };
