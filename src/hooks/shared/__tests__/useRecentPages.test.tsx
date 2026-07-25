import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { useRecentPages } from "../useRecentPages";
import type { ReactNode } from "react";

function wrapperAt(initial: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

describe("useRecentPages", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("registra rutas del mapa del sidebar y las persiste", () => {
    const { result } = renderHook(() => useRecentPages(), {
      wrapper: wrapperAt("/facturacion"),
    });
    expect(result.current.recents[0]).toEqual({ url: "/facturacion", title: "Facturación" });
    const raw = window.localStorage.getItem("nav:recent:v1");
    expect(raw).toContain("Facturación");
  });

  it("ignora rutas de detalle que no estén en el mapa", () => {
    const { result } = renderHook(() => useRecentPages(), {
      wrapper: wrapperAt("/facturacion/abc-123"),
    });
    expect(result.current.recents).toHaveLength(0);
  });

  it("dedupe: la misma URL no aparece dos veces", () => {
    // simulate multiple visits by mounting twice with different keys is complex;
    // en vez de eso probamos el dedupe directamente inyectando storage previo.
    window.localStorage.setItem(
      "nav:recent:v1",
      JSON.stringify([
        { url: "/embarques", title: "Embarques" },
        { url: "/facturacion", title: "Facturación" },
      ]),
    );
    const { result } = renderHook(() => useRecentPages(), {
      wrapper: wrapperAt("/facturacion"),
    });
    // /facturacion visitado ahora → debe estar de primero, sin duplicar
    expect(result.current.recents.map((r) => r.url)).toEqual([
      "/facturacion",
      "/embarques",
    ]);
  });

  it("parseo defensivo: storage roto = lista vacía", () => {
    window.localStorage.setItem("nav:recent:v1", "no es JSON");
    const { result } = renderHook(() => useRecentPages(), {
      wrapper: wrapperAt("/no/existe/en/mapa"),
    });
    expect(result.current.recents).toEqual([]);
  });
});

// silence lint: useNavigate is imported by MemoryRouter tree only
void useNavigate;
