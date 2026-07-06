/**
 * Servicio Tesorería/CxP — programación de pago de una factura de proveedor.
 * Sólo escribe `proveedor_facturas.fecha_programada_pago` (Ola 2 · Item 2).
 * v13.188.0
 */
import { supabase } from "@/integrations/supabase/client";

/** Programa (o desprograma con `null`) la fecha en que Tesorería ejecutará el pago. */
export async function programarPagoProveedor(
  facturaId: string,
  fecha: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("proveedor_facturas")
    .update({ fecha_programada_pago: fecha })
    .eq("id", facturaId);
  if (error) throw error;
}
