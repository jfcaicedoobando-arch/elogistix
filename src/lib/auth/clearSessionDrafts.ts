/** Shared storage contract: logout must not download wizard chunks to erase private drafts. */
import { getStorageRef, safeLocalStorage } from "@/lib/browserStorage";

export const DRAFT_KEY_PREFIX = "lc:cotizacion:draft:";
export const EMBARQUE_DRAFT_KEY_PREFIX = "lc:embarque:draft:";

function clearPrefix(prefix: string): void {
  const storage = getStorageRef("local");
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) safeLocalStorage.removeItem(key);
}

export function clearAllDrafts(): void { clearPrefix(DRAFT_KEY_PREFIX); }
export function clearAllEmbarqueDrafts(): void { clearPrefix(EMBARQUE_DRAFT_KEY_PREFIX); }
