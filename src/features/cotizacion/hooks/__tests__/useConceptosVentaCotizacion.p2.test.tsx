/**
 * P2-IVA — clasificar explícitamente una línea "por definir" alinea la tasa con
 * el tratamiento elegido, sin crear combinaciones contradictorias.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConceptosVentaCotizacion } from "@/features/cotizacion/hooks/useConceptosVentaCotizacion";

vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));

describe("actualizarConcepto con campo tipo_iva", () => {
  it.each([
    ["gravado_16", 0.16, true],
    ["gravado_8", 0.08, true],
    ["tasa_0", 0, false],
    ["exento", 0, false],
    ["no_objeto", 0, false],
  ])("al elegir %s deja tasa %s y aplica_iva %s", (tipo, tasa, aplica) => {
    const { result } = renderHook(() => useConceptosVentaCotizacion());
    act(() => result.current.actualizarConcepto("MXN", 0, "tipo_iva", tipo));
    const fila = result.current.conceptosMXN[0];
    expect(fila.tipo_iva).toBe(tipo);
    expect(fila.tasa_iva_aplicada).toBe(tasa);
    expect(fila.aplica_iva).toBe(aplica);
  });

  it("un tipo no reconocido no toca la tasa (queda 'por definir')", () => {
    const { result } = renderHook(() => useConceptosVentaCotizacion());
    act(() => result.current.actualizarConcepto("MXN", 0, "tipo_iva", "inventado"));
    expect(result.current.conceptosMXN[0].tasa_iva_aplicada).toBe(0.16);
  });
});
