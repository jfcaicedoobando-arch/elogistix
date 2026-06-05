import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
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
 * Cleanup global tras cada test para evitar la fuga acumulativa de memoria
 * detectada en shard 3/4 (OOM al procesar 73 archivos en el mismo worker).
 *
 * - cleanup(): desmonta árboles de React Testing Library (libera DOM + refs).
 * - vi.clearAllMocks(): resetea contadores/llamadas de mocks.
 * - vi.resetAllMocks(): restaura implementaciones de spies/mocks a su estado
 *   original para evitar acumulación de stubs entre archivos.
 * - vi.useRealTimers(): fuerza el retorno a timers reales si algún test usó
 *   `vi.useFakeTimers()`; previene timers simulados colgados que mantienen
 *   referencias a componentes ya desmontados.
 * - QueryClient global: cada createWrapper() crea uno nuevo; aquí limpiamos
 *   cualquier caché residual que se haya colgado en globalThis.
 * - @react-pdf/renderer: cachea Font._fontkit y otros recursos a nivel módulo;
 *   reseteamos los caches conocidos si el módulo está cargado.
 */
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.useRealTimers();

  // Limpia QueryClient global si algún test lo expuso en globalThis.
  const g = globalThis as unknown as { __TEST_QUERY_CLIENT__?: { clear: () => void } };
  if (g.__TEST_QUERY_CLIENT__ && typeof g.__TEST_QUERY_CLIENT__.clear === "function") {
    g.__TEST_QUERY_CLIENT__.clear();
    g.__TEST_QUERY_CLIENT__ = undefined;
  }

  // Limpia caches internos de @react-pdf/renderer si el módulo fue cargado.
  // No lo importamos directamente para no forzar su carga en tests que no lo usan.
  try {
    const pdfFontModule = (globalThis as Record<string, unknown>)["__REACT_PDF_FONT__"] as
      | { _fontkit?: unknown; clear?: () => void }
      | undefined;
    if (pdfFontModule) {
      if (typeof pdfFontModule.clear === "function") pdfFontModule.clear();
      if (pdfFontModule._fontkit) pdfFontModule._fontkit = undefined;
    }
  } catch {
    // noop
  }
});
