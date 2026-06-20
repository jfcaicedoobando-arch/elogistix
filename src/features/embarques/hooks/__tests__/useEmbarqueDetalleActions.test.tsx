import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/services/storage/index", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://example.com/doc.pdf"),
  uploadFile: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useAvanzarEstadoEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useReabrirEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useSyncEstadoEmbarque: () => ({ mutate: vi.fn() }),
  calcularEstadoEmbarque: vi.fn().mockReturnValue("Confirmado"),
  useUploadDocumentoEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useDeleteDocumentoEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSetDocumentoNoAplica: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

vi.mock("@/features/embarques/hooks/useEmbarqueQueries", () => ({
  useEmbarqueConceptosVenta: () => ({ data: [] }),
}));

import { useEmbarqueDetalleActions, getSiguienteEstado } from "../useEmbarqueDetalleActions";

const embarqueStub = { id: "e-1", expediente: "EXP-001", modo: "maritimo", tipo: "FCL", etd: null, eta: null, estado: "Confirmado" } as unknown as Parameters<typeof useEmbarqueDetalleActions>[0];

describe("useEmbarqueDetalleActions", () => {
  it("re-exporta getSiguienteEstado correctamente", () => {
    expect(getSiguienteEstado("Cerrado")).toBeNull();
  });

  it("monta y expone la API combinada de estado + documentos", () => {
    const { result } = renderHook(
      () => useEmbarqueDetalleActions(embarqueStub, "e-1"),
      { wrapper: createWrapper() },
    );
    expect(typeof result.current.handleUpload).toBe("function");
    expect(typeof result.current.handleAvanzarEstado).toBe("function");
    expect(result.current.downloadingDocId).toBeNull();
  });
});
