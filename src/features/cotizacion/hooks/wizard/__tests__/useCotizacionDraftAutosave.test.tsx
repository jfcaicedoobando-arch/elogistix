/**
 * Tests para useCotizacionDraftAutosave (P0 — v13.293.1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useForm } from "react-hook-form";
import {
  useCotizacionDraftAutosave,
  loadDraft,
  clearDraft,
  draftKey,
} from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";

const USER = "user-1";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("loadDraft", () => {
  it("devuelve null cuando no hay nada guardado", () => {
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve null y limpia storage cuando el borrador tiene >24h", () => {
    const stale = { version: 1, savedAt: Date.now() - 25 * 60 * 60 * 1000, values: {} };
    window.localStorage.setItem(draftKey(USER), JSON.stringify(stale));
    expect(loadDraft(USER)).toBeNull();
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });

  it("devuelve null si el JSON está corrupto", () => {
    window.localStorage.setItem(draftKey(USER), "{ no-json");
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve null si la versión no coincide", () => {
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 2, savedAt: Date.now(), values: {} }),
    );
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve el draft cuando es válido y fresco", () => {
    const fresh = { version: 1, savedAt: Date.now(), values: { cliente_id: "c-1" } };
    window.localStorage.setItem(draftKey(USER), JSON.stringify(fresh));
    const out = loadDraft(USER);
    expect(out?.values).toEqual({ cliente_id: "c-1" });
  });
});

describe("clearDraft", () => {
  it("remueve la clave del storage", () => {
    window.localStorage.setItem(draftKey(USER), "x");
    clearDraft(USER);
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });
});

describe("useCotizacionDraftAutosave hook", () => {
  function renderWithForm(enabled: boolean) {
    return renderHook(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const form = useForm<any>({ defaultValues: { cliente_id: "" } });
      useCotizacionDraftAutosave({ form, userId: USER, enabled });
      return form;
    });
  }

  it("persiste tras el debounce cuando enabled=true", () => {
    vi.useFakeTimers();
    const { result } = renderWithForm(true);
    act(() => {
      result.current.setValue("cliente_id", "c-42");
    });
    // Antes del debounce: no hay nada.
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
    act(() => {
      vi.advanceTimersByTime(900);
    });
    const raw = window.localStorage.getItem(draftKey(USER));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.values.cliente_id).toBe("c-42");
  });

  it("no persiste cuando enabled=false", () => {
    vi.useFakeTimers();
    const { result } = renderWithForm(false);
    act(() => {
      result.current.setValue("cliente_id", "c-42");
    });
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });

  it("cancela el timer en unmount", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderWithForm(true);
    act(() => {
      result.current.setValue("cliente_id", "c-x");
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // El timer se canceló, no se persistió nada.
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });
});
