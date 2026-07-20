/**
 * Tests del controller `useNuevoEmbarqueWizard`.
 * Foco: validación por paso (delega a `validateWizardStep`), avance del wizard
 * y handleFinish (delega al orchestrator con el payload correcto).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { validateWizardStepMock, orchestratorSubmit, notifyErrorMock, clearExpediente } = vi.hoisted(() => ({
  validateWizardStepMock: vi.fn(),
  orchestratorSubmit: vi.fn(),
  notifyErrorMock: vi.fn(),
  clearExpediente: vi.fn(),
}));

vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useProveedoresForSelect: () => ({ data: [{ id: "pv-1", nombre: "Prov" }] }),
}));
vi.mock("@/features/cliente/hooks/useClientes", () => ({
  useClientesForSelect: () => ({ data: [{ id: "cli-1", nombre: "ACME" }] }),
  useContactosCliente: () => ({ data: [] }),
}));
vi.mock("@/features/cotizacion/hooks", () => ({
  useConceptosForm: () => ({
    conceptosVenta: [], conceptosCosto: [],
    setConceptosVenta: vi.fn(), setConceptosCosto: vi.fn(),
    updateConceptoVenta: vi.fn(), addConceptoVenta: vi.fn(), removeConceptoVenta: vi.fn(),
    updateConceptoCosto: vi.fn(), addConceptoCosto: vi.fn(), removeConceptoCosto: vi.fn(),
    subtotalVenta: 0, totalCosto: 0, utilidadEstimada: 0,
  }),
  useCotizacionesAceptadas: () => ({ data: [] }),
}));
vi.mock("@/features/embarques/hooks/useEmbarqueForm", () => ({
  useEmbarqueForm: () => ({
    methods: {
      watch: (_k: string) => (_k === "clienteId" ? "cli-1" : "MAR"),
      getValues: () => ({ clienteId: "cli-1", modo: "MAR" }),
    },
    documentosArchivos: {},
    handleMsdsUpload: vi.fn(),
    setDocumentoArchivo: vi.fn(),
    getDocumentosChecklist: vi.fn(),
    buildEmbarquePayload: vi.fn(() => ({ x: 1 })),
    buildConceptosVentaPayload: vi.fn(() => []),
    buildConceptosCostoPayload: vi.fn(() => []),
  }),
}));
vi.mock("@/features/embarques/hooks/useEmbarqueSubmitOrchestrator", () => ({
  useEmbarqueSubmitOrchestrator: () => ({ submit: orchestratorSubmit, isPending: false }),
}));
vi.mock("@/features/embarques/domain/embarqueWizardStepValidator", () => ({
  validateWizardStep: (...a: unknown[]) => validateWizardStepMock(...a),
}));
vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyErrorMock(...a),
}));
vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
// v13.303.26 — canCrearEmbarqueLibre eliminado; se conserva mock vacío por si hay imports transitivos.

vi.mock("../useNuevoEmbarqueExpediente", () => ({
  useNuevoEmbarqueExpediente: () => ({
    modoExpediente: "nuevo",
    expedienteSeleccionado: null,
    clearExpediente,
    handleModoExpedienteChange: vi.fn(),
    handleSeleccionarExpediente: vi.fn(),
  }),
}));
vi.mock("../useNuevoEmbarqueCotVinculada", () => ({
  useNuevoEmbarqueCotVinculada: () => ({
    cotizacionVinculada: { id: "cot-1", folio: "COT-1" },
    handleVincularCotizacion: vi.fn(),
    handleDesvincularCotizacion: vi.fn(),
  }),
}));


import { useNuevoEmbarqueWizard } from "../useNuevoEmbarqueWizard";

beforeEach(() => {
  vi.clearAllMocks();
  orchestratorSubmit.mockResolvedValue(undefined);
});

describe("useNuevoEmbarqueWizard", () => {
  it("expone datos iniciales: paso 1, sin errores y cliente seleccionado", () => {
    validateWizardStepMock.mockReturnValue({});
    const { result } = renderHook(() => useNuevoEmbarqueWizard(), { wrapper: createWrapper() });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.selectedCliente?.id).toBe("cli-1");
    expect(result.current.clientes).toHaveLength(1);
  });

  it("validateStep almacena errores y dispara notifyError cuando hay errores", () => {
    validateWizardStepMock.mockReturnValueOnce({ modo: "Selecciona modo" });
    const { result } = renderHook(() => useNuevoEmbarqueWizard(), { wrapper: createWrapper() });
    let ok = true;
    act(() => { ok = result.current.validateStep(1); });
    expect(ok).toBe(false);
    expect(result.current.validationErrors[1]).toEqual({ modo: "Selecciona modo" });
    expect(notifyErrorMock).toHaveBeenCalledTimes(1);
  });

  it("validateStep devuelve true cuando no hay errores y NO notifica", () => {
    validateWizardStepMock.mockReturnValue({});
    const { result } = renderHook(() => useNuevoEmbarqueWizard(), { wrapper: createWrapper() });
    let ok = false;
    act(() => { ok = result.current.validateStep(2); });
    expect(ok).toBe(true);
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("handleFinish con todos los pasos válidos llama orchestrator.submit", async () => {
    validateWizardStepMock.mockReturnValue({});
    const { result } = renderHook(() => useNuevoEmbarqueWizard(), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleFinish(); });
    expect(orchestratorSubmit).toHaveBeenCalledTimes(1);
    const payload = orchestratorSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      modoExpediente: "nuevo",
      selectedClienteNombre: "ACME",
      values: { clienteId: "cli-1", modo: "MAR" },
    });
  });

  it("handleFinish con paso inválido salta a ese paso y NO submitea", async () => {
    validateWizardStepMock.mockImplementation(({ step }: { step: number }) =>
      step === 3 ? { documento: "Falta" } : {},
    );
    const { result } = renderHook(() => useNuevoEmbarqueWizard(), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleFinish(); });
    expect(orchestratorSubmit).not.toHaveBeenCalled();
    expect(result.current.currentStep).toBe(3);
  });
});
