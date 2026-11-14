import { describe, expect, it } from "vitest";
import { estatusVisible, totalesComisiones } from "../totalesComisiones";

describe("totales de comisiones del broker", () => {
  it("separa pendiente, liquidado sin pagar y pagado; ignora canceladas", () => {
    const t = totalesComisiones([
      { comision_mxn: 100.1, estado: "Devengada", pagada: false },
      { comision_mxn: 0.2, estado: "Devengada", pagada: false },
      { comision_mxn: 50, estado: "Liquidada", pagada: false },
      { comision_mxn: 70, estado: "Liquidada", pagada: true },
      { comision_mxn: 999, estado: "Cancelada", pagada: false },
    ]);
    expect(t).toEqual({ pendiente: 100.3, liquidado: 50, pagado: 70 });
  });
  it("una liquidada pagada se muestra como Pagada", () => {
    expect(estatusVisible({ comision_mxn: 1, estado: "Liquidada", pagada: true })).toBe("Pagada");
  });
});
