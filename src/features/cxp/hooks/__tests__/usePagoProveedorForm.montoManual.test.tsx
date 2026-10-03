import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import type { FacturaCxP } from "@/features/cxp/services";
import type { TcDofVigente } from "@/features/catalogos/services/tipoCambioDof";
import { usePagoProveedorForm, type PagoEditable } from "../usePagoProveedorForm";

const consultaTc = vi.hoisted(() => ({ data: null as TcDofVigente | null, isLoading: false }));
vi.mock("@/features/catalogos/hooks/useTcDofPorFecha", () => ({
  useTcDofPorFecha: () => consultaTc,
}));
vi.mock("@/features/tesoreria/hooks/useTesoreriaCuentas", () => ({
  useCuentasBancarias: () => ({ data: [
    { id: "banco-1", moneda: "MXN", banco: "Banorte", alias: "Prueba" },
    { id: "banco-2", moneda: "MXN", banco: "Banorte", alias: "Otra cuenta" },
  ] }),
}));
vi.mock("../useSaldoProveedorCxp", () => ({
  useSaldoProveedorCxp: () => ({ data: null, isLoading: false }),
}));

const factura: FacturaCxP = {
  id: "factura-prueba", proveedor_id: "proveedor-prueba", proveedor_nombre: "Proveedor de prueba",
  proveedor_origen: null, embarque_id: null, embarque_expediente: null,
  folio_proveedor: "FP-PRUEBA", folio_interno: "FP-PRUEBA", fecha_emision: "2026-01-01",
  fecha_vencimiento: null, dias_vencido: 0, moneda: "USD", total: 100, pagado: 5,
  notas_credito: 0, saldo: 95, estado: "Vigente", estatus: "Parcial",
  tipo_cambio_usd: 20, estado_aprobacion: "aprobada", motivo_rechazo: null,
  categoria_presupuesto_id: null, categoria_nombre: null, subtotal: 100, iva: 0, ieps: 0,
  retenciones: 0, rfc_proveedor: null, uuid_fiscal: null, dias_credito: null, notas: null,
  archivo_xml_url: null, archivo_pdf_url: null, uuid_verificado: false, uuid_verificado_fecha: null,
  uuid_estatus_sat: null, fecha_programada_pago: null, fecha_cancelacion: null,
  motivo_cancelacion: null, cancelada_por: null, created_by: null,
  flags: { parcial: true, parcialPct: 5, ncAplicada: false, satVerificada: false, canceladaPor: null },
};

beforeEach(() => { consultaTc.data = null; });

describe("usePagoProveedorForm — monto capturado", () => {
  it("TC20→21 conserva MXN100 y sólo recalcula el saldo USD95", () => {
    const { result } = renderHook(() => usePagoProveedorForm(factura, true), { wrapper: createWrapper() });
    act(() => result.current.setMoneda("MXN"));
    act(() => result.current.setMonto("100"));
    expect(result.current.montoEnMonedaFactura).toBe(5);
    act(() => result.current.setTc("21"));
    expect(result.current.monto).toBe("100");
    expect(result.current.montoEnMonedaFactura).toBeCloseTo(100 / 21, 6);
    expect(result.current.saldoRestante).toBeCloseTo(95 - 100 / 21, 6);
    expect(result.current.impacto?.salida.monto).toBe(100);
    expect(result.current.impacto?.factura.saldoDespues).toBe(90.24);
    expect(result.current.validacion.error).toBeNull();
  });

  it("sigue sugiriendo el saldo completo cuando no hubo captura manual", () => {
    const { result } = renderHook(() => usePagoProveedorForm(factura, true), { wrapper: createWrapper() });
    act(() => result.current.setMoneda("MXN"));
    expect(result.current.monto).toBe("1900.00");
    act(() => result.current.setTc("21"));
    expect(result.current.monto).toBe("1995.00");
  });

  it("cambiar cuenta o moneda no reemplaza un pago parcial por todo el saldo", () => {
    const { result } = renderHook(() => usePagoProveedorForm(factura, true), { wrapper: createWrapper() });
    act(() => result.current.setMoneda("MXN"));
    act(() => result.current.setMonto("10"));
    act(() => result.current.setCuentaId("banco-2"));
    expect(result.current.monto).toBe("10");
    act(() => result.current.setMoneda("USD"));
    expect(result.current.monto).toBe("10");
    expect(result.current.montoEnMonedaFactura).toBe(10);
  });

  it.each(["", "0"])("conserva una captura %j al editar el TC", (monto) => {
    const { result } = renderHook(() => usePagoProveedorForm(factura, true), { wrapper: createWrapper() });
    act(() => result.current.setMoneda("MXN"));
    act(() => result.current.setMonto(monto));
    act(() => result.current.setTc("21"));
    expect(result.current.monto).toBe(monto);
    expect(result.current.validacion.error).not.toBeNull();
  });

  it("el TC DOF cargado tarde o aplicado por el usuario conserva el monto", () => {
    const { result, rerender } = renderHook(() => usePagoProveedorForm(factura, true), { wrapper: createWrapper() });
    act(() => result.current.setMoneda("MXN"));
    act(() => result.current.setMonto("100"));
    consultaTc.data = { usdMxn: 21, eurMxn: 23, fecha: "2026-10-02", exacto: true };
    rerender();
    expect(result.current.tc).toBe("21");
    expect(result.current.monto).toBe("100");
    act(() => result.current.setTc("22"));
    act(() => result.current.aplicarTcDof());
    expect(result.current.tc).toBe("21");
    expect(result.current.monto).toBe("100");
  });

  it("un refetch preserva captura y reabrir reinicia la sugerencia", () => {
    const { result, rerender } = renderHook(
      ({ actual, open }) => usePagoProveedorForm(actual, open),
      { initialProps: { actual: factura, open: true }, wrapper: createWrapper() },
    );
    act(() => result.current.setMoneda("MXN"));
    act(() => result.current.setMonto("100"));
    const actual = { ...factura, saldo: 90, pagado: 10 };
    rerender({ actual, open: true });
    expect(result.current.monto).toBe("100");
    expect(result.current.saldoRestante).toBe(85);
    rerender({ actual, open: false });
    rerender({ actual, open: true });
    expect(result.current.moneda).toBe("USD");
    expect(result.current.monto).toBe("90.00");
    act(() => result.current.setMoneda("MXN"));
    expect(result.current.monto).toBe("1800.00");
  });

  it("cambiar de factura reinicia captura; editar un pago preserva su monto", () => {
    const initialProps: { actual: FacturaCxP; pago: PagoEditable | null } = { actual: factura, pago: null };
    const { result, rerender } = renderHook(
      ({ actual, pago }: { actual: FacturaCxP; pago: PagoEditable | null }) =>
        usePagoProveedorForm(actual, true, pago),
      { initialProps, wrapper: createWrapper() },
    );
    act(() => result.current.setMonto("10"));
    const actual = { ...factura, id: "otra-factura", saldo: 50, pagado: 50 };
    rerender({ actual, pago: null });
    expect(result.current.monto).toBe("50.00");
    rerender({ actual, pago: {
      id: "pago-prueba", fecha_pago: "2026-10-02", monto: 100, moneda: "MXN",
      tipo_cambio_usd: 20, metodo_pago: "Transferencia", referencia: null, notas: null,
      cuenta_bancaria_id: "banco-1", diferencia_cambiaria_mxn: null,
    } });
    act(() => result.current.setTc("21"));
    expect(result.current.monto).toBe("100.00");
    expect(result.current.modo).toBe("editar");
  });
});
