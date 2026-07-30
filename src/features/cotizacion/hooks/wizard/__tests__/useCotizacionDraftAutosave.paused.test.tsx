/**
 * R-09 — El autoguardado no debe pisar un borrador con contenido usando los
 * valores por defecto del formulario recién montado, ni escribir mientras se
 * está restaurando.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { useCotizacionDraftAutosave, draftKey } from "@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave";
import { safeLocalStorage } from "@/lib/browserStorage";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

const USER = "u-1";

function borradorGuardado() {
  return JSON.stringify({
    version: 3,
    savedAt: Date.now(),
    cotizacionId: null,
    values: { cliente_id: "cli-1", mercancia: "Tornillos" },
    currentStep: 2,
    costosInternos: [],
    noRestaurado: [],
  });
}

function useSetup(paused: boolean, values: Partial<CotizacionFormValues>) {
  const form = useForm<CotizacionFormValues>({ defaultValues: values as CotizacionFormValues });
  useCotizacionDraftAutosave({
    form,
    userId: USER,
    enabled: true,
    cotizacionId: null,
    currentStep: 1,
    costosInternos: [],
    paused,
  });
  return form;
}

describe("useCotizacionDraftAutosave (R-09)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    safeLocalStorage.setItem(draftKey(USER), borradorGuardado());
  });

  it("no sobreescribe el borrador cuando el formulario está vacío", () => {
    renderHook(() => useSetup(false, { cliente_id: "", mercancia: "" } as Partial<CotizacionFormValues>));
    const guardado = safeLocalStorage.getItem(draftKey(USER));
    expect(guardado).toContain("Tornillos");
  });

  it("no escribe mientras está en pausa (restaurando)", () => {
    renderHook(() => useSetup(true, { cliente_id: "cli-9", mercancia: "Otra cosa" } as Partial<CotizacionFormValues>));
    const guardado = safeLocalStorage.getItem(draftKey(USER));
    expect(guardado).toContain("Tornillos");
    expect(guardado).not.toContain("Otra cosa");
  });

  it("sí escribe cuando hay contenido y no está en pausa", () => {
    renderHook(() => useSetup(false, { cliente_id: "cli-9", mercancia: "Otra cosa" } as Partial<CotizacionFormValues>));
    act(() => undefined);
    const guardado = safeLocalStorage.getItem(draftKey(USER));
    expect(guardado).toContain("Otra cosa");
  });
});
