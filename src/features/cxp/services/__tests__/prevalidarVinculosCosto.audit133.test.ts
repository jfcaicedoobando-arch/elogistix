import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ monedaCosto: "MXN", from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
import { prevalidarVinculosCosto } from "../prevalidarVinculosCosto";

beforeEach(() => {
  mock.monedaCosto = "MXN";
  mock.from.mockImplementation((table: string) => {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockResolvedValue({ data: table === "conceptos_costo"
      ? [{ id: "c1", concepto: "Flete", moneda: mock.monedaCosto, monto: 20.44 }] : [], error: null });
    return query;
  });
});

describe("auditoría 133 · prevalidación antes de crear cabecera", () => {
  it("rechaza EUR/MXN aunque el monto conciliado sea 1 EUR", async () => {
    await expect(prevalidarVinculosCosto("org", "EUR", { c1: { monto: 1 } }))
      .rejects.toThrow("Esta vinculación EUR/MXN todavía no está disponible");
  });
  it.each(["MXN", "USD"])("conserva el vínculo factura %s con costo MXN", async (moneda) => {
    await expect(prevalidarVinculosCosto("org", moneda, { c1: { monto: 1 } })).resolves.toBeUndefined();
  });
  it("conserva EUR/EUR", async () => {
    mock.monedaCosto = "EUR";
    await expect(prevalidarVinculosCosto("org", "EUR", { c1: { monto: 1 } })).resolves.toBeUndefined();
  });
  it("permite continuar sin vínculo", async () => {
    await expect(prevalidarVinculosCosto("org", "EUR", {})).resolves.toBeUndefined();
    expect(mock.from).not.toHaveBeenCalled();
  });
});
