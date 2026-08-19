import { describe, expect, it } from "vitest";
import { compararFifo, ordenarFifo } from "../fifoVencimiento";

describe("fifoVencimiento", () => {
  it("ordena por vencimiento ascendente y manda los nulos al final", () => {
    const out = ordenarFifo([
      { factura_id: "c", fecha_vencimiento: null },
      { factura_id: "a", fecha_vencimiento: "2026-01-10" },
      { factura_id: "b", fecha_vencimiento: "2026-01-05" },
    ]);
    expect(out.map((f) => f.factura_id)).toEqual(["b", "a", "c"]);
  });

  it("desempata por fecha de emisión cuando vencen el mismo día", () => {
    const out = ordenarFifo([
      { factura_id: "nueva", fecha_vencimiento: "2026-02-01", fecha_emision: "2026-01-20" },
      { factura_id: "vieja", fecha_vencimiento: "2026-02-01", fecha_emision: "2026-01-02" },
    ]);
    expect(out.map((f) => f.factura_id)).toEqual(["vieja", "nueva"]);
  });

  it("desempata por id cuando no hay emisión (orden determinista)", () => {
    expect(
      compararFifo(
        { factura_id: "b", fecha_vencimiento: "2026-02-01" },
        { factura_id: "a", fecha_vencimiento: "2026-02-01" },
      ),
    ).toBeGreaterThan(0);
  });

  it("no muta el arreglo original", () => {
    const orig = [
      { factura_id: "a", fecha_vencimiento: "2026-03-01" },
      { factura_id: "b", fecha_vencimiento: "2026-01-01" },
    ];
    ordenarFifo(orig);
    expect(orig[0].factura_id).toBe("a");
  });
});
