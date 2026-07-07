import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColumnVisibility } from "../useColumnVisibility";

describe("useColumnVisibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("empieza con los defaults cuando storage está vacío", () => {
    const { result } = renderHook(() =>
      useColumnVisibility("test", { a: true, b: false }),
    );
    expect(result.current.visibility).toEqual({ a: true, b: false });
    expect(result.current.isCustom).toBe(false);
  });

  it("toggle cambia una columna y persiste", () => {
    const { result } = renderHook(() =>
      useColumnVisibility("test", { a: true, b: false }),
    );
    act(() => result.current.toggle("b"));
    expect(result.current.visibility.b).toBe(true);
    expect(result.current.isCustom).toBe(true);

    // Nuevo hook lee del storage
    const { result: r2 } = renderHook(() =>
      useColumnVisibility("test", { a: true, b: false }),
    );
    expect(r2.current.visibility.b).toBe(true);
  });

  it("reset vuelve a defaults", () => {
    const { result } = renderHook(() =>
      useColumnVisibility("test", { a: true, b: false }),
    );
    act(() => result.current.toggle("b"));
    act(() => result.current.reset());
    expect(result.current.visibility).toEqual({ a: true, b: false });
    expect(result.current.isCustom).toBe(false);
  });

  it("ignora valores corruptos en storage", () => {
    window.localStorage.setItem("lc:col-vis:test", "not-json");
    const { result } = renderHook(() =>
      useColumnVisibility("test", { a: true }),
    );
    expect(result.current.visibility).toEqual({ a: true });
  });
});
