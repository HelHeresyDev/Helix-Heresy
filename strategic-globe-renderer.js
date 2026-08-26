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
    ]
  });

  function availableLayers(map) {
    const layers = ["surface"];
    if (map?.relief) layers.push("elevation", "tectonics");
    if (map?.climate) layers.push("temperature", "precipitation");
    if (map?.hydrology) layers.push("hydrology");
    if (map?.biomes) layers.push("biomes");
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

    function colorFor(index, light, selected) {
      if (layer === "elevation" && map?.relief) return elevationColor(index, light, selected);
      if (layer === "tectonics" && map?.relief) return tectonicsColor(index, light, selected);
      if (layer === "temperature" && map?.climate) return temperatureColor(index, light, selected);
      if (layer === "precipitation" && map?.climate) return precipitationColor(index, light, selected);
      if (layer === "hydrology" && map?.hydrology) return hydrologyColor(index, light, selected);
      if (layer === "biomes" && map?.biomes) return biomeColor(index, light, selected);
      return surfaceColor(StrategicWorld.cellSurfaceClass(map, index), light, selected);
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
      snapshot: () => ({ yaw, pitch, zoom, layer, selectedCellIndex, hasMap: Boolean(map), hasRelief: Boolean(map?.relief), hasEnvironment: Boolean(map?.biomes), availableLayers: availableLayers(map) }),
      destroy: () => resizeObserver?.disconnect()
    });
  }

  return Object.freeze({ createRenderer, rotateVector, inverseRotateVector, availableLayers, legendForLayer });
});
