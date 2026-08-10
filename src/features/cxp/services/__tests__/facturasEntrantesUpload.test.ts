/**
 * v13.419.0 — Buzón CxP: el duplicado se detecta ANTES de subir el archivo y
 * los fallos de permisos del almacenamiento se traducen a lenguaje claro.
 * Ola 4 · N36 — el XML acompañante también se deduplica (columna xml_hash) y
 * los archivos ya subidos a cxp-inbox se limpian si el insert/update falla.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const upload = vi.fn();
const remove = vi.fn();
const insertSingle = vi.fn();
const insertChain = { select: vi.fn().mockReturnThis(), single: insertSingle };
const insertMock = vi.fn().mockReturnValue(insertChain);
const eqUpdate = vi.fn();
const updateMock = vi.fn().mockReturnValue({ eq: eqUpdate });
const selectChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload, remove }) },
    from: () => ({ ...selectChain, insert: insertMock, update: updateMock }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
  },
}));

vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: vi.fn().mockResolvedValue(undefined),
}));

const { subirFacturaEntrante, adjuntarXmlFacturaEntrante } = await import(
  "@/features/cxp/services/facturasEntrantesUpload"
);

function archivo(nombre = "factura.pdf", tipo = "application/pdf"): File {
  return new File([new Uint8Array([1, 2, 3])], nombre, { type: tipo });
}

const INPUT_BASE = {
  embarqueId: "emb-1",
  organizationId: "org-1",
  meta: null,
  nota: null,
  proveedorId: null,
  pdf: null as File | null,
  xml: null as File | null,
};

describe("subirFacturaEntrante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.select.mockReturnThis();
    selectChain.eq.mockReturnThis();
    selectChain.is.mockReturnThis();
    insertChain.select.mockReturnThis();
    upload.mockResolvedValue({ error: null });
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

  it("N36: rechaza si el XML acompañante ya existe vivo (xml_hash), sin subir nada", async () => {
    // Primer .limit() = validación del principal (PDF, ok); segundo = XML (duplicado).
    selectChain.limit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ estado: "capturada" }], error: null });

    await expect(
      subirFacturaEntrante({ ...INPUT_BASE, pdf: archivo("f.pdf"), xml: archivo("f.xml", "text/xml") }),
    ).rejects.toThrow(/Este XML ya fue capturado/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("N36: si el insert falla, limpia los archivos subidos (principal + xml)", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    insertSingle.mockResolvedValue({ data: null, error: { message: "duplicate key" } });
    remove.mockResolvedValue({ error: null });

    await expect(
      subirFacturaEntrante({ ...INPUT_BASE, pdf: archivo("f.pdf"), xml: archivo("f.xml", "text/xml") }),
    ).rejects.toThrow();

    expect(remove).toHaveBeenCalledTimes(1);
    const [paths] = remove.mock.calls[0];
    expect(paths).toHaveLength(2);
  });

  it("sube exitosamente y no llama a cleanup cuando el insert es correcto", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    insertSingle.mockResolvedValue({ data: { id: "doc-1" }, error: null });

    await expect(
      subirFacturaEntrante({ ...INPUT_BASE, pdf: archivo() }),
    ).resolves.toBe("doc-1");
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("adjuntarXmlFacturaEntrante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.select.mockReturnThis();
    selectChain.eq.mockReturnThis();
    selectChain.is.mockReturnThis();
    upload.mockResolvedValue({ error: null });
  });

  it("N36: rechaza si el XML ya está vivo en otro documento del buzón", async () => {
    selectChain.limit.mockResolvedValue({ data: [{ estado: "por_capturar" }], error: null });

    await expect(
      adjuntarXmlFacturaEntrante({
        id: "doc-1",
        xml: archivo("f.xml", "text/xml"),
        meta: null,
        embarqueId: "emb-1",
        organizationId: "org-1",
      }),
    ).rejects.toThrow(/Este XML ya está en el buzón/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("N36: si el update falla, limpia el XML ya subido", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    eqUpdate.mockResolvedValue({ error: { message: "duplicate key" } });
    remove.mockResolvedValue({ error: null });

    await expect(
      adjuntarXmlFacturaEntrante({
        id: "doc-1",
        xml: archivo("f.xml", "text/xml"),
        meta: null,
        embarqueId: "emb-1",
        organizationId: "org-1",
      }),
    ).rejects.toThrow();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("adjunta el XML exitosamente sin llamar a cleanup", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    eqUpdate.mockResolvedValue({ error: null });

    await expect(
      adjuntarXmlFacturaEntrante({
        id: "doc-1",
        xml: archivo("f.xml", "text/xml"),
        meta: null,
        embarqueId: "emb-1",
        organizationId: "org-1",
      }),
    ).resolves.toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
  });
});
