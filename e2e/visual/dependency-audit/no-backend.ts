// Sólo esta demo: I/O en memoria, sin localStorage, Auth, Sentry ni Supabase.
const memory = new Map<string, string>();
export const STORAGE_KEYS = { queryCache: "dependency-audit-synthetic" };
export const getStorageRef = () => ({
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
});
export function storedSnapshot() { return memory.get(STORAGE_KEYS.queryCache) ?? "Pendiente"; }
export const invalidateSessionCacheEntries = () => {};
export const reportQueryError = () => {};
export const notifyQueryFailure = () => {};
export const rootOf = () => undefined;
export const opOf = () => undefined;
export let fetchCount = 0;
export async function fetchExchangeRates() {
  fetchCount += 1;
  return { usdMxn: 20 + fetchCount, eurMxn: 22, esFallback: false };
}
