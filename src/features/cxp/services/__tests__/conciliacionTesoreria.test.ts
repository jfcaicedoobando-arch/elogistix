/**
 * Pruebas de la lógica pura de resumen de conciliación de tesorería.
 */
import { describe, expect, it } from "vitest";
import {
  mensajeConciliacion,
  resumenConciliacion,
} from "@/features/cxp/services/conciliacionResumen";
import {
  mapReporteConciliacion,
  type ReporteConciliacion,
} from "@/features/cxp/services/conciliacionTesoreria";

function reporte(over: Partial<ReporteConciliacion> = {}): ReporteConciliacion {
  return {
    facturasRevisadas: 3,
    facturasActualizadas: 0,
    facturas: [],
    incidencias: [],
    proveedores: [],
    conciliadoAt: "2026-08-03T10:00:00Z",
    ...over,
  };
}

const incidencia = (tipo: "sin_movimiento" | "descuadre", id: string) => ({
  pagoId: id,
  facturaId: "f1",
  folio: "FP-000001",
  fechaPago: "2026-08-01",
  monto: 100,
  moneda: "MXN",
  montoEsperadoMxn: 100,
  cargoMxn: tipo === "descuadre" ? 90 : 0,
  tipo,
});

describe("resumenConciliacion", () => {
  it("marca cuadrado cuando no hay incidencias", () => {
    const r = resumenConciliacion(reporte());
    expect(r.cuadrado).toBe(true);
    expect(r.mensaje).toContain("Todo cuadra");
  });

  it("cuenta incidencias por tipo", () => {
    const r = resumenConciliacion(
      reporte({ incidencias: [incidencia("sin_movimiento", "a"), incidencia("descuadre", "b")] }),
    );
    expect(r.sinMovimiento).toBe(1);
    expect(r.descuadres).toBe(1);
    expect(r.cuadrado).toBe(false);
  });

  it("agrupa saldo del proveedor por moneda y ordena", () => {
    const r = resumenConciliacion(
      reporte({
        proveedores: [
          { proveedorId: "p1", moneda: "USD", saldoPendiente: 50, facturasAbiertas: 1 },
          { proveedorId: "p1", moneda: "MXN", saldoPendiente: 100, facturasAbiertas: 2 },
          { proveedorId: "p1", moneda: "MXN", saldoPendiente: 25, facturasAbiertas: 1 },
        ],
      }),
    );
    expect(r.saldoPorMoneda).toEqual([
      { moneda: "MXN", saldo: 125, facturasAbiertas: 3 },
      { moneda: "USD", saldo: 50, facturasAbiertas: 1 },
    ]);
  });

  it("devuelve estado neutro sin reporte", () => {
    expect(resumenConciliacion(null).mensaje).toBe("Sin conciliar todavía");
  });
});

describe("mensajeConciliacion", () => {
  it("informa facturas corregidas en singular", () => {
    expect(mensajeConciliacion(reporte({ facturasActualizadas: 1 }))).toContain("1 factura");
  });

  it("informa pagos sin movimiento y descuadres", () => {
    const msg = mensajeConciliacion(
      reporte({ incidencias: [incidencia("sin_movimiento", "a"), incidencia("descuadre", "b")] }),
    );
    expect(msg).toContain("1 pago sin movimiento");
    expect(msg).toContain("importe distinto");
  });
});

describe("mapReporteConciliacion", () => {
  it("normaliza el jsonb de la RPC", () => {
    const r = mapReporteConciliacion({
      facturas_revisadas: 2,
      facturas_actualizadas: 1,
      facturas: [
        {
          factura_id: "f1",
          folio: "FP-1",
          moneda: "MXN",
          total: 116,
          pagado: 16,
          notas_credito: 0,
          saldo: 100,
          estado: "Vigente",
          pagos: 1,
          movimientos: 1,
        },
      ],
      incidencias: [{ pago_id: "pg1", tipo: "descuadre", monto: "10.5" }],
      proveedores: [{ proveedor_id: "p1", moneda: "MXN", saldo_pendiente: 100, facturas_abiertas: 1 }],
      conciliado_at: "2026-08-03T10:00:00Z",
    });
    expect(r.facturasRevisadas).toBe(2);
    expect(r.facturas[0].saldo).toBe(100);
    expect(r.incidencias[0].tipo).toBe("descuadre");
    expect(r.incidencias[0].monto).toBe(10.5);
    expect(r.proveedores[0].saldoPendiente).toBe(100);
  });

  it("tolera datos vacíos", () => {
    const r = mapReporteConciliacion(null);
    expect(r.facturas).toEqual([]);
    expect(r.incidencias).toEqual([]);
  });
});
