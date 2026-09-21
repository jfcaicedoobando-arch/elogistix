/**
 * Pruebas del controlador de página de "Nuevo embarque" (paso 5 auditoría).
 * Cubre: precedencia state vs query, redirect sin cotización, rechazo de
 * borrador de otra cotización, orden vincular→reset + restauración de paso y
 * conceptos, descarte, y limpieza del borrador sólo si el submit fue exitoso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigateSpy,
}));

const orden: string[] = [];
const cotAceptada = { id: "cot-1", folio: "COT-001" };
const reset = vi.fn(() => { orden.push("reset"); });
const restaurarVinculacion = vi.fn(() => { orden.push("vincular"); });
const setCurrentStep = vi.fn();
const setConceptosVenta = vi.fn();
const setConceptosCosto = vi.fn();
const handleFinish = vi.fn(async () => true);

vi.mock("../useNuevoEmbarqueWizard", () => ({
  useNuevoEmbarqueWizard: () => ({
    methods: { reset, formState: { isDirty: false } },
    currentStep: 1,
    conceptosVenta: [],
    conceptosCosto: [],
    cotizacionVinculada: null,
    cotizacionesAceptadas: [cotAceptada],
    restaurarVinculacion,
    setCurrentStep,
    setConceptosVenta,
    setConceptosCosto,
    handleFinish,
  }),
}));

const autosaveArgs: Record<string, unknown>[] = [];
const clearBorrador = vi.fn();
vi.mock("@/features/embarques/hooks/wizard/useEmbarqueDraftAutosave", () => ({
  useEmbarqueDraftAutosave: (args: Record<string, unknown>) => {
    autosaveArgs.push(args);
    return { clear: clearBorrador, conflictoExterno: false, descartarConflicto: vi.fn() };
  },
}));

const loadEmbarqueDraft = vi.fn();
const clearEmbarqueDraft = vi.fn();
vi.mock("@/features/embarques/hooks/wizard/embarqueDraftStorage", () => ({
  loadEmbarqueDraft: (...a: unknown[]) => loadEmbarqueDraft(...a),
  clearEmbarqueDraft: (...a: unknown[]) => clearEmbarqueDraft(...a),
  embarqueDraftTieneContenido: () => true,
  EMBARQUE_DRAFT_NO_RESTAURADO: ["adjuntos"],
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/shared/useOrgActiva", () => ({
  useOrgActiva: () => ({ organizationId: "org-1" }),
}));

import { useNuevoEmbarquePageController } from "../useNuevoEmbarquePageController";
import { notifyError } from "@/lib/ui/appFeedback";

const makeWrapper = (entry: { pathname: string; search?: string; state?: unknown }) =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );

const draftBase = {
  version: 1 as const,
  savedAt: Date.now(),
  values: { contenedores: [] },
  currentStep: 3,
  conceptosVenta: [{ concepto: "Flete" }],
  conceptosCosto: [{ concepto: "Maniobra" }],
  cotizacionVinculadaId: "cot-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  orden.length = 0;
  autosaveArgs.length = 0;
  loadEmbarqueDraft.mockReturnValue(null);
});

describe("useNuevoEmbarquePageController — acceso por cotización", () => {
  it("el state tiene precedencia sobre ?fromCotizacion", () => {
    loadEmbarqueDraft.mockReturnValue({ ...draftBase, cotizacionVinculadaId: "cot-state" });
    const { result } = renderHook(() => useNuevoEmbarquePageController(), {
      wrapper: makeWrapper({
        pathname: "/embarques/nuevo",
        search: "?fromCotizacion=cot-query",
        state: { cotizacionPrevinculadaId: "cot-state" },
      }),
    });
    expect(result.current.llegaConCotizacion).toBe(true);
    // El draft de `cot-state` se acepta ⇒ la precedencia fue del state.
    expect(result.current.draftDetectado).not.toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("usa ?fromCotizacion como fallback", () => {
    const { result } = renderHook(() => useNuevoEmbarquePageController(), {
      wrapper: makeWrapper({ pathname: "/embarques/nuevo", search: "?fromCotizacion=cot-query" }),
    });
    expect(result.current.llegaConCotizacion).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("sin cotización avisa y redirige a /cotizaciones con origen", async () => {
    const { result } = renderHook(() => useNuevoEmbarquePageController(), {
      wrapper: makeWrapper({ pathname: "/embarques/nuevo" }),
    });
    expect(result.current.llegaConCotizacion).toBe(false);
    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/cotizaciones", {
        replace: true,
        state: { origen: "nuevo-embarque" },
      });
    });
    expect(notifyError).toHaveBeenCalled();
    // El autosave queda deshabilitado sin cotización.
    expect(autosaveArgs.at(-1)?.enabled).toBe(false);
  });
});

describe("useNuevoEmbarquePageController — borrador", () => {
  const wrapperConCot = () =>
    makeWrapper({ pathname: "/embarques/nuevo", state: { cotizacionPrevinculadaId: "cot-1" } });

  it("nunca ofrece un borrador de otra cotización", () => {
    loadEmbarqueDraft.mockReturnValue({ ...draftBase, cotizacionVinculadaId: "cot-otra" });
    const { result } = renderHook(() => useNuevoEmbarquePageController(), { wrapper: wrapperConCot() });
    expect(result.current.draftDetectado).toBeNull();
    expect(result.current.banderaBorrador).toBe(false);
  });

  it("restaura vinculando antes del reset y repone paso y conceptos", () => {
    loadEmbarqueDraft.mockReturnValue(draftBase);
    const { result } = renderHook(() => useNuevoEmbarquePageController(), { wrapper: wrapperConCot() });
    expect(result.current.banderaBorrador).toBe(true);

    act(() => { result.current.handleRestore(); });

    expect(restaurarVinculacion).toHaveBeenCalledWith(cotAceptada);
    expect(orden).toEqual(["vincular", "reset"]);
    expect(reset).toHaveBeenCalledWith(draftBase.values);
    expect(setCurrentStep).toHaveBeenCalledWith(3);
    expect(setConceptosVenta).toHaveBeenCalledWith(draftBase.conceptosVenta);
    expect(setConceptosCosto).toHaveBeenCalledWith(draftBase.conceptosCosto);
    expect(result.current.banderaBorrador).toBe(false);
    // El autosave se congela durante el reset.
    expect(autosaveArgs.some((a) => a.paused === true)).toBe(true);
  });

  it("descartar borra el borrador y oculta el banner", () => {
    loadEmbarqueDraft.mockReturnValue(draftBase);
    const { result } = renderHook(() => useNuevoEmbarquePageController(), { wrapper: wrapperConCot() });
    act(() => { result.current.handleDiscard(); });
    expect(clearEmbarqueDraft).toHaveBeenCalledWith("u1", "org-1");
    expect(result.current.banderaBorrador).toBe(false);
  });
});

describe("useNuevoEmbarquePageController — submit", () => {
  const wrapperConCot = () =>
    makeWrapper({ pathname: "/embarques/nuevo", state: { cotizacionPrevinculadaId: "cot-1" } });

  it("submit exitoso limpia el borrador", async () => {
    handleFinish.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useNuevoEmbarquePageController(), { wrapper: wrapperConCot() });
    await act(async () => { await result.current.handleFinishConLimpieza(); });
    expect(clearBorrador).toHaveBeenCalledTimes(1);
  });

  it("submit fallido conserva el borrador", async () => {
    handleFinish.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useNuevoEmbarquePageController(), { wrapper: wrapperConCot() });
    await act(async () => { await result.current.handleFinishConLimpieza(); });
    expect(clearBorrador).not.toHaveBeenCalled();
  });
});
