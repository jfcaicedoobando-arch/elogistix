/**
 * Ola 4 · N36: dedupe genérico (archivo_hash / xml_hash) contra vivos +
 * cleanup best-effort de storage cuando el insert/update posterior falla.
 * v13.819.2: la ubicación del duplicado la resuelve la RPC canónica
 * `buzon_localizar_duplicado` y viaja en el error para la UI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const remove = vi.fn();
const rpc = vi.fn();
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
    rpc: (...args: unknown[]) => rpc(...args),
    storage: { from: () => ({ remove }) },
  },
}));

const {
  validarNoDuplicadoEnBuzon,
  limpiarArchivosHuerfanos,
  esErrorUnicidad,
  limpiarArchivosHuerfanosSeguro,
} = await import("@/features/cxp/services/facturasEntrantesDedupe");
const { BuzonDuplicadoError, CODIGO_BUZON_DUPLICADO } = await import(
  "@/features/cxp/services/buzonDuplicado"
);

function rpcDevuelve(fila: Record<string, unknown> | null) {
  rpc.mockResolvedValue({ data: fila ? [fila] : [], error: null });
}

async function capturar(promesa: Promise<void>): Promise<InstanceType<typeof BuzonDuplicadoError>> {
  try {
    await promesa;
  } catch (e) {
    return e as InstanceType<typeof BuzonDuplicadoError>;
  }
  throw new Error("se esperaba BuzonDuplicadoError");
}

describe("validarNoDuplicadoEnBuzon", () => {
  beforeEach(() => vi.clearAllMocks());

  it("factura nueva: no lanza y no bloquea la subida", async () => {
    rpcDevuelve(null);
    await expect(
      validarNoDuplicadoEnBuzon("hash-1", "org-1", "xml_hash"),
    ).resolves.toBeUndefined();
  });

  it("pasa hash, columna, uuid fiscal y embarque en curso a la RPC", async () => {
    rpcDevuelve(null);
    await validarNoDuplicadoEnBuzon("hash-1", "org-9", "xml_hash", {
      uuidFiscal: "AAA-BBB",
      embarqueId: "emb-1",
    });
    expect(rpc).toHaveBeenCalledWith("buzon_localizar_duplicado", {
      p_hash: "hash-1",
      p_columna: "xml_hash",
      p_uuid_fiscal: "AAA-BBB",
      p_embarque_id: "emb-1",
    });
  });

  it("duplicada en el MISMO embarque", async () => {
    rpcDevuelve({ caso: "mismo_embarque", factura_id: "fac-1", embarque_id: "emb-1" });
    const err = await capturar(
      validarNoDuplicadoEnBuzon("hash-1", "org-1", "archivo_hash", { embarqueId: "emb-1" }),
    );
    expect(err.message).toBe("Esta factura ya está registrada en este embarque.");
    expect(err.code).toBe(CODIGO_BUZON_DUPLICADO);
    expect(err.status).toBe(409);
    expect(err.ubicacion.embarqueId).toBe("emb-1");
  });

  it("duplicada en OTRO embarque de la misma organización: incluye el folio", async () => {
    rpcDevuelve({
      caso: "otro_embarque",
      factura_id: "fac-1",
      embarque_id: "emb-2",
      embarque_expediente: "EXP-0099",
    });
    const err = await capturar(
      validarNoDuplicadoEnBuzon("hash-1", "org-1", "archivo_hash", { embarqueId: "emb-1" }),
    );
    expect(err.message).toBe("Esta factura ya está registrada en el embarque EXP-0099.");
    expect(err.ubicacion.embarqueId).toBe("emb-2");
  });

  it("existente en Compras sin embarque vinculado", async () => {
    rpcDevuelve({ caso: "sin_embarque", factura_id: "fac-1" });
    const err = await capturar(validarNoDuplicadoEnBuzon("hash-1", "org-1"));
    expect(err.message).toMatch(/ya está registrada en Compras, pero todavía no está vinculada/);
    expect(err.ubicacion.embarqueId).toBeNull();
  });

  it("duplicado de otra organización: mensaje genérico y sin metadatos", async () => {
    rpcDevuelve({ caso: "ajeno" });
    const err = await capturar(validarNoDuplicadoEnBuzon("hash-1", "org-1"));
    expect(err.message).toBe(
      "Esta factura ya está registrada. Solicita a Operaciones que revise el documento.",
    );
    expect(err.ubicacion).toEqual({
      caso: "ajeno",
      facturaId: null,
      embarqueId: null,
      embarqueExpediente: null,
    });
  });

  it("pendiente de captura en el buzón conserva el mensaje por tipo de archivo", async () => {
    rpcDevuelve({ caso: "buzon_pendiente" });
    const xml = await capturar(validarNoDuplicadoEnBuzon("hash-1", "org-1", "xml_hash"));
    expect(xml.message).toMatch(/Este XML ya está en el buzón esperando captura/);
    rpcDevuelve({ caso: "buzon_pendiente" });
    const pdf = await capturar(validarNoDuplicadoEnBuzon("hash-1", "org-1"));
    expect(pdf.message).toMatch(/Este archivo ya está en el buzón esperando captura/);
  });

  it("no lanza si la RPC falla (fail-open best-effort; el índice único protege)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
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
