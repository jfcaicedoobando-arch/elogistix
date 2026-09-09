/**
 * Wrapper único para Window Storage (localStorage / sessionStorage).
 *
 * Centraliza:
 *  - Guard SSR (`typeof window === "undefined"`).
 *  - try/catch para QuotaExceededError, modo privado Safari, storage deshabilitado.
 *  - Catálogo de claves (`STORAGE_KEYS`) para evitar typos y duplicación.
 *  - Helpers de alto nivel para flujos compartidos (chunk-error reload).
 *
 * Regla del proyecto: NINGÚN archivo fuera de este wrapper debe leer/escribir
 * directamente en `window.localStorage` o `window.sessionStorage`. Excepción
 * documentada: `src/integrations/supabase/client.ts` (autogenerado).
 */

export const STORAGE_KEYS = {
  theme: "librecarga-theme",
  superAdminActiveOrg: "sa_active_org",
  chunkErrorReload: "chunk-error-auto-reload",
  queryCache: "lc-query-cache-v1",
  loginLoggedPrefix: "lc:login-logged:",
  appVersion: "lc-app-version",
  eerrFuente: "lc-eerr-fuente",
  // dashboardEjecutivoPeriodo removida en v13.300.31: el periodo ahora vive en URL (?mes=).
  tarifasViewMode: "lc-tarifas-view-mode",
  cxpPreviaAmpliada: "lc-cxp-previa-ampliada",
  navRecents: "nav:recent:v1",
  sidebarCollapsed: "sidebar:collapsed:v1",
  marketingAttribution: "lc-marketing-attribution",
} as const;

export const loginLoggedKey = (userId: string): string =>
  `${STORAGE_KEYS.loginLoggedPrefix}${userId}`;

type StorageKind = "local" | "session";

function rawStorage(kind: StorageKind): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function getStorageRef(kind: StorageKind): Storage | undefined {
  return rawStorage(kind);
}

interface SafeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function makeSafe(kind: StorageKind): SafeStorage {
  return {
    getItem(key) {
      const s = rawStorage(kind);
      if (!s) return null;
      try {
        return s.getItem(key);
      } catch (err) {
        console.warn(`[browserStorage] getItem(${key}) falló`, err);
        return null;
      }
    },
    setItem(key, value) {
      const s = rawStorage(kind);
      if (!s) return;
      try {
        s.setItem(key, value);
      } catch (err) {
        console.warn(`[browserStorage] setItem(${key}) falló`, err);
      }
    },
    removeItem(key) {
      const s = rawStorage(kind);
      if (!s) return;
      try {
        s.removeItem(key);
      } catch (err) {
        console.warn(`[browserStorage] removeItem(${key}) falló`, err);
      }
    },
  };
}

export const safeLocalStorage: SafeStorage = makeSafe("local");
export const safeSessionStorage: SafeStorage = makeSafe("session");

// -------- Helpers de alto nivel --------

// Historial de recargas por chunk caducado: ventana deslizante que permite
// recuperarse de un deploy nuevo pero corta bucles de recarga (ver
// `src/lib/errors/dynamicImportError.ts`).
export interface ChunkReloadHistory {
  count: number;
  first: number;
}

export function getChunkReloadHistory(): ChunkReloadHistory | null {
  const raw = safeSessionStorage.getItem(STORAGE_KEYS.chunkErrorReload);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "count" in parsed && "first" in parsed) {
      const { count, first } = parsed as Record<"count" | "first", unknown>;
      if (typeof count === "number" && typeof first === "number") return { count, first };
    }

    return null; // formato legacy ("1") o corrupto → se ignora
  } catch {
    return null;
  }
}

export function saveChunkReloadHistory(history: ChunkReloadHistory): void {
  safeSessionStorage.setItem(STORAGE_KEYS.chunkErrorReload, JSON.stringify(history));
}

export function clearPersistedQueryCache(): void {
  safeLocalStorage.removeItem(STORAGE_KEYS.queryCache);
}

export function getStoredAppVersion(): string | null {
  return safeLocalStorage.getItem(STORAGE_KEYS.appVersion);
}

export function setStoredAppVersion(version: string): void {
  safeLocalStorage.setItem(STORAGE_KEYS.appVersion, version);
}
