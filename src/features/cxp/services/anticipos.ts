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

export { AnticipoError } from "./anticiposErrors";
export type Anticipo = Tables<"anticipos_proveedor">;
export type AnticipoAplicacion = Tables<"anticipos_aplicaciones">;
export type MonedaAnticipo = "MXN" | "USD" | "EUR";

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
