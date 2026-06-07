import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import type { EmbarqueRow } from "@/features/embarques/hooks/useEmbarques";

const { toastFn, registrarActividadFn } = vi.hoisted(() => ({
  toastFn: vi.fn(),
  registrarActividadFn: vi.fn(),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: toastFn }),
  useRegistrarActividad: () => ({ mutate: registrarActividadFn }),
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

function makeEmbarqueStub(): EmbarqueRow {
  return { id: "e-1", expediente: "EXP-001" } satisfies Partial<EmbarqueRow> as EmbarqueRow;
}

describe("useEmbarqueDocumentosActions (smoke)", () => {
  it("monta sin errores y expone las acciones", () => {
    const { result } = renderHook(
      () => useEmbarqueDocumentosActions(makeEmbarqueStub(), "e-1"),
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
