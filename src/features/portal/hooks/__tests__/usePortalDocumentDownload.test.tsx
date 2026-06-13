import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/services/search", () => ({
  createDocumentoSignedUrl: vi.fn(),
}));
vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifyError: vi.fn(),
}));
vi.mock("@/lib/domain/errorCatalog", () => ({
  ERROR_CODES: { VALIDATION_FAILED: "VALIDATION_FAILED" },
}));

import { createDocumentoSignedUrl } from "@/services/search";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { usePortalDocumentDownload } from "../usePortalDocumentDownload";

const mockCreateUrl = vi.mocked(createDocumentoSignedUrl);
const mockNotifyError = vi.mocked(notifyError);

beforeEach(() => {
  vi.clearAllMocks();

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(["pdf"], { type: "application/pdf" })),
  }) as never;

  global.URL.createObjectURL = vi.fn(() => "blob:fake");
  global.URL.revokeObjectURL = vi.fn();

  // Only stub the anchor creation, not ALL createElement calls
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
