import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarCollapse } from "../useSidebarCollapse";

describe("useSidebarCollapse", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("default: nada colapsado", () => {
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.isCollapsed("Ventas (CxC)")).toBe(false);
  });

  it("toggle marca la sección colapsada y persiste", () => {
    const { result } = renderHook(() => useSidebarCollapse());
    act(() => result.current.toggle("Análisis"));
    expect(result.current.isCollapsed("Análisis")).toBe(true);
    const raw = window.localStorage.getItem("sidebar:collapsed:v1");
    expect(raw).toContain("Análisis");
  });

  it("parseo defensivo: JSON inválido no rompe el hook", () => {
    window.localStorage.setItem("sidebar:collapsed:v1", "no-json{{");
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.isCollapsed("Cualquiera")).toBe(false);
  });

  it("ignora valores no-booleanos al cargar", () => {
    window.localStorage.setItem(
      "sidebar:collapsed:v1",
      JSON.stringify({ Análisis: true, Basura: "texto" }),
    );
    const { result } = renderHook(() => useSidebarCollapse());
    expect(result.current.isCollapsed("Análisis")).toBe(true);
    expect(result.current.isCollapsed("Basura")).toBe(false);
  });
});
