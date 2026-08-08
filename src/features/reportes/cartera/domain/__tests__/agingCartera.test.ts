import { describe, it, expect } from "vitest";
import {
  bucketDeDias,
  construirFilasCartera,
  diasVencidoAlCorte,
  leyendaTcCorte,
  totalCartera,
  totalesPorBucket,
  valuarFactura,
  type FacturaCartera,
  type TcCorte,
} from "../agingCartera";

const tc: TcCorte = { usdMxn: 20, eurMxn: 22, fecha: "2026-08-08", exacto: true };

const base: FacturaCartera = {
  id: "1",
  folio: "F-1",
  contraparte: "CLIENTE SA",
  expediente: "EXP-1",
  moneda: "USD",
  saldo: 100,
  fechaEmision: "2026-05-01",
  fechaVencimiento: "2026-06-01",
  tipoCambio: 18,
};

describe("agingCartera", () => {
  it("calcula días vencidos contra la fecha de corte", () => {
    expect(diasVencidoAlCorte("2026-06-01", "2026-06-11")).toBe(10);
    expect(diasVencidoAlCorte("2026-07-01", "2026-06-11")).toBe(-20);
    expect(diasVencidoAlCorte(null, "2026-06-11")).toBe(0);
  });

  it("asigna la cubeta correcta", () => {
    expect(bucketDeDias(-5)).toBe("vigente");
    expect(bucketDeDias(0)).toBe("vigente");
    expect(bucketDeDias(1)).toBe("d_1_30");
    expect(bucketDeDias(30)).toBe("d_1_30");
    expect(bucketDeDias(31)).toBe("d_31_60");
    expect(bucketDeDias(90)).toBe("d_61_90");
    expect(bucketDeDias(91)).toBe("mas_90");
  });

  it("valúa al TC histórico y al TC del corte, con su diferencia", () => {
    expect(valuarFactura(base, tc)).toEqual({
      mxnHistorico: 1800,
      mxnCorte: 2000,
      diferencia: 200,
    });
  });

  it("no genera diferencia cambiaria en pesos", () => {
    const mxn = { ...base, moneda: "MXN", tipoCambio: 1 };
    expect(valuarFactura(mxn, tc)).toEqual({
      mxnHistorico: 100,
      mxnCorte: 100,
      diferencia: 0,
    });
  });

  it("conserva el histórico cuando no hay TC del corte", () => {
    expect(valuarFactura(base, null).mxnCorte).toBe(1800);
  });

  it("descarta facturas sin saldo y ordena de más vencida a menos", () => {
    const filas = construirFilasCartera(
      [
        { ...base, id: "sin-saldo", saldo: 0 },
        { ...base, id: "nueva", fechaVencimiento: "2026-08-20" },
        { ...base, id: "vieja", fechaVencimiento: "2026-01-01" },
      ],
      "2026-08-08",
      tc,
    );
    expect(filas.map((f) => f.id)).toEqual(["vieja", "nueva"]);
    expect(filas[0].bucket).toBe("mas_90");
    expect(filas[1].bucket).toBe("vigente");
  });

  it("totaliza por cubeta y en gran total", () => {
    const filas = construirFilasCartera(
      [
        { ...base, id: "a", fechaVencimiento: "2026-07-20" },
        { ...base, id: "b", fechaVencimiento: "2026-01-01" },
      ],
      "2026-08-08",
      tc,
    );
    const buckets = totalesPorBucket(filas);
    expect(buckets).toHaveLength(5);
    expect(buckets.find((b) => b.bucket === "d_1_30")?.conteo).toBe(1);
    expect(buckets.find((b) => b.bucket === "mas_90")?.mxnCorte).toBe(2000);

    const total = totalCartera(filas);
    expect(total).toEqual({ conteo: 2, mxnHistorico: 3600, mxnCorte: 4000, diferencia: 400 });
  });

  it("describe el TC usado en el encabezado", () => {
    expect(leyendaTcCorte(tc)).toContain("20.0000");
    expect(leyendaTcCorte({ ...tc, exacto: false, fecha: "2026-08-07" })).toContain("2026-08-07");
    expect(leyendaTcCorte(null)).toContain("Sin TC DOF");
  });
});
