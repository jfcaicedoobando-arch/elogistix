import { supabase } from "@/integrations/supabase/client";
import type { TraspasoDetalle } from "@/features/tesoreria/domain/traspasoDetalle";

/** Lectura bajo RLS; no pide una factura ni ejecuta acciones de conciliación. */
export async function fetchTraspasoDetalle(id: string): Promise<TraspasoDetalle> {
  const { data, error } = await supabase.from("traspasos_bancarios")
    .select("id,folio,fecha,cuenta_origen_id,cuenta_destino_id,moneda_origen,moneda_destino,monto_origen,monto_destino,comision,tipo_cambio,concepto,referencia,estado,origen:cuentas_bancarias!traspasos_bancarios_cuenta_origen_id_fkey(id,alias,banco,moneda),destino:cuentas_bancarias!traspasos_bancarios_cuenta_destino_id_fkey(id,alias,banco,moneda)")
    .eq("id", id).is("deleted_at", null).single();
  if (error) throw error;
  const { data: movimientos, error: errorMovimientos } = await supabase.from("bbva_movimientos")
    .select("id,fecha,cuenta_bancaria_id,cargo,abono,hash_dedupe,estado_conciliacion")
    .eq("traspaso_id", id).is("deleted_at", null).order("id");
  if (errorMovimientos) throw errorMovimientos;
  return { traspaso: data, origen: data.origen, destino: data.destino, movimientos: movimientos ?? [] };
}
