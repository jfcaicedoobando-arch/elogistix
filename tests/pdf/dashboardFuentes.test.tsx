import { describe, expect, it } from "vitest";
import { ReporteEjecutivoDocument } from "@/pdf/documents/ReporteEjecutivoDocument";
import type { SnapshotEjecutivo } from "@/features/dashboardEjecutivo/services";
import { calcularKPIsEjecutivos } from "@/features/dashboardEjecutivo/services/alertas";
import { calcularVencimientosEjecutivos } from "@/features/dashboardEjecutivo/domain/vencimientos";
import { calcularResumenTesoreria, calcularFlujoProyectado } from "@/features/tesoreria/domain";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";
import { inspectPdf } from "./inspectPdf";

function snapshot(fuente: SnapshotEjecutivo["fuente"]): SnapshotEjecutivo {
  const hoy = new Date(2026, 9, 4, 12);
  const base = {
    periodo: "2026-10", fuente,
    vencimientos: calcularVencimientosEjecutivos({ cobranza: [], cxp: [], hoy }),
    eerrPeriodo: buildEstadoResultados([], [], []), eerr12m: [],
    tesoreria: calcularResumenTesoreria({ cuentas: [], cobranza: [], cxp: [], hoy, tipoCambioUsd: 18.5, tipoCambioFecha: "2026-10-02" }),
    flujo: calcularFlujoProyectado({ cuentas: [], cobranza: [], cxp: [], liquidaciones: [], hoy, dias: 28 }),
    presupuesto: { periodo: "2026-10", filas: [], total_presupuesto_mxn: 0, total_real_mxn: 0, variacion_neta_mxn: 0, categorias_en_exceso: 0, top_exceso: [] },
    tipoCambioUsd: 18.5, tcEsFallback: false,
  };
  return { ...base, generadoEn: "2026-10-04T18:00:00Z", kpis: calcularKPIsEjecutivos(base, 0), topDeudores: [], topAcreedores: [], alertas: [] };
}

describe("PDF Dashboard distingue fuente y metodología (84)", () => {
  it.each(["facturas", "embarques"] as const)("renderiza fuente %s y alcance visible con renderer real", async (fuente) => {
    const doc = await inspectPdf(`dashboard-${fuente}`, <ReporteEjecutivoDocument snapshot={snapshot(fuente)} />);
    expect(doc.pages).toBe(1);
    expect(doc.text).toContain("Fuente EERR:");
    expect(doc.text).toContain(fuente === "facturas" ? "Facturas (devengada)" : "Embarques (operativa)");
    expect(doc.text).toContain(fuente === "facturas" ? "fecha fiscal" : "cuya ETA cae en el periodo");
    expect(doc.text).toContain("Bases sin IVA");
    expect(doc.text).toContain("Bancos y cartera al 2026-10-04");
    expect(doc.text).toContain("18.5000 MXN/USD (2026-10-02)");
  });
});
