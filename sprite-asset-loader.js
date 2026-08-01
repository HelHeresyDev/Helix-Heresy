(function attachHelixSpriteAssetLoader(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HelixSpriteAssetLoader = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixSpriteAssetLoader() {
  "use strict";

  const LOADER_VERSION = 1;
  const LOAD_STATES = Object.freeze(["idle", "loading", "ready", "partial", "error"]);
  const ENTRY_STATES = Object.freeze(["idle", "loading", "ready", "error"]);
  const CATEGORIES = Object.freeze(["terrain", "fixture", "item", "actor", "effect", "marker"]);
  const SOURCE_TYPES = new Set(["image", "atlas"]);
  const FALLBACK_TYPES = new Set(["glyph", "procedural"]);
  const ROTATION_MODES = new Set(["none", "quarterTurns"]);
  const MIRROR_MODES = new Set(["none", "horizontal"]);
  const SAFE_KEY = /^[a-z][a-z0-9]*(?:[.-][a-zA-Z0-9]+)*$/;

  function positiveInteger(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
  }

  function safeRelativePath(value) {
    const path = String(value || "").trim();
    if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("..")) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
    return !path.includes("\\");
  }

  function nonnegativeInteger(value) {
    return Number.isInteger(Number(value)) && Number(value) >= 0;
  }

  function validateManifest(candidate) {
    const errors = [];
    if (!candidate || typeof candidate !== "object") return ["Sprite manifest must be an object."];
    if (!positiveInteger(candidate.version)) errors.push("Sprite manifest version must be a positive integer.");
    if (!Array.isArray(candidate.assets)) errors.push("Sprite manifest assets must be an array.");
    if (candidate.aliases !== undefined && !Array.isArray(candidate.aliases)) {
      errors.push("Sprite manifest aliases must be an array.");
    }
    const entries = Array.isArray(candidate.assets) ? candidate.assets : [];
    const aliases = Array.isArray(candidate.aliases) ? candidate.aliases : [];
    const keys = new Set();
    const categories = new Set();
    for (const [index, entry] of entries.entries()) {
      const label = `Asset ${index + 1}`;
      const key = String(entry?.key || "");
      if (!SAFE_KEY.test(key)) errors.push(`${label} has an invalid semantic key.`);
      if (keys.has(key)) errors.push(`${label} duplicates semantic key ${key}.`);
      keys.add(key);
      const category = String(entry?.category || "");
      if (!CATEGORIES.includes(category)) errors.push(`${label} has invalid category ${category || "(missing)"}.`);
      categories.add(category);
      const sourceType = String(entry?.source?.type || "");
      if (!SOURCE_TYPES.has(sourceType)) errors.push(`${label} has unsupported source type ${sourceType || "(missing)"}.`);
      if (!safeRelativePath(entry?.source?.path)) errors.push(`${label} must use a safe relative source path.`);
      if (!positiveInteger(entry?.sourceSize?.width) || !positiveInteger(entry?.sourceSize?.height)) {
        errors.push(`${label} must declare positive source dimensions.`);
      }
      const logicalSize = entry?.logicalSize;
      if (!positiveInteger(logicalSize?.width)
        || !positiveInteger(logicalSize?.height)
        || !positiveInteger(logicalSize?.layers)) {
        errors.push(`${label} must declare positive logical tile and layer dimensions.`);
      }
      const sourceRect = entry?.sourceRect;
      if (sourceRect !== undefined) {
        if (!nonnegativeInteger(sourceRect?.x)
          || !nonnegativeInteger(sourceRect?.y)
          || !positiveInteger(sourceRect?.width)
          || !positiveInteger(sourceRect?.height)
          || Number(sourceRect.x) + Number(sourceRect.width) > Number(entry?.sourceSize?.width)
          || Number(sourceRect.y) + Number(sourceRect.height) > Number(entry?.sourceSize?.height)) {
          errors.push(`${label} source rectangle must fit inside its declared source dimensions.`);
        }
      }
      const anchor = entry?.placement?.anchorTile;
      const supportsQuarterTurns = entry?.placement?.rotation === "quarterTurns";
      const anchorWidth = supportsQuarterTurns
        ? Math.min(Number(logicalSize?.width), Number(logicalSize?.height))
        : Number(logicalSize?.width);
      const anchorHeight = supportsQuarterTurns
        ? Math.min(Number(logicalSize?.width), Number(logicalSize?.height))
        : Number(logicalSize?.height);
      if (!nonnegativeInteger(anchor?.x)
        || !nonnegativeInteger(anchor?.y)
        || !nonnegativeInteger(anchor?.z)
        || Number(anchor.x) >= anchorWidth
        || Number(anchor.y) >= anchorHeight
        || Number(anchor.z) >= Number(logicalSize?.layers)) {
        errors.push(`${label} anchor tile must fit every supported oriented logical rectangle.`);
      }
      if (!ROTATION_MODES.has(String(entry?.placement?.rotation || ""))) {
        errors.push(`${label} has an invalid rotation mode.`);
      }
      if (!MIRROR_MODES.has(String(entry?.placement?.mirror || ""))) {
        errors.push(`${label} has an invalid mirror mode.`);
      }
      if (!Array.isArray(entry?.variants) || entry.variants.some((variant) => !SAFE_KEY.test(String(variant)))) {
        errors.push(`${label} variants must be an array of semantic keys.`);
      }
    }
    for (const category of CATEGORIES) {
      if (!categories.has(category)) errors.push(`Sprite manifest is missing category ${category}.`);
      const fallback = candidate.categoryFallbacks?.[category];
      if (!fallback || !FALLBACK_TYPES.has(String(fallback.type || ""))) {
        errors.push(`Sprite manifest category ${category} needs a glyph or procedural fallback.`);
      }
    }
    for (const [index, alias] of aliases.entries()) {
      const label = `Alias ${index + 1}`;
      if (!["exact", "prefix"].includes(alias?.match)) errors.push(`${label} has invalid match mode.`);
      if (!String(alias?.pattern || "").trim()) errors.push(`${label} needs a pattern.`);
      if (!keys.has(String(alias?.key || ""))) errors.push(`${label} points to missing asset ${alias?.key || "(missing)"}.`);
    }
    return errors;
  }

  function inferredCategory(key) {
    const prefix = String(key || "").split(".")[0];
    if (["tile", "terrain", "room"].includes(prefix)) return "terrain";
    if (["fixture", "container", "door", "object"].includes(prefix)) return "fixture";
    if (["item", "corpse", "material"].includes(prefix)) return "item";
    if (["actor", "creature", "slime"].includes(prefix)) return "actor";
    if (["effect", "hazard"].includes(prefix)) return "effect";
    return "marker";
  }

  function defaultImageFactory() {
    if (typeof Image !== "function") return null;
    return new Image();
  }

  function absoluteSourcePath(path, baseUrl) {
    if (typeof URL !== "function") return String(path || "");
    try {
      return new URL(String(path || ""), baseUrl || (typeof document === "object" ? document.baseURI : undefined)).href;
    } catch (_error) {
      return String(path || "");
    }
  }

  function createAssetLoader(manifest, options = {}) {
    const manifestErrors = validateManifest(manifest);
    if (manifestErrors.length && options.strict) {
      throw new Error(`Invalid sprite manifest:\n${manifestErrors.join("\n")}`);
    }
    const entries = new Map((Array.isArray(manifest?.assets) ? manifest.assets : [])
      .map((entry) => [entry.key, entry]));
    const aliases = Array.isArray(manifest?.aliases) ? [...manifest.aliases] : [];
    const records = new Map();
    const sourceRecords = new Map();
    const listeners = new Set();
    let destroyed = false;

    for (const entry of entries.values()) {
      const sourceKey = [
        entry.source.type,
        absoluteSourcePath(entry.source.path, options.baseUrl),
        `${entry.sourceSize.width}x${entry.sourceSize.height}`
      ].join(":");
      records.set(entry.key, {
        key: entry.key,
        sourceKey,
        status: "idle",
        image: null,
        error: "",
        attempts: 0,
        promise: null
      });
      if (!sourceRecords.has(sourceKey)) {
        sourceRecords.set(sourceKey, {
          key: sourceKey,
          entry,
          status: "idle",
          image: null,
          error: "",
          attempts: 0,
          promise: null
        });
      }
    }

    function canonicalEntry(requestedKey) {
      const key = String(requestedKey || "");
      if (entries.has(key)) return { entry: entries.get(key), resolution: "exact" };
      const parts = key.split(".");
      while (parts.length > 1) {
        parts.pop();
        const baseKey = parts.join(".");
        if (entries.has(baseKey)) return { entry: entries.get(baseKey), resolution: "base" };
      }
      const alias = aliases.find((candidate) => candidate.match === "exact"
        ? key === candidate.pattern
        : key.startsWith(candidate.pattern));
      if (alias && entries.has(alias.key)) return { entry: entries.get(alias.key), resolution: "alias" };
      return { entry: null, resolution: "fallback" };
    }

    function fallbackFor(requestedKey, entry = null) {
      const category = entry?.category || inferredCategory(requestedKey);
      return {
        category,
        ...(manifest?.categoryFallbacks?.[category] || { type: "glyph", key: "fallback.unknown", glyph: "?" })
      };
    }

    function snapshot() {
      const values = [...records.values()];
      const counts = Object.fromEntries(ENTRY_STATES.map((state) => [
        state,
        values.filter((record) => record.status === state).length
      ]));
      let state = "idle";
      if (manifestErrors.length) state = "error";
      else if (counts.loading) state = "loading";
      else if (counts.error && counts.ready) state = "partial";
      else if (counts.error) state = "error";
      else if (values.length && counts.ready === values.length) state = "ready";
      return {
        version: LOADER_VERSION,
        manifestId: String(manifest?.id || ""),
        manifestVersion: Number(manifest?.version) || 0,
        state,
        total: values.length,
        counts,
        errors: [
          ...manifestErrors,
          ...values.filter((record) => record.error).map((record) => `${record.key}: ${record.error}`)
        ]
      };
    }

    function notify() {
      if (destroyed) return;
      const current = snapshot();
      for (const listener of listeners) listener(current);
      options.onStatusChange?.(current);
    }

    function resolve(requestedKey) {
      const requested = String(requestedKey || "");
      const { entry, resolution } = canonicalEntry(requested);
      if (!entry) {
        return {
          requestedKey: requested,
          resolvedKey: "",
          resolution,
          status: "fallback",
          entry: null,
          image: null,
          fallback: fallbackFor(requested)
        };
      }
      const record = records.get(entry.key);
      return {
        requestedKey: requested,
        resolvedKey: entry.key,
        resolution,
        status: record?.status || "idle",
        entry,
        image: record?.status === "ready" ? record.image : null,
        fallback: fallbackFor(requested, entry)
      };
    }

    function load(requestedKey, loadOptions = {}) {
      const resolved = resolve(requestedKey);
      if (!resolved.entry) return Promise.resolve(resolved);
      const record = records.get(resolved.resolvedKey);
      const sourceRecord = sourceRecords.get(record.sourceKey);
      if (record.status === "ready") return Promise.resolve(resolve(requestedKey));
      if (record.status === "loading" && record.promise) return record.promise.then(() => resolve(requestedKey));
      if (record.status === "error" && !loadOptions.retry) return Promise.resolve(resolve(requestedKey));
      const finishRecord = () => {
        record.status = sourceRecord.status;
        record.image = sourceRecord.status === "ready" ? sourceRecord.image : null;
        record.error = sourceRecord.error;
        record.promise = null;
        notify();
        return resolve(requestedKey);
      };
      if (sourceRecord.status === "ready") {
        return Promise.resolve(finishRecord());
      }
      if (sourceRecord.status === "error" && !loadOptions.retry) {
        return Promise.resolve(finishRecord());
      }
      record.status = "loading";
      record.error = "";
      record.attempts += 1;
      notify();
      if (sourceRecord.status === "loading" && sourceRecord.promise) {
        record.promise = sourceRecord.promise.then(finishRecord);
        return record.promise;
      }
      sourceRecord.status = "loading";
      sourceRecord.error = "";
      sourceRecord.attempts += 1;
      sourceRecord.promise = new Promise((finish) => {
        const image = (options.imageFactory || defaultImageFactory)(sourceRecord.entry);
        if (!image) {
          sourceRecord.status = "error";
          sourceRecord.error = "Image construction is unavailable.";
          sourceRecord.promise = null;
          finish();
          return;
        }
        image.decoding = "async";
        image.onload = () => {
          const expected = sourceRecord.entry.sourceSize;
          const width = Number(image.naturalWidth || image.width);
          const height = Number(image.naturalHeight || image.height);
          if (width !== Number(expected.width) || height !== Number(expected.height)) {
            sourceRecord.status = "error";
            sourceRecord.image = null;
            sourceRecord.error = `Expected ${expected.width}x${expected.height}, loaded ${width}x${height}.`;
          } else {
            sourceRecord.status = "ready";
            sourceRecord.image = image;
            sourceRecord.error = "";
          }
          sourceRecord.promise = null;
          finish();
        };
        image.onerror = () => {
          sourceRecord.status = "error";
          sourceRecord.image = null;
          sourceRecord.error = `Failed to load ${sourceRecord.entry.source.path}.`;
          sourceRecord.promise = null;
          finish();
        };
        image.src = absoluteSourcePath(sourceRecord.entry.source.path, options.baseUrl);
      });
      record.promise = sourceRecord.promise.then(finishRecord);
      return record.promise;
    }

    async function loadAll(loadOptions = {}) {
      const requestedCategories = new Set(loadOptions.categories || CATEGORIES);
      await Promise.all([...entries.values()]
        .filter((entry) => requestedCategories.has(entry.category))
        .map((entry) => load(entry.key, loadOptions)));
      return snapshot();
    }

    function subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function destroy() {
      destroyed = true;
      listeners.clear();
      for (const sourceRecord of sourceRecords.values()) {
        if (sourceRecord.image) {
          sourceRecord.image.onload = null;
          sourceRecord.image.onerror = null;
        }
      }
    }

    return {
      version: LOADER_VERSION,
      manifest,
      validate: () => [...manifestErrors],
      resolve,
      load,
      loadAll,
      snapshot,
      subscribe,
      destroy
    };
  }

  return {
    LOADER_VERSION,
    LOAD_STATES,
    ENTRY_STATES,
    CATEGORIES,
    ROTATION_MODES,
    MIRROR_MODES,
    validateManifest,
    inferredCategory,
    createAssetLoader
  };
}));
