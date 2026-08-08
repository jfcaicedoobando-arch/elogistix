import { describe, it, expect } from "vitest";
import {
  carteraACsv,
  ENCABEZADOS_CARTERA,
  filasCarteraExport,
  filasTotalesExport,
  nombreArchivoCartera,
} from "../carteraExport";
import {
  construirFilasCartera,
  totalCartera,
  totalesPorBucket,
  type FacturaCartera,
  type TcCorte,
} from "@/features/reportes/cartera/domain/agingCartera";

const tc: TcCorte = { usdMxn: 20, eurMxn: null, fecha: "2026-08-08", exacto: true };

const facturas: FacturaCartera[] = [
  {
    id: "1",
    folio: "F-1",
    contraparte: "CLIENTE SA",
    expediente: "EXP-1",
    moneda: "USD",
    saldo: 100,
    fechaEmision: "2026-05-01",
    fechaVencimiento: "2026-06-01",
    tipoCambio: 18,
  },
];

describe("carteraExport", () => {
  const filas = construirFilasCartera(facturas, "2026-08-08", tc);

  it("formatea la fila con importes planos para Excel", () => {
    const [f] = filasCarteraExport("Cuentas por cobrar", filas);
    expect(f).toMatchObject({
      bloque: "Cuentas por cobrar",
      contraparte: "CLIENTE SA",
      folio: "F-1",
      moneda: "USD",
      saldo: "100.00",
      mxnHistorico: "1800.00",
      mxnCorte: "2000.00",
      diferencia: "200.00",
    });
    expect(f.dias).toBe("68");
  });

  it("agrega la fila de gran total al final de los totales", () => {
    const totales = filasTotalesExport(
      totalesPorBucket(filas),
      totalCartera(filas),
      "Cuentas por cobrar",
    );
    expect(totales).toHaveLength(6);
    expect(totales.at(-1)).toMatchObject({
      etiqueta: "Total Cuentas por cobrar",
      conteo: "1",
      mxnCorte: "2000.00",
    });
  });

  it("arma el CSV con encabezados, detalle y totales", () => {
    const detalle = filasCarteraExport("Cuentas por cobrar", filas);
    const csv = carteraACsv(detalle, [
      {
        bloque: "Cuentas por cobrar",
        filas: filasTotalesExport(totalesPorBucket(filas), totalCartera(filas), "Cuentas por cobrar"),
      },
    ]);
    const lineas = csv.split("\n");
    expect(lineas[0]).toBe(ENCABEZADOS_CARTERA.join(","));
    expect(csv).toContain("CLIENTE SA");
    expect(csv).toContain("TOTALES Cuentas por cobrar");
  });

  it("nombra el archivo con la fecha de corte", () => {
    expect(nombreArchivoCartera("2026-08-08", "csv")).toBe("cartera-antiguedad-2026-08-08.csv");
    expect(nombreArchivoCartera("2026-08-08", "pdf")).toBe("cartera-antiguedad-2026-08-08.pdf");
  });
});
