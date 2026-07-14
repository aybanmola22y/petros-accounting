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

export function clearPersistedSnapshot() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
