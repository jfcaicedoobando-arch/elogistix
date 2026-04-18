import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/services/cotizacionServices", () => ({
  savePaso1: vi.fn(),
  savePaso2: vi.fn(),
  savePaso3: vi.fn(),
  savePasoFinal: vi.fn(),
  buildConceptosFromCostos: vi.fn(() => ({ usd: [], mxn: [] })),
}));

import { useCotizacionWizardSteps } from "@/hooks/useCotizacionWizardSteps";
import * as services from "@/services/cotizacionServices";

const toast = vi.fn();
const navigate = vi.fn();
const setCotizacionId = vi.fn();
const setCurrentStep = vi.fn();
const setConceptosUSD = vi.fn();
const setConceptosMXN = vi.fn();
const setCostosPreLlenados = vi.fn();

const crearCotizacion = { mutateAsync: vi.fn(), isPending: false };
const updateCotizacion = { mutateAsync: vi.fn(), isPending: false };
const upsertCostos = { mutateAsync: vi.fn(), isPending: false };
const registrarActividad = { mutate: vi.fn() };

function buildDeps(overrides: Record<string, unknown> = {}) {
  const formValues = {
    esProspecto: false,
    clienteId: "cliente-1",
    prospectoEmpresa: "",
    prospectoContacto: "",
    ...((overrides.formValues as object) ?? {}),
  };
  return {
    form: { getValues: () => formValues } as never,
    toast,
    navigate,
    isEditMode: false,
    cotizacionId: null,
    setCotizacionId,
    currentStep: 1,
    setCurrentStep,
    msdsFile: null,
    costosInternos: [],
    costosPreLlenados: false,
    setCostosPreLlenados,
    conceptosUSD: [],
    conceptosMXN: [],
    setConceptosUSD,
    setConceptosMXN,
    totalUSD: 0,
    tasaIva: 0.16,
    buildPaso1Data: () => ({}),
    mutations: { crearCotizacion, updateCotizacion, upsertCostos, registrarActividad },
    ...overrides,
  } as never;
}

describe("useCotizacionWizardSteps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("paso 1: validación cliente/prospecto", () => {
    it("bloquea si no hay cliente y no es prospecto", async () => {
      const deps = buildDeps({ formValues: { esProspecto: false, clienteId: "" } });
      const { result } = renderHook(() => useCotizacionWizardSteps(deps));
      await act(async () => { await result.current.handleSiguiente(); });
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      expect(setCurrentStep).not.toHaveBeenCalled();
    });

    it("bloquea si es prospecto sin empresa", async () => {
      const deps = buildDeps({
        formValues: { esProspecto: true, prospectoEmpresa: "  ", prospectoContacto: "Juan" },
      });
      const { result } = renderHook(() => useCotizacionWizardSteps(deps));
      await act(async () => { await result.current.handleSiguiente(); });
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      expect(setCurrentStep).not.toHaveBeenCalled();
    });

    it("bloquea si es prospecto sin contacto", async () => {
      const deps = buildDeps({
        formValues: { esProspecto: true, prospectoEmpresa: "ACME", prospectoContacto: "" },
      });
      const { result } = renderHook(() => useCotizacionWizardSteps(deps));
      await act(async () => { await result.current.handleSiguiente(); });
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });

    it("avanza a paso 2 y guarda cotizacionId nueva", async () => {
      vi.mocked(services.savePaso1).mockResolvedValueOnce("nueva-cot-id");
      const { result } = renderHook(() => useCotizacionWizardSteps(buildDeps()));
      await act(async () => { await result.current.handleSiguiente(); });
      expect(setCotizacionId).toHaveBeenCalledWith("nueva-cot-id");
      expect(setCurrentStep).toHaveBeenCalledWith(2);
    });

    it("muestra toast de error si savePaso1 falla", async () => {
      vi.mocked(services.savePaso1).mockRejectedValueOnce(new Error("boom"));
      const { result } = renderHook(() => useCotizacionWizardSteps(buildDeps()));
      await act(async () => { await result.current.handleSiguiente(); });
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        variant: "destructive",
        title: expect.stringContaining("Error"),
      }));
      expect(setCurrentStep).not.toHaveBeenCalled();
    });
  });

  describe("paso 3: validación conceptos", () => {
    it("bloquea si no hay conceptos válidos", async () => {
      const deps = buildDeps({ currentStep: 3, cotizacionId: "cot-1" });
      const { result } = renderHook(() => useCotizacionWizardSteps(deps));
      await act(async () => { await result.current.handleSiguiente(); });
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
      expect(setCurrentStep).not.toHaveBeenCalled();
    });

    it("avanza a paso 4 con conceptos válidos", async () => {
      vi.mocked(services.savePaso3).mockResolvedValueOnce(undefined);
      const deps = buildDeps({
        currentStep: 3,
        cotizacionId: "cot-1",
        conceptosUSD: [{ descripcion: "Flete", cantidad: 1, precio_unitario: 100, moneda: "USD", total: 100 }],
      });
      const { result } = renderHook(() => useCotizacionWizardSteps(deps));
      await act(async () => { await result.current.handleSiguiente(); });
      expect(setCurrentStep).toHaveBeenCalledWith(4);
    });
  });

  describe("handleBack y handleGuardar", () => {
    it("handleBack decrementa paso si > 1", () => {
      const deps = buildDeps({ currentStep: 3 });
      const { result } = renderHook(() => useCotizacionWizardSteps(deps));
      act(() => { result.current.handleBack(); });
      expect(setCurrentStep).toHaveBeenCalled();
    });

    it("handleBack navega a /cotizaciones desde paso 1", () => {
      const { result } = renderHook(() => useCotizacionWizardSteps(buildDeps()));
      act(() => { result.current.handleBack(); });
      expect(navigate).toHaveBeenCalledWith("/cotizaciones");
    });

    it("handleGuardar no hace nada si no hay cotizacionId", async () => {
      const { result } = renderHook(() => useCotizacionWizardSteps(buildDeps()));
      await act(async () => { await result.current.handleGuardar(); });
      expect(services.savePasoFinal).not.toHaveBeenCalled();
    });

    it("handleGuardar exitoso navega al detalle", async () => {
      vi.mocked(services.savePasoFinal).mockResolvedValueOnce(undefined);
      const deps = buildDeps({ cotizacionId: "cot-1" });
      const { result } = renderHook(() => useCotizacionWizardSteps(deps));
      await act(async () => { await result.current.handleGuardar(); });
      expect(navigate).toHaveBeenCalledWith("/cotizaciones/cot-1");
    });
  });
});
