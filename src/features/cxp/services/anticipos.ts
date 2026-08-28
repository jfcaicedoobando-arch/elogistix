/**
 * Servicio de anticipos a proveedor (Fase P.1 — v13.301.87).
 *
 * Wrappers seguros para las RPCs:
 *  - `registrar_anticipo_proveedor`
 *  - `aplicar_anticipo_a_factura`
 *  - `cancelar_anticipo_proveedor`
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AnticipoError, assertUuid, mapApiError } from "./anticiposErrors";
import type { Moneda } from "@/types/db";

export { AnticipoError } from "./anticiposErrors";
export type Anticipo = Tables<"anticipos_proveedor">;
export type AnticipoAplicacion = Tables<"anticipos_aplicaciones">;
export type MonedaAnticipo = Moneda;

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
  /** Embarque (expediente) al que corresponde el anticipo. Opcional. */
  embarqueId?: string | null;
  /** Ola 2 · O2.5 — llave de idempotencia: evita anticipos y cargos duplicados. */
  requestId?: string;
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
    p_embarque_id: input.embarqueId ?? undefined,
    p_request_id: input.requestId ?? undefined,
  });
  if (error) throw mapApiError(error);
  // SAFE-CAST: la RPC retorna el row completo tipado en el server.
  return data as unknown as Anticipo;
}

/**
 * Vincula (o desvincula, pasando `null`) el embarque de un anticipo existente.
 * Roles permitidos en el servidor: admin/admin_org/super_admin/contador/tesorero.
 */
export async function vincularAnticipoEmbarque(
  anticipoId: string,
  embarqueId: string | null,
): Promise<Anticipo> {
  assertUuid(anticipoId, "INVALID_ID");
  if (embarqueId) assertUuid(embarqueId, "INVALID_ID");
  const { data, error } = await supabase.rpc("vincular_anticipo_embarque", {
    p_id: anticipoId,
    p_embarque_id: embarqueId ?? undefined,
  });
  if (error) throw mapApiError(error);
  // SAFE-CAST: RPC devuelve fila de anticipos_proveedor (validado por schema DB).
  return data as unknown as Anticipo;
}


export async function aplicarAnticipo(
  anticipoId: string,
  facturaId: string,
  monto: number,
  fechaAplicacion?: string,
  /** BL-08: llave de idempotencia por intento de submit (dedupe server-side). */
  requestId?: string,
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
    p_request_id: requestId ?? undefined,
  });
  if (error) throw mapApiError(error);
  // SAFE-CAST: RPC devuelve fila de anticipos_aplicaciones (validado por schema DB).
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
  // SAFE-CAST: RPC devuelve fila de anticipos_proveedor (validado por schema DB).
  return data as unknown as Anticipo;
}

export interface DevolverAnticipoInput {
  id: string;
  /** Monto que el proveedor regresó, en la moneda del anticipo. */
  monto: number;
  /** Fecha del depósito de regreso (ISO YYYY-MM-DD). */
  fecha: string;
  /** Cuenta bancaria donde entró el dinero. */
  cuentaBancariaId: string;
  referencia?: string | null;
  motivo: string;
}

/**
 * N13 · devolución simple: el proveedor nos regresó el dinero.
 *
 * No es lo mismo que cancelar (eso es "lo registré por error" y borra el
 * movimiento bancario): aquí el pago sí ocurrió, así que el anticipo queda
 * `devuelto` con saldo cero y el reembolso entra al banco por conciliar.
 */
export async function devolverAnticipo(input: DevolverAnticipoInput): Promise<Anticipo> {
  assertUuid(input.id, "INVALID_ID");
  assertUuid(input.cuentaBancariaId, "INVALID_ID");
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new AnticipoError("LC_ANTICIPO_MONTO_INVALIDO", "El monto devuelto debe ser mayor a cero.");
  }
  if (!input.fecha) {
    throw new AnticipoError("LC_ANTICIPO_FECHA_REQUERIDA", "Indica la fecha de la devolución.");
  }
  const motivo = (input.motivo ?? "").trim();
  if (motivo.length < 3) {
    throw new AnticipoError(
      "LC_ANTICIPO_MOTIVO_REQUERIDO",
      "Indica el motivo de la devolución (al menos 3 caracteres).",
    );
  }
  const { data, error } = await supabase.rpc("devolver_anticipo_proveedor", {
    p_id: input.id,
    p_monto: input.monto,
    p_fecha: input.fecha,
    p_cuenta_bancaria_id: input.cuentaBancariaId,
    p_referencia: input.referencia?.trim() || undefined,
    p_motivo: motivo,
  });
  if (error) throw mapApiError(error);
  // SAFE-CAST: RPC devuelve fila de anticipos_proveedor (validado por schema DB).
  return data as unknown as Anticipo;
}
