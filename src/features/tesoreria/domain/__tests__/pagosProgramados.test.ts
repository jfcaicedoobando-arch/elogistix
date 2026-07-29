import { describe, it, expect } from "vitest";
import { agruparPorSemana, fechaEfectivaPago, type FacturaProgramable } from "../pagosProgramados";

function factura(overrides: Partial<FacturaProgramable>): FacturaProgramable {
  return {
    id: "f1",
    proveedor_nombre: "Proveedor X",
    folio_proveedor: "A-1",
    fecha_vencimiento: "2026-08-05",
    fecha_programada_pago: null,
    moneda: "MXN",
    total: 1000,
    saldo: 1000,
    ...overrides,
  };
}

describe("fechaEfectivaPago", () => {
  it("usa fecha_programada_pago cuando existe", () => {
    const f = factura({ fecha_programada_pago: "2026-08-01", fecha_vencimiento: "2026-08-05" });
    expect(fechaEfectivaPago(f)).toBe("2026-08-01");
  });
  it("cae a fecha_vencimiento cuando no hay programada", () => {
    const f = factura({ fecha_programada_pago: null, fecha_vencimiento: "2026-08-05" });
    expect(fechaEfectivaPago(f)).toBe("2026-08-05");
  });
});

describe("agruparPorSemana", () => {
  it("agrupa mezcla de facturas programadas y no programadas por semana ISO", () => {
    const facturas: FacturaProgramable[] = [
      factura({ id: "a", fecha_programada_pago: "2026-08-07", fecha_vencimiento: "2026-08-05" }), // viernes semana W32
      factura({ id: "b", fecha_programada_pago: null, fecha_vencimiento: "2026-08-05" }), // miércoles misma semana
    ];
    const semanas = agruparPorSemana(facturas);
    expect(semanas).toHaveLength(1);
    expect(semanas[0].facturas.map((f) => f.id).sort()).toEqual(["a", "b"]);
  });

  it("una factura sin fecha_programada_pago cae en la semana del vencimiento", () => {
    const facturas: FacturaProgramable[] = [
      factura({ id: "c", fecha_programada_pago: null, fecha_vencimiento: "2026-09-01" }),
    ];
    const semanas = agruparPorSemana(facturas);
    expect(semanas).toHaveLength(1);
    expect(semanas[0].semanaInicio <= "2026-09-01").toBe(true);
    expect(semanas[0].semanaFin >= "2026-09-01").toBe(true);
  });

  it("separa totales por moneda dentro de la misma semana", () => {
    const facturas: FacturaProgramable[] = [
      factura({ id: "d", moneda: "MXN", saldo: 500, fecha_vencimiento: "2026-08-05" }),
      factura({ id: "e", moneda: "USD", saldo: 300, fecha_vencimiento: "2026-08-06" }),
    ];
    const semanas = agruparPorSemana(facturas);
    expect(semanas).toHaveLength(1);
    expect(semanas[0].totalesPorMoneda.MXN).toBe(500);
    expect(semanas[0].totalesPorMoneda.USD).toBe(300);
  });

  it("facturas en semanas distintas generan grupos distintos ordenados cronológicamente", () => {
    const facturas: FacturaProgramable[] = [
      factura({ id: "f", fecha_vencimiento: "2026-09-15" }),
      factura({ id: "g", fecha_vencimiento: "2026-08-05" }),
    ];
    const semanas = agruparPorSemana(facturas);
    expect(semanas).toHaveLength(2);
    expect(semanas[0].semanaInicio < semanas[1].semanaInicio).toBe(true);
  });

  it("omite facturas sin ninguna fecha disponible", () => {
    const facturas: FacturaProgramable[] = [
      factura({ id: "h", fecha_vencimiento: null, fecha_programada_pago: null }),
    ];
    expect(agruparPorSemana(facturas)).toHaveLength(0);
  });
});

describe("agruparPorSemana — Q-15.1 sin corrimiento de zona horaria (MX)", () => {
  it("una factura que vence lunes cae en la semana que inicia ese lunes exacto", () => {
    const facturas: FacturaProgramable[] = [
      factura({ id: "z1", fecha_vencimiento: "2026-08-03", fecha_programada_pago: null }), // lunes
    ];
    const semanas = agruparPorSemana(facturas);
    expect(semanas).toHaveLength(1);
    expect(semanas[0].semanaInicio).toBe("2026-08-03");
  });
});
