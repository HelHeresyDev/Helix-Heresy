// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function infrastructureFixture(page, typeId) {
  return page.evaluate((wantedTypeId) => {
    return window.helixHeresyDebug.infrastructureSnapshot().fixtures.find((fixture) => fixture.typeId === wantedTypeId);
  }, typeId);
}

test('starter utilities are physical fixtures and the oil lamp lights nearby tiles', async ({ page }) => {
  await startRun(page);
  const before = await infrastructureFixture(page, 'wallLamp');
  expect(before.utility.enabled).toBe(true);
  expect(before.utility.powerMode).toBe('fuel');
  expect(before.networks).toEqual(expect.arrayContaining(['electricity', 'mana']));

  await page.evaluate((fixtureId) => window.helixHeresyDebug.advanceSimulation(300), before.id);
  const result = await page.evaluate((fixture) => {
    const nearby = window.helixHeresyDebug.tileEnvironmentSnapshot().filter((record) => (
      Math.abs(record.cell.x - fixture.origin.x) + Math.abs(record.cell.y - fixture.origin.y) <= 2
    ));
    const current = window.helixHeresyDebug.infrastructureSnapshot().fixtures.find((entry) => entry.id === fixture.id);
    return { nearby, current };
  }, before);
  expect(result.current.utility.fuel).toBeLessThan(before.utility.fuel);
  expect(result.current.utility.status).toBe('operating');
  expect(Math.max(...result.nearby.map((record) => record.lightLevel))).toBeGreaterThan(0);
  expect(new Set(result.nearby.map((record) => record.lightLevel)).size).toBeGreaterThan(1);

  await page.evaluate((fixtureId) => {
    window.helixHeresyDebug.setFixtureUtility(fixtureId, { powerMode: 'electric' });
    window.helixHeresyDebug.advanceSimulation(300);
  }, before.id);
  const disconnected = await infrastructureFixture(page, 'wallLamp');
  expect(disconnected.utility.status).toBe('unpowered');
});

test('heaters use broad controls until an operational thermostat enables an exact target', async ({ page }) => {
  await startRun(page);
  const heater = await infrastructureFixture(page, 'spaceHeater');
  const thermostat = await infrastructureFixture(page, 'thermostat');

  await page.evaluate(({ heater, thermostat }) => {
    window.helixHeresyDebug.setTileEnvironment(heater.origin, { temperatureC: 5, rockTemperatureC: 5 });
    window.helixHeresyDebug.setFixtureUtility(thermostat.id, { enabled: false });
    window.helixHeresyDebug.setFixtureUtility(heater.id, {
      enabled: true,
      powerMode: 'fuel',
      fuel: 10,
      climateSetting: 'cold',
      exactTargetC: 40,
    });
    window.helixHeresyDebug.advanceSimulation(3600);
  }, { heater, thermostat });
  const broad = await page.evaluate((cell) => window.helixHeresyDebug.tileEnvironmentSnapshot(cell)[0], heater.origin);
  const broadHeater = await infrastructureFixture(page, 'spaceHeater');
  expect(broad.temperatureC).toBeGreaterThan(10);
  expect(broad.temperatureC).toBeLessThan(20);
  expect(broadHeater.utility.statusReason).toContain('12.0 °C');

  await page.evaluate(({ heater, thermostat }) => {
    window.helixHeresyDebug.setTileEnvironment(heater.origin, { temperatureC: 5, rockTemperatureC: 5 });
    window.helixHeresyDebug.setFixtureUtility(thermostat.id, { enabled: true });
    window.helixHeresyDebug.setFixtureUtility(heater.id, { enabled: true, fuel: 10, exactTargetC: 40 });
    window.helixHeresyDebug.advanceSimulation(300);
  }, { heater, thermostat });
  const exact = await page.evaluate((cell) => window.helixHeresyDebug.tileEnvironmentSnapshot(cell)[0], heater.origin);
  const exactHeater = await infrastructureFixture(page, 'spaceHeater');
  expect(exact.temperatureC).toBeGreaterThan(5);
  expect(exact.temperatureC).toBeLessThanOrEqual(40);
  expect(exactHeater.utility.statusReason).toContain('by thermostat');

  const generator = await infrastructureFixture(page, 'fuelGenerator');
  await page.evaluate(({ heater, generator }) => {
    window.helixHeresyDebug.setTileEnvironment(heater.origin, { temperatureC: 5, rockTemperatureC: 5 });
    window.helixHeresyDebug.setFixtureUtility(generator.id, { enabled: true, fuel: 10 });
    window.helixHeresyDebug.setFixtureUtility(heater.id, { enabled: true, powerMode: 'electric', exactTargetC: 40 });
    window.helixHeresyDebug.advanceSimulation(300);
  }, { heater, generator });
  const electricHeater = await infrastructureFixture(page, 'spaceHeater');
  const usedGenerator = await infrastructureFixture(page, 'fuelGenerator');
  expect(electricHeater.utility.status).toBe('operating');
  expect(usedGenerator.utility.fuel).toBeLessThan(10);
});

