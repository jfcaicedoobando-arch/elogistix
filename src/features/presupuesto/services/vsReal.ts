/**
 * Comparativo Presupuesto vs Real por categoría para un periodo (YYYY-MM).
 * Real = proveedor_facturas (por categoria_presupuesto_id) + liquidaciones_comision
 * que caigan en el mes (mapeadas a la categoría "Comisiones" por nombre).
 *
 * Los tipos y la agregación pura viven en `vsRealDomain.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchCategorias } from "./categorias";
import { fetchPresupuestoMensualAnio } from "./mensual";
import { UMBRAL_SOBREEJERCICIO_PCT } from "../constants";
import {
  agregarGastosCxP,
  aplicarLiquidacionesComisiones,
  construirFila,
  construirFilaHuerfanos,
  mapPresupuestoPorCategoria,
  restarNotasCreditoCxP,
  ultimoDia,
  type FilaVsReal,
  type NcCxPRow,
  type ResumenVsReal,
} from "./vsRealDomain";

/** BL-07: límites duros de filas por fuente del real; al tocarlos se avisa. */
const LIMITE_FILAS_CXP = 2000;
const LIMITE_FILAS_LIQ = 500;

export type { FilaVsReal, ResumenVsReal } from "./vsRealDomain";

export async function fetchPresupuestoVsReal(
  periodo: string,
  organizationId?: string | null,
): Promise<ResumenVsReal> {
  const [y] = periodo.split("-").map(Number);
  const desde = `${periodo}-01`;
  const hasta = ultimoDia(periodo);

  // BL-07: `subtotal` (sin IVA) en vez de `total` (con IVA): los presupuestos
  // se capturan como gasto neto y el IVA acreditable no es costo operativo.
  let cxpQuery = supabase.from("proveedor_facturas")
    .select("categoria_presupuesto_id, subtotal, moneda, tipo_cambio_usd, fecha_emision, estado")
    .gte("fecha_emision", desde).lte("fecha_emision", hasta)
    .is("deleted_at", null)
    // Fase 3: excluye facturas canceladas para consistencia con
    // `estadoResultadosDevengado` (que ya las excluye).
    .neq("estado", "Cancelada")
    .limit(LIMITE_FILAS_CXP);
  // BL-07: NCs de proveedor aplicadas en el periodo descuentan el real de la
  // categoría de la factura padre (antes el gasto quedaba bruto, inflado).
  let ncQuery = supabase.from("proveedor_notas_credito")
    .select("monto, moneda, tipo_cambio, proveedor_facturas!inner(categoria_presupuesto_id, moneda, tipo_cambio_usd)")
    .eq("estado", "Aplicada")
    .gte("fecha", desde).lte("fecha", hasta)
    .is("deleted_at", null)
    .limit(LIMITE_FILAS_CXP);
  // Nota: `liquidaciones_comision` no tiene columna `deleted_at` en el schema.
  // Filtrar por ella causa `column ... does not exist` y rompe el Dashboard Ejecutivo.
  let liqQuery = supabase.from("liquidaciones_comision")
    .select("total_mxn, periodo").is("deleted_at", null)
    .eq("periodo", periodo)
    .limit(LIMITE_FILAS_LIQ);
  if (organizationId) {
    cxpQuery = cxpQuery.eq("organization_id", organizationId);
    ncQuery = ncQuery.eq("organization_id", organizationId);
    liqQuery = liqQuery.eq("organization_id", organizationId);
  }

  const [cats, presupuestoAnio, gastosCxP, ncsCxP, liquidaciones] = await Promise.all([
    // Fase 3 (crítico #2): pasa organizationId para defensa en profundidad.
    fetchCategorias(true, organizationId),
    // Fase 3 (crítico #1): pasa organizationId al presupuesto mensual.
    fetchPresupuestoMensualAnio(y, organizationId),
    cxpQuery,
    ncQuery,
    liqQuery,
  ]);

  if (gastosCxP.error) throw gastosCxP.error;
  if (ncsCxP.error) throw ncsCxP.error;
  if (liquidaciones.error) throw liquidaciones.error;

  // BL-07: una fuente que toca su límite puede estar truncada — señalizarlo
  // en el resumen en vez de subestimar el real en silencio.
  const realTruncado =
    (gastosCxP.data ?? []).length === LIMITE_FILAS_CXP ||
    (ncsCxP.data ?? []).length === LIMITE_FILAS_CXP ||
    (liquidaciones.data ?? []).length === LIMITE_FILAS_LIQ;

  const presupPorCat = mapPresupuestoPorCategoria(presupuestoAnio, periodo);
  const { porCategoria: realPorCat, sinTc: gastosSinTc } = agregarGastosCxP(gastosCxP.data ?? []);
  const ncsSinTc = restarNotasCreditoCxP(mapNcsCxP(ncsCxP.data ?? []), realPorCat);
  aplicarLiquidacionesComisiones(realPorCat, cats, liquidaciones.data ?? []);

  const catIds = new Set(cats.map((c) => c.id));
  const filas: FilaVsReal[] = cats.map((c) => construirFila(c, presupPorCat, realPorCat));

  // Fase 3 (alta #6): gasto real con categoría inactiva/eliminada no debe
  // desaparecer silenciosamente. Se agrega fila sintética "Sin categoría".
  const filaHuerfanos = construirFilaHuerfanos(realPorCat, catIds);
  if (filaHuerfanos) filas.push(filaHuerfanos);

  const total_presupuesto = filas.reduce((a, f) => a + f.presupuesto_mxn, 0);
  const total_real = filas.reduce((a, f) => a + f.real_mxn, 0);

  // Fase J: derivados de sobreejercicio. Umbral compartido con `calcularAlertas`.
  const excedidas = filas.filter(
    (f) => f.presupuesto_mxn > 0 && f.cumplimiento_pct > UMBRAL_SOBREEJERCICIO_PCT,
  );
  const top_exceso = [...excedidas]
    .sort((a, b) => b.variacion_mxn - a.variacion_mxn)
    .slice(0, 5);

  return {
    periodo,
    filas,
    total_presupuesto_mxn: total_presupuesto,
    total_real_mxn: total_real,
    variacion_neta_mxn: total_real - total_presupuesto,
    categorias_en_exceso: excedidas.length,
    top_exceso,
    gastos_sin_tc_count: gastosSinTc + ncsSinTc,
    real_truncado: realTruncado,
  };
}

/** Aplana el embed `proveedor_facturas!inner` de la consulta de NCs. */
function mapNcsCxP(data: unknown[]): NcCxPRow[] {
  return (data as Array<Record<string, unknown>>).map((r) => {
    const pf = (r.proveedor_facturas ?? {}) as Record<string, unknown>;
    return {
      categoria_presupuesto_id: (pf.categoria_presupuesto_id as string | null) ?? null,
      monto: r.monto as number | string,
      moneda: (r.moneda as string | null) ?? null,
      // N9: la NC trae su propia paridad (MXN por 1 USD/EUR) y manda sobre la
      // de la factura padre; antes una NC en EUR se valuaba con el T/C del
      // dólar heredado. Sólo se hereda cuando la NC no capturó paridad.
      tipo_cambio_usd: (r.tipo_cambio as number | string | null)
        ?? (pf.tipo_cambio_usd as number | string | null)
        ?? null,

    };
  });
}
