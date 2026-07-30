/**
 * Setup para tests que corren en entorno **node** (sin jsdom).
 *
 * v13.344.0 — La suite se partió en dos proyectos de Vitest:
 *   - `node`  → tests puros (dominio, utils, guardrails de arquitectura, SQL).
 *   - `jsdom` → tests que renderizan React o tocan el DOM.
 *
 * Levantar jsdom cuesta ~1–3 s por archivo y `setup.ts` importa
 * `@testing-library/*` + React encima. Para los ~580 archivos que nunca tocan
 * el DOM eso era tiempo puro de arranque. Este setup sólo conserva la higiene
 * de mocks/timers, que sí aplica en node.
 */
import { afterEach, beforeEach, afterAll, vi } from "vitest";

const maybeGc = (): void => {
  const g = globalThis as unknown as { gc?: () => void };
  if (typeof g.gc === "function") {
    try { g.gc(); } catch { /* noop */ }
  }
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.restoreAllMocks();
  maybeGc();
});

/**
 * Shim mínimo de storage para el entorno `node`.
 *
 * Analogía: es como darle a la cocina sólo el refrigerador, no toda la casa.
 * Varios módulos de dominio importan `@/integrations/supabase/client`, que en
 * su carga toca `localStorage`. En vez de mandar esos tests a jsdom (caro),
 * les damos un almacén en memoria. NO se define `window`/`document`: si un
 * test los necesita de verdad, falla ruidosamente y debe ir al proyecto jsdom.
 */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  } as Storage;
}

const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.localStorage === "undefined") g.localStorage = createMemoryStorage();
if (typeof g.sessionStorage === "undefined") g.sessionStorage = createMemoryStorage();
