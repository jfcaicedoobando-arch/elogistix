import "@testing-library/jest-dom";
import { afterEach, afterAll, beforeAll, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * v13.137.25 — Instrumentación CI para localizar el archivo que cuelga el
 * shard 2. Imprime, antes de cada archivo de test, su ruta y un timestamp.
 * Si CI vuelve a hacer timeout >20min, el último FILE_START sin FILE_END
 * señala al culpable. Activado sólo cuando `CI=true` para no ensuciar local.
 */
if (process.env.CI) {
  // `expect.getState().testPath` es estable entre versiones de vitest.
  beforeAll(() => {
    try {
      const path = (globalThis as { expect?: { getState?: () => { testPath?: string } } })
        .expect?.getState?.()?.testPath;
      // eslint-disable-next-line no-console -- shard-trace instrumentation (CI only)
      console.log(`[shard-trace] FILE_START ${path ?? "?"} @ ${new Date().toISOString()}`);
    } catch { /* noop */ }
  });
  afterAll(() => {
    try {
      const path = (globalThis as { expect?: { getState?: () => { testPath?: string } } })
        .expect?.getState?.()?.testPath;
      // eslint-disable-next-line no-console -- shard-trace instrumentation (CI only)
      console.log(`[shard-trace] FILE_END   ${path ?? "?"} @ ${new Date().toISOString()}`);
    } catch { /* noop */ }
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * Polyfills globales para jsdom (Fase 3 auditoría 12.84.0).
 *
 * jsdom no implementa `ResizeObserver` ni `IntersectionObserver`. Varios
 * componentes Radix (Select, Tooltip, Popover) y `react-resizable-panels`
 * los invocan al montar; sin polyfill cada test que los usa falla con
 * `ResizeObserver is not defined`. Stub mínimo no-op (suficiente para tests
 * que no verifican layout real).
 */
class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] { return []; }
}
if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: typeof NoopObserver }).ResizeObserver = NoopObserver;
}
if (typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver === "undefined") {
  (globalThis as unknown as { IntersectionObserver: typeof NoopObserver }).IntersectionObserver = NoopObserver;
}
// `scrollIntoView` no existe en jsdom — Radix Select lo llama al abrir.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

/**
 * Helper: invoca global.gc() si Node corre con --expose-gc. No-op en caso
 * contrario. Permite recuperar heap entre archivos de test cuando se ejecuta
 * la suite completa en un solo proceso.
 */
const maybeGc = (): void => {
  const g = globalThis as unknown as { gc?: () => void };
  if (typeof g.gc === "function") {
    try { g.gc(); } catch { /* noop */ }
  }
};

/**
 * Cleanup global tras cada test para evitar la fuga acumulativa de memoria
 * detectada cuando la suite corre en un solo `vitest run` (vs. 2 shards).
 *
 * Mantiene `clearAllMocks` (NO `resetAllMocks`/`restoreAllMocks`) porque
 * varios archivos declaran mocks a nivel módulo con `vi.hoisted` / `vi.mock`
 * que se romperían si destruimos las implementaciones entre tests.
 */
function resetDom(): void {
  try {
    document.body.innerHTML = "";
    document.head.querySelectorAll("style,link[rel='stylesheet']").forEach((n) => n.remove());
  } catch { /* noop */ }
}

function cancelPendingFrames(): void {
  try {
    const id = (globalThis as unknown as { requestAnimationFrame?: (cb: () => void) => number })
      .requestAnimationFrame?.(() => {});
    if (typeof id === "number") {
      for (let i = id; i > 0; i--) {
        (globalThis as unknown as { cancelAnimationFrame?: (n: number) => void })
          .cancelAnimationFrame?.(i);
      }
    }
  } catch { /* noop */ }
}

function resetGlobalErrorHandlers(): void {
  try {
    (window as unknown as { onerror: null; onunhandledrejection: null }).onerror = null;
    (window as unknown as { onerror: null; onunhandledrejection: null }).onunhandledrejection = null;
  } catch { /* noop */ }
}

function cleanupGlobalQueryClient(): void {
  const g = globalThis as unknown as {
    __TEST_QUERY_CLIENT__?: {
      cancelQueries?: () => void;
      clear?: () => void;
      unmount?: () => void;
    };
  };
  if (!g.__TEST_QUERY_CLIENT__) return;
  try { g.__TEST_QUERY_CLIENT__.cancelQueries?.(); } catch { /* noop */ }
  try { g.__TEST_QUERY_CLIENT__.clear?.(); } catch { /* noop */ }
  try { g.__TEST_QUERY_CLIENT__.unmount?.(); } catch { /* noop */ }
  g.__TEST_QUERY_CLIENT__ = undefined;
}

function cleanupPdfFontCache(): void {
  try {
    const pdfFontModule = (globalThis as Record<string, unknown>)["__REACT_PDF_FONT__"] as
      | { _fontkit?: unknown; clear?: () => void }
      | undefined;
    if (!pdfFontModule) return;
    if (typeof pdfFontModule.clear === "function") pdfFontModule.clear();
    if (pdfFontModule._fontkit) pdfFontModule._fontkit = undefined;
  } catch { /* noop */ }
}

afterEach(() => {
  cleanup();
  resetDom();
  cancelPendingFrames();
  vi.useRealTimers();
  resetGlobalErrorHandlers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  cleanupGlobalQueryClient();
  cleanupPdfFontCache();
  maybeGc();
});

/**
 * Cleanup defensivo ANTES de cada test (13.85.3 — quick win audit #2).
 * `afterEach` ya limpia mocks tras el test previo, pero `beforeEach` blinda
 * casos donde un archivo declara mocks a nivel módulo y deja contadores
 * sucios al arrancar la suite, o cuando el archivo previo aborta sin pasar
 * por su `afterEach`.
 */
beforeEach(() => {
  vi.clearAllMocks();
});



/**
 * Teardown final por archivo: aquí sí es seguro restaurar implementaciones
 * porque no quedan más tests en el archivo y el siguiente correrá en un fork
 * nuevo (vitest.config.ts: maxForks=1 + fileParallelism=false).
 */
afterAll(() => {
  try {
    const pdfFontModule = (globalThis as Record<string, unknown>)["__REACT_PDF_FONT__"] as
      | { _fontkit?: unknown; clear?: () => void }
      | undefined;
    if (pdfFontModule?.clear) pdfFontModule.clear();
  } catch { /* noop */ }
  vi.restoreAllMocks();
  maybeGc();
});
