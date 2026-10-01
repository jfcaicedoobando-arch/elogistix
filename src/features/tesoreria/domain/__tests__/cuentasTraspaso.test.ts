import { describe, it, expect } from "vitest";
import { cuentasActivasParaTraspaso } from "../cuentasTraspaso";
describe("N03 · cuentas disponibles para traspaso", () => {
  const activa = { id: "a", activa: true, deleted_at: null };
  it("no ofrece registros inactivos, eliminados o duplicados", () => {
    const rows = [activa, { ...activa }, { ...activa, id: "b", activa: false }, { ...activa, id: "c", deleted_at: "2026-09-30" }];
    expect(cuentasActivasParaTraspaso(rows)).toEqual([activa]);
  });
  it("requiere dos cuentas distintas y conserva monedas e identidades sin mutarlas", () => {
    expect(cuentasActivasParaTraspaso([])).toHaveLength(0);
    const rows = [{ ...activa, moneda: "USD" }, { ...activa, id: "b", moneda: "MXN" }];
    expect(cuentasActivasParaTraspaso(rows)).toEqual(rows);
    expect(rows[0].moneda).toBe("USD");
  });
});
