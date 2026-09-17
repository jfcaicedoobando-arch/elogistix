/**
 * Lote P2 (item 2): el diálogo de cobro al cliente debe advertir por CUALQUIER
 * campo editable, no sólo referencia/notas/monto.
 */
import { describe, it, expect } from "vitest";
import { pagoClienteSucio } from "../registrarPagoDirty";
import type { PagoFormValues } from "../PagoFormFields";

const baseline: PagoFormValues = {
  fecha: "2026-06-10", monto: "1000.00", moneda: "MXN",
  formaPago: "03", referencia: "", notas: "", cuentaBancariaId: "",
};

describe("pagoClienteSucio", () => {
  it("no advierte al abrir sin editar", () => {
    expect(pagoClienteSucio({ ...baseline }, baseline)).toBe(false);
  });

  it("no advierte sin baseline (aún sin inicializar)", () => {
    expect(pagoClienteSucio({ ...baseline }, null)).toBe(false);
  });

  it.each<[keyof PagoFormValues, string]>([
    ["fecha", "2026-06-11"],
    ["monto", "500.00"],
    ["moneda", "USD"],
    ["formaPago", "01"],
    ["referencia", "REF-9"],
    ["notas", "abono parcial"],
    ["cuentaBancariaId", "cta-1"],
  ])("advierte al cambiar sólo %s", (campo, valor) => {
    expect(pagoClienteSucio({ ...baseline, [campo]: valor }, baseline)).toBe(true);
  });
});
