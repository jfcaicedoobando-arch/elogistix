/**
 * MNY (item 1): un pago en efectivo no debe llevar cuenta bancaria (la base
 * derivaba una salida de banco inexistente).
 * MNY (item 4): la diferencia cambiaria sólo se envía para el par USD/MXN, el
 * único que el servidor calcula y guarda.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/features/tesoreria/hooks/useTesoreriaCuentas", () => ({
  useCuentasBancarias: () => ({
    data: [
      { id: "c1", moneda: "MXN", banco: "BBVA", alias: "Principal" },
    ],
  }),
}));
import { usePagoProveedorForm } from "../usePagoProveedorForm";
import type { FacturaCxP } from "@/features/cxp/services";

function factura(moneda: string): FacturaCxP {
  return {
    id: "f1",
    moneda,
    saldo: 1000,
    total: 1000,
    tipo_cambio_usd: 19.5,
    proveedor_origen: null,
    estado_aprobacion: "aprobada",
    folio_proveedor: "F-1",
    proveedor_nombre: "Test",
  } as unknown as FacturaCxP;
}

describe("usePagoProveedorForm · efectivo sin cuenta bancaria", () => {
  it("preselecciona cuenta con transferencia y la limpia al pasar a efectivo", () => {
    const { result } = renderHook(() => usePagoProveedorForm(factura("MXN"), true), {
      wrapper: createWrapper(),
    });
    expect(result.current.cuentaBancariaIdEnvio).toBe("c1");

    act(() => result.current.setMetodo("Efectivo"));
    expect(result.current.requiereCuenta).toBe(false);
    expect(result.current.cuentaId).toBe("");
    expect(result.current.cuentaBancariaIdEnvio).toBeNull();
  });

  it("no auto-selecciona cuenta si el formulario abre en efectivo", () => {
    const { result } = renderHook(() => usePagoProveedorForm(factura("MXN"), true), {
      wrapper: createWrapper(),
    });
    act(() => result.current.setMetodo("Efectivo"));
    expect(result.current.cuentaBancariaIdEnvio).toBeNull();
  });
});

describe("usePagoProveedorForm · diferencia cambiaria por par de monedas", () => {
  it("USD pagado en MXN sí soporta diferencia cambiaria", () => {
    const { result } = renderHook(() => usePagoProveedorForm(factura("USD"), true), {
      wrapper: createWrapper(),
    });
    act(() => result.current.setMoneda("MXN"));
    expect(result.current.soportaDiferenciaCambiaria).toBe(true);
    act(() => result.current.setDiffMxn("12.34"));
    expect(result.current.diferenciaCambiariaEnvio).toBeCloseTo(12.34, 2);
  });

  it("EUR pagado en MXN no soporta diferencia cambiaria y no la envía", () => {
    const { result } = renderHook(() => usePagoProveedorForm(factura("EUR"), true), {
      wrapper: createWrapper(),
    });
    act(() => result.current.setMoneda("MXN"));
    expect(result.current.soportaDiferenciaCambiaria).toBe(false);
    act(() => result.current.setDiffMxn("12.34"));
    expect(result.current.diferenciaCambiariaEnvio).toBeNull();
  });
});
