/**
 * Agregador del Dashboard Ejecutivo: ejecuta todos los servicios financieros
 * en paralelo y construye un único snapshot consumible por la UI.
 */
import { fetchEstadoResultadosDevengado } from "@/services/profit/estadoResultadosDevengado";
import { fetchResumenTesoreria } from "@/services/tesoreria";
import { fetchFlujoProyectado } from "@/services/tesoreria";
import { fetchPresupuestoVsReal } from "@/services/presupuesto";
import { calcularAlertas, calcularKPIsEjecutivos } from "./alertas";
import type { SnapshotEjecutivo, PuntoEERR } from "./types";

export interface FetchSnapshotParams {
  organizationId: string | null;
  periodo: string; // YYYY-MM
}

function periodoAnterior(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function meses12Atras(periodo: string): Array<{ year: number; month: number; key: string }> {
  const [y, m] = periodo.split("-").map(Number);
  const out: Array<{ year: number; month: number; key: string }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  return out;
}

export async function fetchDashboardEjecutivo(
  params: FetchSnapshotParams,
): Promise<SnapshotEjecutivo> {
  const { organizationId, periodo } = params;
  const [year, month] = periodo.split("-").map(Number);
  const prev = periodoAnterior(periodo);
  const [prevY, prevM] = prev.split("-").map(Number);

  // Ejecución paralela de servicios base
  const [eerrPeriodo, eerrPrev, tesoreria, flujo, presupuesto] = await Promise.all([
    fetchEstadoResultadosDevengado({ organizationId, year, month }),
    fetchEstadoResultadosDevengado({ organizationId, year: prevY, month: prevM }),
    fetchResumenTesoreria(),
    fetchFlujoProyectado(28),
    fetchPresupuestoVsReal(periodo),
  ]);

  // EERR rolling 12 meses (también en paralelo)
  const meses = meses12Atras(periodo);
  const eerrMensuales = await Promise.all(
    meses.map((m) =>
      fetchEstadoResultadosDevengado({ organizationId, year: m.year, month: m.month }),
    ),
  );
  const eerr12m: PuntoEERR[] = meses.map((m, i) => {
    const er = eerrMensuales[i];
    return {
      periodo: m.key,
      ingresos: er.totalIngresos.total,
      costos: er.totalCostos.total,
      utilidad: er.utilidad.total,
    };
  });

  const base = {
    periodo,
    eerrPeriodo,
    eerr12m,
    tesoreria,
    flujo,
    presupuesto,
  };

  const kpis = calcularKPIsEjecutivos(base, eerrPrev.totalIngresos.total);
  const alertas = calcularAlertas({ flujo, tesoreria, presupuesto });

  return {
    ...base,
    generadoEn: new Date().toISOString(),
    kpis,
    topDeudores: tesoreria.top_deudores,
    topAcreedores: tesoreria.top_acreedores,
    alertas,
  };
}
