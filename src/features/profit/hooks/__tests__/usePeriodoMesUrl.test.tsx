/**
 * Tests para el hook compartido de periodo mensual persistido en URL.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import { usePeriodoMesUrl } from "../usePeriodoMesUrl";

function makeWrapper(initialUrl: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("usePeriodoMesUrl", () => {
  it("lee el valor inicial desde ?mes= cuando es válido", () => {
    // Elegimos un mes que caiga en la ventana [hoy-24m, hoy+12m]
    const d = new Date();
    const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const { result } = renderHook(() => usePeriodoMesUrl("mes"), {
      wrapper: makeWrapper(`/dashboard?mes=${target}`),
    });
    expect(result.current.mesActual.key).toBe(target);
  });

  it("cae al mes actual si el valor de URL es inválido", () => {
    const { result } = renderHook(() => usePeriodoMesUrl("mes"), {
      wrapper: makeWrapper("/dashboard?mes=NOPE"),
    });
    const d = new Date();
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    expect(result.current.mesActual.key).toBe(esperado);
  });

  it("setMesKey actualiza el estado", () => {
    const { result } = renderHook(() => usePeriodoMesUrl("mes"), {
      wrapper: makeWrapper("/dashboard"),
    });
    const disponibles = result.current.mesesDisponibles;
    const otro = disponibles[Math.max(0, disponibles.length - 5)].key;
    act(() => { result.current.setMesKey(otro); });
    expect(result.current.mesActual.key).toBe(otro);
  });

  it("irMesAnterior / irMesSiguiente mueven un slot", () => {
    const { result } = renderHook(() => usePeriodoMesUrl("mes"), {
      wrapper: makeWrapper("/dashboard"),
    });
    const inicial = result.current.mesActual.key;
    act(() => { result.current.irMesAnterior(); });
    const anterior = result.current.mesActual.key;
    expect(anterior).not.toBe(inicial);
    act(() => { result.current.irMesSiguiente(); });
    expect(result.current.mesActual.key).toBe(inicial);
  });

  it("respeta minMes filtrando meses fuera de rango", () => {
    const { result } = renderHook(() => usePeriodoMesUrl("mes", "2100-01"), {
      wrapper: makeWrapper("/dashboard"),
    });
    // Todos los meses generados por generarMesesDisponibles quedan por debajo de 2100-01,
    // así que la lista debe quedar vacía y el mesActual será undefined-safe: verificamos length 0.
    expect(result.current.mesesDisponibles.length).toBe(0);
  });
});
