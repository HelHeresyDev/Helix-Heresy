const { expect } = require('@playwright/test');
const { beastFixture } = require('./corridor-beast-fixture');
const Robbery = require('../../corridor-robbery');
function robberyFixture(options = {}) {
  const f = beastFixture(options); f.state.corridorBeasts = [];
  const group = Robbery.createGroup(f.route, 0); group.siteKm = 1;
  group.members.forEach(p => { p.positionKm = 1; }); group.truck.positionKm = 1;
  f.state.roadsideGroups = [{ routeId: f.route.id, lengthKm: f.route.distanceKm, group, createdAt: 0 }];
  let at = 0;
  const step = (seconds = 1) => { at += seconds; f.advance(at); };
  const until = phase => {
    for (let n = 0; n < 1200 && f.sh.robbery?.phase !== phase; n++) step();
    expect(f.sh.robbery?.phase).toBe(phase);
  };
  return { ...f, group, step, until, now: () => at };
}
module.exports = { robberyFixture };
