/**
 * Q-15.2 · Ejecución transaccional de un pago programado: descuenta el saldo
 * de la cuenta bancaria, registra el movimiento bancario y aplica el pago a
 * la factura de proveedor vía RPC `ejecutar_pago_programado` (SECURITY DEFINER).
 */
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { esPagoEfectivo } from "@/features/tesoreria/domain/conciliacionPago";
import { erroresPagoProgramado } from "@/features/tesoreria/domain/pagoProgramadoValidacion";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface EjecutarPagoProgramadoInput {
  facturaId: string;
  cuentaBancariaId: string | null;
  /** MXN por unidad de moneda del pago; obligatorio fuera de MXN. */
  tipoCambio?: number | null;
  fecha: string;
  monto: number;
  metodoPago?: string;
  referencia?: string;
  /**
   * Ola 1 (major release) · idempotencia: llave estable del submit. Con ella
   * un doble clic o un reintento por red lenta devuelve el pago original en
   * lugar de registrar el cargo dos veces (`idempotency_claim` en la RPC).
   */
  requestId?: string;
  /** Moneda de la factura para preflight; la RPC obtiene la moneda bajo lock. */
  moneda?: string;
  proveedorNombre?: string | null;
}

export interface EjecutarPagoProgramadoResultado {
  pago_id: string;
  movimiento_id: string | null;
  saldo_cuenta_restante: number | null;
}

export async function ejecutarPagoProgramado(
  input: EjecutarPagoProgramadoInput,
): Promise<EjecutarPagoProgramadoResultado> {
  const metodoPago = input.metodoPago ?? "Transferencia";
  const errores = erroresPagoProgramado({ ...input, metodoPago }, { moneda: input.moneda ?? "MXN" });
  if (Object.keys(errores).length > 0) throw new Error(Object.values(errores).join(" "));
  const cuentaBancariaId = esPagoEfectivo(metodoPago) ? null : input.cuentaBancariaId;
  type Args = Database["public"]["Functions"]["ejecutar_pago_programado"]["Args"];
  const args: Omit<Args, "p_cuenta_bancaria_id"> & { p_cuenta_bancaria_id: string | null } = {
    p_factura_id: input.facturaId,
    p_cuenta_bancaria_id: cuentaBancariaId,
    p_tipo_cambio: input.tipoCambio ?? undefined,
    p_fecha: input.fecha,
    p_monto: input.monto,
    p_metodo_pago: input.metodoPago ?? "Transferencia",
    p_referencia: input.referencia ?? "",
    p_request_id: input.requestId ?? undefined,
  };
  // SAFE-CAST: typegen omite la nulabilidad de argumentos SQL requeridos. La
  // migración audit103_108 acepta NULL sólo para efectivo; el preflight exige
  // banco en los demás medios. Se conserva NULL en JSON, no se omite el argumento.
  const { data, error } = await supabase.rpc("ejecutar_pago_programado", args as Args);
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve `Json` en los tipos generados; el shape real lo
  // fija el contrato de `ejecutar_pago_programado` (ver mem://principles/safe-cast).
  const resultado = data as unknown as EjecutarPagoProgramadoResultado;
  if (!resultado) return resultado;
  await registrarActividad({
    modulo: "tesoreria",
    accion: "Ejecutó pago programado",
    entidadId: resultado.pago_id,
    entidadNombre: input.proveedorNombre ?? undefined,
    detalles: {
      factura_id: input.facturaId,
      monto: input.monto,
      moneda: input.moneda ?? null,
      cuenta_bancaria_id: cuentaBancariaId,
      tipo_cambio: input.tipoCambio ?? null,
      proveedor_nombre: input.proveedorNombre ?? null,
      metodo_pago: input.metodoPago ?? "Transferencia",
      saldo_cuenta_restante: resultado.saldo_cuenta_restante,
    },
  });
  return resultado;
}
