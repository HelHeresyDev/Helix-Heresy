(function initStrategicGlobeRenderer(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const api = factory(strategicWorld);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicGlobeRenderer = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicGlobeRendererApi(StrategicWorld) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-globe-renderer.js");

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function rotateVector(vector, yaw, pitch) {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const x1 = cosYaw * vector[0] + sinYaw * vector[2];
    const z1 = -sinYaw * vector[0] + cosYaw * vector[2];
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    return [
      x1,
      cosPitch * vector[1] - sinPitch * z1,
      sinPitch * vector[1] + cosPitch * z1
    ];
  }

  function inverseRotateVector(vector, yaw, pitch) {
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const y1 = cosPitch * vector[1] + sinPitch * vector[2];
    const z1 = -sinPitch * vector[1] + cosPitch * vector[2];
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    return [
      cosYaw * vector[0] - sinYaw * z1,
      y1,
      sinYaw * vector[0] + cosYaw * z1
    ];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  const LAYER_LEGENDS = Object.freeze({
    surface: [{ label: "Land", color: "#526c46" }, { label: "Ocean", color: "#1c4559" }],
    elevation: [
      { label: "Deep ocean", color: "#102644" }, { label: "Shelf", color: "#488b97" },
      { label: "Lowland", color: "#4a7445" }, { label: "Highland", color: "#8b674c" }, { label: "High peak", color: "#e1e3dc" }
    ],
    tectonics: [
      { label: "Plate interiors", color: "#4c7b77" }, { label: "Convergent", color: "#ef6a4c" },
      { label: "Divergent", color: "#46c7d5" }, { label: "Transform", color: "#d9a252" }
    ],
    temperature: [
      { label: "≤ −15°C", color: "#dcecf1" }, { label: "−15–0°C", color: "#82b7cb" },
      { label: "0–10°C", color: "#5a9e99" }, { label: "10–20°C", color: "#77a95d" },
      { label: "20–30°C", color: "#d39a4d" }, { label: "> 30°C", color: "#b94f3f" }
    ],
    precipitation: [
      { label: "< 150 mm", color: "#b28b57" }, { label: "150–400 mm", color: "#a5a060" },
      { label: "400–800 mm", color: "#71945f" }, { label: "800–1,500 mm", color: "#47846d" },
      { label: "1,500–2,500 mm", color: "#387987" }, { label: "> 2,500 mm", color: "#565f9b" }
    ],
    hydrology: [
      { label: "Ocean", color: "#193e55" }, { label: "Land drainage", color: "#665f48" },
      { label: "Wetland", color: "#4d8978" }, { label: "River", color: "#3f9db5" },
      { label: "Major river", color: "#62c7dc" }, { label: "Major lake", color: "#80d7df" }
    ],
    biomes: [
      { label: "Ice / tundra", color: "#c5d9d2" }, { label: "Forest", color: "#3f704b" },
      { label: "Grass / shrub", color: "#8b9955" }, { label: "Desert", color: "#bd965a" },
      { label: "Wetland", color: "#4b8e78" }, { label: "Marine", color: "#315f78" }
    ],
    geology: [
      { label: "Granitic", color: "#b39b87" }, { label: "Basaltic", color: "#4c5360" },
      { label: "Siliciclastic", color: "#94775e" }, { label: "Carbonate", color: "#d2c8a6" },
      { label: "Metamorphic", color: "#786987" }, { label: "Volcanic", color: "#8a493f" },
      { label: "Ultramafic", color: "#566e52" }
    ],
    hazards: [
      { label: "Minimal", color: "#59635b" }, { label: "Earthquake", color: "#de9c43" },
      { label: "Volcanic", color: "#cf4c3f" }, { label: "Landslide", color: "#9b7048" },
      { label: "Subsidence", color: "#826c93" }, { label: "Geothermal", color: "#d56e4b" },
      { label: "Flood", color: "#3e8eae" }
    ],
    arcane: [
      { label: "Earth", color: "#87705b" }, { label: "Flame", color: "#cf633e" },
      { label: "Water", color: "#397fac" }, { label: "Frost", color: "#a7d8df" },
      { label: "Storm", color: "#7168a5" }, { label: "Wind", color: "#9db7ae" },
      { label: "Life", color: "#4f9b61" }, { label: "Ether", color: "#a65bb2" },
      { label: "Ley structure", color: "#f6d578" }, { label: "Null zone", color: "#525360" }
    ],
    prospects: [
      { label: "Ferrous ore", color: "#a85f48" }, { label: "Base metals", color: "#b47a51" },
      { label: "Precious minerals", color: "#d2b85a" }, { label: "Construction stone", color: "#8b8580" },
      { label: "Industrial minerals", color: "#b8aa8c" }, { label: "Chemical / fuel", color: "#685846" },
      { label: "Mana crystals", color: "#9c65bd" }, { label: "Nullstone", color: "#575c68" },
      { label: "Fresh water", color: "#4c98bd" }, { label: "Biological", color: "#67a55d" },
      { label: "Timber / fiber", color: "#52764d" }, { label: "Geothermal", color: "#d47a45" }
    ],
    humanGeography: [
      { label: "Fortified city", color: "#f3d27a" },
      { label: "Primary intercity corridor", color: "#74c7c1" },
      { label: "Redundant corridor", color: "#9aada7" },
      { label: "Human wilderness", color: "#3e493e" }
    ],
    cityPolities: [
      { label: "Fortified polity core", color: "#f0d27d" },
      { label: "Controlled approach", color: "#8ca96a" },
      { label: "Intermittent corridor support", color: "#63aaa6" },
      { label: "Ungoverned wilderness", color: "#303a33" }
    ],
    beastEcology: [
      { label: "Low reported threat", color: "#61744c" },
      { label: "Guarded", color: "#9a824c" },
      { label: "Dangerous", color: "#a95d45" },
      { label: "Catastrophic", color: "#782e45" },
      { label: "Contested range", color: "#a06cb0" },
      { label: "Reported migration corridor", color: "#4b9eaf" },
      { label: "Wave-pressure approach", color: "#d95b3f" },
      { label: "Known lair", color: "#f1d889" }
    ],
    religions: [
      { label: "Confirmed holy site", color: "#f2d477" },
      { label: "City with established faith", color: "#ad72c9" },
      { label: "Organized religious branches", color: "#668fbd" },
      { label: "No major public religious feature", color: "#39433f" }
    ],
    networks: [
      { label: "Orbital launch or relay hub", color: "#e4c66d" },
      { label: "Dense institutional hub", color: "#a875bd" },
      { label: "Public network branches", color: "#57989a" },
      { label: "No major public network hub", color: "#39433f" }
    ],
    settlements: [
      { label: "Sovereign resource-anchor city", color: "#d4b35e" },
      { label: "Rare independent refuge", color: "#b786c7" },
      { label: "Joint route stronghold", color: "#d6795b" },
      { label: "Agricultural satellite", color: "#79a95c" },
      { label: "Extraction satellite", color: "#aa9070" },
      { label: "Hunting, utility, or service satellite", color: "#5f9fa2" },
      { label: "Beast-dominated or unsettled land", color: "#39433f" }
    ]
  });

  function availableLayers(map) {
    const layers = ["surface"];
    if (map?.relief) layers.push("elevation", "tectonics");
    if (map?.climate) layers.push("temperature", "precipitation");
    if (map?.hydrology) layers.push("hydrology");
    if (map?.biomes) layers.push("biomes");
    if (map?.geology) layers.push("geology");
    if (map?.naturalHazards) layers.push("hazards");
    if (map?.arcaneGeography) layers.push("arcane");
    if (map?.publicResourceProspects) layers.push("prospects");
    if (map?.humanGeography) layers.push("humanGeography");
    if (map?.cityPolities) layers.push("cityPolities");
    if (map?.publicBeastAtlas) layers.push("beastEcology");
    if (map?.publicReligionDirectory) layers.push("religions");
    if (map?.publicNonStateNetworkDirectory) layers.push("networks");
    if (map?.publicSettlementDirectory) layers.push("settlements");
    return layers;
  }

  function legendForLayer(layer) {
    return (LAYER_LEGENDS[layer] || LAYER_LEGENDS.surface).map((entry) => ({ ...entry }));
  }

  function createRenderer(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== "function") throw new Error("A Canvas element is required for globe rendering.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The strategic globe Canvas context is unavailable.");
    let map = null;
    let topology = null;
    let yaw = -0.65;
    let pitch = -0.22;
    let zoom = 1;
    let selectedCellIndex = -1;
    let layer = "surface";
    let religionCellClasses = new Map();
    let networkCellClasses = new Map();
    let settlementCellClasses = new Map();
    let dragging = null;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(260, Math.round(rect.width || Number(canvas.getAttribute("width")) || 640));
      height = Math.max(220, Math.round(rect.height || Number(canvas.getAttribute("height")) || 440));
      pixelRatio = Math.max(1, Math.min(2, Number(globalThis.devicePixelRatio) || 1));
      const targetWidth = Math.round(width * pixelRatio);
      const targetHeight = Math.round(height * pixelRatio);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      render();
    }

    function surfaceColor(surfaceClass, light, selected) {
      if (selected) return "#f5bd58";
      const band = clamp(Math.floor(light * 5), 0, 4);
      const land = ["#324436", "#40563d", "#526c46", "#668251", "#7e9a60"];
      const ocean = ["#132936", "#173647", "#1c4559", "#22556d", "#2b6882"];
      return surfaceClass === "land" ? land[band] : ocean[band];
    }

    function elevationColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const elevation = Number(map.relief.elevationM[index]);
      const brightness = clamp(0.7 + light * 0.42, 0.7, 1.12);
      const stops = elevation < 0
        ? (elevation < -6000 ? [16, 38, 68] : elevation < -3500 ? [22, 62, 96] : elevation < -1200 ? [34, 92, 126] : [72, 139, 151])
        : (elevation < 500 ? [74, 116, 69] : elevation < 1800 ? [137, 137, 79] : elevation < 3600 ? [139, 103, 76] : elevation < 5200 ? [156, 140, 123] : [225, 227, 220]);
      return `rgb(${stops.map((value) => Math.round(clamp(value * brightness, 0, 255))).join(",")})`;
    }

    const PLATE_COLORS = [
      [61, 107, 119], [113, 87, 128], [124, 104, 61], [70, 119, 86],
      [124, 73, 76], [77, 93, 139], [130, 111, 97], [76, 123, 119]
    ];

    function tectonicsColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const boundaryIndex = map.relief.boundaryByCell[index];
      if (boundaryIndex >= 0) {
        return { convergent: "#ef6a4c", divergent: "#46c7d5", transform: "#d9a252" }[map.relief.boundaries[boundaryIndex]?.kind] || "#e3d0aa";
      }
      const plateIndex = Number(map.relief.plateByCell[index]) || 0;
      const base = PLATE_COLORS[plateIndex % PLATE_COLORS.length];
      const brightness = clamp(0.7 + light * 0.38, 0.7, 1.08);
      return `rgb(${base.map((value) => Math.round(clamp(value * brightness, 0, 255))).join(",")})`;
    }

    function shadedRgb(base, light) {
      const brightness = clamp(0.72 + light * 0.38, 0.72, 1.1);
      return `rgb(${base.map((value) => Math.round(clamp(value * brightness, 0, 255))).join(",")})`;
    }

    function temperatureColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const temperatureC = map.climate.temperatureTenthsC[index] / 10;
      const base = temperatureC <= -15 ? [220, 236, 241]
        : temperatureC <= 0 ? [130, 183, 203]
          : temperatureC <= 10 ? [90, 158, 153]
            : temperatureC <= 20 ? [119, 169, 93]
              : temperatureC <= 30 ? [211, 154, 77]
                : [185, 79, 63];
      return shadedRgb(base, light);
    }

    function precipitationColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const precipitationMm = map.climate.precipitationMm[index];
      const base = precipitationMm < 150 ? [178, 139, 87]
        : precipitationMm < 400 ? [165, 160, 96]
          : precipitationMm < 800 ? [113, 148, 95]
            : precipitationMm < 1500 ? [71, 132, 109]
              : precipitationMm < 2500 ? [56, 121, 135]
                : [86, 95, 155];
      return shadedRgb(base, light);
    }

    function hydrologyColor(index, light, selected) {
      if (selected) return "#f5bd58";
      if (map.surface.classes[index] === "W") return shadedRgb([25, 62, 85], light);
      if (map.hydrology.lakeByCell[index] >= 0) return shadedRgb([128, 215, 223], light);
      const river = map.hydrology.riverClasses[index];
      if (river === "G" || river === "R") return shadedRgb([98, 199, 220], light);
      if (river === "r") return shadedRgb([63, 157, 181], light);
      if (map.hydrology.wetlandClasses[index] !== ".") return shadedRgb([77, 137, 120], light);
      const moisture = map.climate?.aridityIndexPermille[index] || 0;
      return shadedRgb(moisture > 900 ? [91, 105, 74] : [102, 95, 72], light);
    }

    const BIOME_COLORS = Object.freeze({
      I: [220, 234, 230], T: [170, 190, 175], B: [55, 101, 72], F: [63, 112, 75],
      G: [141, 157, 81], S: [150, 137, 79], D: [189, 150, 90], Y: [73, 128, 67],
      R: [40, 111, 67], A: [137, 132, 123], W: [75, 142, 120], p: [154, 196, 207],
      c: [58, 106, 128], t: [49, 102, 128], w: [43, 112, 139], u: [54, 129, 123],
      h: [69, 151, 148], o: [42, 84, 111], d: [27, 58, 82]
    });

    function biomeColor(index, light, selected) {
      if (selected) return "#f5bd58";
      return shadedRgb(BIOME_COLORS[map.biomes.classes[index]] || [100, 100, 100], light);
    }

    const GEOLOGY_COLORS = Object.freeze({
      g: [179, 155, 135], b: [76, 83, 96], s: [148, 119, 94], c: [210, 200, 166],
      m: [120, 105, 135], v: [138, 73, 63], u: [86, 110, 82]
    });

    function geologyColor(index, light, selected) {
      if (selected) return "#f5bd58";
      return shadedRgb(GEOLOGY_COLORS[map.geology.bedrockClasses[index]] || [100, 100, 100], light);
    }

    const HAZARD_COLORS = Object.freeze({
      ".": [89, 99, 91], E: [222, 156, 67], V: [207, 76, 63], L: [155, 112, 72],
      S: [130, 108, 147], G: [213, 110, 75], F: [62, 142, 174]
    });

    function hazardColor(index, light, selected) {
      if (selected) return "#f5bd58";
      return shadedRgb(HAZARD_COLORS[map.naturalHazards.dominantClasses[index]] || HAZARD_COLORS["."], light);
    }

    const ARCANE_ASPECT_COLORS = Object.freeze({
      E: [135, 112, 91], F: [207, 99, 62], W: [57, 127, 172], I: [167, 216, 223],
      S: [113, 104, 165], A: [157, 183, 174], L: [79, 155, 97], T: [166, 91, 178]
    });

    function mixRgb(left, right, amount) {
      return left.map((value, index) => value * (1 - amount) + right[index] * amount);
    }

    function arcaneColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const nullStrength = map.arcaneGeography.nullPermille[index];
      if (nullStrength >= 600) return shadedRgb([82, 83, 96], light);
      const aspect = map.arcaneGeography.primaryAspectClasses[index];
      const concentration = map.arcaneGeography.manaConcentrationPermille[index];
      const intensity = 0.62 + concentration / 1000 * 0.5;
      let base = (ARCANE_ASPECT_COLORS[aspect] || [110, 95, 125]).map((value) => clamp(value * intensity, 0, 255));
      const ley = map.arcaneGeography.leyClasses[index];
      if (ley === "c") base = mixRgb(base, [104, 224, 216], 0.48);
      if (ley === "n") base = mixRgb(base, [246, 213, 120], 0.7);
      return shadedRgb(base, light);
    }

    const PROSPECT_COLORS = Object.freeze({
      F: [168, 95, 72], B: [180, 122, 81], P: [210, 184, 90], C: [139, 133, 128],
      I: [184, 170, 140], H: [104, 88, 70], M: [156, 101, 189], N: [87, 92, 104],
      W: [76, 152, 189], G: [103, 165, 93], T: [82, 118, 77], E: [212, 122, 69], ".": [82, 86, 83]
    });

    function prospectColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const code = map.publicResourceProspects.dominantProspectClasses[index];
      const familyId = {
        F: "ferrousOre", B: "baseMetalOre", P: "preciousMinerals", C: "constructionStone",
        I: "industrialMinerals", H: "chemicalFeedstock", M: "manaCrystals", N: "nullstone",
        W: "freshWater", G: "biologicalProductivity", T: "timberFiber", E: "geothermalEnergy"
      }[code];
      const band = familyId ? map.publicResourceProspects.prospectBands[familyId][index] : "0";
      const intensity = { "0": 0.55, "1": 0.72, "2": 0.9, "3": 1.08 }[band] || 0.55;
      let base = (PROSPECT_COLORS[code] || PROSPECT_COLORS["."]).map((value) => clamp(value * intensity, 0, 255));
      const confidence = map.publicResourceProspects.confidenceClasses[index];
      if (confidence === "l") base = mixRgb(base, [105, 105, 105], 0.35);
      if (confidence === "m") base = mixRgb(base, [105, 105, 105], 0.14);
      return shadedRgb(base, light);
    }

    function humanGeographyColor(index, light, selected) {
      if (selected) return "#f5bd58";
      return StrategicWorld.cellSurfaceClass(map, index) === "land"
        ? shadedRgb([62, 73, 62], light)
        : shadedRgb([24, 54, 68], light);
    }

    const POLITY_COLORS = Object.freeze([
      [208, 112, 92], [213, 159, 74], [145, 175, 92], [77, 165, 137],
      [78, 151, 183], [111, 125, 194], [165, 106, 185], [196, 105, 145]
    ]);

    function polityBaseColor(polity) {
      if (!polity) return [96, 110, 96];
      return POLITY_COLORS[parseInt(StrategicWorld.stableHash(polity.id), 16) % POLITY_COLORS.length];
    }

    function cityPolityColor(index, light, selected) {
      if (selected) return "#f5bd58";
      if (map.surface.classes[index] === "W") return shadedRgb([22, 50, 64], light);
      const controlClass = map.cityPolities.control.classes[index];
      const controllerIndex = map.cityPolities.control.controllerByCell[index];
      const base = polityBaseColor(controllerIndex >= 0 ? map.cityPolities.polities[controllerIndex] : null);
      if (controlClass === "c") return shadedRgb(base.map((value) => clamp(value * 1.15, 0, 255)), light);
      if (controlClass === "a") return shadedRgb(base.map((value) => value * 0.72), light);
      if (controlClass === "i") return shadedRgb([63, 126, 123], light);
      return shadedRgb([48, 58, 51], light);
    }

    function beastEcologyColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const threat = map.publicBeastAtlas.threatClasses[index];
      let base = threat === "4" ? [120, 46, 69]
        : threat === "3" ? [169, 93, 69]
          : threat === "2" ? [154, 130, 76]
            : threat === "1" ? [97, 116, 76]
              : (map.surface.classes[index] === "L" ? [47, 58, 49] : [22, 49, 64]);
      if (map.publicBeastAtlas.contestedClasses[index] === "c") base = mixRgb(base, [160, 108, 176], 0.32);
      if (map.publicBeastAtlas.migrationClasses?.[index] === "m") base = mixRgb(base, [75, 158, 175], 0.52);
      if (map.publicBeastAtlas.wavePressureClasses?.[index] === "w") base = mixRgb(base, [217, 91, 63], 0.68);
      return shadedRgb(base, light);
    }

    function religionColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const publicClass = religionCellClasses.get(index);
      const base = publicClass === "h" ? [242, 212, 119]
        : publicClass === "e" ? [173, 114, 201]
          : publicClass === "c" ? [102, 143, 189]
            : (map.surface.classes[index] === "L" ? [57, 67, 63] : [23, 48, 63]);
      return shadedRgb(base, light);
    }

    function networkColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const publicClass = networkCellClasses.get(index);
      const base = publicClass === "o" ? [228, 198, 109]
        : publicClass === "d" ? [168, 117, 189]
          : publicClass === "b" ? [87, 152, 154]
            : (map.surface.classes[index] === "L" ? [57, 67, 63] : [23, 48, 63]);
      return shadedRgb(base, light);
    }

    function settlementColor(index, light, selected) {
      if (selected) return "#f5bd58";
      const publicClass = settlementCellClasses.get(index);
      const base = publicClass === "c" ? [212, 179, 94]
        : publicClass === "r" ? [183, 134, 199]
          : publicClass === "s" ? [214, 121, 91]
            : publicClass === "a" ? [121, 169, 92]
              : publicClass === "e" ? [170, 144, 112]
                : ["h", "u", "t"].includes(publicClass) ? [95, 159, 162]
                  : (map.surface.classes[index] === "L" ? [57, 67, 63] : [23, 48, 63]);
      return shadedRgb(base, light);
    }

    function colorFor(index, light, selected) {
      if (layer === "elevation" && map?.relief) return elevationColor(index, light, selected);
      if (layer === "tectonics" && map?.relief) return tectonicsColor(index, light, selected);
      if (layer === "temperature" && map?.climate) return temperatureColor(index, light, selected);
      if (layer === "precipitation" && map?.climate) return precipitationColor(index, light, selected);
      if (layer === "hydrology" && map?.hydrology) return hydrologyColor(index, light, selected);
      if (layer === "biomes" && map?.biomes) return biomeColor(index, light, selected);
      if (layer === "geology" && map?.geology) return geologyColor(index, light, selected);
      if (layer === "hazards" && map?.naturalHazards) return hazardColor(index, light, selected);
      if (layer === "arcane" && map?.arcaneGeography) return arcaneColor(index, light, selected);
      if (layer === "prospects" && map?.publicResourceProspects) return prospectColor(index, light, selected);
      if (layer === "humanGeography" && map?.humanGeography) return humanGeographyColor(index, light, selected);
      if (layer === "cityPolities" && map?.cityPolities) return cityPolityColor(index, light, selected);
      if (layer === "beastEcology" && map?.publicBeastAtlas) return beastEcologyColor(index, light, selected);
      if (layer === "religions" && map?.publicReligionDirectory) return religionColor(index, light, selected);
      if (layer === "networks" && map?.publicNonStateNetworkDirectory) return networkColor(index, light, selected);
      if (layer === "settlements" && map?.publicSettlementDirectory) return settlementColor(index, light, selected);
      return surfaceColor(StrategicWorld.cellSurfaceClass(map, index), light, selected);
    }

    function renderHumanGeographyOverlay(centerX, centerY, radius) {
      if (!map?.humanGeography || (layer !== "humanGeography" && layer !== "cityPolities")) return;
      const corridorById = new Map(map.humanGeography.corridors.map((corridor) => [corridor.id, corridor]));
      context.lineCap = "round";
      context.lineJoin = "round";
      for (const route of map.routeGraph.routes) {
        const corridor = corridorById.get(route.id);
        context.strokeStyle = layer === "cityPolities"
          ? "rgba(99, 170, 166, 0.86)"
          : (corridor?.corridorClass === "redundant" ? "rgba(154, 173, 167, 0.82)" : "rgba(116, 199, 193, 0.94)");
        context.lineWidth = corridor?.corridorClass === "redundant" ? 1.15 : 1.8;
        const indices = route.cellPath.map(StrategicWorld.cellIndex);
        for (let index = 1; index < indices.length; index += 1) {
          const left = rotateVector(topology.vertices[indices[index - 1]], yaw, pitch);
          const right = rotateVector(topology.vertices[indices[index]], yaw, pitch);
          if (left[2] <= 0.01 || right[2] <= 0.01) continue;
          context.beginPath();
          context.moveTo(centerX + left[0] * radius, centerY - left[1] * radius);
          context.lineTo(centerX + right[0] * radius, centerY - right[1] * radius);
          context.stroke();
        }
      }
      for (const city of map.humanGeography.cities) {
        const index = StrategicWorld.cellIndex(city.cellId);
        const center = rotateVector(topology.vertices[index], yaw, pitch);
        if (center[2] <= 0.012) continue;
        const x = centerX + center[0] * radius;
        const y = centerY - center[1] * radius;
        const markerRadius = index === selectedCellIndex ? 5.1 : 3.6;
        context.beginPath();
        context.arc(x, y, markerRadius, 0, Math.PI * 2);
        const cityPolity = map.cityPolities?.polities.find((polity) => polity.cityId === city.id);
        const markerColor = layer === "cityPolities" ? polityBaseColor(cityPolity) : null;
        context.fillStyle = markerColor ? `rgb(${markerColor.join(",")})` : "#f3d27a";
        context.fill();
        context.strokeStyle = index === selectedCellIndex ? "#fff4c5" : "#392f22";
        context.lineWidth = index === selectedCellIndex ? 2 : 1;
        context.stroke();
      }
    }

    function renderBeastEcologyOverlay(centerX, centerY, radius) {
      if (layer !== "beastEcology" || !map?.publicBeastAtlas) return;
      for (const report of map.publicBeastAtlas.reports) {
        if (!report.knownLairCellId) continue;
        const index = StrategicWorld.cellIndex(report.knownLairCellId);
        const center = rotateVector(topology.vertices[index], yaw, pitch);
        if (center[2] <= 0.012) continue;
        const x = centerX + center[0] * radius;
        const y = centerY - center[1] * radius;
        context.beginPath();
        context.arc(x, y, index === selectedCellIndex ? 4.5 : 2.8, 0, Math.PI * 2);
        context.fillStyle = "#f1d889";
        context.fill();
        context.strokeStyle = "#3d2922";
        context.lineWidth = index === selectedCellIndex ? 2 : 1;
        context.stroke();
      }
    }

    function renderReligionOverlay(centerX, centerY, radius) {
      if (layer !== "religions" || !map?.publicReligionDirectory) return;
      for (const siteRow of map.publicPreCivicFaithDirectory?.holySiteRows || []) {
        const index = siteRow[3];
        const center = rotateVector(topology.vertices[index], yaw, pitch);
        if (center[2] <= 0.012) continue;
        const x = centerX + center[0] * radius;
        const y = centerY - center[1] * radius;
        const markerRadius = index === selectedCellIndex ? 5 : 3.2;
        context.beginPath();
        context.arc(x, y, markerRadius, 0, Math.PI * 2);
        context.fillStyle = "#f2d477";
        context.fill();
        context.strokeStyle = index === selectedCellIndex ? "#fff6cd" : "#513b62";
        context.lineWidth = index === selectedCellIndex ? 2 : 1;
        context.stroke();
      }
    }

    function render() {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.43 * zoom;
      const background = context.createRadialGradient(
        centerX - radius * 0.28,
        centerY - radius * 0.32,
        radius * 0.08,
        centerX,
        centerY,
        radius
      );
      background.addColorStop(0, "#264052");
      background.addColorStop(0.72, "#10242f");
      background.addColorStop(1, "#071017");
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fillStyle = background;
      context.fill();
      context.strokeStyle = "rgba(124, 205, 201, 0.45)";
      context.lineWidth = 1.5;
      context.stroke();
      if (!map || !topology) return;

      const lightDirection = [0.35, 0.55, 0.76];
      for (let index = 0; index < topology.cellCount; index += 1) {
        const center = rotateVector(topology.vertices[index], yaw, pitch);
        if (center[2] <= 0.012) continue;
        const corners = topology.cellCornerFaceIndices[index].map((faceIndex) => (
          rotateVector(topology.faceCenters[faceIndex], yaw, pitch)
        ));
        if (corners.some((corner) => corner[2] < -0.04)) continue;
        context.beginPath();
        corners.forEach((corner, cornerIndex) => {
          const x = centerX + corner[0] * radius;
          const y = centerY - corner[1] * radius;
          if (cornerIndex === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
        const light = clamp((dot(center, lightDirection) + 1) / 2, 0, 1);
        context.fillStyle = colorFor(index, light, index === selectedCellIndex);
        context.fill();
        context.strokeStyle = index === selectedCellIndex
          ? "rgba(255, 240, 190, 0.98)"
          : "rgba(7, 13, 16, 0.23)";
        context.lineWidth = index === selectedCellIndex ? 1.8 : 0.42;
        context.stroke();
      }

      const shade = context.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.38,
        radius * 0.6,
        centerX + radius * 0.38,
        centerY + radius * 0.18,
        radius * 1.08
      );
      shade.addColorStop(0, "rgba(0, 0, 0, 0)");
      shade.addColorStop(0.7, "rgba(0, 0, 0, 0.08)");
      shade.addColorStop(1, "rgba(0, 0, 0, 0.62)");
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fillStyle = shade;
      context.fill();
      renderHumanGeographyOverlay(centerX, centerY, radius);
      renderBeastEcologyOverlay(centerX, centerY, radius);
      renderReligionOverlay(centerX, centerY, radius);
    }

    function pickCell(clientX, clientY) {
      if (!map || !topology) return -1;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.43 * zoom;
      const x = (clientX - rect.left - centerX) / radius;
      const y = (centerY - (clientY - rect.top)) / radius;
      const squared = x * x + y * y;
      if (squared > 1) return -1;
      const viewPoint = [x, y, Math.sqrt(Math.max(0, 1 - squared))];
      const globePoint = inverseRotateVector(viewPoint, yaw, pitch);
      let bestIndex = -1;
      let bestDot = -Infinity;
      for (let index = 0; index < topology.cellCount; index += 1) {
        const score = dot(globePoint, topology.vertices[index]);
        if (score > bestDot) {
          bestDot = score;
          bestIndex = index;
        }
      }
      return bestIndex;
    }

    function selectCell(index, notify = true) {
      if (!topology?.vertices[index]) return false;
      selectedCellIndex = index;
      render();
      if (notify && typeof options.onSelect === "function") {
        options.onSelect(StrategicWorld.cellSnapshot(map, index));
      }
      return true;
    }

    function selectCenterCell() {
      if (!topology) return false;
      let bestIndex = 0;
      let bestDepth = -Infinity;
      for (let index = 0; index < topology.cellCount; index += 1) {
        const depth = rotateVector(topology.vertices[index], yaw, pitch)[2];
        if (depth > bestDepth) {
          bestDepth = depth;
          bestIndex = index;
        }
      }
      return selectCell(bestIndex);
    }

    function rotate(deltaYaw, deltaPitch) {
      yaw += Number(deltaYaw) || 0;
      pitch = clamp(pitch + (Number(deltaPitch) || 0), -Math.PI / 2, Math.PI / 2);
      render();
    }

    function setZoom(nextZoom) {
      zoom = clamp(Number(nextZoom) || 1, 0.72, 1.38);
      render();
    }

    function resetView() {
      yaw = -0.65;
      pitch = -0.22;
      zoom = 1;
      render();
    }

    function setLayer(nextLayer) {
      const requested = availableLayers(map).includes(nextLayer) ? nextLayer : "surface";
      layer = requested;
      render();
      return layer;
    }

    function setMap(nextMap) {
      map = nextMap ? StrategicWorld.validateStrategicMap(nextMap) : null;
      topology = map ? StrategicWorld.topologyForMap(map) : null;
      religionCellClasses = new Map((map?.publicReligiousInstitutionHistoryDirectory?.cellFeatures || map?.publicReligionDirectory?.cellFeatures || []).map((entry) => [parseInt(entry, 36), entry.split(":")[1]]));
      networkCellClasses = new Map((map?.publicNonStateNetworkHistoryDirectory?.cellFeatures || map?.publicNonStateNetworkDirectory?.cellFeatures || []).map((entry) => [parseInt(entry, 36), entry.split(":")[1]]));
      settlementCellClasses = new Map((map?.publicSettlementDirectory?.cellFeatures || []).map((entry) => [parseInt(entry, 36), entry.split(":")[1]]));
      selectedCellIndex = -1;
      layer = "surface";
      resetView();
      if (map) selectCenterCell();
    }

    canvas.addEventListener("pointerdown", (event) => {
      dragging = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - dragging.x;
      const deltaY = event.clientY - dragging.y;
      dragging.x = event.clientX;
      dragging.y = event.clientY;
      dragging.moved += Math.abs(deltaX) + Math.abs(deltaY);
      rotate(deltaX * 0.008, -deltaY * 0.008);
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      const moved = dragging.moved;
      dragging = null;
      canvas.releasePointerCapture?.(event.pointerId);
      if (moved < 6) {
        const index = pickCell(event.clientX, event.clientY);
        if (index >= 0) selectCell(index);
      }
    });
    canvas.addEventListener("pointercancel", () => { dragging = null; });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      setZoom(zoom + (event.deltaY < 0 ? 0.08 : -0.08));
    }, { passive: false });
    canvas.addEventListener("keydown", (event) => {
      const action = {
        ArrowLeft: () => rotate(-0.14, 0),
        ArrowRight: () => rotate(0.14, 0),
        ArrowUp: () => rotate(0, 0.12),
        ArrowDown: () => rotate(0, -0.12),
        "+": () => setZoom(zoom + 0.1),
        "=": () => setZoom(zoom + 0.1),
        "-": () => setZoom(zoom - 0.1),
        Home: resetView,
        Enter: selectCenterCell,
        " ": selectCenterCell
      }[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    });

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    resize();

    return Object.freeze({
      setMap,
      render,
      resize,
      rotate,
      setZoom,
      setLayer,
      resetView,
      selectCell,
      selectCenterCell,
      pickCell,
      snapshot: () => ({ yaw, pitch, zoom, layer, selectedCellIndex, hasMap: Boolean(map), hasRelief: Boolean(map?.relief), hasEnvironment: Boolean(map?.biomes), hasGeology: Boolean(map?.geology), hasArcaneGeography: Boolean(map?.arcaneGeography), hasResourceProspects: Boolean(map?.publicResourceProspects), hasHumanGeography: Boolean(map?.humanGeography), hasCityPolities: Boolean(map?.cityPolities), hasBeastEcology: Boolean(map?.publicBeastAtlas), hasReligions: Boolean(map?.publicReligionDirectory), hasNonStateNetworks: Boolean(map?.publicNonStateNetworkDirectory), hasSettlements: Boolean(map?.publicSettlementDirectory), availableLayers: availableLayers(map) }),
      destroy: () => resizeObserver?.disconnect()
    });
  }

  return Object.freeze({ createRenderer, rotateVector, inverseRotateVector, availableLayers, legendForLayer });
});
