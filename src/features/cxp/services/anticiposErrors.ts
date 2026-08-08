/**
 * Errores y mapeo del servicio de anticipos (Fase P.1).
 */

export class AnticipoError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AnticipoError";
    this.code = code;
  }
}

interface RuleMatch {
  code: string;
  message: string;
  matches: (raw: string) => boolean;
}

const ERROR_RULES: readonly RuleMatch[] = [
  { code: "LC_ANTICIPO_SIN_ROL", message: "Sólo administradores, contabilidad o tesorería pueden gestionar anticipos.", matches: (r) => r.includes("lc_anticipo_sin_rol") },
  { code: "LC_ANTICIPO_MONTO_INVALIDO", message: "El monto del anticipo debe ser mayor a cero.", matches: (r) => r.includes("lc_anticipo_monto_invalido") },
  { code: "LC_ANTICIPO_NO_EXISTE", message: "El anticipo no existe o fue eliminado.", matches: (r) => r.includes("lc_anticipo_no_existe") },
  { code: "LC_ANTICIPO_YA_CANCELADO", message: "El anticipo ya está cancelado.", matches: (r) => r.includes("lc_anticipo_ya_cancelado") },
  { code: "LC_ANTICIPO_SIN_SALDO", message: "El saldo disponible del anticipo no alcanza para aplicar ese monto.", matches: (r) => r.includes("lc_anticipo_sin_saldo") },
  { code: "LC_ANTICIPO_FACTURA_INVALIDA", message: "La factura debe existir y estar aprobada antes de aplicar un anticipo.", matches: (r) => r.includes("lc_anticipo_factura_invalida") },
  { code: "LC_ANTICIPO_PROVEEDOR_MISMATCH", message: "El anticipo y la factura pertenecen a proveedores distintos.", matches: (r) => r.includes("lc_anticipo_proveedor_mismatch") },
  { code: "LC_ANTICIPO_ORG_MISMATCH", message: "El anticipo y la factura pertenecen a organizaciones distintas.", matches: (r) => r.includes("lc_anticipo_org_mismatch") },
  { code: "LC_ANTICIPO_CON_APLICACIONES", message: "No se puede cancelar un anticipo con aplicaciones vivas. Reversa las aplicaciones primero.", matches: (r) => r.includes("lc_anticipo_con_aplicaciones") },
  { code: "LC_ANTICIPO_PROVEEDOR_NO_EXISTE", message: "El proveedor no existe.", matches: (r) => r.includes("lc_anticipo_proveedor_no_existe") },
  { code: "LC_ANTICIPO_PROVEEDOR_OTRA_ORG", message: "El proveedor pertenece a otra organización.", matches: (r) => r.includes("lc_anticipo_proveedor_otra_org") },
  { code: "LC_ANTICIPO_MOTIVO_REQUERIDO", message: "Indica un motivo de cancelación de al menos 3 caracteres.", matches: (r) => r.includes("lc_anticipo_motivo_requerido") },
  { code: "LC_ANTICIPO_EMBARQUE_INVALIDO", message: "El embarque no existe o pertenece a otra organización.", matches: (r) => r.includes("lc_anticipo_embarque_invalido") },
  { code: "LC_ANTICIPO_CANCELADO", message: "No se puede vincular un anticipo cancelado.", matches: (r) => r.includes("lc_anticipo_cancelado") },
  { code: "LC_ANTICIPO_OTRA_ORG", message: "El anticipo pertenece a otra organización.", matches: (r) => r.includes("lc_anticipo_otra_org") },

  { code: "LC_PAGO_TC_REQUERIDO", message: "Falta el tipo de cambio para convertir el anticipo a la moneda de la factura.", matches: (r) => r.includes("lc_pago_tc_requerido") },
  { code: "LC_PAGO_CRUCE_NO_SOPORTADO", message: "Cruce de monedas no soportado (EUR). Usa un anticipo en la misma moneda que la factura.", matches: (r) => r.includes("lc_pago_cruce_no_soportado") },
];

export function mapApiError(error: { message?: string; code?: string }): AnticipoError {
  const raw = (error.message ?? "").toLowerCase();
  const rule = ERROR_RULES.find((r) => r.matches(raw));
  if (rule) return new AnticipoError(rule.code, rule.message);
  return new AnticipoError("UNKNOWN", error.message || "Ocurrió un error inesperado al procesar el anticipo.");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string, code: string): void {
  if (!id || typeof id !== "string" || !UUID_RE.test(id)) {
    throw new AnticipoError(code, "Identificador inválido.");
  }
}
