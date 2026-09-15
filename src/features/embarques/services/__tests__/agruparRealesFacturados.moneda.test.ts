/**
 * REC-02: la moneda se normaliza al agrupar los reales facturados.
 */
import { describe, it, expect } from "vitest";
import { agruparRealesFacturados } from "@/features/embarques/services/reconciliacion3Columnas.helpers";

describe("agruparRealesFacturados", () => {
  it("junta USD, usd y ' USD ' en un solo renglón", () => {
    const r = agruparRealesFacturados([
      { concepto: "Flete", moneda: "USD", real_facturado: 100, facturas: [{}] },
      { concepto: "flete", moneda: "usd", real_facturado: 50, facturas: [] },
      { concepto: "Flete", moneda: " USD ", real_facturado: 25, facturas: [] },
    ]);
    expect(r).toHaveLength(1);
    expect(Number(r[0].monto)).toBe(175);
    expect(r[0].tiene_factura).toBe(true);
    // Etiqueta original conservada para mostrar.
    expect(r[0].moneda).toBe("USD");
  });

  it("mantiene separadas monedas distintas", () => {
    const r = agruparRealesFacturados([
      { concepto: "Flete", moneda: "USD", real_facturado: 100, facturas: [] },
      { concepto: "Flete", moneda: "MXN", real_facturado: 100, facturas: [] },
    ]);
    expect(r).toHaveLength(2);
  });
});
