import { fetchEstadoResultadosDevengado, fetchEstadoResultadosDevengadoAnual } from "@/features/profit/services/estadoResultadosDevengado";
import { fetchEstadoResultadosMes } from "@/features/profit/services/estadoResultados";
import type { FuenteEERR } from "@/features/profit/domain/fuenteEerr";
import { fetchPresupuestoVsReal } from "@/features/presupuesto/services";
import { fetchExchangeRates, EXCHANGE_RATES_FALLBACK } from "@/features/catalogos/services";
import { logger } from "@/lib/observability/logger";
import { supabase } from "@/integrations/supabase/client";
import type { PuntoEERR } from "./types";

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
  const porYearMes = new Map<string, { ingresos: number; costos: number; sinBase: number; valuacion?: PuntoEERR["valuacion"] }>();
  years.forEach((y, i) => {
    for (const row of results[i] as Array<{ mes: number; ingresos_mxn: number | string; costos_mxn: number | string; notas_proveedor_sin_base_count?: number; valuacion?: PuntoEERR["valuacion"] }>) {
      porYearMes.set(`${y}-${String(row.mes).padStart(2, "0")}`, {
        ingresos: Number(row.ingresos_mxn) || 0,
        costos: Number(row.costos_mxn) || 0,
        sinBase: row.notas_proveedor_sin_base_count ?? 0,
        valuacion: row.valuacion,
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
      ...(v.valuacion ? { valuacion: v.valuacion } : {}),
      ...(fuente === "embarques" && !v.valuacion ? { valuacion_no_verificada: true } : {}),
      ...(v.sinBase ? { notas_proveedor_sin_base_count: v.sinBase } : {}),
    };
  });
}

export async function fetchFuentesDashboardEjecutivo({
  organizationId,
  periodo,
  fuente = "embarques",
}: {
  organizationId: string | null;
  periodo: string;
  fuente?: FuenteEERR;
}) {
  const [year, month] = periodo.split("-").map(Number);
  const [prevY, prevM] = periodoAnterior(periodo).split("-").map(Number);
  const fetchEerr = fuente === "facturas" ? fetchEstadoResultadosDevengado : fetchEstadoResultadosMes;
  const [eerrPeriodo, eerrPrev, presupuesto, tipoCambio, eerr12m] = await Promise.all([
    fetchEerr({ organizationId, year, month }),
    fetchEerr({ organizationId, year: prevY, month: prevM }),
    fetchPresupuestoVsReal(periodo, organizationId),
    fetchExchangeRates().catch(() => EXCHANGE_RATES_FALLBACK),
    fetchTendencia12m(meses12Atras(periodo), fuente, organizationId),
  ]);
  if (tipoCambio.esFallback) {
    logger.warn("dashboardEjecutivo", "TC del DOF no disponible: se usó el tipo de cambio de respaldo", {
      periodo, tipoCambioUsd: tipoCambio.usdMxn,
    });
  }
  return { organizationId, periodo, fuente, eerrPeriodo, eerrPrev, presupuesto, tipoCambio, eerr12m };
}

export type FuentesDashboardEjecutivo = Awaited<ReturnType<typeof fetchFuentesDashboardEjecutivo>>;
