import "@testing-library/jest-dom";
import { afterEach, afterAll, vi } from "vitest";
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
afterEach(() => {
  // 1. Desmonta árboles React Testing Library.
  cleanup();

  // 2. DOM hard reset: JSDOM acumula nodos (sobre todo <style> inyectados por
  //    Radix/Tailwind durante portales) que sostienen refs circulares.
  try {
    document.body.innerHTML = "";
    // Conservamos <meta> y <title> del head; quitamos sólo style/link extras.
    document.head.querySelectorAll("style,link[rel='stylesheet']").forEach((n) => n.remove());
  } catch { /* noop */ }

  // 3. Cancela rAF pendientes y vuelve a timers reales.
  try {
    // SAFE-CAST: requestAnimationFrame en JSDOM acepta callback simple.
    const id = (globalThis as unknown as { requestAnimationFrame?: (cb: () => void) => number })
      .requestAnimationFrame?.(() => {});
    if (typeof id === "number") {
      for (let i = id; i > 0; i--) {
        (globalThis as unknown as { cancelAnimationFrame?: (n: number) => void })
          .cancelAnimationFrame?.(i);
      }
    }
  } catch { /* noop */ }
  vi.useRealTimers();

  // 4. Handlers globales de error reseteados (algunos tests los sobrescriben).
  try {
    (window as unknown as { onerror: null; onunhandledrejection: null }).onerror = null;
    (window as unknown as { onerror: null; onunhandledrejection: null }).onunhandledrejection = null;
  } catch { /* noop */ }

  // 5. Mocks: sólo limpiar historia de llamadas. NO resetear ni restaurar
  //    (rompería mocks declarados a nivel módulo). Sí revertir stubs de
  //    globalThis/env, que son explícitamente por-test.
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();

  // 6. QueryClient global expuesto por algunos hooks de test.
  const g = globalThis as unknown as {
    __TEST_QUERY_CLIENT__?: {
      cancelQueries?: () => void;
      clear?: () => void;
      unmount?: () => void;
    };
  };
  if (g.__TEST_QUERY_CLIENT__) {
    try { g.__TEST_QUERY_CLIENT__.cancelQueries?.(); } catch { /* noop */ }
    try { g.__TEST_QUERY_CLIENT__.clear?.(); } catch { /* noop */ }
    try { g.__TEST_QUERY_CLIENT__.unmount?.(); } catch { /* noop */ }
    g.__TEST_QUERY_CLIENT__ = undefined;
  }

  // 7. Caches internos de @react-pdf/renderer (Font._fontkit y similares).
  //    No importamos el módulo aquí para no forzar su carga en tests que no
  //    lo usan; sólo limpiamos si quedó expuesto en globalThis.
  try {
    const pdfFontModule = (globalThis as Record<string, unknown>)["__REACT_PDF_FONT__"] as
      | { _fontkit?: unknown; clear?: () => void }
      | undefined;
    if (pdfFontModule) {
      if (typeof pdfFontModule.clear === "function") pdfFontModule.clear();
      if (pdfFontModule._fontkit) pdfFontModule._fontkit = undefined;
    }
  } catch { /* noop */ }

  // 8. GC opcional (--expose-gc).
  maybeGc();
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
