import { DEFAULTS, SCHEMA_VERSION, SYNC_STORAGE_SOFT_LIMIT } from "./constants.js";

const encoder = new TextEncoder();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function clone(value) {
  return structuredClone(value);
}

export function deepMergeDefaults(defaultValue, actualValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(actualValue) ? actualValue : clone(defaultValue);
  }

  if (isPlainObject(defaultValue)) {
    const source = isPlainObject(actualValue) ? actualValue : {};
    const merged = {};
    for (const [key, value] of Object.entries(defaultValue)) {
      merged[key] = deepMergeDefaults(value, source[key]);
    }
    for (const [key, value] of Object.entries(source)) {
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
    return merged;
  }

  return actualValue === undefined ? defaultValue : actualValue;
}

export async function migrateStoredData() {
  const [syncRaw, localRaw] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(null)
  ]);

  const nextSync = deepMergeDefaults(
    {
      aurora_initialized: DEFAULTS.aurora_initialized,
      aurora_schema_version: DEFAULTS.aurora_schema_version,
      settings: DEFAULTS.settings,
      notes: DEFAULTS.notes,
      activeNoteId: DEFAULTS.activeNoteId,
      stickers: DEFAULTS.stickers,
      shortcuts: DEFAULTS.shortcuts
    },
    syncRaw
  );

  const nextLocal = deepMergeDefaults(DEFAULTS.local, localRaw);

  if (!nextSync.aurora_schema_version || nextSync.aurora_schema_version < SCHEMA_VERSION) {
    nextSync.aurora_schema_version = SCHEMA_VERSION;
  }

  await Promise.all([
    chrome.storage.sync.set(nextSync),
    chrome.storage.local.set(nextLocal)
  ]);

  return { sync: nextSync, local: nextLocal };
}

export async function initializeStorage() {
  return migrateStoredData();
}

export async function getSyncState() {
  const raw = await chrome.storage.sync.get(null);
  return deepMergeDefaults(
    {
      aurora_initialized: DEFAULTS.aurora_initialized,
      aurora_schema_version: DEFAULTS.aurora_schema_version,
      settings: DEFAULTS.settings,
      notes: DEFAULTS.notes,
      activeNoteId: DEFAULTS.activeNoteId,
      stickers: DEFAULTS.stickers,
      shortcuts: DEFAULTS.shortcuts
    },
    raw
  );
}

export async function getLocalState() {
  const raw = await chrome.storage.local.get(null);
  return deepMergeDefaults(DEFAULTS.local, raw);
}

export async function getAppState() {
  const [sync, local] = await Promise.all([getSyncState(), getLocalState()]);
  return {
    ...sync,
    local
  };
}

export async function setLocalState(partial) {
  await chrome.storage.local.set(partial);
  return partial;
}

export async function estimateSyncSize(partial) {
  const current = await chrome.storage.sync.get(null);
  const merged = {
    ...current,
    ...partial
  };
  return encoder.encode(JSON.stringify(merged)).length;
}

export async function setSyncState(partial) {
  const size = await estimateSyncSize(partial);
  if (size > SYNC_STORAGE_SOFT_LIMIT) {
    throw new Error("Aurora sync storage is almost full. Trim notes or stickers before saving more.");
  }

  await chrome.storage.sync.set(partial);
  return partial;
}

export async function updateSetting(key, value) {
  const current = await getSyncState();
  const nextSettings = {
    ...current.settings,
    [key]: value
  };
  return setSyncState({ settings: nextSettings });
}

export function subscribeStorageChanges(listener) {
  const handler = (changes, areaName) => listener(changes, areaName);
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
