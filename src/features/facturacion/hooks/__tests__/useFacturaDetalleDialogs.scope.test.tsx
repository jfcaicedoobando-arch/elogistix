import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFacturaDetalleDialogs } from "../useFacturaDetalleDialogs";
const factura = (id = "A", deleted_at: string | null = null) => ({ id, organization_id: "org", deleted_at });

describe("estado de diálogos por generación documental", () => {
  it.each(["otra factura", "baja", "desconocida", "otra empresa"])("%s descarta aperturas e invalida setters previos", (cambio) => {
    const a = factura();
    const { result, rerender } = renderHook(({ f }) => useFacturaDetalleDialogs(f), { initialProps: { f: a as typeof a | undefined } });
    const anterior = result.current;
    act(() => anterior.setPagoOpen(true));
    expect(result.current.pagoOpen).toBe(true);
    const f = cambio === "otra factura" ? factura("B") : cambio === "baja" ? factura("A", "2026-10-13") : cambio === "desconocida" ? undefined : { ...a, organization_id: "otra" };
    rerender({ f }); rerender({ f: a });
    expect(result.current.pagoOpen).toBe(false);
    act(() => anterior.setPagoOpen(true));
    expect(result.current.pagoOpen).toBe(false);
    act(() => result.current.setPagoOpen(true));
    expect(result.current.pagoOpen).toBe(true);
    act(() => anterior.setPagoOpen(false));
    expect(result.current.pagoOpen).toBe(true);
  });
  it("baja inicial no permite apertura y vigente permite transición cancelar→sustituir", () => {
    const { result, rerender } = renderHook(({ f }) => useFacturaDetalleDialogs(f), { initialProps: { f: factura("A", "2026-10-13") } });
    act(() => result.current.openPago()); expect(result.current.pagoOpen).toBe(false);
    rerender({ f: factura() });
    act(() => result.current.setCancelarOpen(true));
    act(() => { result.current.setCancelarOpen(false); result.current.setSustituirOpen(true); });
    expect(result.current.cancelarOpen).toBe(false); expect(result.current.sustituirOpen).toBe(true);
  });
});
