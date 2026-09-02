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
    const movs = await parseMovs(csvFile("bbva.csv", csv));
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
    const movs = await parseMovs(csvFile("bbva.csv", csv));
    expect(movs.map((m) => m.fecha)).toEqual(["2026-05-15", "2026-01-01"]);
  });

  it("filtra filas vacías y filas sin cargo ni abono", async () => {
    const csv = [
      HEADER,
      "01/05/2026,MOV CON MONTO,R,100,,",
      ",,,,,",
      "02/05/2026,MOV SIN MONTO,R,,,",
    ].join("\n");
    const movs = await parseMovs(csvFile("bbva.csv", csv));
    expect(movs).toHaveLength(1);
    expect(movs[0].concepto).toBe("MOV CON MONTO");
  });

  /** Helper: la mayoría de las pruebas sólo mira los movimientos legibles. */
  const parseMovs = async (f: File) =>
    (await parseEstadoCuentaBBVA(f)).movimientos;

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
    const movs = await parseMovs(csvFile("bbva.csv", csv));
    expect(movs).toHaveLength(2);
    expect(movs[0].cargo).toBe(55.5);
    expect(movs[1].abono).toBe(200);
  });

  it("hash_dedupe es determinista para el mismo movimiento", async () => {
    const csv = [HEADER, "01/05/2026,X,R,10,,"].join("\n");
    const a = await parseMovs(csvFile("a.csv", csv));
    const b = await parseMovs(csvFile("b.csv", csv));
    expect(a[0].hash_dedupe).toBe(b[0].hash_dedupe);
  });

  it("N32: dos movimientos idénticos el mismo día se conservan con hashes distintos", async () => {
    const csv = [
      HEADER,
      '05/05/2026,COMISION SPEI,,"$150.00",,1000.00',
      '05/05/2026,COMISION SPEI,,"$150.00",,850.00',
    ].join("\n");
    const movs = await parseMovs(csvFile("bbva.csv", csv));
    expect(movs).toHaveLength(2);
    expect(movs[0].hash_dedupe).not.toBe(movs[1].hash_dedupe);
  });

  it("N32: el sufijo ordinal es determinista (mismo archivo → mismos hashes)", async () => {
    const csv = [
      HEADER,
      '05/05/2026,COMISION SPEI,,"$150.00",,1000.00',
      '05/05/2026,COMISION SPEI,,"$150.00",,850.00',
    ].join("\n");
    const a = await parseMovs(csvFile("a.csv", csv));
    const b = await parseMovs(csvFile("b.csv", csv));
    expect(a.map((m) => m.hash_dedupe)).toEqual(b.map((m) => m.hash_dedupe));
  });

  it("N33: una fecha inválida (31/02) descarta sólo su fila, no el lote", async () => {
    const csv = [
      HEADER,
      '31/02/2026,FECHA MALA,REFX,"$100.00",,1000.00',
      '02/05/2026,DEPOSITO CLIENTE,REF002,,"$5,000.00",103765.43',
    ].join("\n");
    const { movimientos, ilegibles } = await parseEstadoCuentaBBVA(
      csvFile("bbva.csv", csv),
    );
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].fecha).toBe("2026-05-02");
    // Defecto 3: la fila descartada se reporta, no se pierde en silencio.
    expect(ilegibles).toHaveLength(1);
    expect(ilegibles[0].fila).toBe(2);
  });

  it("N33: un archivo MM/DD (mes primero) aborta con mensaje claro", async () => {
    const csv = [
      HEADER,
      '12/31/2026,MONTH FIRST A,REF1,"$100.00",,1000.00',
      '11/30/2026,MONTH FIRST B,REF2,"$200.00",,1200.00',
      '10/29/2026,MONTH FIRST C,REF3,"$300.00",,1500.00',
    ].join("\n");
    await expect(parseEstadoCuentaBBVA(csvFile("bbva.csv", csv))).rejects.toThrow(/MM\/DD\/AAAA/);
  });
});
