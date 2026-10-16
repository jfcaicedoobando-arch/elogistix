import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarCargo, listarCargos } from "../cargosService";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), insert: vi.fn(), result: { data: [] as unknown[], error: null } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    select: mocks.select,
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => mocks.result),
    insert: mocks.insert,
  };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.insert.mockResolvedValue({ error: null });
});

describe("cargo IVA data contract preserves base amounts", () => {
  it.each(["fob", "locales"] as const)("reads %s legacy false and explicit true without converting amounts", async (tipo) => {
    mocks.result.data = [
      { id: "old", concepto: "Legacy", monto: 100.12, moneda: "USD", unidad: null, entidad_id: "entity", entidad: null },
      { id: "new", concepto: "Explicit", monto: 340.2, moneda: "MXN", unidad: null, entidad_id: "entity", entidad: null, aplica_iva: true },
    ];
    const rows = await listarCargos(tipo);
    expect(rows.map(({ monto, moneda, aplica_iva }) => ({ monto, moneda, aplica_iva }))).toEqual([
      { monto: 100.12, moneda: "USD", aplica_iva: false },
      { monto: 340.2, moneda: "MXN", aplica_iva: true },
    ]);
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("aplica_iva"));
  });

  it.each([
    { tipo: "fob" as const, iva: false }, { tipo: "fob" as const, iva: true },
    { tipo: "locales" as const, iva: false }, { tipo: "locales" as const, iva: true },
  ])("saves $tipo IVA=$iva with the original base amount", async ({ tipo, iva }) => {
    await guardarCargo(tipo, "synthetic-org", { entidad_id: "synthetic-entity", concepto: "Synthetic cargo", monto: 171.23, moneda: "EUR", unidad: "Por BL", aplica_iva: iva });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ monto: 171.23, moneda: "EUR", aplica_iva: iva, organization_id: "synthetic-org" }));
  });
});
