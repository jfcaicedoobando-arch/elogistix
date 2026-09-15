/**
 * CXP-NEW-12 — el diálogo de pago en lote se inicializa UNA sola vez por
 * apertura. Antes, cualquier refetch en segundo plano de las facturas o del
 * saldo borraba los importes ya editados y regeneraba la llave de idempotencia.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [] }),
}));
vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({
  useTcDofPorFecha: () => ({ data: null }),
}));
vi.mock("@/features/cxp/hooks/usePagoProveedorLote", () => ({
  usePagoProveedorLote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { usePagoLoteState } = await import("../usePagoLoteState");

const factura = (id: string, saldo: number) =>
  ({ id, folio: id, saldo, fecha_vencimiento: "2026-06-30" }) as never;

function args(facturas: unknown[]) {
  return {
    open: true,
    proveedorId: "p1",
    proveedorOrigen: "manual" as never,
    moneda: "MXN",
    facturas: facturas as never,
    onOpenChange: vi.fn(),
    onDone: vi.fn(),
  };
}

describe("usePagoLoteState · inicialización una vez por apertura", () => {
  it("conserva los importes editados cuando llega un refetch de facturas", () => {
    const lista = [factura("f1", 1000), factura("f2", 500)];
    const { result, rerender } = renderHook((p: { facturas: unknown[] }) =>
      usePagoLoteState(args(p.facturas)), { initialProps: { facturas: lista } });

    const requestInicial = result.current.requestId;
    act(() => result.current.setMonto("f1", 250));
    expect(result.current.renglones.find((r) => r.factura_id === "f1")?.monto).toBe(250);

    // Refetch en segundo plano: MISMOS datos, nueva referencia de arreglo.
    rerender({ facturas: [factura("f1", 1000), factura("f2", 500)] });

    expect(result.current.renglones.find((r) => r.factura_id === "f1")?.monto).toBe(250);
    expect(result.current.requestId).toBe(requestInicial);
  });
});
