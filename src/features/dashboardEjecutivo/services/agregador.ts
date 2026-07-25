/**
 * Agregador del Dashboard Ejecutivo: ejecuta servicios financieros en paralelo
 * y construye un snapshot. Auditoría Paso 4 (v12.95.11): recibe `cobranza` y
 * `cxp` inyectados por el hook caller para no acoplar service→service.
 */
import { fetchEstadoResultadosDevengado } from "@/features/profit/services/estadoResultadosDevengado";
import { fetchEstadoResultadosMes } from "@/features/profit/services/estadoResultados";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchSaldosCuentas,
  fetchResumenTesoreria,
  fetchFlujoProyectado,
} from "@/features/tesoreria/services";
import { fetchPresupuestoVsReal } from "@/features/presupuesto/services";
import { fetchExchangeRates } from "@/features/catalogos/services";
import type { CobranzaRow, CxpRow } from "@/features/tesoreria/domain";
import { calcularAlertas, calcularKPIsEjecutivos } from "./alertas";
import type { SnapshotEjecutivo, PuntoEERR } from "./types";
import type { FuenteEERR } from "@/features/profit/hooks/useFuenteEerr";

export interface FetchSnapshotParams {
  organizationId: string | null;
  periodo: string; // YYYY-MM
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  /** Fuente del EERR. Default `"embarques"` para alinearse con la pantalla EERR. */
  fuente?: FuenteEERR;
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
  const { organizationId, periodo, cobranza, cxp, fuente = "embarques" } = params;
  const [year, month] = periodo.split("-").map(Number);
  const prev = periodoAnterior(periodo);
  const [prevY, prevM] = prev.split("-").map(Number);

  // Selector de fuente EERR. `facturas` = devengado (contable);
  // `embarques` = pagado/liquidado. Ambas firmas son idénticas.
  const fetchEerr = fuente === "facturas" ? fetchEstadoResultadosDevengado : fetchEstadoResultadosMes;

  const meses = meses12Atras(periodo);
  const [
    cuentas,
    eerrPeriodo,
    eerrPrev,
    presupuesto,
    tipoCambio,
    ...eerrMensuales
  ] = await Promise.all([
    fetchSaldosCuentas(organizationId),
    fetchEerr({ organizationId, year, month }),
    fetchEerr({ organizationId, year: prevY, month: prevM }),
    fetchPresupuestoVsReal(periodo, organizationId),
    fetchExchangeRates().catch(() => ({ usdMxn: 17.25, eurMxn: 18.5 })),
    ...meses.map((m) => fetchEerr({ organizationId, year: m.year, month: m.month })),
  ]);
  const tipoCambioUsd = tipoCambio.usdMxn;
  // A1/A2 fix (v13.300.49): tesorería y flujo reciben el TC para
  // convertir a MXN los saldos y flujos en USD.
  // P4: reutilizamos `cuentas` (ya fetched arriba) en vez de re-fetch dentro
  // de fetchResumenTesoreria; P8-lite: paralelizamos tesoreria/flujo.
  const [tesoreria, flujo] = await Promise.all([
    fetchResumenTesoreria({
      cobranza, cxp, organizationId, tipoCambioUsd, cuentas,
    }),
    fetchFlujoProyectado({
      cuentas, cobranza, cxp, dias: 28, organizationId, tipoCambioUsd,
    }),
  ]);

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
  const kpis = calcularKPIsEjecutivos(base, eerrPrev.totalIngresos.total, eerrPrev);
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
