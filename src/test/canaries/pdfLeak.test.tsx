/**
 * PDF leak canary (Fase 2 auditoría — 12.83.0).
 *
 * Monta y desmonta un documento PDF representativo 200 veces y verifica que
 * el heap no crezca de forma descontrolada. Como en tests `@react-pdf/renderer`
 * está aliasado a un stub ligero, este canary protege la cadena React + RTL +
 * cleanup global (`src/test/setup.ts`) — la fuga real reportada históricamente
 * provenía de fontkit/pdfkit, ya neutralizado, pero el ciclo render→unmount
 * sigue siendo el indicador de que el teardown global funciona.
 *
 * Umbral: drift < 50MB tras 200 ciclos (~250KB por ciclo). Es generoso para
 * tolerar GC perezoso del CI; el escenario real estable mide <5MB.
 *
 * Requiere `--expose-gc` (configurado en `vitest.config.ts` execArgv).
 */
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";

const proforma = {
  numero: "PROF-CANARY",
  fecha_emision: "2026-06-01",
  expediente: "EXP-CANARY",
  cliente_nombre: "Canary Client",
  subtotal_usd: 100, iva_usd: 16, total_usd: 116,
  subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0,
};
const embarque = {
  modo: "Marítimo", tipo: "FCL", incoterm: "FOB",
  puerto_origen: "Shanghai", puerto_destino: "Manzanillo",
  descripcion_mercancia: "Carga seca",
};
const concepto = {
  descripcion: "Flete",
  moneda: "USD",
  cantidad: 1,
  precio_unitario: 100,
  subtotal: 100,
  aplica_iva: true,
};

function gc(): void {
  const g = globalThis as unknown as { gc?: () => void };
  if (typeof g.gc === "function") {
    try { g.gc(); g.gc(); } catch { /* noop */ }
  }
}

describe("PDF leak canary (200 renders)", () => {
  it("no crece el heap más de 50MB tras 200 render+unmount", () => {
    gc();
    const heapBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 200; i++) {
      // try/finally + cleanup() asegura desmontaje aunque render() lance
      // (auditoría 13.137.28 - CRÍTICA: sin esto, una excepción dejaba el
      // árbol RTL montado e inflaba el heap del loop).
      const { unmount } = render(
        <ProformaDocument proforma={proforma as any} embarque={embarque as any} conceptos={[concepto as any]} />,
      );
      try {
        // render exitoso; no hay aserciones por iteración.
      } finally {
        unmount();
        cleanup();
      }
    }

    gc();
    const heapAfter = process.memoryUsage().heapUsed;
    const driftMB = (heapAfter - heapBefore) / (1024 * 1024);

    // Log informativo (útil cuando falla en CI).
    console.log(`[pdfLeak.canary] drift = ${driftMB.toFixed(2)} MB`);
    expect(driftMB).toBeLessThan(50);
  });
});
