/**
 * Aprobación / rechazo de facturas de proveedor.
 * Wrapper de la RPC `aprobar_factura_proveedor` (SECURITY DEFINER con check de rol).
 *
 * v13.177.0 — Validaciones completas de entrada y mapeo de errores del API a
 * mensajes en español mexicano para el usuario final.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EstadoAprobacion = "pendiente" | "aprobada" | "rechazada";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MOTIVO_RECHAZO_MIN = 3;
export const MOTIVO_RECHAZO_MAX = 500;

export class AprobacionFacturaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AprobacionFacturaError";
    this.code = code;
  }
}

interface RuleMatch {
  code: string;
  message: string;
  matches: (raw: string, code: string) => boolean;
}

const ERROR_RULES: readonly RuleMatch[] = [
  {
    code: "SESSION_EXPIRED",
    message: "Tu sesión expiró. Inicia sesión de nuevo para continuar.",
    matches: (raw, code) => code === "PGRST301" || raw.includes("jwt") || raw.includes("expired"),
  },
  {
    code: "FORBIDDEN",
    message: "No tienes permisos para aprobar o rechazar facturas.",
    matches: (raw, code) =>
      code === "42501" || raw.includes("permission") || raw.includes("no_role") || raw.includes("not authorized"),
  },
  {
    code: "NOT_FOUND",
    message: "La factura ya no existe o fue eliminada.",
    matches: (raw, code) => code === "PGRST116" || raw.includes("not_found") || raw.includes("no rows"),
  },
  {
    code: "INVALID_STATE",
    message: "Esta factura ya fue procesada. Recarga la página para ver su estado actual.",
    matches: (raw) => raw.includes("already_approved") || raw.includes("already_rejected") || raw.includes("estado"),
  },
  {
    code: "NETWORK",
    message: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
    matches: (raw) => raw.includes("network") || raw.includes("fetch"),
  },
];

/** Traduce un error crudo de Supabase/PostgREST a un mensaje amigable. */
function mapApiError(error: { message?: string; code?: string; details?: string | null }): AprobacionFacturaError {
  const raw = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  const rule = ERROR_RULES.find((r) => r.matches(raw, code));
  if (rule) return new AprobacionFacturaError(rule.code, rule.message);
  return new AprobacionFacturaError("UNKNOWN", error.message || "Ocurrió un error inesperado al procesar la factura.");
}

export async function aprobarFacturaProveedor(
  id: string,
  aprobar: boolean,
  motivo?: string,
): Promise<Tables<"proveedor_facturas">> {
  // — Validaciones de entrada —
  if (!id || typeof id !== "string" || !UUID_RE.test(id)) {
    throw new AprobacionFacturaError("INVALID_ID", "Identificador de factura inválido.");
  }

  let motivoLimpio: string | undefined;
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
  }

  const { data, error } = await supabase.rpc("aprobar_factura_proveedor", {
    p_id: id,
    p_aprobar: aprobar,
    p_motivo: motivoLimpio,
  });
  if (error) throw mapApiError(error);
  if (!data) {
    throw new AprobacionFacturaError("NOT_FOUND", "La factura ya no existe o fue eliminada.");
  }
  // SAFE-CAST: la RPC retorna el row completo de proveedor_facturas; Supabase tipa el `data` como genérico.
  return data as unknown as Tables<"proveedor_facturas">;
}
