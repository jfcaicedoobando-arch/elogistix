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
  ultimoDia,
  type FilaVsReal,
  type ResumenVsReal,
} from "./vsRealDomain";

export { agregarGastosCxP } from "./vsRealDomain";
export type { FilaVsReal, ResumenVsReal, CxpRow } from "./vsRealDomain";

export async function fetchPresupuestoVsReal(
  periodo: string,
  organizationId?: string | null,
): Promise<ResumenVsReal> {
  const [y] = periodo.split("-").map(Number);
  const desde = `${periodo}-01`;
  const hasta = ultimoDia(periodo);

  let cxpQuery = supabase.from("proveedor_facturas")
    .select("categoria_presupuesto_id, total, moneda, tipo_cambio_usd, fecha_emision, estado")
    .gte("fecha_emision", desde).lte("fecha_emision", hasta)
    .is("deleted_at", null)
    // Fase 3: excluye facturas canceladas para consistencia con
    // `estadoResultadosDevengado` (que ya las excluye).
    .neq("estado", "Cancelada")
    .limit(2000);
  // Nota: `liquidaciones_comision` no tiene columna `deleted_at` en el schema.
  // Filtrar por ella causa `column ... does not exist` y rompe el Dashboard Ejecutivo.
  let liqQuery = supabase.from("liquidaciones_comision")
    .select("total_mxn, periodo")
    .eq("periodo", periodo)
    .limit(500);
  if (organizationId) {
    cxpQuery = cxpQuery.eq("organization_id", organizationId);
    liqQuery = liqQuery.eq("organization_id", organizationId);
  }

  const [cats, presupuestoAnio, gastosCxP, liquidaciones] = await Promise.all([
    // Fase 3 (crítico #2): pasa organizationId para defensa en profundidad.
    fetchCategorias(true, organizationId),
    // Fase 3 (crítico #1): pasa organizationId al presupuesto mensual.
    fetchPresupuestoMensualAnio(y, organizationId),
    cxpQuery,
    liqQuery,
  ]);

  if (gastosCxP.error) throw gastosCxP.error;
  if (liquidaciones.error) throw liquidaciones.error;

  const presupPorCat = mapPresupuestoPorCategoria(presupuestoAnio, periodo);
  const { porCategoria: realPorCat, sinTc: gastosSinTc } = agregarGastosCxP(gastosCxP.data ?? []);
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
    gastos_sin_tc_count: gastosSinTc,
  };
}
