import { expect, it, describe, vi, beforeEach, beforeAll, afterAll } from "vitest";
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

// Auditoría 13.137.31 (barrido de mutaciones globales): la asignación directa a
// `global.URL.createObjectURL/revokeObjectURL` a nivel módulo dejaba estos métodos
// reemplazados de forma permanente para todos los archivos del shard bajo singleFork.
// Migrado a guardado/restauración explícita en beforeAll/afterAll del archivo.
const origCreateObjectURL = URL.createObjectURL;
const origRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "mock-url");
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  URL.createObjectURL = origCreateObjectURL;
  URL.revokeObjectURL = origRevokeObjectURL;
});

describe("pdf/render/descargarPdf", () => {
  beforeEach(() => {
    descargarBlobMock.mockClear();
  });

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
    pdfSpy.mockRestore();
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
    pdfSpy.mockRestore();
  });
});
