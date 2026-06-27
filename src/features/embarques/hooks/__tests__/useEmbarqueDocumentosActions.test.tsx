import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import type { EmbarqueRow } from "@/features/embarques/hooks/useEmbarques";

const {
  toastFn, registrarActividadFn, getSignedUrlMock,
  uploadMutateAsync, deleteMutateAsync, descargarBlobMock, sonnerSuccess, sonnerError,
} = vi.hoisted(() => ({
  toastFn: vi.fn(),
  registrarActividadFn: vi.fn(),
  getSignedUrlMock: vi.fn().mockResolvedValue("https://example.com/doc.pdf"),
  uploadMutateAsync: vi.fn().mockResolvedValue({}),
  deleteMutateAsync: vi.fn().mockResolvedValue({}),
  descargarBlobMock: vi.fn(),
  sonnerSuccess: vi.fn(),
  sonnerError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: sonnerSuccess, error: sonnerError, warning: vi.fn(), info: vi.fn(), message: vi.fn() },
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: toastFn }),
  useRegistrarActividad: () => ({ mutate: registrarActividadFn }),
}));

vi.mock("@/services/storage/index", () => ({
  getSignedUrl: getSignedUrlMock,
  uploadFile: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/downloadBlob", () => ({
  descargarBlob: descargarBlobMock,
}));

vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useUploadDocumentoEmbarque: () => ({ mutateAsync: uploadMutateAsync }),
  useDeleteDocumentoEmbarque: () => ({ mutateAsync: deleteMutateAsync }),
  useSetDocumentoNoAplica: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

import { useEmbarqueDocumentosActions } from "../useEmbarqueDocumentosActions";

function makeEmbarqueStub(): EmbarqueRow {
  return { id: "e-1", expediente: "EXP-001" } satisfies Partial<EmbarqueRow> as EmbarqueRow;
}

describe("useEmbarqueDocumentosActions", () => {
  // v13.137.36: restaurar `fetch` stubeado para no contaminar tests siguientes.
  afterEach(() => { vi.unstubAllGlobals(); });
  it("handleUpload llama mutateAsync con args y notifica éxito", async () => {
    uploadMutateAsync.mockClear();
    registrarActividadFn.mockClear();
    sonnerSuccess.mockClear(); sonnerError.mockClear();
    const { result } = renderHook(
      () => useEmbarqueDocumentosActions(makeEmbarqueStub(), "e-1"),
      { wrapper: createWrapper() },
    );
    const file = new File(["x"], "factura.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.handleUpload("doc-factura", file);
    });
    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledTimes(1));
    expect(uploadMutateAsync).toHaveBeenCalledWith({
      embarqueId: "e-1", docId: "doc-factura", file,
    });
    expect(registrarActividadFn).toHaveBeenCalledWith(
      expect.objectContaining({ accion: "subir_documento", entidad_id: "e-1" }),
    );
    expect(sonnerSuccess).toHaveBeenCalled();
  });

  it("handleDownload obtiene signed URL, descarga blob y resetea downloadingDocId", async () => {
    getSignedUrlMock.mockClear();
    descargarBlobMock.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["pdf-data"])),
    }));
    const { result } = renderHook(
      () => useEmbarqueDocumentosActions(makeEmbarqueStub(), "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleDownload("embarques/e-1/factura.pdf", "doc-factura");
    });
    expect(getSignedUrlMock).toHaveBeenCalledWith("embarques/e-1/factura.pdf");
    expect(descargarBlobMock).toHaveBeenCalledWith(expect.any(Blob), "factura.pdf");
    expect(result.current.downloadingDocId).toBeNull();
  });

  it("handleDownload notifica error cuando fetch falla", async () => {
    sonnerSuccess.mockClear(); sonnerError.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(
      () => useEmbarqueDocumentosActions(makeEmbarqueStub(), "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleDownload("embarques/e-1/factura.pdf", "doc-factura");
    });
    await waitFor(() => expect(sonnerError).toHaveBeenCalled());
    expect(result.current.downloadingDocId).toBeNull();
  });

  it("monta sin errores cuando embarque es undefined y no dispara mutaciones", async () => {
    uploadMutateAsync.mockClear();
    const { result } = renderHook(
      () => useEmbarqueDocumentosActions(undefined, undefined),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleUpload("doc-x", new File(["x"], "x.pdf"));
    });
    expect(uploadMutateAsync).not.toHaveBeenCalled();
  });
});
