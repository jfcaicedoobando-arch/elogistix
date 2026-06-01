import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/services/search", () => ({
  createDocumentoSignedUrl: vi.fn(),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
}));

vi.mock("@/lib/domain/errorCatalog", () => ({
  ERROR_CODES: { VALIDATION_FAILED: "VALIDATION_FAILED" },
}));

import { createDocumentoSignedUrl } from "@/services/search";
import { notifyError } from "@/lib/ui/appFeedback";
import { usePortalDocumentDownload } from "../usePortalDocumentDownload";

const mockCreateUrl = vi.mocked(createDocumentoSignedUrl);
const mockNotifyError = vi.mocked(notifyError);

beforeEach(() => {
  vi.clearAllMocks();

  // Mock fetch and DOM APIs for blob download
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(["pdf"], { type: "application/pdf" })),
  }) as never;

  global.URL.createObjectURL = vi.fn(() => "blob:fake");
  global.URL.revokeObjectURL = vi.fn();

  const a = { href: "", download: "", click: vi.fn(), style: {} };
  vi.spyOn(document, "createElement").mockReturnValue(a as never);
  vi.spyOn(document.body, "appendChild").mockImplementation(() => a as never);
  vi.spyOn(document.body, "removeChild").mockImplementation(() => a as never);
});

describe("usePortalDocumentDownload", () => {
  it("happy path: sets downloadingId during download and resets after", async () => {
    mockCreateUrl.mockResolvedValue("https://signed-url/file.pdf");

    const { result } = renderHook(() => usePortalDocumentDownload());
    expect(result.current.downloadingId).toBeNull();

    await act(async () => {
      await result.current.handleDownload("path/to/file.pdf", "doc-1");
    });

    expect(result.current.downloadingId).toBeNull();
    expect(mockCreateUrl).toHaveBeenCalledWith("path/to/file.pdf", 300);
  });

  it("error path: calls notifyError when createDocumentoSignedUrl rejects", async () => {
    mockCreateUrl.mockRejectedValue(new Error("storage error"));

    const { result } = renderHook(() => usePortalDocumentDownload());

    await act(async () => {
      await result.current.handleDownload("bad/path.pdf", "doc-2");
    });

    expect(mockNotifyError).toHaveBeenCalled();
    expect(result.current.downloadingId).toBeNull();
  });
});
