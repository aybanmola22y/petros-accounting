/**
 * In-browser request dedupe for heavy Supabase-backed list fetches.
 * Multiple components mounting the same hook share one in-flight request
 * (e.g. dashboard cards that both call useMockSales / useMockExpenses).
 */

const inFlight = new Map<string, Promise<unknown>>();

export async function fetchWithSharedCache<T>(
  key: string,
  loader: () => Promise<T>,
  options: { force?: boolean } = {},
): Promise<T> {
  if (!options.force) {
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
  }

  const promise = loader().finally(() => {
    if (inFlight.get(key) === promise) {
      inFlight.delete(key);
    }
  });

  inFlight.set(key, promise);
  return promise;
}

export function invalidateSharedFetchCache(key?: string) {
  if (key) {
    inFlight.delete(key);
    return;
  }
  inFlight.clear();
}
