import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useFacturacionDateRange } from "../useFacturacionDateRange";

function makeWrapper(initialEntries: string[] = ["/"]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
}

describe("useFacturacionDateRange", () => {
  it("sin QP devuelve rango del mes en curso y activo=true", () => {
    const { result } = renderHook(() => useFacturacionDateRange(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.range.desde).toBeInstanceOf(Date);
    expect(result.current.range.hasta).toBeInstanceOf(Date);
    expect(result.current.activo).toBe(true);
  });

  it("isInRange filtra correctamente con QP explícitos", () => {
    const { result } = renderHook(() => useFacturacionDateRange(), {
      wrapper: makeWrapper(["/?desde=2024-01-01&hasta=2024-01-31"]),
    });
    expect(result.current.isInRange("2024-01-15")).toBe(true);
    expect(result.current.isInRange("2024-02-01")).toBe(false);
    expect(result.current.isInRange(null)).toBe(false);
  });

  it("setRango actualiza desdeIso y hastaIso", () => {
    const { result } = renderHook(() => useFacturacionDateRange(), {
      wrapper: makeWrapper(),
    });
    act(() => {
      result.current.setRango({ desde: new Date("2024-03-01"), hasta: new Date("2024-03-31") });
    });
    expect(result.current.desdeIso).toBe("2024-03-01");
    expect(result.current.hastaIso).toBe("2024-03-31");
  });
});
