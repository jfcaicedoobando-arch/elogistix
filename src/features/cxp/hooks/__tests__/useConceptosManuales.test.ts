import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConceptosManuales } from "../useConceptosManuales";

describe("useConceptosManuales", () => {
  it("duplica un renglón justo debajo conservando los valores", () => {
    const { result } = renderHook(() => useConceptosManuales());
    act(() => result.current.reemplazar([{ descripcion: "Flete", cantidad: 2, importe: 100, iva: 32, ieps: 0 }]));
    const key = result.current.conceptos[0].key;
    act(() => result.current.duplicar(key));

    expect(result.current.conceptos).toHaveLength(2);
    expect(result.current.conceptos[1].descripcion).toBe("Flete");
    expect(result.current.conceptos[1].key).not.toBe(key);
  });

  it("ajustarDiferencia reparte la diferencia en el importe unitario", () => {
    const { result } = renderHook(() => useConceptosManuales());
    act(() => result.current.reemplazar([{ descripcion: "MX ISPS", cantidad: 2, importe: 12, iva: 0, ieps: 0 }]));
    const key = result.current.conceptos[0].key;
    // Subtotal 12, suma 24 → diferencia -12 → importe unitario baja 6.
    act(() => result.current.ajustarDiferencia(key, -12));

    expect(result.current.conceptos[0].importe).toBe(6);
  });
});
