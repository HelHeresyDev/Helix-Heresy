const { test, expect } = require('@playwright/test');
const Market = require('../city-commodity-market');
const defs = [{ id: 'steelPanels', supply: 100, liquidity: 20 }, { id: 'biomass', supply: 100, liquidity: 20 }];
const facts = () => ({ directory: { foundations: [{ city: { id: 'a', name: 'Aster' }, primaryExploitation: { id: 'ferrousOre', label: 'Ferrous Ore' }, arableLandBand: 'productive' }, { city: { id: 'b' }, primaryExploitation: { id: 'biologicalProductivity' } }], satellites: [{ id: 'farm', parentId: 'a', name: 'Aster Farm', function: 'agriculture', sizeBand: 'town', exportResource: { id: 'biologicalProductivity' } }] }, current: { playableYear: 500, cityRows: [{ cityId: 'a', physicalCondition: 'intact', populationBand: 'large', services: { utilities: 'functional' } }], satelliteRows: [] } });
test('public local production and farming influence finite supply without foreign imports or hidden data', () => {
  const f = facts(), before = JSON.stringify(f), a = Market.profile('a', f.directory, f.current, defs);
  expect(JSON.stringify(f)).toBe(before);
  expect(a.listings.steelPanels.targetSupply).toBeGreaterThan(50); expect(a.listings.biomass.targetSupply).toBeGreaterThan(50);
  f.directory.foundations[1].primaryExploitation.id = 'ferrousOre'; f.directory.hiddenReserves = 99999;
  f.directory.satellites.push({ parentId: 'b', exportResource: { id: 'ferrousOre' }, sizeBand: 'town' });
  expect(Market.profile('a', f.directory, f.current, defs)).toEqual(a);
  expect(JSON.stringify(a)).not.toContain('hidden'); expect(before).toBe(JSON.stringify(facts()));
});
test('damaged infrastructure, utilities and lost satellites lower supply while larger populations raise demand', () => {
  const f = facts(), normal = Market.profile('a', f.directory, f.current, defs);
  f.current.cityRows[0].physicalCondition = 'damaged'; f.current.cityRows[0].services.utilities = 'fragile';
  f.current.cityRows[0].populationBand = 'immense'; f.current.satelliteRows.push({ satelliteId: 'farm', habitationStatus: 'abandoned' });
  const damaged = Market.profile('a', f.directory, f.current, defs);
  expect(damaged.listings.steelPanels.targetSupply).toBeLessThan(normal.listings.steelPanels.targetSupply);
  expect(damaged.listings.biomass.targetSupply).toBeLessThan(normal.listings.biomass.targetSupply);
  expect(damaged.listings.biomass.targetDemand).toBeGreaterThan(normal.listings.biomass.targetDemand);
});
test('canonical profiles repeat across independent runs; JSON persistence retains modified run stocks', () => {
  const f = facts(), profile = Market.profile('a', f.directory, f.current, defs), first = { cityContext: profile, stock: profile.listings.steelPanels.targetSupply };
  first.stock -= 20; const saved = JSON.parse(JSON.stringify(first));
  const second = Market.profile('a', f.directory, f.current, defs);
  expect(second).toEqual(profile); expect(saved.stock).toBe(second.listings.steelPanels.targetSupply - 20);
  expect(Market.profile('missing', f.directory, f.current, defs)).toBeNull();
});
test('market turnover tends to the saved local baseline, permits zero stock and preserves sales pressure', () => {
  const baseline = { targetSupply: 0, targetDemand: 1.2 };
  expect(Market.evolve({ supply: 0, demand: 1.2 }, baseline, defs[0], 1, 0.5).supply).toBe(0);
  const normal = Market.evolve({ supply: 40, demand: 1 }, { targetSupply: 80, targetDemand: 1 }, defs[0], 0.5, 0.5);
  const sold = Market.evolve({ supply: 60, demand: 1 }, { targetSupply: 80, targetDemand: 1 }, defs[0], 0.5, 0.5);
  expect(sold.supply).toBeGreaterThan(normal.supply); expect(normal.supply).toBeGreaterThan(40);
});
