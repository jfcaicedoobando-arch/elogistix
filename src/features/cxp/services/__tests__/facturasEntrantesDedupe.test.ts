/**
 * Ola 4 · N36: dedupe genérico (archivo_hash / xml_hash) contra vivos +
 * cleanup best-effort de storage cuando el insert/update posterior falla.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const remove = vi.fn();
const selectChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  in: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => selectChain,
    storage: { from: () => ({ remove }) },
  },
}));

const {
  validarNoDuplicadoEnBuzon,
  limpiarArchivosHuerfanos,
  esErrorUnicidad,
  limpiarArchivosHuerfanosSeguro,
} = await import("@/features/cxp/services/facturasEntrantesDedupe");

describe("validarNoDuplicadoEnBuzon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.select.mockReturnThis();
    selectChain.eq.mockReturnThis();
    selectChain.is.mockReturnThis();
  });

  it("no lanza si no hay ningún documento vivo con ese hash", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    await expect(
      validarNoDuplicadoEnBuzon("hash-1", "org-1", "xml_hash"),
    ).resolves.toBeUndefined();
  });

  it("lanza mensaje de XML ya capturado cuando columna es xml_hash y estado=capturada", async () => {
    selectChain.limit.mockResolvedValue({ data: [{ estado: "capturada" }], error: null });
    await expect(
      validarNoDuplicadoEnBuzon("hash-1", "org-1", "xml_hash"),
    ).rejects.toThrow(/Este XML ya fue capturado como factura de proveedor/i);
  });

  it("lanza mensaje de XML en buzón esperando captura cuando estado no es capturada", async () => {
    selectChain.limit.mockResolvedValue({ data: [{ estado: "por_capturar" }], error: null });
    await expect(
      validarNoDuplicadoEnBuzon("hash-1", "org-1", "xml_hash"),
    ).rejects.toThrow(/Este XML ya está en el buzón esperando captura/i);
  });

  it("consulta sólo documentos vivos (is deleted_at null) filtrando por organización", async () => {
    selectChain.limit.mockResolvedValue({ data: [], error: null });
    await validarNoDuplicadoEnBuzon("hash-1", "org-9", "xml_hash");
    expect(selectChain.eq).toHaveBeenCalledWith("organization_id", "org-9");
    expect(selectChain.eq).toHaveBeenCalledWith("xml_hash", "hash-1");
    expect(selectChain.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("no lanza si la consulta falla (fail-open best-effort)", async () => {
    selectChain.limit.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(
      validarNoDuplicadoEnBuzon("hash-1", "org-1"),
    ).resolves.toBeUndefined();
  });
});

describe("limpiarArchivosHuerfanos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no llama a storage.remove si no hay paths", async () => {
    await limpiarArchivosHuerfanos([]);
    expect(remove).not.toHaveBeenCalled();
  });

  it("remueve los paths indicados del bucket cxp-inbox", async () => {
    remove.mockResolvedValue({ error: null });
    await limpiarArchivosHuerfanos(["a/b.pdf", "a/b.xml"]);
    expect(remove).toHaveBeenCalledWith(["a/b.pdf", "a/b.xml"]);
  });

  it("no propaga errores del storage (best-effort, no debe romper el flujo)", async () => {
    remove.mockRejectedValue(new Error("storage caído"));
    await expect(limpiarArchivosHuerfanos(["a/b.pdf"])).resolves.toBeUndefined();
  });
});

describe("esErrorUnicidad (Ola 5 · RG4-7)", () => {
  it("detecta el código 23505 de Postgres", () => {
    expect(esErrorUnicidad({ code: "23505" })).toBe(true);
  });

  it("detecta mensajes duplicate key / unique cuando no hay code", () => {
    expect(
      esErrorUnicidad({ message: 'duplicate key value violates unique constraint "uq_x"' }),
    ).toBe(true);
  });

  it("no confunde otros errores ni null", () => {
    expect(esErrorUnicidad({ code: "42501", message: "permission denied" })).toBe(false);
    expect(esErrorUnicidad(null)).toBe(false);
  });
});

describe("limpiarArchivosHuerfanosSeguro (Ola 5 · RG4-7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.select.mockReturnThis();
    selectChain.eq.mockReturnThis();
    selectChain.is.mockReturnThis();
  });

  it("borra sólo los paths que NINGUNA fila viva referencia", async () => {
    selectChain.in
      .mockResolvedValueOnce({ data: [{ archivo_path: "a/b.pdf" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    remove.mockResolvedValue({ error: null });

    await limpiarArchivosHuerfanosSeguro(["a/b.pdf", "a/c.xml"], "org-1");

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(["a/c.xml"]);
    expect(selectChain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(selectChain.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("no borra nada si todos los paths siguen referenciados (carrera 23505)", async () => {
    selectChain.in.mockImplementation((_col: string, paths: string[]) =>
      Promise.resolve({ data: paths.map((p) => ({ [_col]: p })), error: null }),
    );

    await limpiarArchivosHuerfanosSeguro(["a/b.pdf"], "org-1");

    expect(remove).not.toHaveBeenCalled();
  });

  it("fail-safe: si la verificación falla NO borra (huérfano tolerable, archivo vivo no)", async () => {
    selectChain.in.mockResolvedValue({ data: null, error: { message: "boom" } });

    await limpiarArchivosHuerfanosSeguro(["a/b.pdf"], "org-1");

    expect(remove).not.toHaveBeenCalled();
  });

  it("no llama a storage.remove si no hay paths", async () => {
    await limpiarArchivosHuerfanosSeguro([], "org-1");
    expect(remove).not.toHaveBeenCalled();
  });
});
