import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/features/search/services", () => ({
  createDocumentoSignedUrl: vi.fn(),
}));
vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifyError: vi.fn(),
}));
vi.mock("@/lib/domain/errorCatalog", () => ({
  ERROR_CODES: { VALIDATION_FAILED: "VALIDATION_FAILED" },
}));

import { createDocumentoSignedUrl } from "@/features/search/services";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { usePortalDocumentDownload } from "../usePortalDocumentDownload";

const mockCreateUrl = vi.mocked(createDocumentoSignedUrl);
const mockNotifyError = vi.mocked(notifyError);

beforeEach(() => {
  vi.clearAllMocks();

  // `vi.stubGlobal` + el `vi.unstubAllGlobals()` del setup garantizan que
  // estos parches se reviertan entre archivos del shard (antes la asignación
  // directa a `global.fetch` persistía y podía contaminar otros tests).
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["pdf"], { type: "application/pdf" })),
    }),
  );
  // jsdom no implementa `URL.createObjectURL`/`revokeObjectURL`. Usamos
  // `vi.stubGlobal("URL", ...)` para que `vi.unstubAllGlobals()` del setup
  // global RESTAURE el objeto URL completo entre archivos del shard. La
  // versión previa usaba `Object.defineProperty` directo, que dejaba esos
  // métodos como `vi.fn()` permanentes y filtraba el mock al resto del shard
  // (singleFork).
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:fake"),
    revokeObjectURL: vi.fn(),
  });

  // Stub sólo el anchor; `restoreAllMocks` (afterEach local) evita acumular
  // spies dentro del archivo.
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      const a = origCreate("a");
      vi.spyOn(a, "click").mockImplementation(() => {});
      return a;
    }
    return origCreate(tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("usePortalDocumentDownload", () => {
  it("happy path: completa la descarga y resetea downloadingId", async () => {
    mockCreateUrl.mockResolvedValue("https://signed-url/file.pdf");

    const { result } = renderHook(() => usePortalDocumentDownload());
    expect(result.current.downloadingId).toBeNull();

    await act(async () => {
      await result.current.handleDownload("path/to/file.pdf", "doc-1");
    });

    expect(result.current.downloadingId).toBeNull();
    expect(mockCreateUrl).toHaveBeenCalledWith("path/to/file.pdf", 300);
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  it("error path: llama notifyError cuando createDocumentoSignedUrl falla", async () => {
    mockCreateUrl.mockRejectedValue(new Error("storage error"));

    const { result } = renderHook(() => usePortalDocumentDownload());

    await act(async () => {
      await result.current.handleDownload("bad/path.pdf", "doc-2");
    });

    expect(mockNotifyError).toHaveBeenCalled();
    expect(result.current.downloadingId).toBeNull();
  });
});
