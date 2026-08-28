/**
 * Ola 8 (M8): los filtros de listados deben vivir en el query string.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import React from "react";
import { useFiltroUrl, useTextoUrl } from "../useFiltroUrl";

const MONEDAS = ["todas", "MXN", "USD"] as const;
type Moneda = (typeof MONEDAS)[number];

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/compras/pagos"]}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </MemoryRouter>
  );
}

describe("useFiltroUrl / useTextoUrl", () => {
  it("arranca en el valor por defecto", () => {
    const { result } = renderHook(
      () => useFiltroUrl<Moneda>("moneda", MONEDAS, "todas"),
      { wrapper },
    );
    expect(result.current[0]).toBe("todas");
  });

  it("actualiza el valor del filtro", async () => {
    const { result } = renderHook(
      () => useFiltroUrl<Moneda>("moneda2", MONEDAS, "todas"),
      { wrapper },
    );
    await act(async () => { result.current[1]("MXN"); });
    expect(result.current[0]).toBe("MXN");
  });

  it("regresar al valor por defecto limpia el parámetro", async () => {
    const { result } = renderHook(
      () => useFiltroUrl<Moneda>("moneda3", MONEDAS, "todas"),
      { wrapper },
    );
    await act(async () => { result.current[1]("USD"); });
    expect(result.current[0]).toBe("USD");
    await act(async () => { result.current[1]("todas"); });
    expect(result.current[0]).toBe("todas");
  });

  it("maneja texto libre y lo limpia al vaciarlo", async () => {
    const { result } = renderHook(() => useTextoUrl("q"), { wrapper });
    expect(result.current[0]).toBe("");
    await act(async () => { result.current[1]("ACME"); });
    expect(result.current[0]).toBe("ACME");
    await act(async () => { result.current[1](""); });
    expect(result.current[0]).toBe("");
  });
});
