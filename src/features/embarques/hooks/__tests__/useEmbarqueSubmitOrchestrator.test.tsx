import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useEmbarqueSubmitOrchestrator } from "../useEmbarqueSubmitOrchestrator";
import { MemoryRouter } from "react-router-dom";

const { createEmbarqueMock, resolverExpedienteMock, subirDocsMock } = vi.hoisted(() => ({
  createEmbarqueMock: vi.fn().mockResolvedValue({ id: "1" }),
  resolverExpedienteMock: vi.fn().mockResolvedValue("EXP-001"),
  subirDocsMock: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "test@example.com" } }),
}));

vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useCreateEmbarque: () => ({ mutateAsync: createEmbarqueMock, isPending: false }),
}));

vi.mock("@/features/cotizacion/hooks", () => ({
  useUpdateEstadoCotizacion: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/features/embarques/services", () => ({
  resolverExpediente: resolverExpedienteMock,
  subirDocumentosEmbarque: subirDocsMock,
}));

// v13.137.36: `createWrapper()` se ejecuta UNA vez por test (factory), no en
// cada render. Antes el wrapper a nivel módulo invocaba `createWrapper()` dentro
// del cuerpo del componente → nuevo QueryClient por render, leak global.
const makeWrapper = () => {
  const QueryWrapper = createWrapper();
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryWrapper>{children}</QueryWrapper>
    </MemoryRouter>
  );
};

type SubmitParams = Parameters<ReturnType<typeof useEmbarqueSubmitOrchestrator>["submit"]>[0];

function makeSubmitParams(overrides: Partial<SubmitParams> = {}): SubmitParams {
  const base = {
    values: { modo: "Marítimo", tipo: "FCL", blMaster: "BL123" },
    modoExpediente: "nuevo",
    expedienteSeleccionado: null,
    cotizacionVinculada: null,
    contactos: [],
    selectedClienteNombre: "Cliente Test",
    proveedoresDb: [],
    documentosArchivos: {},
    buildEmbarquePayload: vi.fn().mockReturnValue({}),
    buildConceptosVentaPayload: vi.fn().mockReturnValue([]),
    buildConceptosCostoPayload: vi.fn().mockReturnValue([]),
    getDocumentosChecklist: vi.fn().mockReturnValue([]),
    conceptosVenta: [],
    conceptosCosto: [],
    ...overrides,
  };
  // SAFE-CAST: el tipo `SubmitParams` es interno del hook y mezcla fixtures complejos
  // (RHF values, queries) que sólo importan parcialmente para estos tests.
  return base as unknown as SubmitParams;
}

describe("useEmbarqueSubmitOrchestrator", () => {
  it("inicializa correctamente", () => {
    const { result } = renderHook(() => useEmbarqueSubmitOrchestrator(), { wrapper: makeWrapper() });
    expect(result.current.submit).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it("el flujo de submit llama a las dependencias con argumentos correctos", async () => {
    const { result } = renderHook(() => useEmbarqueSubmitOrchestrator(), { wrapper: makeWrapper() });
    resolverExpedienteMock.mockClear();
    subirDocsMock.mockClear();
    createEmbarqueMock.mockClear();

    const success = await result.current.submit(makeSubmitParams());
    expect(resolverExpedienteMock).toHaveBeenCalledWith("BL123", "FCL");
    expect(subirDocsMock).toHaveBeenCalledTimes(1);
    expect(createEmbarqueMock).toHaveBeenCalledTimes(1);
    expect(success).toBe(true);
  });

  it("retorna false y no crea embarque cuando resolverExpediente falla", async () => {
    resolverExpedienteMock.mockRejectedValueOnce(new Error("expediente no resuelto"));
    createEmbarqueMock.mockClear();
    const { result } = renderHook(() => useEmbarqueSubmitOrchestrator(), { wrapper: makeWrapper() });
    const success = await result.current.submit(makeSubmitParams());
    expect(success).toBe(false);
    expect(createEmbarqueMock).not.toHaveBeenCalled();
  });

  it("retorna false cuando subirDocumentos falla", async () => {
    subirDocsMock.mockRejectedValueOnce(new Error("upload error"));
    createEmbarqueMock.mockClear();
    const { result } = renderHook(() => useEmbarqueSubmitOrchestrator(), { wrapper: makeWrapper() });
    const success = await result.current.submit(makeSubmitParams());
    expect(success).toBe(false);
    expect(createEmbarqueMock).not.toHaveBeenCalled();
  });

  it("modo existente: usa expedienteSeleccionado sin invocar resolverExpediente", async () => {
    resolverExpedienteMock.mockClear();
    createEmbarqueMock.mockClear();
    const { result } = renderHook(() => useEmbarqueSubmitOrchestrator(), { wrapper: makeWrapper() });
    // SAFE-CAST: ExpedienteCliente es opaco; aquí basta con un fixture mínimo.
    const expedienteFixture = { expediente: "EXP-999", cliente_id: "cli-1" } as unknown as SubmitParams["expedienteSeleccionado"];
    const success = await result.current.submit(
      makeSubmitParams({ modoExpediente: "existente", expedienteSeleccionado: expedienteFixture }),
    );
    expect(resolverExpedienteMock).not.toHaveBeenCalled();
    expect(createEmbarqueMock).toHaveBeenCalledTimes(1);
    expect(success).toBe(true);
  });
});
