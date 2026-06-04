import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useEmbarqueSubmitOrchestrator } from "../useEmbarqueSubmitOrchestrator";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "test@example.com" } }),
}));

vi.mock("../useEmbarques", () => ({
  useCreateEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: "1" }), isPending: false }),
}));

vi.mock("@/hooks/cotizacion", () => ({
  useUpdateEstadoCotizacion: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
}));

vi.mock("../services", () => ({
  resolverExpediente: vi.fn().mockResolvedValue("EXP-001"),
  subirDocumentosEmbarque: vi.fn().mockResolvedValue([]),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const QueryWrapper = createWrapper();
  return (
    <MemoryRouter>
      <QueryWrapper>{children}</QueryWrapper>
    </MemoryRouter>
  );
};

describe("useEmbarqueSubmitOrchestrator", () => {
  it("inicializa correctamente", () => {
    const { result } = renderHook(() => useEmbarqueSubmitOrchestrator(), { wrapper });
    expect(result.current.submit).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it("el flujo de submit llama a las dependencias", async () => {
    const { result } = renderHook(() => useEmbarqueSubmitOrchestrator(), { wrapper });
    const mockParams = {
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
    };

    const success = await result.current.submit(mockParams as any);
    expect(success).toBe(true);
  });
});
