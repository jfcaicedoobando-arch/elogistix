/**
 * Tests del parser de estado de cuenta BBVA.
 * Cubrimos la API pública `parseEstadoCuentaBBVA` con archivos CSV
 * sintéticos para ejercitar:
 *  - detección de header en filas intermedias,
 *  - parseo de fechas DD/MM/YYYY y DD-MMM-YYYY,
 *  - cargos vs abonos (montos con $ y comas),
 *  - filtrado de filas vacías / sin monto,
 *  - hash_dedupe estable y único por movimiento,
 *  - error cuando no hay encabezados reconocibles.
 *
 * No se mockea papaparse: corre real (ligero) para validar integración.
 */
import { describe, it, expect } from "vitest";
import { parseEstadoCuentaBBVA } from "../bbva";

function csvFile(name: string, body: string): File {
  const f = new File([body], name, { type: "text/csv" });
  // jsdom no implementa Blob.prototype.text(); lo polyfileamos puntualmente
  // sólo para este test (evitamos contaminar el setup global).
  if (typeof f.text !== "function") {
    (f as unknown as { text: () => Promise<string> }).text = async () => body;
  }
  return f;
}

const HEADER = "FECHA,DESCRIPCION,REFERENCIA,CARGO,ABONO,SALDO";

describe("parseEstadoCuentaBBVA", () => {
  it("parsea un CSV simple con cargo y abono", async () => {
    const csv = [
      "Estado de cuenta - BBVA",
      "Periodo: MAY 2026",
      "",
      HEADER,
      "01/05/2026,PAGO PROVEEDOR,REF001,\"$1,234.50\",,98765.43",
      "02/05/2026,DEPOSITO CLIENTE,REF002,,\"$5,000.00\",103765.43",
    ].join("\n");
    const movs = await parseEstadoCuentaBBVA(csvFile("bbva.csv", csv));
    expect(movs).toHaveLength(2);
    expect(movs[0]).toMatchObject({
      fecha: "2026-05-01",
      concepto: "PAGO PROVEEDOR",
      referencia: "REF001",
      cargo: 1234.5,
      abono: 0,
      saldo: 98765.43,
    });
    expect(movs[1]).toMatchObject({
      fecha: "2026-05-02",
      cargo: 0,
      abono: 5000,
    });
    expect(movs[0].hash_dedupe).toMatch(/^[a-f0-9]{40}$/);
    expect(movs[0].hash_dedupe).not.toBe(movs[1].hash_dedupe);
  });

  it("acepta fechas DD-MMM-YYYY en español", async () => {
    const csv = [
      HEADER,
      "15-MAY-2026,TRANSFERENCIA,REF,100,,",
      "1-ENE-26,CARGO INICIAL,REF,50,,",
    ].join("\n");
    const movs = await parseEstadoCuentaBBVA(csvFile("bbva.csv", csv));
    expect(movs.map((m) => m.fecha)).toEqual(["2026-05-15", "2026-01-01"]);
  });

  it("filtra filas vacías y filas sin cargo ni abono", async () => {
    const csv = [
      HEADER,
      "01/05/2026,MOV CON MONTO,R,100,,",
      ",,,,,",
      "02/05/2026,MOV SIN MONTO,R,,,",
    ].join("\n");
    const movs = await parseEstadoCuentaBBVA(csvFile("bbva.csv", csv));
    expect(movs).toHaveLength(1);
    expect(movs[0].concepto).toBe("MOV CON MONTO");
  });

  it("lanza error si no hay encabezados reconocibles", async () => {
    const csv = "col1,col2,col3\n1,2,3\n";
    await expect(parseEstadoCuentaBBVA(csvFile("bad.csv", csv))).rejects.toThrow(
      /encabezados/i,
    );
  });

  it("normaliza encabezados con variantes (RETIRO/DEPOSITO)", async () => {
    const csv = [
      "FECHA OPER,CONCEPTO,FOLIO,RETIRO,DEPOSITO,SALDO",
      "03/05/2026,COMISION,F1,55.5,,",
      "04/05/2026,ABONO,F2,,200,",
    ].join("\n");
    const movs = await parseEstadoCuentaBBVA(csvFile("bbva.csv", csv));
    expect(movs).toHaveLength(2);
    expect(movs[0].cargo).toBe(55.5);
    expect(movs[1].abono).toBe(200);
  });

  it("hash_dedupe es determinista para el mismo movimiento", async () => {
    const csv = [HEADER, "01/05/2026,X,R,10,,"].join("\n");
    const a = await parseEstadoCuentaBBVA(csvFile("a.csv", csv));
    const b = await parseEstadoCuentaBBVA(csvFile("b.csv", csv));
    expect(a[0].hash_dedupe).toBe(b[0].hash_dedupe);
  });
});
