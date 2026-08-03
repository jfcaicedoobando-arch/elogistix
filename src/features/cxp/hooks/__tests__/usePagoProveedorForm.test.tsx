/**
 * FIX-14: validar pago CxP cross-currency (USD factura pagada en MXN).
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { vi } from "vitest";

// R6-N1: el hook ahora consulta cuentas bancarias; se aísla el acceso a red.
vi.mock("@/features/tesoreria/hooks/useTesoreriaCuentas", () => ({
  useCuentasBancarias: () => ({ data: [] }),
}));
import { usePagoProveedorForm } from "../usePagoProveedorForm";
import type { FacturaCxP } from "@/features/cxp/services";

const facturaUsd = {
  id: "f1",
  moneda: "USD",
  saldo: 1000,
  total: 1000,
  tipo_cambio_usd: 19.5,
  proveedor_origen: null,
  estado_aprobacion: "aprobada",
  folio_proveedor: "F-1",
  proveedor_nombre: "Test",
} as unknown as FacturaCxP;

describe("usePagoProveedorForm · FIX-14", () => {
  it("prefill del monto en MXN = saldo * TC al cambiar moneda", () => {
    const { result } = renderHook(() => usePagoProveedorForm(facturaUsd, true), { wrapper: createWrapper() });
    act(() => result.current.setMoneda("MXN"));
    expect(Number(result.current.monto)).toBeCloseTo(19500, 2);
    expect(result.current.esUsdPagadoEnMxn).toBe(true);
    expect(result.current.excede).toBe(false);
  });

  it("MXN 19,500 sobre factura USD 1,000 con TC 19.5 → liquida (no excede)", () => {
    const { result } = renderHook(() => usePagoProveedorForm(facturaUsd, true), { wrapper: createWrapper() });
    act(() => {
      result.current.setMoneda("MXN");
      result.current.setMonto("19500");
    });
    expect(result.current.montoEnMonedaFactura).toBeCloseTo(1000, 2);
    expect(result.current.saldoRestante).toBeCloseTo(0, 2);
    expect(result.current.excede).toBe(false);
  });

  it("MXN 20,000 excede el saldo USD 1,000 con TC 19.5", () => {
    const { result } = renderHook(() => usePagoProveedorForm(facturaUsd, true), { wrapper: createWrapper() });
    act(() => { result.current.setMoneda("MXN"); });
    act(() => { result.current.setMonto("20000"); });
    expect(result.current.excede).toBe(true);
  });

  it("sin TC válido → bloqueadoPorTc y no permite validar", () => {
    const facturaSinTc = { ...facturaUsd, tipo_cambio_usd: null } as unknown as FacturaCxP;
    const { result } = renderHook(() => usePagoProveedorForm(facturaSinTc, true), { wrapper: createWrapper() });
    act(() => {
      result.current.setMoneda("MXN");
      result.current.setTc("");
    });
    expect(result.current.bloqueadoPorTc).toBe(true);
  });
});
