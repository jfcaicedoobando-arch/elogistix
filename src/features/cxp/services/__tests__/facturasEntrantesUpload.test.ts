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
// RNF-08 (Ola 11): el adjuntar XML ya no hace UPDATE directo, usa la RPC
// `adjuntar_xml_factura_entrante` (autorización server-side).
const rpcMock = vi.fn();
const updateMock = vi.fn().mockReturnValue({ eq: eqUpdate });
const selectChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  in: vi.fn().mockReturnThis(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload, remove }) },
    from: () => ({ ...selectChain, insert: insertMock, update: updateMock }),
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
  },
}));

// Ola 5 · O5.8: la escritura de metadatos pasa por el edge `adjuntar-xml-entrante`.
// Se reusa `rpcMock` como fuente del resultado para conservar los casos RG4-7.
vi.mock("@/features/cxp/services/adjuntarXmlEntranteEdge", () => ({
  verificarYAdjuntarXmlEntrante: async () => {
    const { error } = await rpcMock();
    return error ?? null;
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
    selectChain.in.mockReturnThis();
    insertChain.select.mockReturnThis();
    upload.mockResolvedValue({ error: null });
    // El dedupe vive en la RPC `buzon_localizar_duplicado`: sin duplicado por
    // defecto (v13.821.2).
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it("detecta el duplicado sin tocar el almacenamiento", async () => {
    rpcMock.mockResolvedValue({ data: [{ caso: "buzon_pendiente" }], error: null });

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

  it("RG4-7 (Ola 5): si el insert falla con error NO de unicidad, limpia los archivos subidos", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    // Error genérico (red/RLS): la fila NO existe → cleanup seguro borra todo.
    insertSingle.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    remove.mockResolvedValue({ error: null });

    await expect(
      subirFacturaEntrante({ ...INPUT_BASE, pdf: archivo("f.pdf"), xml: archivo("f.xml", "text/xml") }),
    ).rejects.toThrow();

    expect(remove).toHaveBeenCalledTimes(1);
    const [paths] = remove.mock.calls[0];
    expect(paths).toHaveLength(2);
  });

  it("RG4-7 (Ola 5): con 23505 NO borra el objeto — lo comparte la fila ganadora de la carrera", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    insertSingle.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "uq_efe_org_hash_vivo"',
      },
    });

    await expect(
      subirFacturaEntrante({ ...INPUT_BASE, pdf: archivo("f.pdf"), xml: null }),
    ).rejects.toThrow(/ya fue subido al buzón|ya está en el buzón|duplicate key/i);

    expect(remove).not.toHaveBeenCalled();
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
    selectChain.in.mockReturnThis();
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

  it("RG4-7 (Ola 5): si el update falla con error NO de unicidad, limpia el XML subido", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ error: { message: "connection reset" } });
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

  it("RG4-7 (Ola 5): con 23505 en el update NO borra el XML (otra fila viva lo referencia)", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "uq_efe_org_xml_hash_vivo"',
      },
    });

    await expect(
      adjuntarXmlFacturaEntrante({
        id: "doc-1",
        xml: archivo("f.xml", "text/xml"),
        meta: null,
        embarqueId: "emb-1",
        organizationId: "org-1",
      }),
    ).rejects.toThrow(/Este XML ya está en el buzón de esta organización|duplicate key/i);

    expect(remove).not.toHaveBeenCalled();
  });

  it("RG4-7 (Ola 5): con error no-unicidad pero path referenciado por fila viva, tampoco borra", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ error: { message: "connection reset" } });
    // La verificación del cleanup seguro encuentra el path referenciado.
    selectChain.in.mockImplementation((_col: string, paths: string[]) =>
      Promise.resolve({ data: paths.map((p) => ({ [_col]: p })), error: null }),
    );

    await expect(
      adjuntarXmlFacturaEntrante({
        id: "doc-1",
        xml: archivo("f.xml", "text/xml"),
        meta: null,
        embarqueId: "emb-1",
        organizationId: "org-1",
      }),
    ).rejects.toThrow();

    expect(remove).not.toHaveBeenCalled();
  });

  it("adjunta el XML exitosamente sin llamar a cleanup", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    upload.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ error: null });

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
