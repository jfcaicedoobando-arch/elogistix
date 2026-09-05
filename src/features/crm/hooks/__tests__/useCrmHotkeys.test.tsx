/**
 * Regresión JAVASCRIPT-REACT-5Z: el listener de atajos no debe tronar cuando
 * un keydown llega sin `key` (autocompletado del navegador / IME).
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCrmHotkeys } from "../useCrmHotkeys";

function handlers() {
  return {
    onOpenQuick: vi.fn(),
    onNewLead: vi.fn(),
    onNewOportunidad: vi.fn(),
    onNewActividad: vi.fn(),
    onOpenPalette: vi.fn(),
  };
}

describe("useCrmHotkeys", () => {
  it("ignora keydown sin `key` sin lanzar (5Z)", () => {
    const h = handlers();
    renderHook(() => useCrmHotkeys(h));
    const ev = new KeyboardEvent("keydown");
    Object.defineProperty(ev, "key", { value: undefined });
    expect(() => window.dispatchEvent(ev)).not.toThrow();
    expect(h.onOpenPalette).not.toHaveBeenCalled();
  });

  it("Ctrl+P abre la palette", () => {
    const h = handlers();
    renderHook(() => useCrmHotkeys(h));
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "P", ctrlKey: true }),
    );
    expect(h.onOpenPalette).toHaveBeenCalledTimes(1);
  });
});
