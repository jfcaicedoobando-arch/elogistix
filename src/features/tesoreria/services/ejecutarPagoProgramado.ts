/**
 * Q-15.2 · Ejecución transaccional de un pago programado: descuenta el saldo
 * de la cuenta bancaria, registra el movimiento bancario y aplica el pago a
 * la factura de proveedor vía RPC `ejecutar_pago_programado` (SECURITY DEFINER).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface EjecutarPagoProgramadoInput {
  facturaId: string;
  cuentaBancariaId: string;
  fecha: string;
  monto: number;
  metodoPago?: string;
  referencia?: string;
  /** Datos sólo para bitácora — no viajan a la RPC. */
  moneda?: string;
  proveedorNombre?: string | null;
}

export interface EjecutarPagoProgramadoResultado {
  pago_id: string;
  movimiento_id: string;
  saldo_cuenta_restante: number;
}

export async function ejecutarPagoProgramado(
  input: EjecutarPagoProgramadoInput,
): Promise<EjecutarPagoProgramadoResultado> {
  const { data, error } = await supabase.rpc("ejecutar_pago_programado", {
    p_factura_id: input.facturaId,
    p_cuenta_bancaria_id: input.cuentaBancariaId,
    p_fecha: input.fecha,
    p_monto: input.monto,
    p_metodo_pago: input.metodoPago ?? "Transferencia",
    p_referencia: input.referencia ?? "",
  });
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
      cuenta_bancaria_id: input.cuentaBancariaId,
      proveedor_nombre: input.proveedorNombre ?? null,
      metodo_pago: input.metodoPago ?? "Transferencia",
      saldo_cuenta_restante: resultado.saldo_cuenta_restante,
    },
  });
  return resultado;
}
