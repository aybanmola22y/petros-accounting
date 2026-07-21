import type { MockStoreSnapshot } from "./empty-snapshot";

const STORAGE_KEY = "petrosphere-accounting-data";

export function loadPersistedSnapshot(): MockStoreSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockStoreSnapshot;
    if (!parsed || typeof parsed.version !== "number" || !Array.isArray(parsed.chartAccounts)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistSnapshot(snapshot: MockStoreSnapshot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Could not save accounting data to browser storage.", error);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersist: MockStoreSnapshot | null = null;

/** Debounce localStorage writes — full snapshots are expensive after imports. */
export function schedulePersistSnapshot(snapshot: MockStoreSnapshot) {
  if (typeof window === "undefined") return;
  pendingPersist = snapshot;
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const next = pendingPersist;
    pendingPersist = null;
    if (next) persistSnapshot(next);
  }, 750);
}

export function flushPersistSnapshot() {
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (pendingPersist) {
    persistSnapshot(pendingPersist);
    pendingPersist = null;
  }
}

export function clearPersistedSnapshot() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
