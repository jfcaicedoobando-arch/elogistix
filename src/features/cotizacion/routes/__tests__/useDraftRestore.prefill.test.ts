/**
 * CRM-COT-01 — la decisión sobre el borrador habilita o bloquea la precarga
 * desde una oportunidad del CRM.
 *
 * Antes se derivaba de `draftDetectado` (memo del storage leído al montar), que
 * sigue siendo truthy después de "Descartar": llegar desde una oportunidad con
 * un borrador previo y descartarlo dejaba la precarga muerta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types/form";

const draft = { actual: null as unknown };
const clearDraft = vi.fn();

vi.mock("@/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave", () => ({
  loadDraft: () => draft.actual,
  clearDraft: (...a: unknown[]) => clearDraft(...a),
  draftTieneContenido: () => true,
}));
vi.mock("@/features/cotizacion/services", () => ({
  fetchCotizacionSello: vi.fn(async () => null),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyInfo: vi.fn(), notifyWarning: vi.fn() }));

import { useDraftRestore } from "../useDraftRestore";

/** Borrador SIN cotizacionId/clienteId/leadId: aun así debe conservarse. */
const BORRADOR_SIN_IDS = {
  values: { prospectoEmpresa: "Borrador previo" } as unknown as CotizacionFormValues,
  costosInternos: [],
  currentStep: 2,
  cotizacionId: null,
  updatedAt: null,
  savedAt: "2026-09-08T10:00:00Z",
  noRestaurado: [] as string[],
};

const form = { reset: vi.fn() } as unknown as UseFormReturn<CotizacionFormValues>;

function render(userId = "u-1") {
  return renderHook(() =>
    useDraftRestore({
      form,
      userId,
      organizationId: "org-1",
      setCotizacionId: vi.fn(),
      setCurrentStep: vi.fn(),
      setCostosInternos: vi.fn(),
      resincronizarSello: vi.fn(),
    }),
  );
}

beforeEach(() => {
  draft.actual = null;
  clearDraft.mockClear();
});

describe("useDraftRestore · permiso de precarga desde oportunidad", () => {
  it("entrada limpia con identidad lista: permite precargar", () => {
    const { result } = render();
    expect(result.current.draftDetectado).toBeNull();
    expect(result.current.permitePrefillProspecto).toBe(true);
  });

  it("identidad todavía no disponible: no precarga (podría aparecer un borrador)", () => {
    const { result } = render("");
    expect(result.current.permitePrefillProspecto).toBe(false);
  });

  it("borrador pendiente de decisión: no precarga ni sobrescribe", () => {
    draft.actual = BORRADOR_SIN_IDS;
    const { result } = render();
    expect(result.current.banderaBorrador).toBe(true);
    expect(result.current.decisionBorrador).toBe("pendiente");
    expect(result.current.permitePrefillProspecto).toBe(false);
    expect(form.reset).not.toHaveBeenCalled();
  });

  it("descartar → habilita la precarga de la oportunidad de destino", async () => {
    draft.actual = BORRADOR_SIN_IDS;
    const { result } = render();
    await act(async () => { result.current.handleDiscard(); });
    expect(clearDraft).toHaveBeenCalledWith("u-1", "org-1");
    expect(result.current.decisionBorrador).toBe("descartado");
    expect(result.current.permitePrefillProspecto).toBe(true);
  });

  it("restaurar → conserva el borrador previo aun sin IDs y NO precarga el prospecto", async () => {
    draft.actual = BORRADOR_SIN_IDS;
    const { result } = render();
    await act(async () => { await result.current.handleRestore(); });
    expect(form.reset).toHaveBeenCalledWith(BORRADOR_SIN_IDS.values);
    expect(result.current.decisionBorrador).toBe("restaurado");
    expect(result.current.permitePrefillProspecto).toBe(false);
    expect(clearDraft).not.toHaveBeenCalled();
  });
});
