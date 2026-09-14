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
 *
 * v13.823.392 (Auditoría cotización→embarque #1): la cuenta directa sobre
 * `cotizacion_costos` estaba filtrada por RLS para los roles que pueden
 * convertir pero no ven importes (coordinador_logistico, operador): devolvía
 * `count = 0` sin error y producía un falso "no tiene costos cargados". Ahora
 * preguntamos a `cotizacion_tiene_costos`, que responde sólo sí/no acotado a la
 * organización activa y no expone montos.
 */
export async function tieneCostosCargados(cotizacionId: string): Promise<boolean> {
  // SAFE-CAST: RPC nueva; el contrato (boolean) se valida abajo.
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(
    "cotizacion_tiene_costos",
    { p_cotizacion_id: cotizacionId },
  );
  if (error) {
    reportCaughtError(error, { feature: "cotizacion", op: "tiene_costos_cargados" }, {
      cotizacion_id: cotizacionId,
    });
    throw new CandadoCostosNoVerificableError(error);
  }
  return data === true;
}
