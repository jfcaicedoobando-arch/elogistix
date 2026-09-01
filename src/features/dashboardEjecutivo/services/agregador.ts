/**
 * Agregador del Dashboard Ejecutivo: ejecuta servicios financieros en paralelo
 * y construye un snapshot. Auditoría Paso 4 (v12.95.11): recibe `cobranza` y
 * `cxp` inyectados por el hook caller para no acoplar service→service.
 */
import { fetchEstadoResultadosDevengado } from "@/features/profit/services/estadoResultadosDevengado";
import { fetchEstadoResultadosMes } from "@/features/profit/services/estadoResultados";
import { logger } from "@/lib/observability/logger";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchSaldosCuentas,
  fetchResumenTesoreria,
  fetchFlujoProyectado,
} from "@/features/tesoreria/services";
import { fetchPresupuestoVsReal } from "@/features/presupuesto/services";
import { fetchExchangeRates, EXCHANGE_RATES_FALLBACK } from "@/features/catalogos/services";
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

/**
 * P8 (v13.317.x): trae la tendencia 12m en 1 sola llamada RPC en lugar de
 * 12 fetch mensuales separados. La semántica es idéntica a
 * fetchEstadoResultadosMes / fetchEstadoResultadosDevengado (mismos filtros,
 * misma conversión a MXN), pero agregada en el servidor por mes/año.
 * Puede abarcar dos años calendario (ej. mar-2025 → feb-2026) así que
 * hacemos hasta 2 llamadas RPC.
 */
async function fetchTendencia12m(
  meses: Array<{ year: number; month: number; key: string }>,
  fuente: FuenteEERR,
): Promise<PuntoEERR[]> {
  const years = Array.from(new Set(meses.map((m) => m.year)));
  const results = await Promise.all(
    years.map((y) =>
      supabase.rpc("eerr_resumen_anual", { p_year: y, p_fuente: fuente }),
    ),
  );
  const porYearMes = new Map<string, { ingresos: number; costos: number }>();
  years.forEach((y, i) => {
    const { data, error } = results[i];
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ mes: number; ingresos_mxn: number | string; costos_mxn: number | string }>) {
      porYearMes.set(`${y}-${String(row.mes).padStart(2, "0")}`, {
        ingresos: Number(row.ingresos_mxn) || 0,
        costos: Number(row.costos_mxn) || 0,
      });
    }
  });
  return meses.map((m) => {
    const v = porYearMes.get(m.key) ?? { ingresos: 0, costos: 0 };
    return {
      periodo: m.key,
      ingresos: v.ingresos,
      costos: v.costos,
      utilidad: v.ingresos - v.costos,
    };
  });
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
  // P8: la tendencia 12m ahora usa 1 RPC (`eerr_resumen_anual`) en vez de
  // 12 fetch mensuales. `eerrPeriodo` y `eerrPrev` siguen usando el fetch
  // completo porque necesitan el pivot por concepto/modo.
  const [
    cuentas,
    eerrPeriodo,
    eerrPrev,
    presupuesto,
    tipoCambio,
    eerr12m,
  ] = await Promise.all([
    fetchSaldosCuentas(organizationId),
    fetchEerr({ organizationId, year, month }),
    fetchEerr({ organizationId, year: prevY, month: prevM }),
    fetchPresupuestoVsReal(periodo, organizationId),
    fetchExchangeRates().catch(() => EXCHANGE_RATES_FALLBACK),
    fetchTendencia12m(meses, fuente),
  ]);
  const tipoCambioUsd = tipoCambio.usdMxn;
  // Ola 5 · A10: si el TC vino del fallback operativo (17.25/18.5), el tablero
  // no debe presentarlo como cifra oficial: se marca el snapshot y se avisa a
  // Sentry para detectar caídas prolongadas de la fuente DOF.
  const tcEsFallback = tipoCambio.esFallback === true;
  if (tcEsFallback) {
    logger.warn(
      "dashboardEjecutivo",
      "TC del DOF no disponible: se usó el tipo de cambio de respaldo",
      { periodo, tipoCambioUsd },
    );
  }
  // A1/A2 fix (v13.300.49): tesorería y flujo reciben el TC para
  // convertir a MXN los saldos y flujos en USD.
  // P4: reutilizamos `cuentas` (ya fetched arriba) en vez de re-fetch dentro
  // de fetchResumenTesoreria; P8-lite: paralelizamos tesoreria/flujo.
  // P1-7 (v13.823.5): además del USD se propaga el TC EUR y su fecha. Si el EUR
  // es estimado (fallback) NO se envía: el dominio marca el saldo/flujo como
  // incompleto y conserva el importe nominal por moneda, en vez de valuar EUR
  // con un TC inventado o excluirlo en silencio.
  const tipoCambioEur = tipoCambio.eurEsFallback === true ? undefined : tipoCambio.eurMxn;
  const tipoCambioFecha = tipoCambio.fechaAplicada ?? null;
  const [tesoreria, flujo] = await Promise.all([
    fetchResumenTesoreria({
      cobranza, cxp, organizationId, tipoCambioUsd, tipoCambioEur, tipoCambioFecha, cuentas,
    }),
    fetchFlujoProyectado({
      cuentas, cobranza, cxp, dias: 28, organizationId, tipoCambioUsd, tipoCambioEur, tipoCambioFecha,
    }),
  ]);


  const base = { periodo, eerrPeriodo, eerr12m, tesoreria, flujo, presupuesto, tipoCambioUsd, tcEsFallback };
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
