/**
 * v13.823.355 (YAGNI r2 · P1) — el subtotal del encabezado se guarda SIN IVA.
 *
 * Antes se sumaba `concepto.total` (que YA incluye IVA): al reeditar y guardar
 * una cotización con impuesto el subtotal se inflaba (COT-2026-0012 mostraba
 * 2107.72 en vez de 1817) y con él la lista, los KPIs y el CRM.
 */
import { describe, it, expect } from "vitest";
import { derivarSubtotalMoneda } from "@/features/cotizacion/services/derivarSubtotalMoneda";

const conIva16 = [
  { moneda: "MXN", cantidad: 1, precio_unitario: 1817, total: 2107.72 },
];

describe("derivarSubtotalMoneda — subtotal sin IVA", () => {
  it("ignora el IVA del renglón (1817 + 16% ⇒ 1817)", () => {
    expect(derivarSubtotalMoneda(conIva16, "MXN")).toEqual({ subtotal: 1817, moneda: "MXN" });
  });

  it("suma cantidad * precio_unitario en varios renglones", () => {
    const r = derivarSubtotalMoneda(
      [
        { moneda: "USD", cantidad: 2, precio_unitario: 100, total: 232 },
        { moneda: "USD", cantidad: 3, precio_unitario: 50, total: 174 },
      ],
      "USD",
    );
    expect(r).toEqual({ subtotal: 350, moneda: "USD" });
  });

  it("usa `subtotal` como respaldo en renglones legados sin desglose", () => {
    const r = derivarSubtotalMoneda([{ moneda: "MXN", subtotal: 1000, total: 1160 }], "MXN");
    expect(r).toEqual({ subtotal: 1000, moneda: "MXN" });
  });
});
