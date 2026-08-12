import "@testing-library/jest-dom";
import { afterEach, afterAll, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";



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


// jsdom no implementa `URL.createObjectURL`/`revokeObjectURL`. Los stubs
// evitan unhandled errors cuando timers tardíos (p.ej. `descargarBlob` con
// `setTimeout(revoke, 4000)`) se ejecutan después de que el test terminó.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => { /* noop */ };
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
 * Helpers de limpieza usados por el teardown. `clearAllMocks` (NO
 * `resetAllMocks`/`restoreAllMocks`) es lo único que corre entre tests porque
 * varios archivos declaran mocks a nivel módulo con `vi.hoisted` / `vi.mock`
 * que se romperían si destruimos las implementaciones.
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

/**
 * v13.513.0 — `afterEach` adelgazado (auditoría CI/tests). Sólo lo que DEBE
 * correr entre tests: desmontar el DOM de RTL, devolver los timers reales y
 * limpiar handlers/mocks. El GC y la caché de fuentes de PDF son caros y ya no
 * cambian el resultado de un test, así que viven en el `afterAll` por archivo.
 */
afterEach(() => {
  cleanup();
  resetDom();
  cancelPendingFrames();
  vi.useRealTimers();
  resetGlobalErrorHandlers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  cleanupGlobalQueryClient();
});

/**
 * Cleanup defensivo ANTES de cada test (13.85.3 — quick win audit #2).
 * Único punto donde se limpian contadores de mocks: blinda archivos que
 * declaran mocks a nivel módulo y arrancan con contadores sucios, o cuando el
 * archivo previo aborta sin pasar por su teardown.
 */
beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Teardown final por archivo: aquí sí es seguro restaurar implementaciones
 * porque no quedan más tests en el archivo y cada archivo corre en su propio
 * fork (`pool: "forks"` + `isolate: true` en vitest.config.ts).
 */
afterAll(() => {
  cleanupPdfFontCache();
  vi.restoreAllMocks();
  maybeGc();
});

