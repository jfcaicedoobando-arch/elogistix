/**
 * Servicio Tesorería/CxP — programación de pago de una factura de proveedor.
 * Sólo escribe `proveedor_facturas.fecha_programada_pago` (Ola 2 · Item 2).
 * v13.188.0
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

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
  const { data: factura } = await supabase
    .from("proveedor_facturas")
    .select("folio_interno")
    .eq("id", facturaId)
    .maybeSingle();
  await registrarActividad({
    modulo: "cxp",
    accion: fecha ? "Programó pago de factura de proveedor" : "Desprogramó pago de factura de proveedor",
    entidadId: facturaId,
    entidadNombre: factura?.folio_interno ?? null,
    detalles: { fecha_programada_pago: fecha },
  });
}
