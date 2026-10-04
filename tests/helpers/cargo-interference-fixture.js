const { expect } = require('@playwright/test');
const { fixture } = require('./cargo-appearance-fixture');
const Custody = require('../../cargo-custody');
const Referrals = require('../../cargo-criminal-referrals');
function interferenceFixture(request = 'falseAccount') {
  const f = fixture(); f.person.courtPreferences.attend = false;
  Object.assign(f.person.interferencePreferences, { request, continuePressing: true });
  f.until('awaitingAttendance'); f.advance(86401);
  const step = (seconds = 30) => { f.advance(seconds); Custody.advance(f.state, f.gate, f.now(), Referrals.findings); };
  const until = phase => {
    for (let n = 0; n < 2000 && f.d.custodyCase?.phase !== phase; n++) step();
    expect(f.d.custodyCase?.phase).toBe(phase);
  };
  return { ...f, step, until, job: () => f.d.custodyCase, office: () => f.gate.custodyOffice };
}
module.exports = { interferenceFixture };
