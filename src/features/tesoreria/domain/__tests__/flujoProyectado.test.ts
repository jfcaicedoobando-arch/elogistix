import { describe, it, expect } from "vitest";
import {
  calcularFlujoProyectado,
  inicioSemana,
  isoWeekKey,
  toMxn,
} from "../flujoProyectado";
import type { CobranzaRow, CxpRow, LiquidacionRow, ResumenCuenta } from "../resumen";

describe("inicioSemana", () => {
  it("regresa lunes 00:00 para un miércoles", () => {
    const wed = new Date("2026-06-17T15:30:00");
    const lun = inicioSemana(wed);
    expect(lun.getDay()).toBe(1);
    expect(lun.getHours()).toBe(0);
  });

  it("para domingo retrocede 6 días", () => {
    const sun = new Date("2026-06-21T10:00:00");
    const lun = inicioSemana(sun);
    expect(lun.getDate()).toBe(15);
  });
});

describe("isoWeekKey", () => {
  it("genera formato YYYY-Www con padding", () => {
    expect(isoWeekKey(new Date("2026-01-05T00:00:00Z"))).toMatch(/^2026-W0\d$/);
  });
  it("es consistente dentro de la misma semana", () => {
    const a = isoWeekKey(new Date("2026-06-15T00:00:00Z"));
    const b = isoWeekKey(new Date("2026-06-19T00:00:00Z"));
    expect(a).toBe(b);
  });
});

describe("toMxn", () => {
  it("regresa monto tal cual si moneda es MXN", () => {
    expect(toMxn(1000, "MXN", 20)).toBe(1000);
  });
  it("convierte USD usando tc", () => {
    expect(toMxn(100, "USD", 18)).toBe(1800);
  });
  it("excluye el monto (0) si el tc no es confiable — FIX C6", () => {
    expect(toMxn(100, "USD", 0)).toBe(0);
    expect(toMxn(100, "USD", undefined)).toBe(0);
    expect(toMxn(100, "USD", 1)).toBe(0);
  });
});

const cuentas: ResumenCuenta[] = [
  { id: "c1", alias: "BBVA", banco: "BBVA", moneda: "MXN", saldo: 50_000 },
];

describe("calcularFlujoProyectado", () => {
  it("genera semanas y calcula saldo proyectado acumulado", () => {
    const hoy = new Date("2026-06-15T00:00:00");
    const cobranza: CobranzaRow[] = [
      { id: "f1", numero: "F-1", cliente_nombre: "A", moneda: "MXN", saldo: 10_000, fecha_vencimiento: "2026-06-18" },
    ];
    const cxp: CxpRow[] = [
      { id: "x1", folio_proveedor: "P-1", proveedor_nombre: "P", moneda: "USD", saldo: 100, fecha_vencimiento: "2026-06-25", tipo_cambio_usd: 18 },
    ];
    const r = calcularFlujoProyectado({ cuentas, cobranza, cxp, liquidaciones: [], dias: 14, hoy });
    expect(r.saldo_inicial_mxn).toBe(50_000);
    expect(r.total_entradas_mxn).toBe(10_000);
    expect(r.total_salidas_mxn).toBe(1_800);
    expect(r.saldo_final_mxn).toBe(58_200);
    expect(r.alertas_negativas).toBe(0);
    expect(r.semanas.length).toBeGreaterThan(0);
  });

  it("detecta alertas cuando saldo proyectado se vuelve negativo", () => {
    const hoy = new Date("2026-06-15T00:00:00");
    const cxp: CxpRow[] = [
      { id: "x1", folio_proveedor: "P-1", proveedor_nombre: "P", moneda: "MXN", saldo: 200_000, fecha_vencimiento: "2026-06-18" },
    ];
    const r = calcularFlujoProyectado({ cuentas, cobranza: [], cxp, liquidaciones: [], dias: 14, hoy });
    expect(r.alertas_negativas).toBeGreaterThanOrEqual(1);
    expect(r.saldo_final_mxn).toBeLessThan(0);
  });

  it("liquidaciones se asignan al día 5 del mes siguiente al periodo", () => {
    const hoy = new Date("2026-06-01T00:00:00");
    const liquidaciones: LiquidacionRow[] = [
      { id: "l1", vendedora_id: "v1", periodo: "2026-06", total_mxn: 5_000, fecha_pago: null, created_at: "" },
    ];
    const r = calcularFlujoProyectado({ cuentas, cobranza: [], cxp: [], liquidaciones, dias: 45, hoy });
    expect(r.total_salidas_mxn).toBe(5_000);
    const detalle = r.semanas.flatMap((s) => s.detalle_salidas);
    expect(detalle[0].concepto).toContain("2026-06");
  });

  it("ignora cobranza/cxp fuera de ventana", () => {
    const hoy = new Date("2026-06-15T00:00:00");
    const cobranza: CobranzaRow[] = [
      { id: "f1", numero: "F-1", cliente_nombre: "A", moneda: "MXN", saldo: 999, fecha_vencimiento: "2026-12-01" },
    ];
    const r = calcularFlujoProyectado({ cuentas, cobranza, cxp: [], liquidaciones: [], dias: 14, hoy });
    expect(r.total_entradas_mxn).toBe(0);
  });

  it("ignora saldo <=0, fecha_vencimiento null en cxp y periodos inválidos", () => {
    const hoy = new Date("2026-06-15T00:00:00");
    const cxp: CxpRow[] = [
      { id: "x1", folio_proveedor: "P", proveedor_nombre: "P", moneda: "MXN", saldo: 0, fecha_vencimiento: "2026-06-20" },
      { id: "x2", folio_proveedor: "P", proveedor_nombre: "P", moneda: "MXN", saldo: 100, fecha_vencimiento: null },
    ];
    const liquidaciones: LiquidacionRow[] = [
      { id: "l1", vendedora_id: "v1", periodo: "invalid", total_mxn: 1, fecha_pago: null, created_at: "" },
    ];
    const r = calcularFlujoProyectado({ cuentas, cobranza: [], cxp, liquidaciones, dias: 14, hoy });
    expect(r.total_salidas_mxn).toBe(0);
  });

  // v13.315.7 (QW1) — la fecha programada de pago debe ganar sobre vencimiento.
  it("usa fecha_programada_pago cuando existe para ubicar la salida CxP", () => {
    const hoy = new Date("2026-06-15T00:00:00");
    const cxpProgramada: CxpRow[] = [
      {
        id: "x1",
        folio_proveedor: "P-1",
        proveedor_nombre: "P",
        moneda: "MXN",
        saldo: 3_000,
        // Vence en semana 1 (2026-06-18) pero se programó para semana 3 (2026-07-02)
        fecha_vencimiento: "2026-06-18",
        fecha_programada_pago: "2026-07-02",
      },
    ];
    const r = calcularFlujoProyectado({
      cuentas, cobranza: [], cxp: cxpProgramada, liquidaciones: [], dias: 30, hoy,
    });
    expect(r.total_salidas_mxn).toBe(3_000);
    const detalle = r.semanas.flatMap((s) => s.detalle_salidas);
    expect(detalle).toHaveLength(1);
    expect(detalle[0].fecha_vencimiento).toBe("2026-07-02");
    const semanaConSalida = r.semanas.find((s) => s.salidas_mxn > 0);
    expect(semanaConSalida?.inicio.startsWith("2026-06-29")).toBe(true);
  });

  it("si fecha_programada_pago es null, cae a fecha_vencimiento", () => {
    const hoy = new Date("2026-06-15T00:00:00");
    const cxp: CxpRow[] = [
      {
        id: "x1",
        folio_proveedor: "P-1",
        proveedor_nombre: "P",
        moneda: "MXN",
        saldo: 1_000,
        fecha_vencimiento: "2026-06-18",
        fecha_programada_pago: null,
      },
    ];
    const r = calcularFlujoProyectado({
      cuentas, cobranza: [], cxp, liquidaciones: [], dias: 14, hoy,
    });
    expect(r.total_salidas_mxn).toBe(1_000);
  });
});

