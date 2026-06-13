/**
 * Agregador del Dashboard Ejecutivo: ejecuta servicios financieros en paralelo
 * y construye un snapshot. Auditoría Paso 4 (v12.95.11): recibe `cobranza` y
 * `cxp` inyectados por el hook caller para no acoplar service→service.
 */
import { fetchEstadoResultadosDevengado } from "@/services/profit/estadoResultadosDevengado";
import {
  fetchSaldosCuentas,
  fetchResumenTesoreria,
  fetchFlujoProyectado,
} from "@/features/tesoreria/services";
import { fetchPresupuestoVsReal } from "@/services/presupuesto";
import type { CobranzaRow, CxpRow } from "@/lib/domain/tesoreria";
import { calcularAlertas, calcularKPIsEjecutivos } from "./alertas";
import type { SnapshotEjecutivo, PuntoEERR } from "./types";

export interface FetchSnapshotParams {
  organizationId: string | null;
  periodo: string; // YYYY-MM
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
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
  const { organizationId, periodo, cobranza, cxp } = params;
  const [year, month] = periodo.split("-").map(Number);
  const prev = periodoAnterior(periodo);
  const [prevY, prevM] = prev.split("-").map(Number);

  const cuentas = await fetchSaldosCuentas();

  const [eerrPeriodo, eerrPrev, tesoreria, flujo, presupuesto] = await Promise.all([
    fetchEstadoResultadosDevengado({ organizationId, year, month }),
    fetchEstadoResultadosDevengado({ organizationId, year: prevY, month: prevM }),
    fetchResumenTesoreria({ cobranza, cxp }),
    fetchFlujoProyectado({ cuentas, cobranza, cxp, dias: 28 }),
    fetchPresupuestoVsReal(periodo),
  ]);

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

  const base = { periodo, eerrPeriodo, eerr12m, tesoreria, flujo, presupuesto };
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
