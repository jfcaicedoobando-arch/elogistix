/**
 * El botón de envío al buzón exige proveedor seleccionado y que el operador
 * diga a qué costo corresponde (o declare que no hay costo capturado).
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/features/proveedor/services/duplicadoRfc", () => ({
  findProveedorByRfcEnOrg: vi.fn(async () => null),
}));
vi.mock("@/lib/domain/cfdiXmlMeta", () => ({
  extraerCfdiXmlMetaDeArchivo: vi.fn(async () => null),
  metaCfdiUtil: () => false,
}));

import { useSubirEntranteForm } from "@/features/cxp/hooks/useSubirEntranteForm";

const pdf = () => new File(["x"], "factura.pdf", { type: "application/pdf" });

describe("useSubirEntranteForm — proveedor obligatorio", () => {
  it("no está listo sin proveedor y sí al seleccionarlo", () => {
    const { result } = renderHook(() =>
      useSubirEntranteForm({ organizationId: "org-1" }),
    );

    act(() => result.current.agregarArchivos([pdf()]));
    expect(result.current.listo).toBe(false);

    act(() => result.current.setProveedor({ id: "prov-1", nombre: "Naviera SA" }));
    // v13.506.0 — Falta declarar el costo al que corresponde.
    expect(result.current.listo).toBe(false);

    act(() => result.current.marcarSinCosto(true));
    // v13.618.0 — El importe declarado también es obligatorio.
    expect(result.current.listo).toBe(false);

    act(() => result.current.setMontoDeclarado(500));
    expect(result.current.listo).toBe(true);
  });

  it("queda listo al marcar un concepto de costo", () => {
    const { result } = renderHook(() =>
      useSubirEntranteForm({ organizationId: "org-1" }),
    );

    act(() => result.current.agregarArchivos([pdf()]));
    act(() => result.current.setProveedor({ id: "prov-1", nombre: "Naviera SA" }));
    act(() =>
      result.current.toggleConcepto(
        { id: "c1", concepto: "Flete", monto: 1000, moneda: "USD" },
        true,
      ),
    );

    expect(result.current.conceptosSeleccionados).toHaveLength(1);
    expect(result.current.sumaSugeridaPorMoneda).toEqual({ USD: 1000 });
    expect(result.current.listo).toBe(false);

    // v13.618.0 — "Usar la suma de lo marcado" copia el importe declarado.
    act(() => result.current.setMonedaDeclarada("USD"));
    act(() => result.current.usarSumaSugerida());
    expect(result.current.montoDeclarado).toBe(1000);
    expect(result.current.listo).toBe(true);
  });

  it("al cambiar de proveedor se limpian los conceptos marcados", () => {
    const { result } = renderHook(() =>
      useSubirEntranteForm({ organizationId: "org-1" }),
    );

    act(() => result.current.agregarArchivos([pdf()]));
    act(() => result.current.setProveedor({ id: "prov-1", nombre: "Naviera SA" }));
    act(() =>
      result.current.toggleConcepto(
        { id: "c1", concepto: "Flete", monto: 1000, moneda: "USD" },
        true,
      ),
    );
    act(() => result.current.setProveedor({ id: "prov-2", nombre: "Otra SA" }));

    expect(result.current.conceptosSeleccionados).toHaveLength(0);
    expect(result.current.listo).toBe(false);
  });
});
