/**
 * MNY P1.2 — pago en lote CxP en Efectivo: no debe viajar cuenta bancaria a la
 * RPC (antes quedaba la cuenta de Transferencia y se creaba un cargo fantasma).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({
    data: [{ id: "c1", alias: "MXN", banco: "BBVA", moneda: "MXN" }],
  }),
}));

vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({
  useTcDofPorFecha: () => ({ data: null }),
}));

const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/cxp/hooks/usePagoProveedorLote", () => ({
  usePagoProveedorLote: () => ({ mutateAsync, isPending: false }),
}));

import { usePagoLoteState } from "../usePagoLoteState";

const facturas = [
  { id: "f1", saldo: 600, folio_proveedor: "A-1", fecha_vencimiento: "2026-08-01", moneda: "MXN" },
  { id: "f2", saldo: 400, folio_proveedor: "A-2", fecha_vencimiento: "2026-08-02", moneda: "MXN" },
] as never;

function montar() {
  return renderHook(
    () =>
      usePagoLoteState({
        open: true,
        proveedorId: "p1",
        proveedorOrigen: "Nacional",
        moneda: "MXN",
        facturas,
        onOpenChange: () => {},
        onDone: () => {},
      }),
    { wrapper: createWrapper() },
  );
}

describe("usePagoLoteState · Efectivo sin cuenta bancaria", () => {
  beforeEach(() => mutateAsync.mockClear());

  it("al pasar de Transferencia a Efectivo limpia la cuenta y manda null", async () => {
    const { result } = montar();
    act(() => result.current.setCuentaId("c1"));
    expect(result.current.cuentaId).toBe("c1");
    expect(result.current.requiereCuenta).toBe(true);

    act(() => result.current.setMetodo("Efectivo"));
    expect(result.current.cuentaId).toBe("");
    expect(result.current.requiereCuenta).toBe(false);

    await act(async () => {
      await result.current.submit();
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      metodo_pago: "Efectivo",
      cuenta_bancaria_id: null,
    });
  });

  it("con Transferencia sí envía la cuenta seleccionada", async () => {
    const { result } = montar();
    act(() => result.current.setMetodo("Transferencia"));
    act(() => result.current.setCuentaId("c1"));
    await act(async () => {
      await result.current.submit();
    });
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ cuenta_bancaria_id: "c1" });
  });
});
