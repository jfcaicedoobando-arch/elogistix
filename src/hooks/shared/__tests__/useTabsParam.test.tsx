import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useTabsParam } from "../useTabsParam";

const TABS = ["general", "documentos", "actividades"] as const;

function makeWrapper(url = "/") {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
}

describe("useTabsParam", () => {
  it("sin QP devuelve el tab por defecto", () => {
    const { result } = renderHook(() => useTabsParam(TABS, "general"), {
      wrapper: makeWrapper(),
    });
    expect(result.current.activeTab).toBe("general");
  });

  it("lee tab válido de la URL", () => {
    const { result } = renderHook(() => useTabsParam(TABS, "general"), {
      wrapper: makeWrapper("/?tab=documentos"),
    });
    expect(result.current.activeTab).toBe("documentos");
  });

  it("setActiveTab actualiza el tab activo", async () => {
    const { result } = renderHook(() => useTabsParam(TABS, "general"), {
      wrapper: makeWrapper(),
    });
    await act(async () => { result.current.setActiveTab("actividades"); });
    expect(result.current.activeTab).toBe("actividades");
  });

  it("QP inválido cae al default", () => {
    const { result } = renderHook(() => useTabsParam(TABS, "general"), {
      wrapper: makeWrapper("/?tab=invalido"),
    });
    expect(result.current.activeTab).toBe("general");
  });
});
