/**
 * Tests para el hook compartido de periodo mensual persistido en URL.
 * Cubre lectura inicial, sanitización, navegación, minMes, sync con URL externa
 * y canonicalización cuando el query param es inválido.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
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

/** Wrapper que expone `navigate` para simular back/forward externo. */
let externalNavigate: ((to: string) => void) | null = null;
let externalSearch: string = "";
function InstrumentedRoutes({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    externalNavigate = (to) => navigate(to);
    externalSearch = location.search;
  }, [navigate, location.search]);
  return <>{children}</>;
}
function makeInstrumentedWrapper(initialUrl: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="*" element={<InstrumentedRoutes>{children}</InstrumentedRoutes>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("usePeriodoMesUrl", () => {
  it("lee el valor inicial desde ?mes= cuando es válido", () => {
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
    expect(result.current.mesesDisponibles.length).toBe(0);
    expect(result.current.mesActual.key).toBe("");
    expect(result.current.puedeIrAtras).toBe(false);
    expect(result.current.puedeIrAdelante).toBe(false);
  });

  it("sincroniza mesActual cuando la URL cambia externamente (back/forward)", async () => {
    const disp = (() => {
      const d = new Date();
      const y = d.getFullYear(); const m = d.getMonth();
      const p = (n: number) => String(n).padStart(2, "0");
      // Usamos dos meses seguros dentro de la ventana [-24, +12].
      return [`${y}-${p(m + 1)}`, `${y - 1}-${p(m + 1)}`];
    })();
    externalNavigate = null;
    const { result } = renderHook(() => usePeriodoMesUrl("mes"), {
      wrapper: makeInstrumentedWrapper(`/dashboard?mes=${disp[0]}`),
    });
    expect(result.current.mesActual.key).toBe(disp[0]);

    // Simular back/forward: cambiar la URL sin pasar por setMesKey.
    await waitFor(() => expect(externalNavigate).not.toBeNull());
    act(() => { externalNavigate!(`/dashboard?mes=${disp[1]}`); });
    await waitFor(() => expect(result.current.mesActual.key).toBe(disp[1]));
  });

  it("canonicaliza URL cuando el query param es inválido", async () => {
    externalSearch = "";
    renderHook(() => usePeriodoMesUrl("mes"), {
      wrapper: makeInstrumentedWrapper("/dashboard?mes=1999-01"),
    });
    // El efecto debe reescribir la URL a un valor válido.
    await waitFor(() => {
      expect(externalSearch).not.toContain("mes=1999-01");
      expect(externalSearch).toMatch(/mes=\d{4}-\d{2}/);
    });
  });
});
