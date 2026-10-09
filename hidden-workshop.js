(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./theme-content') : root.HelixThemeContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixHiddenWorkshop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Theme) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const registry = Theme.createRegistry([{ id: 'facility.shared.hidden-workshop', kind: 'facility', compatibility: 'shared',
    contentTags: ['science', 'survival'], template: 'Physically supplied wilderness workshop', fallback: true }]);
  const EQUIPMENT = Object.freeze({ bench: 'basicWorkbench', generator: 'fuelGenerator', mana: 'manaCollector',
    water: 'waterCisternPump', sump: 'sumpTank', services: 'surfaceServiceTrunk', testStand: 'workshopServiceStand',
    lamp: 'wallLamp', heater: 'spaceHeater' });
  const SHELL_COSTS = Object.freeze({ lumber: 49, steelPanels: 12, metalParts: 6, rubber: 4 });
  const key = c => `${c.x},${c.y},${c.z}`;
  function create(options = {}) {
    const selected = Theme.selectContent(registry, { kind: 'facility', worldTheme: options.theme || 'madcap', seed: options.seed || 'workshop', required: true });
    if (!selected.ok) throw new Error('No compatible hidden workshop definition.');
    return { definitionId: selected.definitionId, sourceTheme: selected.sourceTheme, site: null, observations: { goods: [], fixtures: [] }, receipts: [] };
  }
  function normalize(value) { return value?.definitionId && value.observations && Array.isArray(value.receipts) ? copy(value) : create(); }
  function plan(origin) {
    const at = (x, y) => ({ x: origin.x + x, y: origin.y + y, z: origin.z });
    const floors = [], walls = [], services = [];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      floors.push(at(x, y));
      if ((x === 0 || y === 0 || x === 6 || y === 6) && !(x === 3 && y === 6)) walls.push(at(x, y));
    }
    for (let x = 1; x <= 5; x++) services.push(at(x, 3));
    for (let y = 2; y <= 7; y++) services.push(at(3, y));
    const unique = [...new Map(services.map(c => [key(c), c])).values()];
    return { origin: copy(origin), floors, walls, roofs: floors.map(c => ({ ...c, z: c.z + 1 })),
      entrance: at(3, 6), workCell: at(3, 5), stagingCell: at(2, 5),
      equipment: { bench: [at(1, 1)], generator: [at(1, 7)], mana: [at(3, 1)], water: [at(5, 1)],
        sump: [at(4, 4)], services: unique, testStand: [at(1, 4)], lamp: [at(1, 2)], heater: [at(2, 4)] },
      rotations: { sump: 180 },
      // Include the external generator's footprint and operator position.
      ground: [...floors, at(1, 7), at(2, 7), at(3, 7), at(1, 8)] };
  }
  function establishmentReason(state, c) {
    return state.site ? 'This run already has its one hidden workshop site.' : !c.alive || !c.local || !c.visited
      ? 'Personally visit the wilderness site before establishing a workshop.' : !c.wilderness
        ? 'Municipal sampling permission and the assay lease do not authorize this workshop.' : !c.observed
          ? 'Walk close enough to inspect the entire footprint; unobserved ground is not confirmed usable.' : !c.clear
            ? 'Choose clear reachable ground outside the landing footprint; this does not grant ownership or safety.' : '';
  }
  function establish(state, destination, layout, now, c) {
    const reason = establishmentReason(state, c); if (reason) return { ok: false, reason };
    state.site = { id: `hidden-workshop:${destination.id}`, destinationId: destination.id, strategicCellId: destination.strategicCellId,
      label: 'Hidden Receiving Workshop', roomId: c.roomId, establishedAt: now, layout: copy(layout), shellBuiltAt: null,
      fixtureIds: {}, disclosures: [{ at: now, source: 'Scientist', purpose: 'Physical site establishment' }] };
    return { ok: true };
  }
  function progress(work, seconds, attended, supplied = true) {
    const used = Math.max(0, Math.min(Number(seconds) || 0, work.required - work.progress));
    if (attended && supplied) work.progress += used;
    return attended && supplied ? used : 0;
  }
  function observe(state, now, visibleCells, goods, fixtures, shell) {
    const seen = new Set(visibleCells.map(key)), o = state.observations;
    o.goods = o.goods.filter(g => !seen.has(key(g.cell)));
    o.goods.push(...goods.filter(g => seen.has(key(g.cell))).map(g => ({ id: g.id, key: g.key, quantity: g.quantity, cell: copy(g.cell), at: now })));
    o.fixtures = o.fixtures.filter(f => !seen.has(key(f.cell)));
    o.fixtures.push(...fixtures.filter(f => seen.has(key(f.origin))).map(f => ({ id: f.id, label: f.name, cell: copy(f.origin),
      condition: f.condition, enabled: f.utility?.enabled, fuel: f.utility?.fuel, mana: f.utility?.storedMana,
      feedstock: f.utility?.feedstock, water: f.utility?.contents?.cleanWater,
      wasteUnits: Object.values(f.utility?.contents || {}).reduce((n, amount) => n + (Number(amount) || 0), 0), at: now })));
    if (shell !== null) o.shell = { intact: shell, at: now };
    o.lastAt = now;
  }
  function publicView(state) {
    if (!state?.site) return null;
    const s = state.site;
    return copy({ id: s.id, label: s.label, destinationId: s.destinationId, establishedAt: s.establishedAt,
      entrance: s.layout.entrance, workCell: s.layout.workCell, stagingCell: s.layout.stagingCell,
      disclosures: s.disclosures, observations: state.observations, receipts: state.receipts });
  }
  return { EQUIPMENT, SHELL_COSTS, create, normalize, plan, establishmentReason, establish, progress, observe, publicView };
});
