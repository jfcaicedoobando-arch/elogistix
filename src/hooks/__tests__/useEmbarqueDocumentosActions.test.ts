import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const toast = vi.fn();
const registrarActividadMutate = vi.fn();
const uploadMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useBitacora", () => ({
  useRegistrarActividad: () => ({ mutate: registrarActividadMutate }),
}));
vi.mock("@/services/storage", () => ({ getSignedUrl: vi.fn() }));
vi.mock("@/hooks/useEmbarques", () => ({
  useUploadDocumentoEmbarque: () => ({ mutateAsync: uploadMutateAsync }),
  useDeleteDocumentoEmbarque: () => ({ mutateAsync: deleteMutateAsync }),
}));

import { getSignedUrl } from "@/services/storage";
const getSignedUrlMock = vi.mocked(getSignedUrl);

import { useEmbarqueDocumentosActions } from "@/hooks/useEmbarqueDocumentosActions";

const embarque = { id: "emb-1", expediente: "IMP-001" } as never;
const docConArchivo = { id: "doc-1", nombre: "BL", archivo: "path/to/bl.pdf" } as never;

describe("useEmbarqueDocumentosActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub URL APIs (jsdom no implementa createObjectURL)
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["x"]),
    })) as never;
  });

  it("handleUpload exitoso: llama upload, registra y notifica", async () => {
    uploadMutateAsync.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, "emb-1"));
    const file = new File(["x"], "doc.pdf");
    await act(async () => { await result.current.handleUpload("doc-1", file); });
    expect(uploadMutateAsync).toHaveBeenCalledWith({ embarqueId: "emb-1", docId: "doc-1", file });
    expect(registrarActividadMutate).toHaveBeenCalledWith(expect.objectContaining({
      accion: "subir_documento",
    }));
    expect(toast).toHaveBeenCalledWith({ title: "Archivo subido correctamente" });
  });

  it("handleUpload: no hace nada si no hay id", async () => {
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, undefined));
    await act(async () => { await result.current.handleUpload("doc-1", new File(["x"], "doc.pdf")); });
    expect(uploadMutateAsync).not.toHaveBeenCalled();
  });

  it("handleUpload: error muestra toast destructive", async () => {
    uploadMutateAsync.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, "emb-1"));
    await act(async () => { await result.current.handleUpload("doc-1", new File(["x"], "doc.pdf")); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(registrarActividadMutate).not.toHaveBeenCalled();
  });

  it("handleDeleteDoc exitoso: llama delete, registra y notifica", async () => {
    deleteMutateAsync.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, "emb-1"));
    await act(async () => { await result.current.handleDeleteDoc(docConArchivo); });
    expect(deleteMutateAsync).toHaveBeenCalledWith({
      embarqueId: "emb-1",
      docId: "doc-1",
      archivoPath: "path/to/bl.pdf",
    });
    expect(toast).toHaveBeenCalledWith({ title: "Documento eliminado correctamente" });
  });

  it("handleDeleteDoc: ignora doc sin archivo", async () => {
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, "emb-1"));
    await act(async () => {
      await result.current.handleDeleteDoc({ id: "x", nombre: "y", archivo: null } as never);
    });
    expect(deleteMutateAsync).not.toHaveBeenCalled();
  });

  it("handleDeleteDoc: error muestra toast destructive", async () => {
    deleteMutateAsync.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, "emb-1"));
    await act(async () => { await result.current.handleDeleteDoc(docConArchivo); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("handleDownload exitoso: maneja downloadingDocId y revoca blob", async () => {
    getSignedUrlMock.mockResolvedValueOnce("https://signed.example/file.pdf");
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, "emb-1"));
    await act(async () => { await result.current.handleDownload("path/file.pdf", "doc-1"); });
    expect(getSignedUrlMock).toHaveBeenCalledWith("path/file.pdf");
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    expect(result.current.downloadingDocId).toBeNull();
  });

  it("handleDownload: error en fetch muestra toast destructive", async () => {
    getSignedUrlMock.mockResolvedValueOnce("https://signed.example/file.pdf");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false } as never);
    const { result } = renderHook(() => useEmbarqueDocumentosActions(embarque, "emb-1"));
    await act(async () => { await result.current.handleDownload("path/file.pdf", "doc-1"); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(result.current.downloadingDocId).toBeNull();
  });
});
