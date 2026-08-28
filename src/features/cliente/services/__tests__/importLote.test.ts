import { describe, it, expect, vi, beforeEach } from "vitest";

const { insertMock } = vi.hoisted(() => ({ insertMock: vi.fn() }));

// M4 (auditoría 3-3): el alta va por la RPC canónica `crear_clientes`.

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (_fn: string, args: { p_clientes: unknown[] }) => insertMock(args.p_clientes) },
}));
vi.mock("@/lib/text/razonSocial", () => ({
  normalizarRazonSocial: (s: string) => s.trim().toUpperCase(),
}));

import { createClientesLote } from "../importLote";
import { IMPORT_LOTE_TAMANO } from "@/lib/csv/importLimits";

function filas(n: number) {
  return Array.from({ length: n }, (_, i) => ({ nombre: ` cliente ${i} ` })) as never[];
}

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockImplementation(async (lote: { nombre: string }[]) => ({
    data: lote.map((c, i) => ({ id: `c${i}`, ...c })),
    error: null,
  }));
});

describe("createClientesLote", () => {
  it("agrupa en lotes de IMPORT_LOTE_TAMANO con un solo insert por lote", async () => {
    const creados = await createClientesLote(filas(IMPORT_LOTE_TAMANO + 5));
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect((insertMock.mock.calls[0] as unknown as [unknown[]])[0]).toHaveLength(
      IMPORT_LOTE_TAMANO,
    );
    expect((insertMock.mock.calls[1] as unknown as [unknown[]])[0]).toHaveLength(5);
    expect(creados).toHaveLength(IMPORT_LOTE_TAMANO + 5);
  });

  it("normaliza la razón social de cada fila", async () => {
    await createClientesLote(filas(1));
    const lote = (insertMock.mock.calls[0] as unknown as [{ nombre: string }[]])[0];
    expect(lote[0].nombre).toBe("CLIENTE 0");
  });

  it("reporta cuántos clientes se alcanzaron a guardar cuando un lote falla", async () => {
    insertMock.mockImplementationOnce(async (lote: unknown[]) => ({
      data: lote.map(() => ({ id: "x" })),
      error: null,
    }));
    insertMock.mockImplementationOnce(async () => ({
      data: null,
      error: { message: "RFC duplicado" },
    }));
    await expect(createClientesLote(filas(IMPORT_LOTE_TAMANO + 3))).rejects.toThrow(
      `Se importaron ${IMPORT_LOTE_TAMANO} de ${IMPORT_LOTE_TAMANO + 3} clientes`,
    );
  });

  it("no llama a la base cuando no hay filas", async () => {
    expect(await createClientesLote([])).toEqual([]);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
