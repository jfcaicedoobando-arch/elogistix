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
    code: "LC_CONFLICTO_CONCURRENCIA",
    message: "La factura cambió desde que la revisaste. Cierra este diálogo, recarga y revisa los datos actuales antes de decidir.",
    matches: (raw, code) => code === "PT409" || code === "40001" || raw.includes("lc_conflicto_concurrencia"),
  },
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
  // Fase O — validaciones de cuadre y consistencia.
  {
    code: "LC_CXP_SIN_CONCEPTOS",
    message: "Captura los conceptos de la factura antes de aprobar.",
    matches: (raw) => raw.includes("lc_cxp_sin_conceptos"),
  },
  {
    code: "LC_CXP_DESCUADRE",
    message: "Los conceptos capturados no cuadran con el subtotal de la factura. Revisa la captura.",
    matches: (raw) => raw.includes("lc_cxp_descuadre"),
  },
  {
    code: "LC_CXP_EMBARQUE_CANCELADO",
    message: "El embarque asociado está cancelado. No se puede aprobar esta factura.",
    matches: (raw) => raw.includes("lc_cxp_embarque_cancelado"),
  },
  {
    code: "LC_CXP_EMBARQUE_ORG_MISMATCH",
    message: "El embarque asociado pertenece a otra organización.",
    matches: (raw) => raw.includes("lc_cxp_embarque_org_mismatch"),
  },
  {
    code: "LC_CXP_EMBARQUE_NO_EXISTE",
    message: "El embarque asociado no existe.",
    matches: (raw) => raw.includes("lc_cxp_embarque_no_existe"),
  },
  // Q-04 — segregación de funciones (SOD): la RPC rechaza a tesorero y a
  // quien capturó la factura para evitar auto-aprobación.
  {
    code: "LC_SOD_VIOLATION",
    message:
      "No puedes aprobar esta factura porque tú la capturaste (o tu rol es de tesorería). Pídele la aprobación a un administrador de la organización o a otra persona de contabilidad. Sí puedes rechazarla.",
    matches: (raw) => raw.includes("lc_sod_violation"),
  },
  // v13.493.0 — el rechazo cancela la factura y libera el embarque, por eso no
  // se permite si ya hay pagos aplicados.
  {
    code: "LC_CXP_RECHAZO_CON_PAGOS",
    message:
      "Esta factura ya tiene pagos aplicados. Anula o reversa los pagos antes de rechazarla.",
    matches: (raw) => raw.includes("lc_cxp_rechazo_con_pagos"),
  },
  {


    code: "LC_CXP_UUID_NO_VERIFICADO",
    message: "Verifica el UUID en el SAT antes de aprobar. Si es un proveedor internacional, quita el UUID fiscal desde el detalle de la factura.",
    matches: (raw) => raw.includes("lc_cxp_uuid_no_verificado"),
  },
  // Ola 4 (H2) — respaldo mínimo: sin embarque ni costos acordados vinculados.
  {
    code: "LC_CXP_SIN_RESPALDO_MONTO",
    message:
      "Esta factura es un costo de embarque y excede el monto que puede aprobarse sin liga. Vincúlala al embarque o a sus conceptos de costo. Si en realidad es un gasto de administración o de ventas, cámbiale la categoría; el monto máximo se ajusta en Configuración → Compras.",
    matches: (raw) => raw.includes("lc_cxp_sin_respaldo_monto"),
  },
  {
    code: "LC_CXP_SIN_RESPALDO",
    message:
      "Esta factura no está ligada a un embarque ni a costos acordados. Escribe la justificación del gasto (mínimo 10 caracteres) para poder aprobarla.",
    matches: (raw) => raw.includes("lc_cxp_sin_respaldo"),
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
export function mapApiError(error: { message?: string; code?: string; details?: string | null }): AprobacionFacturaError {
  const raw = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  const rule = ERROR_RULES.find((r) => r.matches(raw, code));
  if (rule) return new AprobacionFacturaError(rule.code, rule.message);
  return new AprobacionFacturaError("UNKNOWN", error.message || "Ocurrió un error inesperado al procesar la factura.");
}
