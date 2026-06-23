/**
 * I/O del candado de costos: verifica si una cotización tiene filas en
 * `cotizacion_costos`. Extraído de `useCotizacionDetalleHandlers` para
 * cumplir la regla "hooks no importan supabase/client" (arquitectura).
 */
import { supabase } from "@/integrations/supabase/client";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

/**
 * Regla canónica del candado: bloqueamos por existencia real de filas
 * en `cotizacion_costos`, no por el flag `sin_desglose_costos`.
 * Ante error, devolvemos `true` para no impedir operación legítima.
 */
export async function tieneCostosCargados(cotizacionId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("cotizacion_costos")
    .select("id", { count: "exact", head: true })
    .eq("cotizacion_id", cotizacionId);
  if (error) {
    // 13.114.19: antes sólo `console.error`; ahora reportamos a Sentry para
    // detectar fallos silenciosos del candado (devolvemos `true` por seguridad).
    reportCaughtError(error, { feature: "cotizacion", op: "tiene_costos_cargados" }, {
      cotizacion_id: cotizacionId,
    });
    return true;
  }
  return (count ?? 0) > 0;
}
