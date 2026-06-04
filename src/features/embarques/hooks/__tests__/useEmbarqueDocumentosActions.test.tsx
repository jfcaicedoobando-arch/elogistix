import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/services/storage/index", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://example.com/doc.pdf"),
  uploadFile: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useUploadDocumentoEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useDeleteDocumentoEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSetDocumentoNoAplica: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

import { useEmbarqueDocumentosActions } from "../useEmbarqueDocumentosActions";

const embarqueStub = { id: "e-1", expediente: "EXP-001" } as Parameters<typeof useEmbarqueDocumentosActions>[0];

describe("useEmbarqueDocumentosActions (smoke)", () => {
  it("monta sin errores y expone las acciones", () => {
    const { result } = renderHook(
      () => useEmbarqueDocumentosActions(embarqueStub, "e-1"),
      { wrapper: createWrapper() },
    );
    expect(typeof result.current.handleUpload).toBe("function");
    expect(typeof result.current.handleDeleteDoc).toBe("function");
    expect(typeof result.current.handleDownload).toBe("function");
    expect(result.current.downloadingDocId).toBeNull();
  });

  it("monta sin errores cuando embarque es undefined", () => {
    const { result } = renderHook(
      () => useEmbarqueDocumentosActions(undefined, undefined),
      { wrapper: createWrapper() },
    );
    expect(result.current.downloadingDocId).toBeNull();
  });
});
