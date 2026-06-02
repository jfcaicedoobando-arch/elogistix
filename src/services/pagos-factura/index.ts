import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PagoFactura = Tables<"pagos_factura">;

export interface RegistrarPagoInput {
  factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: PagoFactura["moneda"];
  tipo_cambio: number;
  monto_aplicado_factura: number;
  forma_pago: string;
  referencia?: string;
  notas?: string;
  /**
   * Diferencia cambiaria en MXN. Aplica cuando la factura es USD/EUR y el
   * pago se recibe en MXN: monto MXN recibido − (monto_aplicado_factura × TC
   * de emisión). El UI calcula y manda el valor; default 0.
   */
  diferencia_cambiaria_mxn?: number;
}

export async function listarPagosFactura(facturaId: string): Promise<PagoFactura[]> {
  const { data, error } = await supabase
    .from("pagos_factura")
    .select("*")
    .eq("factura_id", facturaId)
    .order("fecha_pago", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function registrarPagoFactura(input: RegistrarPagoInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const created_by = userData.user?.id ?? null;
  const { error } = await supabase.from("pagos_factura").insert({
    factura_id: input.factura_id,
    fecha_pago: input.fecha_pago,
    monto: input.monto,
    moneda: input.moneda,
    tipo_cambio: input.tipo_cambio,
    monto_aplicado_factura: input.monto_aplicado_factura,
    forma_pago: input.forma_pago,
    referencia: input.referencia ?? "",
    notas: input.notas ?? "",
    diferencia_cambiaria_mxn: input.diferencia_cambiaria_mxn ?? 0,
    created_by,
  });
  if (error) throw error;
}

export async function eliminarPagoFactura(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("pagos_factura")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userData.user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
}
