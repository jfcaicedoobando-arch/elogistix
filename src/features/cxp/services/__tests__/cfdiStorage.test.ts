/**
 * Guardarraíl de 13.114.14: la ruta del CFDI en el bucket `facturas` debe
 * empezar SIEMPRE con el `organization_id` para satisfacer la política RLS
 * `(storage.foldername(name))[1] = current_user_org_id()::text`.
 *
 * Si alguien regresa la ruta a `cfdi/<org>/...` la subida volverá a fallar
 * silenciosamente con el toast amarillo "Factura guardada pero el XML/PDF
 * falló" — sólo para los roles que NO son super_admin.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: uploadMock }),
    },
    from: () => ({
      update: () => ({ eq: updateMock }),
    }),
  },
}));

import { subirArchivosCfdiFactura } from "../cfdiStorage";

beforeEach(() => {
  uploadMock.mockReset().mockResolvedValue({ error: null });
  updateMock.mockReset().mockResolvedValue({ error: null });
});

describe("subirArchivosCfdiFactura — prefijo de ruta para RLS", () => {
  it("usa {organization_id}/cfdi/{facturaId}/{archivo} como ruta", async () => {
    const org = "00000000-0000-0000-0000-000000000001";
    const facturaId = "fac-123";
    const xmlFile = new File(["<x/>"], "factura.xml", { type: "application/xml" });

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
});
