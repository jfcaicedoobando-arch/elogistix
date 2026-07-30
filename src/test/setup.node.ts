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
