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

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/compras/pagos?moneda=USD&q=ACME"]}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </MemoryRouter>
  );
}

describe("useFiltroUrl / useTextoUrl", () => {
  it("lee el valor inicial desde la URL", () => {
    const { result } = renderHook(
      () => useFiltroUrl<(typeof MONEDAS)[number]>("moneda", MONEDAS, "todas"),
      { wrapper },
    );
    expect(result.current[0]).toBe("USD");
  });

  it("cae al valor por defecto cuando el parámetro no es válido", () => {
    const { result } = renderHook(
      () => useFiltroUrl<(typeof MONEDAS)[number]>("otro", MONEDAS, "todas"),
      { wrapper },
    );
    expect(result.current[0]).toBe("todas");
  });

  it("actualiza el valor del filtro", async () => {
    const { result } = renderHook(
      () => useFiltroUrl<(typeof MONEDAS)[number]>("moneda", MONEDAS, "todas"),
      { wrapper },
    );
    await act(async () => { result.current[1]("MXN"); });
    expect(result.current[0]).toBe("MXN");
  });

  it("lee y actualiza texto libre", async () => {
    const { result } = renderHook(() => useTextoUrl("q"), { wrapper });
    expect(result.current[0]).toBe("ACME");
    await act(async () => { result.current[1](""); });
    expect(result.current[0]).toBe("");
  });
});
