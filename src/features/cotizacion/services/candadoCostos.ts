/**
 * I/O del candado de costos: verifica si una cotización tiene filas en
 * `cotizacion_costos`. Extraído de `useCotizacionDetalleHandlers` para
 * cumplir la regla "hooks no importan supabase/client" (arquitectura).
 */
import { supabase } from "@/integrations/supabase/client";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

/** Error de verificación (no de negocio): la consulta del candado falló. */
export class CandadoCostosNoVerificableError extends Error {
  constructor(cause?: unknown) {
    super("LC_CANDADO_COSTOS_NO_VERIFICABLE");
    this.name = "CandadoCostosNoVerificableError";
    this.cause = cause;
  }
}

/**
 * Regla canónica del candado: bloqueamos por existencia real de filas
 * en `cotizacion_costos`, no por el flag `sin_desglose_costos`.
 *
 * v13.823.357 (Auditoría YAGNI P1 #4): ante error de consulta ya NO devolvemos
 * `true` (fail-open). Un fallo de red dejaba pasar la conversión de una
 * cotización sin costos y el embarque nacía en cero. Ahora falla cerrado con un
 * error reintentable que la UI traduce a "no pudimos verificar, inténtalo de
 * nuevo".
 */
export async function tieneCostosCargados(cotizacionId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("cotizacion_costos")
    .select("id", { count: "exact", head: true }).is("deleted_at", null)
    .eq("cotizacion_id", cotizacionId);
  if (error) {
    reportCaughtError(error, { feature: "cotizacion", op: "tiene_costos_cargados" }, {
      cotizacion_id: cotizacionId,
    });
    throw new CandadoCostosNoVerificableError(error);
  }
  return (count ?? 0) > 0;
}
