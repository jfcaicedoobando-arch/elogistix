/**
 * v13.419.0 — Buzón CxP: el duplicado se detecta ANTES de subir el archivo y
 * los fallos de permisos del almacenamiento se traducen a lenguaje claro.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const upload = vi.fn();
const selectChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload }) },
    from: () => selectChain,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
  },
}));

const { subirFacturaEntrante } = await import(
  "@/features/cxp/services/facturasEntrantesUpload"
);

function archivo(nombre = "factura.pdf"): File {
  return new File([new Uint8Array([1, 2, 3])], nombre, { type: "application/pdf" });
}

const INPUT_BASE = {
  embarqueId: "emb-1",
  organizationId: "org-1",
  meta: null,
  nota: null,
  proveedorId: null,
} as never;

describe("subirFacturaEntrante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.select.mockReturnThis();
    selectChain.eq.mockReturnThis();
    selectChain.is.mockReturnThis();
  });

  it("detecta el duplicado sin tocar el almacenamiento", async () => {
    selectChain.limit.mockResolvedValue({ data: [{ estado: "por_capturar" }], error: null });

    await expect(
      subirFacturaEntrante({ ...INPUT_BASE, pdf: archivo(), xml: null }),
    ).rejects.toThrow(/ya está en el buzón/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("traduce el error de permisos del almacenamiento", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({
      error: { message: "new row violates row-level security policy" },
    });

    await expect(
      subirFacturaEntrante({ ...INPUT_BASE, pdf: archivo(), xml: null }),
    ).rejects.toThrow(/No tienes permiso para guardar archivos en el buzón/i);
  });
});
