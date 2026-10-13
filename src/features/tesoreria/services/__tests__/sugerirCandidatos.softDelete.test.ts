import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
import { monedaDeCuenta, sugerirCandidatosDetalle } from "../sugerirCandidatos";
import type { MovimientoBBVA } from "../conciliacion";

const deleted_at = "2026-10-01T00:00:00Z";
beforeEach(() => mock.reset());
const vivo = (index = 0) => {
  const call = mock.tableCalls[index];
  expect(call.ops.some((op, i) => op === "is" && call.opArgs[i][0] === "deleted_at" && call.opArgs[i][1] === null)).toBe(true);
};

describe("moneda de la cuenta bancaria", () => {
  it.each(["MXN", "USD", "EUR"])("conserva moneda %s de cuenta viva", async moneda => {
    mock.queue("cuentas_bancarias", { moneda });
    expect(await monedaDeCuenta("cta1")).toBe(moneda); vivo();
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "cta1"]);
  });
  it.each([null, { moneda: "USD", deleted_at }])("sin cuenta viva no propone pagos: %j", async row => {
    mock.queue("cuentas_bancarias", row);
    const mov = { cargo: 100, abono: 0, fecha: "2026-10-01", cuenta_bancaria_id: "cta1" } as MovimientoBBVA;
    expect(await sugerirCandidatosDetalle(mov)).toEqual({ candidatos: [], truncado: false });
    vivo(); expect(mock.tableCalls).toHaveLength(1);
  });
  it("sin cuenta no consulta ni asume moneda", async () => {
    expect(await monedaDeCuenta(null)).toBeNull(); expect(mock.tableCalls).toEqual([]);
  });
});

describe("errores de lectura de cuentas bancarias al sugerir candidatos", () => {
  it("propaga error de cuentas_bancarias", async () => {
    mock.queue("cuentas_bancarias", null, new Error("lectura-fallida"));
    await expect(monedaDeCuenta("cta1")).rejects.toThrow("lectura-fallida");
    expect(mock.tableCalls).toHaveLength(1);
  });
});
