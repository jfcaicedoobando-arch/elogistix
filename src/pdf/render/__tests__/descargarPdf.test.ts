import { expect, it, describe, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// 13.85.3 — Eliminamos el `vi.mock("@react-pdf/renderer", ...)` local porque
// `vitest.config.ts` ya aliasa el módulo al stub en `src/test/mocks/reactPdfStub.tsx`.
// Espiamos sobre la función `pdf` exportada por el stub para verificar invocación.
import * as ReactPDF from "@react-pdf/renderer";

const descargarBlobMock = vi.fn();
vi.mock("@/lib/downloadBlob", () => ({
  descargarBlob: (...args: unknown[]) => descargarBlobMock(...args),
}));

import { descargarPdf } from "../descargarPdf";

beforeEach(() => {
  descargarBlobMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pdf/render/descargarPdf", () => {


  it("renderiza el elemento y delega la descarga del Blob", async () => {
    const pdfSpy = vi.spyOn(ReactPDF, "pdf");
    const element = React.createElement("div") as never;
    await descargarPdf(element, "mi-documento");

    expect(pdfSpy).toHaveBeenCalledTimes(1);
    expect(pdfSpy).toHaveBeenCalledWith(element);
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
    const pdfSpy = vi.spyOn(ReactPDF, "pdf").mockReturnValueOnce({
      toBlob: () => Promise.reject(new Error("render fail")),
      toBuffer: () => Promise.resolve(new Uint8Array()),
      toString: () => Promise.resolve(""),
    } as never);
    await expect(
      descargarPdf(React.createElement("div") as never, "x"),
    ).rejects.toThrow("render fail");
    expect(descargarBlobMock).not.toHaveBeenCalled();
  });
});
