import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarCuentas, crearCuenta, actualizarCuenta, eliminarCuenta } from "../cuentas";

describe("cuentas service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("listarCuentas filtra por activas por defecto", async () => {
    mock.setTableResult("cuentas_bancarias", { data: [], error: null });
    await listarCuentas();
    const call = mock.tableCalls.find(c => c.table === "cuentas_bancarias");
    expect(call?.ops).toContain("eq");
  });

  it("crearCuenta inserta registro", async () => {
    mock.setTableResult("cuentas_bancarias", { data: { id: "1" }, error: null });
    const res = await crearCuenta({ alias: "Test" } as any);
    expect(res.id).toBe("1");
    expect(mock.tableCalls.some(c => c.table === "cuentas_bancarias")).toBe(true);
  });

  it("actualizarCuenta hace update", async () => {
    mock.setTableResult("cuentas_bancarias", { data: [{ id: "1" }], error: null });
    await actualizarCuenta("1", { alias: "Nuevo" });
    const call = mock.tableCalls.find(c => c.table === "cuentas_bancarias");
    expect(call?.ops).toContain("update");
  });

  it("actualizarCuenta avisa del conflicto si otro usuario ya guardó (H5)", async () => {
    mock.setTableResult("cuentas_bancarias", { data: [], error: null });
    await expect(
      actualizarCuenta("1", { alias: "Nuevo" }, "2026-01-01T00:00:00Z"),
    ).rejects.toThrow(/LC_CONFLICTO_CONCURRENCIA/);
  });

  it("eliminarCuenta hace soft delete", async () => {
    mock.setTableResult("cuentas_bancarias", { data: [], error: null });
    await eliminarCuenta("1", "u1");
    const call = mock.tableCalls.find(c => c.table === "cuentas_bancarias");
    expect(call?.ops).toContain("update");
  });
});
