/**
 * Agregador del Dashboard Ejecutivo: ejecuta servicios financieros en paralelo
 * y construye un snapshot. Auditoría Paso 4 (v12.95.11): recibe `cobranza` y
 * `cxp` inyectados por el hook caller para no acoplar service→service.
 */
import { avisoNcProveedorSinBase } from "@/lib/financial/baseNcProveedor";
import { fetchEstadoResultadosDevengado, fetchEstadoResultadosDevengadoAnual } from "@/features/profit/services/estadoResultadosDevengado";
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
import type { FuenteEERR } from "@/features/profit/domain/fuenteEerr";
import { calcularVencimientosEjecutivos } from "../domain/vencimientos";

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
 * Embarques conserva la agregación RPC por año. Facturas comparte el lector
 * y los cálculos mensuales devengados: bases sin IVA, NC netas y TC fiscal.
 * Cada lectura por año se limita a los meses visibles de la ventana de 12m.
 */
async function fetchTendencia12m(
  meses: Array<{ year: number; month: number; key: string }>,
  fuente: FuenteEERR,
  organizationId: string | null,
): Promise<PuntoEERR[]> {
  const years = Array.from(new Set(meses.map((m) => m.year)));
  const results = await Promise.all(
    years.map(async (y) => {
      if (fuente === "facturas") {
        const mesesYear = meses.filter((mes) => mes.year === y).map((mes) => mes.month);
        return fetchEstadoResultadosDevengadoAnual({
          organizationId, year: y, desdeMes: Math.min(...mesesYear), hastaMes: Math.max(...mesesYear),
        });
      }
      const { data, error } = await supabase.rpc("eerr_resumen_anual", { p_year: y, p_fuente: fuente });
      if (error) throw error;
      return data ?? [];
    }),
  );
  const porYearMes = new Map<string, { ingresos: number; costos: number; sinBase: number }>();
  years.forEach((y, i) => {
    for (const row of results[i] as Array<{ mes: number; ingresos_mxn: number | string; costos_mxn: number | string; notas_proveedor_sin_base_count?: number }>) {
      porYearMes.set(`${y}-${String(row.mes).padStart(2, "0")}`, {
        ingresos: Number(row.ingresos_mxn) || 0,
        costos: Number(row.costos_mxn) || 0,
        sinBase: row.notas_proveedor_sin_base_count ?? 0,
      });
    }
  });
  return meses.map((m) => {
    const v = porYearMes.get(m.key) ?? { ingresos: 0, costos: 0, sinBase: 0 };
    return {
      periodo: m.key,
      ingresos: v.ingresos,
      costos: v.costos,
      utilidad: v.ingresos - v.costos,
      ...(v.sinBase ? { notas_proveedor_sin_base_count: v.sinBase } : {}),
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
  // La tendencia agrupa lecturas por año; actual y previo conservan el
  // pivot completo por concepto/modo del mismo criterio contable.
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
    fetchTendencia12m(meses, fuente, organizationId),
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


  const vencimientos = calcularVencimientosEjecutivos({
    cobranza, cxp, tasas: { usdMxn: tipoCambioUsd, eurMxn: tipoCambioEur },
  });
  const base = { periodo, fuente, vencimientos, eerrPeriodo, eerr12m, tesoreria, flujo, presupuesto, tipoCambioUsd, tcEsFallback };
  const kpis = calcularKPIsEjecutivos(base, eerrPrev.totalIngresos.total, eerrPrev);
  const alertas = calcularAlertas({ flujo, tesoreria, presupuesto });
  const sinBase = Math.max(eerrPeriodo.notas_proveedor_sin_base?.length ?? 0, eerrPrev.notas_proveedor_sin_base?.length ?? 0, presupuesto.notas_proveedor_sin_base_count ?? 0, eerr12m.reduce((s, p) => s + (p.notas_proveedor_sin_base_count ?? 0), 0));
  if (sinBase) alertas.unshift({ id: "nc-proveedor-sin-base", severidad: "warning", titulo: "Resultados provisionales", descripcion: avisoNcProveedorSinBase(sinBase), url: "/profit/estado-resultados" });

  return {
    ...base,
    generadoEn: new Date().toISOString(),
    kpis,
    topDeudores: tesoreria.top_deudores,
    topAcreedores: tesoreria.top_acreedores,
    alertas,
  };
}
