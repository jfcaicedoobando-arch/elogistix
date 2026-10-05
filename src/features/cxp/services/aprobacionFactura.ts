/**
 * Aprobación / rechazo de facturas de proveedor.
 * Wrapper de la RPC `aprobar_factura_proveedor` (SECURITY DEFINER con check de rol).
 *
 * v13.177.0 — Validaciones completas de entrada y mapeo de errores del API a
 * mensajes en español mexicano para el usuario final.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AprobacionFacturaError, mapApiError } from "./aprobacionFactura.errores";
export { AprobacionFacturaError } from "./aprobacionFactura.errores";

export type EstadoAprobacion = "pendiente" | "aprobada" | "rechazada";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MOTIVO_RECHAZO_MIN = 3;
export const MOTIVO_RECHAZO_MAX = 500;
/**
 * Ola 4 (H2): mínimo de caracteres de la justificación cuando la factura no
 * está ligada a un embarque ni a costos acordados (lo exige la base de datos).
 */
export const JUSTIFICACION_SIN_VINCULO_MIN = 10;


/**
 * Aprueba o rechaza una factura de proveedor.
 *
 * `motivo` cumple dos papeles según la acción (así lo espera la RPC):
 * - al **rechazar**, es el motivo del rechazo (obligatorio);
 * - al **aprobar**, es la justificación del gasto cuando la factura no está
 *   ligada a un embarque ni a costos acordados (Ola 4 · H2).
 */
export async function aprobarFacturaProveedor(
  id: string,
  aprobar: boolean,
  motivo?: string,
  expectedUpdatedAt?: string | null,
): Promise<Tables<"proveedor_facturas">> {
  // — Validaciones de entrada —
  if (!id || typeof id !== "string" || !UUID_RE.test(id)) {
    throw new AprobacionFacturaError("INVALID_ID", "Identificador de factura inválido.");
  }

  let motivoLimpio: string | undefined = (motivo ?? "").trim() || undefined;
  if (!aprobar) {
    motivoLimpio = (motivo ?? "").trim();
    if (motivoLimpio.length < MOTIVO_RECHAZO_MIN) {
      throw new AprobacionFacturaError(
        "MOTIVO_REQUIRED",
        `Debes indicar un motivo de al menos ${MOTIVO_RECHAZO_MIN} caracteres para rechazar la factura.`,
      );
    }
    if (motivoLimpio.length > MOTIVO_RECHAZO_MAX) {
      throw new AprobacionFacturaError(
        "MOTIVO_TOO_LONG",
        `El motivo no puede exceder ${MOTIVO_RECHAZO_MAX} caracteres.`,
      );
    }
  } else if (motivoLimpio && motivoLimpio.length > MOTIVO_RECHAZO_MAX) {
    throw new AprobacionFacturaError(
      "MOTIVO_TOO_LONG",
      `La justificación no puede exceder ${MOTIVO_RECHAZO_MAX} caracteres.`,
    );
  }


  if (!expectedUpdatedAt) {
    throw new AprobacionFacturaError("LC_CONFLICTO_CONCURRENCIA", "Recarga y revisa la factura antes de aprobarla o rechazarla.");
  }
  const args = {
    p_id: id,
    p_aprobar: aprobar,
    p_motivo: motivoLimpio,
    p_expected_updated_at: expectedUpdatedAt,
  };
  const { data, error } = await supabase.rpc("aprobar_factura_proveedor", args);
  if (error) throw mapApiError(error);
  if (!data) {
    throw new AprobacionFacturaError("NOT_FOUND", "La factura ya no existe o fue eliminada.");
  }
  // SAFE-CAST: la RPC retorna el row completo de proveedor_facturas; Supabase tipa el `data` como genérico.
  return data as unknown as Tables<"proveedor_facturas">;
}
