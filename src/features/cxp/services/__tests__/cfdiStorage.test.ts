/**
 * Guardarraíl de 13.114.14: la ruta del CFDI en el bucket `facturas` debe
 * empezar SIEMPRE con el `organization_id` para satisfacer la política RLS
 * `(storage.foldername(name))[1] = current_user_org_id()::text`.
 *
 * N50 (Ola 4): además el path lleva el prefijo del slot (xml-/pdf-) y se
 * valida el tipo real del archivo antes de subir.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn();
const removeMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: uploadMock, remove: removeMock }),
    },
    from: () => ({
      update: () => ({ eq: updateMock }),
    }),
  },
}));

import { subirArchivosCfdiFactura } from "../cfdiStorage";

function archivo(contenido: string, nombre: string, type: string): File {
  const f = new File([contenido], nombre, { type });
  // jsdom no implementa Blob.prototype.arrayBuffer(); polyfill puntual
  // (mismo patrón que bbva.test.ts).
  if (typeof f.arrayBuffer !== "function") {
    const u8 = new TextEncoder().encode(contenido);
    (f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
      async () => u8.buffer.slice(0) as ArrayBuffer;
  }
  return f;
}

beforeEach(() => {
  uploadMock.mockReset().mockResolvedValue({ error: null });
  removeMock.mockReset().mockResolvedValue({ error: null });
  updateMock.mockReset().mockResolvedValue({ error: null });
});

describe("subirArchivosCfdiFactura — prefijo de ruta para RLS", () => {
  it("usa {organization_id}/cfdi/{facturaId}/{archivo} como ruta", async () => {
    const org = "00000000-0000-0000-0000-000000000001";
    const facturaId = "fac-123";
    const xmlFile = archivo("<x/>", "factura.xml", "application/xml");

    await subirArchivosCfdiFactura({
      facturaId,
      organizationId: org,
      xmlFile,
      pdfFile: null,
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path] = uploadMock.mock.calls[0];
    expect(path.startsWith(`${org}/cfdi/${facturaId}/`)).toBe(true);
    expect(path.startsWith("cfdi/")).toBe(false);
  });

  it("N50: XML y PDF con el mismo nombre NO comparten path (prefijo de slot)", async () => {
    await subirArchivosCfdiFactura({
      facturaId: "fac-123",
      organizationId: "00000000-0000-0000-0000-000000000001",
      xmlFile: archivo("<cfdi:Comprobante/>", "mismo.xml", "application/xml"),
      pdfFile: archivo("%PDF-1.4 …", "mismo.xml", "application/pdf"),
    });

    expect(uploadMock).toHaveBeenCalledTimes(2);
    const [pathXml] = uploadMock.mock.calls[0];
    const [pathPdf] = uploadMock.mock.calls[1];
    expect(pathXml).toContain("xml-mismo.xml");
    expect(pathPdf).toContain("pdf-mismo.xml");
    expect(pathXml).not.toBe(pathPdf);
  });

  it("N50: un PDF disfrazado de XML se rechaza antes de subir", async () => {
    await expect(
      subirArchivosCfdiFactura({
        facturaId: "fac-123",
        organizationId: "00000000-0000-0000-0000-000000000001",
        xmlFile: archivo("%PDF-1.4 …", "disfraz.xml", "application/xml"),
        pdfFile: null,
      }),
    ).rejects.toThrow(/no es un XML válido/);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("N50: si el UPDATE de BD falla, borra los objetos subidos (cleanup)", async () => {
    updateMock.mockResolvedValue({ error: { message: "boom" } });

    await expect(
      subirArchivosCfdiFactura({
        facturaId: "fac-123",
        organizationId: "00000000-0000-0000-0000-000000000001",
        xmlFile: archivo("<x/>", "factura.xml", "application/xml"),
        pdfFile: null,
      }),
    ).rejects.toBeTruthy();
    expect(removeMock).toHaveBeenCalledTimes(1);
    const [paths] = removeMock.mock.calls[0];
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain("xml-factura.xml");
  });
});
