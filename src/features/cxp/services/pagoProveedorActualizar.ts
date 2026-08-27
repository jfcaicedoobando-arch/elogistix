/**
 * Edición de un pago a proveedor ya registrado (v13.395.0).
 *
 * Mantiene la coherencia de tesorería: el movimiento bancario vinculado se
 * regenera con los datos nuevos (o se da de baja si el pago dejó de salir de
 * una cuenta) y se deja rastro en la bitácora.
 */
import { supabase } from "@/integrations/supabase/client";
import { primeraFila } from "@/lib/supabase/primeraFila";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import {
  crearMovimientoBancarioPago,
  eliminarMovimientoBancarioPago,
} from "./pagoProveedorMovimiento";
import { avisarMovimientoNoCreado } from "./pagoProveedorMovimientoAviso";
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
  userId: string | null,
): Promise<void> {
  const actual = await leerPagoActual(input.id);

  const tc = input.tipo_cambio_usd && input.tipo_cambio_usd > 0 ? input.tipo_cambio_usd : null;
  const payload: TablesUpdate<"pagos_proveedor"> = {
    fecha_pago: input.fecha_pago,
    monto: input.monto,
    moneda: input.moneda,
    tipo_cambio_usd: tc,
    metodo_pago: input.metodo_pago,
    referencia: input.referencia ?? "",
    cuenta_bancaria_id: input.cuenta_bancaria_id ?? null,
    notas: input.notas ?? "",
    diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? null,
  };

  let query = supabase
    .from("pagos_proveedor")
    .update(payload)
    .eq("id", input.id);
  if (input.expectedUpdatedAt) query = query.eq("updated_at", input.expectedUpdatedAt);
  const { data: filas, error } = await query.select("id");
  if (error) throw error;
  if (!primeraFila(filas)) throw conflictoConcurrenciaError();

  // El movimiento bancario anterior deja de ser válido: se da de baja y, si el
  // pago sigue saliendo de una cuenta, se genera de nuevo con los datos nuevos.
  await eliminarMovimientoBancarioPago(input.id, userId);
  let movimientoCreado = false;
  if (input.cuenta_bancaria_id) {
    movimientoCreado = avisarMovimientoNoCreado(await crearMovimientoBancarioPago({
      pagoId: input.id,
      organizationId: actual.organization_id,
      cuentaBancariaId: input.cuenta_bancaria_id,
      facturaId: input.proveedor_factura_id,
      fechaPago: input.fecha_pago,
      monto: input.monto,
      moneda: input.moneda,
      tipoCambioUsd: tc,
      referencia: input.referencia,
      userId,
    }));
  }

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
