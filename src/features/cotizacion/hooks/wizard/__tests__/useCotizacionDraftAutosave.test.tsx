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
    // v13.320.35: la versión vigente del schema es 2 (bump por B-003, Wave 1).
    // Usamos 99 para asegurar mismatch aun si el schema vuelve a bumpearse.
    window.localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ version: 99, savedAt: Date.now(), values: {} }),
    );
    expect(loadDraft(USER)).toBeNull();
  });

  it("devuelve el draft cuando es válido y fresco", () => {
    const fresh = { version: 2, savedAt: Date.now(), values: { cliente_id: "c-1" } };
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
       
      const form = useForm<any>({ defaultValues: { cliente_id: "" } });
      useCotizacionDraftAutosave({ form, userId: USER, enabled, cotizacionId: null, currentStep: 1, costosInternos: [] });
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
    expect(parsed.version).toBe(2);
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
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });
});

describe("useCotizacionDraftAutosave flush (P1 — v13.294.1)", () => {
  function renderWithFlush(enabled: boolean) {
    return renderHook(() => {
       
      const form = useForm<any>({ defaultValues: { cliente_id: "seed" } });
      const api = useCotizacionDraftAutosave({ form, userId: USER, enabled, cotizacionId: null, currentStep: 1, costosInternos: [] });
      return { form, api };
    });
  }

  it("persiste inmediatamente saltándose el debounce", () => {
    vi.useFakeTimers();
    const { result } = renderWithFlush(true);
    act(() => {
      result.current.form.setValue("cliente_id", "c-flush");
      result.current.api.flush();
    });
    const raw = window.localStorage.getItem(draftKey(USER));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.values.cliente_id).toBe("c-flush");
  });

  it("es no-op cuando enabled=false", () => {
    const { result } = renderWithFlush(false);
    act(() => {
      result.current.api.flush();
    });
    expect(window.localStorage.getItem(draftKey(USER))).toBeNull();
  });

  it("cancela el timer pendiente al flushear", () => {
    vi.useFakeTimers();
    const { result } = renderWithFlush(true);
    act(() => {
      result.current.form.setValue("cliente_id", "c-1");
    });
    // Timer pendiente. Flush ahora fuerza el escribir con último valor.
    act(() => {
      result.current.api.flush();
    });
    const primerRaw = window.localStorage.getItem(draftKey(USER));
    expect(primerRaw).not.toBeNull();
    // Avanzar el reloj no debe sobrescribir (el timer fue cancelado).
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(window.localStorage.getItem(draftKey(USER))).toBe(primerRaw);
  });
});


describe("loadDraft — Q-12: restauración de paso y costos internos", () => {
  it("restaura currentStep y costosInternos cuando el draft es v3, y avisa lo que no aplica", () => {
    const draft = {
      version: 3,
      savedAt: Date.now(),
      cotizacionId: "cot-1",
      values: { cliente_id: "c-9" },
      currentStep: 2,
      costosInternos: [{ id: "f1", concepto: "Flete", monto: 100 }],
    };
    window.localStorage.setItem(draftKey(USER), JSON.stringify(draft));

    const out = loadDraft(USER);

    expect(out?.currentStep).toBe(2);
    expect(out?.costosInternos).toEqual([{ id: "f1", concepto: "Flete", monto: 100 }]);
    // Sólo se avisa lo que nunca sobrevive a JSON.stringify (el MSDS).
    expect(out?.noRestaurado).toEqual([
      "El archivo MSDS adjunto (si lo había) — vuelve a adjuntarlo",
    ]);
  });

  it("avisa que no se pudo restaurar el paso ni los costos cuando el draft es legacy (sin version 3)", () => {
    const draftLegacy = { version: 1, savedAt: Date.now(), values: { cliente_id: "c-1" } };
    window.localStorage.setItem(draftKey(USER), JSON.stringify(draftLegacy));

    const out = loadDraft(USER);

    expect(out?.currentStep).toBe(1);
    expect(out?.costosInternos).toEqual([]);
    expect(out?.noRestaurado).toEqual([
      "El archivo MSDS adjunto (si lo había) — vuelve a adjuntarlo",
      "El paso del asistente en el que ibas — se reinicia en el Paso 1",
      "Los costos internos capturados — tendrás que volver a agregarlos",
    ]);
  });
});
