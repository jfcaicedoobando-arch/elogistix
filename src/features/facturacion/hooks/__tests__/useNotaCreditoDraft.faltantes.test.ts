/**
 * YG-04 / YG-06 · Nota de crédito.
 * - `faltantesGuardar`/`faltantesTimbrar` explican por qué el botón está gris.
 * - `isDirty` avisa antes de perder la captura al cerrar el modal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mocks = vi.hoisted(() => ({
  crearNotaCredito: vi.fn(),
  timbrarMutate: vi.fn(),
  notifyError: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/features/facturacion/services/notasCredito", () => ({
  crearNotaCredito: mocks.crearNotaCredito,
}));
vi.mock("@/features/facturacion/hooks/useNotaCreditoFacturapi", () => ({
  useTimbrarNotaCredito: () => ({ mutateAsync: mocks.timbrarMutate }),
}));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.notifyError }));

import { useNotaCreditoDraft } from "../useNotaCreditoDraft";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const baseParams = {
  open: true,
  onOpenChange: vi.fn(),
  facturaId: "fact-1",
  saldoFactura: 10000,
  uuidFacturaOriginal: "UUID-1",
  monedaFactura: "MXN" as const,
  tipoCambioFactura: 1,
};

const conceptoOk = {
  descripcion: "Servicio", cantidad: 1, precio_unitario: 500,
  clave_sat: "84111506", clave_unidad: "E48", unidad: "u", tasa_iva: 0.16,
};

beforeEach(() => {
  mocks.crearNotaCredito.mockReset().mockResolvedValue({ id: "nc-1" });
  mocks.notifyError.mockReset();
});

describe("useNotaCreditoDraft · faltantes e isDirty", () => {
  it("al abrir en limpio: no está sucio y explica los faltantes principales", () => {
    const { result } = renderHook(() => useNotaCreditoDraft(baseParams), { wrapper });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.puedeGuardar).toBe(false);
    expect(result.current.faltantesGuardar).toContain("descripción");
    expect(result.current.faltantesGuardar).toContain("importe mayor a cero");
  });

  it("con descripción capturada queda sucio y sólo falta el concepto", () => {
    const { result } = renderHook(() => useNotaCreditoDraft(baseParams), { wrapper });
    act(() => { result.current.setDescripcion("Descuento comercial"); });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.faltantesGuardar).not.toContain("descripción");
    expect(result.current.faltantesGuardar).toContain("importe mayor a cero");
  });

  it("sin UUID de la factura original permite guardar pero no timbrar", () => {
    const { result } = renderHook(
      () => useNotaCreditoDraft({ ...baseParams, uuidFacturaOriginal: null }),
      { wrapper },
    );
    act(() => {
      result.current.setDescripcion("Descuento");
      result.current.setConceptos([conceptoOk]);
    });
    expect(result.current.puedeGuardar).toBe(true);
    expect(result.current.puedeTimbrar).toBe(false);
    expect(result.current.faltantesTimbrar).toEqual(["UUID fiscal de la factura original"]);
  });

  it("marca el faltante cuando el monto excede el saldo de la factura", () => {
    const { result } = renderHook(
      () => useNotaCreditoDraft({ ...baseParams, saldoFactura: 100 }),
      { wrapper },
    );
    act(() => {
      result.current.setDescripcion("Descuento");
      result.current.setConceptos([conceptoOk]);
    });
    expect(result.current.faltantesGuardar).toContain("monto dentro del saldo de la factura");
  });
});