describe("calcularFlujoProyectado — Q-06 conversión multi-moneda", () => {
  const hoy = new Date("2026-06-15T00:00:00");

  it("con TC confiable convierte saldo/entradas/salidas USD y marca completo", () => {
    const cuentasMix: ResumenCuenta[] = [
      { id: "c1", alias: "USD", banco: "BBVA", moneda: "USD", saldo: 1_000 },
    ];
    const cobranza: CobranzaRow[] = [
      // El TC de la factura manda sobre el TC global (canon: `f.tipo_cambio`).
      { id: "f1", numero: "F-1", cliente_nombre: "A", moneda: "USD", saldo: 100, tipo_cambio: 20, fecha_vencimiento: "2026-06-18" },
    ];
    const r = calcularFlujoProyectado({
      cuentas: cuentasMix, cobranza, cxp: [], liquidaciones: [], dias: 14, hoy, tipoCambioUsd: 20,
    });
    expect(r.saldo_inicial_mxn).toBe(20_000);
    expect(r.total_entradas_mxn).toBe(2_000);
    expect(r.saldo_incompleto).toBe(false);
    expect(r.tipo_cambio_usd).toBe(20);
  });

  it("sin TC confiable NO suma 1:1 y marca saldo_incompleto con desglose", () => {
    const cuentasMix: ResumenCuenta[] = [
      { id: "c1", alias: "USD", banco: "BBVA", moneda: "USD", saldo: 1_000 },
    ];
    const cobranza: CobranzaRow[] = [
      { id: "f1", numero: "F-1", cliente_nombre: "A", moneda: "USD", saldo: 100, fecha_vencimiento: "2026-06-18" },
    ];
    const r = calcularFlujoProyectado({
      cuentas: cuentasMix, cobranza, cxp: [], liquidaciones: [], dias: 14, hoy,
    });
    expect(r.saldo_inicial_mxn).toBe(0);
    expect(r.total_entradas_mxn).toBe(0);
    expect(r.saldo_incompleto).toBe(true);
    expect(r.excluido_por_moneda.USD).toBe(1_100);
  });
});

describe("calcularFlujoProyectado — Q-15.1 sin corrimiento de día (zona MX)", () => {
  it("una cobranza que vence el lunes cae en la semana que inicia ese lunes", () => {
    const hoy = new Date("2026-06-15T00:00:00"); // lunes
    const cobranza: CobranzaRow[] = [
      { id: "f1", numero: "F-1", cliente_nombre: "A", moneda: "MXN", saldo: 1_000, fecha_vencimiento: "2026-06-15" },
    ];
    const r = calcularFlujoProyectado({
      cuentas: [], cobranza, cxp: [], liquidaciones: [], dias: 7, hoy,
    });
    const semanaConEntrada = r.semanas.find((s) => s.entradas_mxn > 0);
    expect(semanaConEntrada?.inicio).toBe("2026-06-15");
  });
});
