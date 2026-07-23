(function attachHelixCreatureSpatial(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixCreatureSpatial = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixCreatureSpatial() {
  "use strict";

  const FULL_SHAPES = new Set(["cubic", "flat sheet"]);
  const BRANCHING_SHAPES = new Set(["branching", "star-like"]);

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeMask(mask, width, height) {
    const safeWidth = Math.max(1, Math.ceil(finiteNumber(width, 1)));
    const safeHeight = Math.max(1, Math.ceil(finiteNumber(height, 1)));
    const seen = new Set();
    const result = [];
    for (const candidate of Array.isArray(mask) ? mask : []) {
      const x = Math.round(finiteNumber(candidate?.x, -1));
      const y = Math.round(finiteNumber(candidate?.y, -1));
      const key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= safeWidth || y >= safeHeight || seen.has(key)) continue;
      seen.add(key);
      result.push({ x, y });
    }
    if (!result.length) result.push({ x: 0, y: 0 });
    return result.sort((left, right) => left.y - right.y || left.x - right.x);
  }

  function fullMask(width, height) {
    const mask = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) mask.push({ x, y });
    }
    return mask;
  }

  function ellipseMask(width, height) {
    if (width <= 2 || height <= 2) return fullMask(width, height);
    const radiusX = width / 2;
    const radiusY = height / 2;
    const mask = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = (x + 0.5 - radiusX) / radiusX;
        const dy = (y + 0.5 - radiusY) / radiusY;
        if (dx * dx + dy * dy <= 0.85) mask.push({ x, y });
      }
    }
    return normalizeMask(mask, width, height);
  }

  function branchingMask(width, height) {
    if (width <= 2 || height <= 2) return fullMask(width, height);
    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;
    const armX = width % 2 === 0 ? 0.55 : 0.15;
    const armY = height % 2 === 0 ? 0.55 : 0.15;
    const mask = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const horizontalArm = Math.abs(y - centerY) <= armY;
        const verticalArm = Math.abs(x - centerX) <= armX;
        const diagonalArm = Math.abs(Math.abs(x - centerX) - Math.abs(y - centerY)) <= 0.2;
        if (horizontalArm || verticalArm || diagonalArm) mask.push({ x, y });
      }
    }
    return normalizeMask(mask, width, height);
  }

  function shapeMask(shape, width, height) {
    const normalizedShape = String(shape || "blob").trim().toLowerCase();
    if (FULL_SHAPES.has(normalizedShape)) return fullMask(width, height);
    if (BRANCHING_SHAPES.has(normalizedShape)) return branchingMask(width, height);
    return ellipseMask(width, height);
  }

  function footprintFromDimensions(dimensions = {}, options = {}) {
    const tileSizeM = Math.max(0.01, finiteNumber(options.tileSizeM, 1));
    const layerHeightM = Math.max(0.01, finiteNumber(options.layerHeightM, 4));
    const lengthM = Math.max(0.01, finiteNumber(dimensions.lengthCm, dimensions.length) / 100);
    const widthM = Math.max(0.01, finiteNumber(dimensions.widthCm, dimensions.width) / 100);
    const heightM = Math.max(0.01, finiteNumber(dimensions.heightCm, dimensions.height) / 100);
    const width = Math.max(1, Math.ceil(lengthM / tileSizeM));
    const height = Math.max(1, Math.ceil(widthM / tileSizeM));
    const mask = shapeMask(options.shape, width, height);
    return {
      width,
      height,
      heightLayers: Math.max(1, Math.ceil(heightM / layerHeightM)),
      orientation: width === height ? "square" : options.orientation === "vertical" ? "vertical" : "horizontal",
      rotatable: width !== height && options.rotatable !== false,
      exclusive: mask.length > 1,
      mask,
      dimensionsM: { length: lengthM, width: widthM, height: heightM }
    };
  }

  function orientedMask(footprint = {}, orientation = footprint.orientation) {
    const width = Math.max(1, Math.ceil(finiteNumber(footprint.width, 1)));
    const height = Math.max(1, Math.ceil(finiteNumber(footprint.height, 1)));
    const mask = normalizeMask(footprint.mask, width, height);
    if (orientation !== "vertical" || width === height) return mask.map((cell) => ({ ...cell }));
    return mask.map((cell) => ({ x: height - 1 - cell.y, y: cell.x }))
      .sort((left, right) => left.y - right.y || left.x - right.x);
  }

  function footprintSignature(footprint = {}) {
    const width = Math.max(1, Math.ceil(finiteNumber(footprint.width, 1)));
    const height = Math.max(1, Math.ceil(finiteNumber(footprint.height, 1)));
    return normalizeMask(footprint.mask, width, height).map((cell) => `${cell.x}.${cell.y}`).join(",");
  }

  return {
    normalizeMask,
    shapeMask,
    footprintFromDimensions,
    orientedMask,
    footprintSignature
  };
}));
