/**
 * Edición de un pago a proveedor ya registrado (v13.395.0).
 *
 * Mantiene la coherencia de tesorería: el movimiento bancario vinculado se
 * regenera con los datos nuevos (o se da de baja si el pago dejó de salir de
 * una cuenta) y se deja rastro en la bitácora.
 */
import { supabase } from "@/integrations/supabase/client";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import { registrarActividad } from "@/services/bitacora/registrar";
import { detallesPagoEditado } from "./pagoProveedorBitacora";
import type { PagoProveedor } from "./pagosProveedorTypes";

export interface ActualizarPagoProveedorInput {
  id: string;
  proveedor_factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: PagoProveedor["moneda"];
  /** TC MXN por 1 USD; `null` cuando no aplica. Debe ser > 0 si se envía. */
  tipo_cambio_usd: number | null;
  metodo_pago: string;
  referencia?: string;
  cuenta_bancaria_id?: string | null;
  notas?: string;
  diferencia_cambiaria_mxn?: number | null;
  /**
   * H5 (Ola 4): bloqueo optimista. `updated_at` leído al abrir el modal; si
   * otro usuario ya editó el pago, se avisa en vez de pisar su cambio.
   */
  expectedUpdatedAt?: string | null;
}

async function leerPagoActual(id: string) {
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .select("id, organization_id, monto, moneda, cuenta_bancaria_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.deleted_at) {
    throw Object.assign(new Error("El pago ya no existe o fue eliminado."), { code: "NOT_FOUND" });
  }
  return data;
}

export async function actualizarPagoProveedor(
  input: ActualizarPagoProveedorInput,
  _userId: string | null,
): Promise<void> {
  const actual = await leerPagoActual(input.id);

  const tc = input.tipo_cambio_usd && input.tipo_cambio_usd > 0 ? input.tipo_cambio_usd : null;

  // D5 (v13.823.382): una sola transacción en BD. Antes eran tres llamadas
  // (actualizar pago → borrar movimiento → crear movimiento) y un fallo dejaba
  // la factura editada sin salida bancaria, o con la salida vieja.
  const { data, error } = await supabase.rpc("actualizar_pago_proveedor_atomico", {
    p_pago_id: input.id,
    p_fecha_pago: input.fecha_pago,
    p_monto: input.monto,
    p_moneda: input.moneda,
    // SAFE-CAST: el argumento admite NULL en BD (NULLIF sobre COALESCE).
    p_tipo_cambio_usd: tc as number,
    p_metodo_pago: input.metodo_pago,
    p_referencia: input.referencia ?? "",
    p_cuenta_bancaria_id: input.cuenta_bancaria_id ?? undefined,
    p_notas: input.notas ?? "",
    p_diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? undefined,
    p_expected_updated_at: input.expectedUpdatedAt ?? undefined,
  });
  if (error) {
    if (error.message.includes("LC_CONFLICTO_CONCURRENCIA")) throw conflictoConcurrenciaError();
    throw error;
  }
  // SAFE-CAST: contrato jsonb de la RPC (movimiento_creado).
  const movimientoCreado = ((data ?? {}) as { movimiento_creado?: boolean }).movimiento_creado === true;

  await registrarActividad({
    modulo: "cxp",
    accion: "editar_pago",
    entidadId: input.proveedor_factura_id,
    detalles: detallesPagoEditado({
      pagoId: input.id,
      monto: input.monto,
      moneda: input.moneda,
      metodoPago: input.metodo_pago,
      referencia: input.referencia,
      cuentaBancariaId: input.cuenta_bancaria_id ?? null,
      tipoCambioUsd: tc,
      movimientoCreado,
      montoAnterior: Number(actual.monto),
      monedaAnterior: actual.moneda,
      cuentaAnteriorId: actual.cuenta_bancaria_id ?? null,
    }),
  });
}
