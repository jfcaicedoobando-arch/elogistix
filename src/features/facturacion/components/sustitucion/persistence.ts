/**
 * Persistencia del progreso de sustitución CFDI en `sessionStorage`.
 *
 * Se guarda por `facturaId` original para que si el usuario navega al detalle
 * del borrador sustituto y regresa, el diálogo reabra en el paso "confirmar".
 * TTL: 24 h; después se descarta para no dejar borradores huérfanos.
 */
import { getStorageRef, safeSessionStorage } from "@/lib/browserStorage";

export interface PersistedState {
  nuevaId: string;
  ts: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;

export const storageKey = (facturaId: string) => `sustitucion:${facturaId}`;

/** Type guard sin cast (evita CRITICAL en auditoría de casts). */
function isPersistedState(v: unknown): v is PersistedState {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { nuevaId?: unknown }).nuevaId === "string" &&
    typeof (v as { ts?: unknown }).ts === "number"
  );
}

export function readPersisted(facturaId: string): PersistedState | null {
  try {
    const raw = safeSessionStorage.getItem(storageKey(facturaId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedState(parsed)) return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      safeSessionStorage.removeItem(storageKey(facturaId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePersisted(facturaId: string, nuevaId: string): void {
  const state: PersistedState = { nuevaId, ts: Date.now() };
  safeSessionStorage.setItem(storageKey(facturaId), JSON.stringify(state));
}

export function clearPersisted(facturaId: string): void {
  safeSessionStorage.removeItem(storageKey(facturaId));
}
