/**
 * RFE-01 / RNF-04 — el pago en lote CxP debe guardar el T/C de la MONEDA DEL LOTE
 * y bloquearse cuando el DOF de la fecha no está disponible.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/features/tesoreria/hooks", () => ({
  useCuentasBancarias: () => ({ data: [] }),
}));

const tcDofMock = vi.fn();
vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({
  useTcDofPorFecha: () => tcDofMock(),
}));

const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/cxp/hooks/usePagoProveedorLote", () => ({
  usePagoProveedorLote: () => ({ mutateAsync, isPending: false }),
}));

import { usePagoLoteState } from "../usePagoLoteState";

const facturas = [
  { id: "f1", saldo: 1000, folio_proveedor: "A-1", fecha_vencimiento: "2026-08-01", moneda: "EUR" },
] as never;

function montar(moneda: string) {
  return renderHook(
    () =>
      usePagoLoteState({
        open: true,
        proveedorId: "p1",
        proveedorOrigen: "Nacional",
        moneda,
        facturas,
        onOpenChange: () => {},
        onDone: () => {},
      }),
    { wrapper: createWrapper() },
  );
}

describe("usePagoLoteState · T/C por moneda", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    tcDofMock.mockReturnValue({
      data: { usdMxn: 17.5, eurMxn: 20.02, fecha: "2026-08-12", exacto: true },
    });
  });

  it("lote en EUR usa la paridad EUR/MXN, no la del dólar", () => {
    const { result } = montar("EUR");
    expect(result.current.tcAplicable).toBe(20.02);
    expect(result.current.tcBloqueado).toBe(false);
  });

  it("lote en USD usa la paridad USD/MXN", () => {
    const { result } = montar("USD");
    expect(result.current.tcAplicable).toBe(17.5);
  });

  it("lote en MXN no pide ni aplica T/C", () => {
    const { result } = montar("MXN");
    expect(result.current.tcAplicable).toBeNull();
    expect(result.current.tcBloqueado).toBe(false);
  });

  it("sin T/C DOF disponible bloquea el lote extranjero con mensaje en español", () => {
    tcDofMock.mockReturnValue({ data: null });
    const { result } = montar("EUR");
    expect(result.current.tcBloqueado).toBe(true);
    expect(result.current.error).toMatch(/Sin tipo de cambio DOF EUR\/MXN/);
  });

  it("no llama la RPC cuando el lote está bloqueado por T/C", async () => {
    tcDofMock.mockReturnValue({ data: null });
    const { result } = montar("USD");
    await result.current.submit();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
