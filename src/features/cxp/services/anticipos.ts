/**
 * Servicio de anticipos a proveedor (Fase P.1 — v13.301.87).
 *
 * Wrappers seguros para las RPCs:
 *  - `registrar_anticipo_proveedor`
 *  - `aplicar_anticipo_a_factura`
 *  - `cancelar_anticipo_proveedor`
 *
 * Validaciones locales de entrada antes de tocar la red, y mapeo de errores
 * de PostgREST/Postgres a mensajes accionables en español mexicano.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Anticipo = Tables<"anticipos_proveedor">;
export type AnticipoAplicacion = Tables<"anticipos_aplicaciones">;
export type MonedaAnticipo = "MXN" | "USD" | "EUR";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  {
    code: "LC_ANTICIPO_SIN_ROL",
    message: "Sólo administradores, contabilidad o tesorería pueden gestionar anticipos.",
    matches: (raw) => raw.includes("lc_anticipo_sin_rol"),
  },
  {
    code: "LC_ANTICIPO_MONTO_INVALIDO",
    message: "El monto del anticipo debe ser mayor a cero.",
    matches: (raw) => raw.includes("lc_anticipo_monto_invalido"),
  },
  {
    code: "LC_ANTICIPO_NO_EXISTE",
    message: "El anticipo no existe o fue eliminado.",
    matches: (raw) => raw.includes("lc_anticipo_no_existe"),
  },
  {
    code: "LC_ANTICIPO_YA_CANCELADO",
    message: "El anticipo ya está cancelado.",
    matches: (raw) => raw.includes("lc_anticipo_ya_cancelado"),
  },
  {
    code: "LC_ANTICIPO_SIN_SALDO",
    message: "El saldo disponible del anticipo no alcanza para aplicar ese monto.",
    matches: (raw) => raw.includes("lc_anticipo_sin_saldo"),
  },
  {
    code: "LC_ANTICIPO_FACTURA_INVALIDA",
    message: "La factura debe existir y estar aprobada antes de aplicar un anticipo.",
    matches: (raw) => raw.includes("lc_anticipo_factura_invalida"),
  },
  {
    code: "LC_ANTICIPO_PROVEEDOR_MISMATCH",
    message: "El anticipo y la factura pertenecen a proveedores distintos.",
    matches: (raw) => raw.includes("lc_anticipo_proveedor_mismatch"),
  },
  {
    code: "LC_ANTICIPO_ORG_MISMATCH",
    message: "El anticipo y la factura pertenecen a organizaciones distintas.",
    matches: (raw) => raw.includes("lc_anticipo_org_mismatch"),
  },
  {
    code: "LC_ANTICIPO_CON_APLICACIONES",
    message: "No se puede cancelar un anticipo con aplicaciones vivas. Reversa las aplicaciones primero.",
    matches: (raw) => raw.includes("lc_anticipo_con_aplicaciones"),
  },
  {
    code: "LC_ANTICIPO_PROVEEDOR_NO_EXISTE",
    message: "El proveedor no existe.",
    matches: (raw) => raw.includes("lc_anticipo_proveedor_no_existe"),
  },
  {
    code: "LC_ANTICIPO_PROVEEDOR_OTRA_ORG",
    message: "El proveedor pertenece a otra organización.",
    matches: (raw) => raw.includes("lc_anticipo_proveedor_otra_org"),
  },
  {
    code: "LC_ANTICIPO_MOTIVO_REQUERIDO",
    message: "Indica un motivo de cancelación de al menos 3 caracteres.",
    matches: (raw) => raw.includes("lc_anticipo_motivo_requerido"),
  },
  {
    code: "LC_PAGO_TC_REQUERIDO",
    message: "Falta el tipo de cambio para convertir el anticipo a la moneda de la factura.",
    matches: (raw) => raw.includes("lc_pago_tc_requerido"),
  },
  {
    code: "LC_PAGO_CRUCE_NO_SOPORTADO",
    message: "Cruce de monedas no soportado (EUR). Usa un anticipo en la misma moneda que la factura.",
    matches: (raw) => raw.includes("lc_pago_cruce_no_soportado"),
  },
];

function mapApiError(error: { message?: string; code?: string }): AnticipoError {
  const raw = (error.message ?? "").toLowerCase();
  const rule = ERROR_RULES.find((r) => r.matches(raw));
  if (rule) return new AnticipoError(rule.code, rule.message);
  return new AnticipoError("UNKNOWN", error.message || "Ocurrió un error inesperado al procesar el anticipo.");
}

function assertUuid(id: string, code: string): void {
  if (!id || typeof id !== "string" || !UUID_RE.test(id)) {
    throw new AnticipoError(code, "Identificador inválido.");
  }
}

export interface RegistrarAnticipoInput {
  proveedorId: string;
  monto: number;
  moneda: MonedaAnticipo;
  fechaAnticipo?: string;
  tipoCambioUsd?: number | null;
  metodoPago?: string;
  referencia?: string;
  cuentaBancariaId?: string | null;
  notas?: string;
}

export async function registrarAnticipo(input: RegistrarAnticipoInput): Promise<Anticipo> {
  assertUuid(input.proveedorId, "INVALID_ID");
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new AnticipoError("LC_ANTICIPO_MONTO_INVALIDO", "El monto del anticipo debe ser mayor a cero.");
  }
  const { data, error } = await supabase.rpc("registrar_anticipo_proveedor", {
    p_proveedor_id: input.proveedorId,
    p_monto: input.monto,
    p_moneda: input.moneda,
    p_fecha_anticipo: input.fechaAnticipo,
    p_tipo_cambio_usd: input.tipoCambioUsd ?? undefined,
    p_metodo_pago: input.metodoPago ?? undefined,
    p_referencia: input.referencia ?? undefined,
    p_cuenta_bancaria_id: input.cuentaBancariaId ?? undefined,
    p_notas: input.notas ?? undefined,
  });
  if (error) throw mapApiError(error);
  // SAFE-CAST: la RPC retorna el row completo tipado en el server.
  return data as unknown as Anticipo;
}

export async function aplicarAnticipo(
  anticipoId: string,
  facturaId: string,
  monto: number,
  fechaAplicacion?: string,
): Promise<AnticipoAplicacion> {
  assertUuid(anticipoId, "INVALID_ID");
  assertUuid(facturaId, "INVALID_ID");
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new AnticipoError("LC_ANTICIPO_MONTO_INVALIDO", "El monto a aplicar debe ser mayor a cero.");
  }
  const { data, error } = await supabase.rpc("aplicar_anticipo_a_factura", {
    p_anticipo_id: anticipoId,
    p_factura_id: facturaId,
    p_monto: monto,
    p_fecha_aplicacion: fechaAplicacion,
  });
  if (error) throw mapApiError(error);
  return data as unknown as AnticipoAplicacion;
}

export async function cancelarAnticipo(id: string, motivo: string): Promise<Anticipo> {
  assertUuid(id, "INVALID_ID");
  const limpio = (motivo ?? "").trim();
  if (limpio.length < 3) {
    throw new AnticipoError(
      "LC_ANTICIPO_MOTIVO_REQUERIDO",
      "Indica un motivo de cancelación de al menos 3 caracteres.",
    );
  }
  const { data, error } = await supabase.rpc("cancelar_anticipo_proveedor", {
    p_id: id,
    p_motivo: limpio,
  });
  if (error) throw mapApiError(error);
  return data as unknown as Anticipo;
}

export async function listAnticiposPorProveedor(proveedorId: string): Promise<Anticipo[]> {
  assertUuid(proveedorId, "INVALID_ID");
  const { data, error } = await supabase
    .from("anticipos_proveedor")
    .select("*")
    .eq("proveedor_id", proveedorId)
    .is("deleted_at", null)
    .order("fecha_anticipo", { ascending: false });
  if (error) throw mapApiError(error);
  return (data ?? []) as Anticipo[];
}