test('powered ventilation preserves substance identities and respects finite filter capacity', async ({ page }) => {
  await startRun(page);
  const fan = await infrastructureFixture(page, 'ductFan');
  const terminal = await infrastructureFixture(page, 'wallVent');
  const filter = await infrastructureFixture(page, 'airFilter');

  await page.evaluate(({ fan, terminal, filter }) => {
    window.helixHeresyDebug.setFixtureUtility(fan.id, { enabled: true, powerMode: 'fuel', fuel: 10 });
    window.helixHeresyDebug.setFixtureUtility(terminal.id, { enabled: true, mode: 'exhaust' });
    window.helixHeresyDebug.setFixtureUtility(filter.id, { enabled: true, capturedAirborne: { 'old-smoke': 79 } });
    window.helixHeresyDebug.setTileEnvironment(terminal.origin, {
      airborne: { 'acid-vapor': 30, 'smoke-vapor': 20 },
    });
    window.helixHeresyDebug.advanceSimulation(900);
  }, { fan, terminal, filter });

  const result = await page.evaluate(({ terminal, filter }) => {
    const tile = window.helixHeresyDebug.tileEnvironmentSnapshot(terminal.origin)[0];
    const currentFilter = window.helixHeresyDebug.infrastructureSnapshot().fixtures.find((fixture) => fixture.id === filter.id);
    return { tile, currentFilter };
  }, { terminal, filter });
  const captured = Object.values(result.currentFilter.utility.capturedAirborne).reduce((sum, value) => sum + value, 0);
  expect(captured).toBeLessThanOrEqual(80.001);
  expect(result.currentFilter.utility.capturedAirborne['acid-vapor'] || result.currentFilter.utility.capturedAirborne['smoke-vapor']).toBeTruthy();
  expect(result.tile.airborne['acid-vapor']).toBeLessThan(30);
  expect(result.tile.airborne['smoke-vapor']).toBeLessThan(20);
});

test('a drain removes spills only from its exact tile and stores tagged contents in a finite sump', async ({ page }) => {
  await startRun(page);
  const drain = await infrastructureFixture(page, 'floorDrain');
  const sump = await infrastructureFixture(page, 'sumpTank');
  const neighbor = { x: drain.origin.x, y: drain.origin.y - 1 };

  await page.evaluate(({ drain, neighbor }) => {
    window.helixHeresyDebug.addPhysicalSpill(drain.origin, 10, 'hazardousSludge', ['acidic', 'corpse']);
    window.helixHeresyDebug.addPhysicalSpill(neighbor, 10, 'hazardousSludge', ['acidic', 'corpse']);
    window.helixHeresyDebug.advanceSimulation(1800);
  }, { drain, neighbor });

  const result = await page.evaluate(({ drain, sump, neighbor }) => {
    const stocks = window.helixHeresyDebug.physicalStockSnapshot().stacks;
    const at = (cell) => stocks.filter((stack) => stack.form === 'spill' && stack.cell.x === cell.x && stack.cell.y === cell.y)
      .reduce((sum, stack) => sum + stack.quantity, 0);
    const currentSump = window.helixHeresyDebug.infrastructureSnapshot().fixtures.find((fixture) => fixture.id === sump.id);
    return { drainAmount: at(drain.origin), neighborAmount: at(neighbor), currentSump };
  }, { drain, sump, neighbor });
  const held = Object.values(result.currentSump.utility.contents).reduce((sum, value) => sum + value, 0);
  expect(result.drainAmount).toBeLessThan(10);
  expect(result.neighborAmount).toBe(10);
  expect(held).toBeGreaterThan(0);
  expect(held).toBeLessThanOrEqual(120);
  expect(Object.keys(result.currentSump.utility.contents)[0]).toContain('hazardoussludge');
});

test('mana collectors support rock extraction and feedstock while emitters affect only their local tile', async ({ page }) => {
  await startRun(page);
  const collector = await infrastructureFixture(page, 'manaCollector');
  const emitter = await infrastructureFixture(page, 'manaEmitter');

  await page.evaluate(({ collector, emitter }) => {
    window.helixHeresyDebug.setFixtureUtility(emitter.id, { enabled: false });
    window.helixHeresyDebug.setFixtureUtility(collector.id, { enabled: true, mode: 'rock', storedMana: 0 });
    window.helixHeresyDebug.setTileEnvironment(collector.origin, { rockManaDensity: 100, manaDensity: 50 });
    window.helixHeresyDebug.advanceSimulation(3600);
  }, { collector, emitter });
  const rockResult = await page.evaluate((collector) => ({
    collector: window.helixHeresyDebug.infrastructureSnapshot().fixtures.find((fixture) => fixture.id === collector.id),
    tile: window.helixHeresyDebug.tileEnvironmentSnapshot(collector.origin)[0],
  }), collector);
  expect(rockResult.collector.utility.storedMana).toBeGreaterThan(0);
  expect(rockResult.tile.rockManaDensity).toBeLessThan(100);

  await page.evaluate(({ collector, emitter }) => {
    window.helixHeresyDebug.setTileEnvironment(emitter.origin, { manaDensity: 0, rockManaDensity: 0 });
    window.helixHeresyDebug.setFixtureUtility(emitter.id, { enabled: true, manaTarget: 70 });
    window.helixHeresyDebug.advanceSimulation(1800);
  }, { collector, emitter });
  const emitted = await page.evaluate((cell) => window.helixHeresyDebug.tileEnvironmentSnapshot(cell)[0], emitter.origin);
  expect(emitted.manaDensity).toBeGreaterThan(0);

  await page.evaluate(({ collector, emitter }) => {
    window.helixHeresyDebug.setFixtureUtility(emitter.id, { enabled: false });
    window.helixHeresyDebug.setFixtureUtility(collector.id, { enabled: true, mode: 'feedstock', storedMana: 0, feedstock: 2 });
    window.helixHeresyDebug.advanceSimulation(3600);
  }, { collector, emitter });
  const feedstockResult = await infrastructureFixture(page, 'manaCollector');
  expect(feedstockResult.utility.storedMana).toBeGreaterThan(0);
  expect(feedstockResult.utility.feedstock).toBeLessThan(2);
});
