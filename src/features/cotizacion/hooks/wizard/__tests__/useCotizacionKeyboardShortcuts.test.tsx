/**
 * Tests para useCotizacionKeyboardShortcuts (P1 — v13.294.0).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCotizacionKeyboardShortcuts } from "@/features/cotizacion/hooks/wizard/useCotizacionKeyboardShortcuts";

function dispatch(key: string, mod: "ctrl" | "meta" = "ctrl", target?: EventTarget) {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: mod === "ctrl",
    metaKey: mod === "meta",
    bubbles: true,
    cancelable: true,
  });
  (target ?? window).dispatchEvent(event);
  return event;
}

describe("useCotizacionKeyboardShortcuts", () => {
  let onNext: () => void;
  let onSave: () => void;
  let onBack: () => void;
  let onFlushDraft: () => void;

  beforeEach(() => {
    onNext = vi.fn();
    onSave = vi.fn();
    onBack = vi.fn();
    onFlushDraft = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("Ctrl+Enter dispara onNext en pasos <4", () => {
    renderHook(() =>
      useCotizacionKeyboardShortcuts({ currentStep: 2, onNext, onSave, onBack, onFlushDraft }),
    );
    dispatch("Enter");
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Cmd+Enter dispara onSave en paso 4", () => {
    renderHook(() =>
      useCotizacionKeyboardShortcuts({ currentStep: 4, onNext, onSave, onBack, onFlushDraft }),
    );
    dispatch("Enter", "meta");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("Ctrl+ArrowLeft dispara onBack", () => {
    renderHook(() =>
      useCotizacionKeyboardShortcuts({ currentStep: 2, onNext, onSave, onBack, onFlushDraft }),
    );
    dispatch("ArrowLeft");
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+S dispara onFlushDraft", () => {
    renderHook(() =>
      useCotizacionKeyboardShortcuts({ currentStep: 2, onNext, onSave, onBack, onFlushDraft }),
    );
    dispatch("s");
    expect(onFlushDraft).toHaveBeenCalledTimes(1);
  });

  it("no dispara ArrowLeft si el foco está en un textarea", () => {
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();
    renderHook(() =>
      useCotizacionKeyboardShortcuts({ currentStep: 2, onNext, onSave, onBack, onFlushDraft }),
    );
    dispatch("ArrowLeft", "ctrl", ta);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("no dispara nada cuando enabled=false", () => {
    renderHook(() =>
      useCotizacionKeyboardShortcuts({
        currentStep: 2, enabled: false, onNext, onSave, onBack, onFlushDraft,
      }),
    );
    dispatch("Enter");
    expect(onNext).not.toHaveBeenCalled();
  });

  it("hace cleanup del listener en unmount", () => {
    const { unmount } = renderHook(() =>
      useCotizacionKeyboardShortcuts({ currentStep: 2, onNext, onSave, onBack, onFlushDraft }),
    );
    unmount();
    dispatch("Enter");
    expect(onNext).not.toHaveBeenCalled();
  });
});
