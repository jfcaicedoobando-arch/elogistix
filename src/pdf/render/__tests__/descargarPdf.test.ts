import { expect, it, describe, vi, beforeEach } from "vitest";
import React from "react";

// Mock @react-pdf/renderer ANTES de importar descargarPdf
const toBlobMock = vi.fn(async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }));
vi.mock("@react-pdf/renderer", () => ({
  pdf: vi.fn(() => ({ toBlob: toBlobMock })),
}));

const descargarBlobMock = vi.fn();
vi.mock("@/lib/downloadBlob", () => ({
  descargarBlob: (...args: unknown[]) => descargarBlobMock(...args),
}));

import { descargarPdf } from "../descargarPdf";
import { pdf } from "@react-pdf/renderer";

global.URL.createObjectURL = vi.fn(() => "mock-url");
global.URL.revokeObjectURL = vi.fn();

describe("pdf/render/descargarPdf", () => {
  beforeEach(() => {
    toBlobMock.mockClear();
    descargarBlobMock.mockClear();
    (pdf as ReturnType<typeof vi.fn>).mockClear();
  });

  it("renderiza el elemento y delega la descarga del Blob", async () => {
    const element = React.createElement("div") as never;
    await descargarPdf(element, "mi-documento");

    expect(pdf).toHaveBeenCalledTimes(1);
    expect(pdf).toHaveBeenCalledWith(element);
    expect(toBlobMock).toHaveBeenCalledTimes(1);
    expect(descargarBlobMock).toHaveBeenCalledTimes(1);
    const [blobArg, nameArg] = descargarBlobMock.mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(nameArg).toBe("mi-documento.pdf");
  });

  it("conserva la extensión .pdf si ya está incluida", async () => {
    await descargarPdf(React.createElement("div") as never, "reporte.pdf");
    expect(descargarBlobMock.mock.calls[0][1]).toBe("reporte.pdf");
  });

  it("propaga el error si toBlob falla", async () => {
    toBlobMock.mockRejectedValueOnce(new Error("render fail"));
    await expect(
      descargarPdf(React.createElement("div") as never, "x"),
    ).rejects.toThrow("render fail");
    expect(descargarBlobMock).not.toHaveBeenCalled();
  });
});
