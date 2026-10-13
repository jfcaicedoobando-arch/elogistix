import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSimpleFilteredReadMock } from "@/services/__tests__/_simpleFilteredReadMock";

const { db } = vi.hoisted(() => ({ db: { current: null as unknown as ReturnType<typeof createSimpleFilteredReadMock> } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => db.current.supabase.from(table),
} }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
import { CLIENTE_DETAIL_COLUMNS, fetchCliente, fetchDiasCreditoCliente } from "../crud";

beforeEach(() => {
  db.current = createSimpleFilteredReadMock();
  const from = db.current.supabase.from.getMockImplementation()!;
  db.current.supabase.from.mockImplementation(table => {
    const chain = from(table);
    const single = chain.single as () => Promise<{ data: unknown; error: unknown }>;
    // PostgREST single rechaza cero filas; maybeSingle permite ausencia.
    chain.single = async () => {
      const response = await single();
      return response.data === null && !response.error
        ? { ...response, error: { code: "PGRST116", message: "No rows" } } : response;
    };
    return chain;
  });
});

function assertRead(columns: string) {
  expect(db.current.tableCalls).toHaveLength(1);
  const call = db.current.tableCalls[0];
  expect(call.table).toBe("clientes");
  expect(call.ops).toEqual(["select", "eq", "is"]);
  expect(call.opArgs).toEqual([[columns], ["id", "cliente-vivo"], ["deleted_at", null]]);
  expect(db.current.rpcCalls).toEqual([]);
}

describe("lecturas operativas de cliente", () => {
  it("devuelve el detalle vivo, conserva columnas e id y excluye otras filas", async () => {
    db.current.source("clientes", [
      { id: "otro", nombre: "Otro", deleted_at: null },
      { id: "cliente-vivo", nombre: "Cliente sintético", dias_credito: 30, deleted_at: null },
    ]);
    expect(await fetchCliente("cliente-vivo")).toMatchObject({ id: "cliente-vivo", nombre: "Cliente sintético", dias_credito: 30 });
    assertRead(CLIENTE_DETAIL_COLUMNS);
  });

  it.each([{ rows: [] }, { rows: [{ id: "cliente-vivo", deleted_at: "2026-01-01", dias_credito: 45 }] }])(
    "devuelve ausencia en el detalle de un cliente ausente o eliminado: %j", async ({ rows }) => {
      db.current.source("clientes", rows);
      expect(await fetchCliente("cliente-vivo")).toBeNull();
      assertRead(CLIENTE_DETAIL_COLUMNS);
    },
  );

  it.each([null, 0, 30])("preserva días de crédito vivos %j", async dias => {
    db.current.source("clientes", [
      { id: "otro", dias_credito: 90, deleted_at: null },
      { id: "cliente-vivo", dias_credito: dias, deleted_at: null },
    ]);
    expect(await fetchDiasCreditoCliente("cliente-vivo")).toBe(dias);
    assertRead("dias_credito");
  });

  it.each([{ rows: [] }, ...[null, 0, 30].map(dias => ({
    rows: [{ id: "cliente-vivo", deleted_at: "2026-01-01", dias_credito: dias }],
  }))])(
    "rechaza el crédito ausente o eliminado antes de convertirlo a Contado: %j", async ({ rows }) => {
      db.current.source("clientes", rows);
      await expect(fetchDiasCreditoCliente("cliente-vivo")).rejects.toThrow("El cliente no está disponible");
      assertRead("dias_credito");
    },
  );

  it.each([fetchCliente, fetchDiasCreditoCliente])("propaga el error de consulta sin convertirlo en ausencia", async read => {
    const error = { code: "MOCK_READ_FAILURE", message: "Fallo sintético" };
    db.current.source("clientes", null, error);
    await expect(read("cliente-vivo")).rejects.toBe(error);
    expect(db.current.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
  });
});
