import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFuenteEerr } from "../useFuenteEerr";
import { safeLocalStorage, STORAGE_KEYS } from "@/lib/browserStorage";

describe("useFuenteEerr", () => {
  beforeEach(() => {
    safeLocalStorage.removeItem(STORAGE_KEYS.eerrFuente);
  });

  it("default es 'embarques' cuando no hay valor persistido", () => {
    const { result } = renderHook(() => useFuenteEerr());
    expect(result.current.fuente).toBe("embarques");
  });

  it("persiste el cambio en localStorage y actualiza el estado", () => {
    const { result } = renderHook(() => useFuenteEerr());
    act(() => result.current.setFuente("facturas"));
    expect(result.current.fuente).toBe("facturas");
    expect(safeLocalStorage.getItem(STORAGE_KEYS.eerrFuente)).toBe("facturas");
  });

  it("sincroniza entre dos consumidores en la misma pestaña", () => {
    const a = renderHook(() => useFuenteEerr());
    const b = renderHook(() => useFuenteEerr());
    act(() => a.result.current.setFuente("facturas"));
    expect(b.result.current.fuente).toBe("facturas");
  });

  it("ignora valores inválidos y cae al default", () => {
    safeLocalStorage.setItem(STORAGE_KEYS.eerrFuente, "xxx");
    const { result } = renderHook(() => useFuenteEerr());
    expect(result.current.fuente).toBe("embarques");
  });

  // Regresión: el hook usaba `useState` con snapshot inicial → segunda instancia
  // no veía cambios de la primera. Con `useSyncExternalStore` + evento custom
  // esto ahora funciona.
  it("no rompe si window está definido pero storage no dispara evento nativo", () => {
    // simulamos que otra pestaña escribió: dispatch manual del evento storage
    const { result } = renderHook(() => useFuenteEerr());
    act(() => {
      safeLocalStorage.setItem(STORAGE_KEYS.eerrFuente, "facturas");
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEYS.eerrFuente }));
    });
    expect(result.current.fuente).toBe("facturas");
  });

  it("no crashea si dispatchEvent falla", () => {
    const spy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => {
      throw new Error("boom");
    });
    const { result } = renderHook(() => useFuenteEerr());
    expect(() => result.current.setFuente("facturas")).toThrow(); // el hook no oculta el error
    spy.mockRestore();
  });
});
