import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { prevalidarVinculosCosto } from "../prevalidarVinculosCosto";

const deleted_at = "2026-10-01T00:00:00Z";
beforeEach(() => mock.reset());
const vivo = (index = 0) => {
  const call = mock.tableCalls[index];
  expect(call.ops.some((op, i) => op === "is" && call.opArgs[i][0] === "deleted_at" && call.opArgs[i][1] === null)).toBe(true);
};

describe("prevalidación de costos", () => {
  const costo = { id: "c1", concepto: "Flete", monto: 100, moneda: "MXN" };
  const run = () => prevalidarVinculosCosto("org-test", "MXN", { c1: { monto: 50 } });
  const queue = (rows: unknown[]) => {
    mock.queue("conceptos_costo", rows);
    mock.queue("proveedor_facturas_conceptos", []);
  };
  it("acepta el costo vivo y conserva los dos filtros tenant", async () => {
    queue([costo]); await expect(run()).resolves.toBeUndefined(); vivo();
    for (const call of mock.tableCalls) expect(call.opArgs).toContainEqual(["organization_id", "org-test"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", ["c1"]]);
    expect(mock.tableCalls[1].opArgs).toContainEqual(["concepto_costo_id", ["c1"]]);
  });
  it.each([{ rows: [] }, { rows: [{ ...costo, deleted_at }] }])("rechaza selección ausente/borrada: %j", async ({ rows }) => {
    queue(rows); await expect(run()).rejects.toThrow(/verificar todos los costos/); vivo();
  });
  it("sin selección no consulta tablas", async () => {
    await prevalidarVinculosCosto("org-test", "MXN", {}); expect(mock.tableCalls).toEqual([]);
  });
});

describe("errores de lectura en la prevalidación de costos CxP", () => {
  it("prevalidación propaga el error del costo antes de aprobar vínculos", async () => {
    const error = new Error("lectura-costos"); mock.queue("conceptos_costo", null, error);
    mock.queue("proveedor_facturas_conceptos", []);
    await expect(prevalidarVinculosCosto("org-test", "MXN", { c1: { monto: 1 } })).rejects.toBe(error);
  });
});
