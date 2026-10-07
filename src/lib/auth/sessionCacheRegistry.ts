/** In-memory cache lifecycle. Lib owns the registry; features register their resetters. */
const resetters = new Set<() => void>();
let generation = 0;
const listeners = new Set<() => void>();
let notificationPending = false;

export function registerSessionCache(reset: () => void): () => void {
  resetters.add(reset);
  return () => { resetters.delete(reset); };
}

export function resetSessionCaches(): void {
  generation += 1;
  invalidateSessionCacheEntries();
  // Scope is revoked synchronously. Notify React after the current render/event;
  // publishing identity in an ancestor must not set state in a mounted child.
  if (!notificationPending) {
    notificationPending = true;
    queueMicrotask(() => {
      notificationPending = false;
      for (const listener of listeners) listener();
    });
  }
}

export function getSessionCacheGeneration(): number {
  return generation;
}

/** Mutation success clears short-lived data without revoking the auth operation. */
export function invalidateSessionCacheEntries(): void {
  for (const reset of resetters) reset();
}

export function subscribeSessionCacheGeneration(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
