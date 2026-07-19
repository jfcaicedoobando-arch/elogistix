/**
 * Errores y mapeo del servicio de garantías (Fase P.2 · v13.301.88).
 */

export class GarantiaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GarantiaError";
    this.code = code;
  }
}

interface RuleMatch {
  code: string;
  message: string;
  matches: (raw: string) => boolean;
}

const ERROR_RULES: readonly RuleMatch[] = [
  {
    code: "LC_GARANTIA_SIN_ROL",
    message: "Sólo administradores u operadores pueden actualizar garantías.",
    matches: (r) => r.includes("lc_garantia_sin_rol"),
  },
  {
    code: "LC_GARANTIA_TRANSICION_INVALIDA",
    message: "La transición de estado no está permitida (pendiente → depositado → liberado, o retenido).",
    matches: (r) => r.includes("lc_garantia_transicion_invalida"),
  },
  {
    code: "LC_GARANTIA_MONTO_CONGELADO",
    message: "No puedes modificar el monto una vez que la garantía está depositada, retenida o liberada.",
    matches: (r) => r.includes("lc_garantia_monto_congelado"),
  },
  {
    code: "LC_GARANTIA_FECHA_DEPOSITO_REQUERIDA",
    message: "Captura la fecha del depósito antes de marcarlo como depositado.",
    matches: (r) => r.includes("lc_garantia_fecha_deposito_requerida"),
  },
  {
    code: "LC_GARANTIA_MONTO_REQUERIDO",
    message: "Captura el monto del depósito (debe ser mayor a cero) antes de confirmarlo.",
    matches: (r) => r.includes("lc_garantia_monto_requerido"),
  },
  {
    code: "LC_GARANTIA_FECHA_LIBERACION_REQUERIDA",
    message: "Captura la fecha de liberación antes de marcar la garantía como liberada.",
    matches: (r) => r.includes("lc_garantia_fecha_liberacion_requerida"),
  },
  {
    code: "LC_GARANTIA_NO_ENCONTRADA",
    message: "La garantía ya no existe o fue eliminada.",
    matches: (r) => r.includes("lc_garantia_no_encontrada"),
  },
  {
    code: "LC_GARANTIA_ORG_MISMATCH",
    message: "Esta garantía pertenece a otra organización.",
    matches: (r) => r.includes("lc_garantia_org_mismatch"),
  },
];

export function mapApiError(error: { message?: string; code?: string }): GarantiaError {
  const raw = (error.message ?? "").toLowerCase();
  const rule = ERROR_RULES.find((r) => r.matches(raw));
  if (rule) return new GarantiaError(rule.code, rule.message);
  return new GarantiaError("UNKNOWN", error.message || "Ocurrió un error inesperado al actualizar la garantía.");
}
