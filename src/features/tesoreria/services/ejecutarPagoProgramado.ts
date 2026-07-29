/**
 * Q-15.2 · Ejecución transaccional de un pago programado: descuenta el saldo
 * de la cuenta bancaria, registra el movimiento bancario y aplica el pago a
 * la factura de proveedor vía RPC `ejecutar_pago_programado` (SECURITY DEFINER).
 */
import { supabase } from "@/integrations/supabase/client";

export interface EjecutarPagoProgramadoInput {
  facturaId: string;
  cuentaBancariaId: string;
  fecha: string;
  monto: number;
  metodoPago?: string;
  referencia?: string;
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
  return data as unknown as EjecutarPagoProgramadoResultado;
}
