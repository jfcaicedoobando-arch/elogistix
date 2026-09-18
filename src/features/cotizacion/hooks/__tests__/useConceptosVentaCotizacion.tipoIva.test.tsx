import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConceptosVentaCotizacion } from "@/features/cotizacion/hooks/useConceptosVentaCotizacion";

vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));

describe("useConceptosVentaCotizacion — tasa y tratamiento fiscal sincronizados", () => {
  beforeEach(() => vi.clearAllMocks());

  it("al elegir 16% sobre una línea 'tasa 0%' reclasifica a gravado 16%", () => {
    const { result } = renderHook(() =>
      useConceptosVentaCotizacion({
        initialMXN: [{
          descripcion: "Maniobras", unidad_medida: "Servicio", cantidad: 1, precio_unitario: 1000,
          moneda: "MXN", total: 1000, aplica_iva: true, tasa_iva_aplicada: 0, tipo_iva: "tasa_0",
        }],
      }),
    );
    act(() => result.current.actualizarConcepto("MXN", 0, "tasa_iva_aplicada", 0.16));
    const fila = result.current.conceptosMXN[0];
    expect(fila.tipo_iva).toBe("gravado_16");
    expect(fila.tasa_iva_aplicada).toBe(0.16);
    expect(fila.aplica_iva).toBe(true);
  });

  it("al elegir 8% reclasifica a gravado de frontera", () => {
    const { result } = renderHook(() => useConceptosVentaCotizacion());
    act(() => result.current.actualizarConcepto("MXN", 0, "tasa_iva_aplicada", 0.08));
    expect(result.current.conceptosMXN[0].tipo_iva).toBe("gravado_8");
  });

  it("no degrada 'no objeto' ni 'exento' aunque llegue un cambio de tasa", () => {
    const base = {
      descripcion: "Cuota", unidad_medida: "Servicio", cantidad: 1, precio_unitario: 500,
      moneda: "USD", total: 500, aplica_iva: false, tasa_iva_aplicada: 0,
    };
    const { result } = renderHook(() =>
      useConceptosVentaCotizacion({
        initialUSD: [
          { ...base, tipo_iva: "no_objeto" },
          { ...base, tipo_iva: "exento" },
        ],
      }),
    );
    act(() => result.current.actualizarConcepto("USD", 0, "tasa_iva_aplicada", 0.16));
    act(() => result.current.actualizarConcepto("USD", 1, "tasa_iva_aplicada", 0.16));
    expect(result.current.conceptosUSD[0].tipo_iva).toBe("no_objeto");
    expect(result.current.conceptosUSD[0].tasa_iva_aplicada).toBe(0);
    expect(result.current.conceptosUSD[1].tipo_iva).toBe("exento");
    expect(result.current.conceptosUSD[1].tasa_iva_aplicada).toBe(0);
  });

  it("apagar el IVA retira la clasificación gravada sin afirmar 'exento'", () => {
    const { result } = renderHook(() => useConceptosVentaCotizacion());
    act(() => result.current.actualizarConcepto("MXN", 0, "aplica_iva", false));
    const fila = result.current.conceptosMXN[0];
    expect(fila.tipo_iva).toBeUndefined();
    expect(fila.tasa_iva_aplicada).toBe(0);
  });
});
