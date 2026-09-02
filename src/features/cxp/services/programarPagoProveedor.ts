/**
 * Servicio Tesorería/CxP — programación de pago de una factura de proveedor.
 *
 * v13.823.32: el UPDATE directo a `proveedor_facturas` estaba bloqueado por RLS
 * justo para el rol `tesorero` (dueño funcional de la pantalla) y en cambio lo
 * permitía a roles que no deberían programar. Ahora se usa la RPC mínima
 * `programar_pago_proveedor`, que valida organización de la factura + roles
 * exactos (admin, admin_org, tesorero, contador, super_admin).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

/** Programa (o desprograma con `null`) la fecha en que Tesorería ejecutará el pago. */
export async function programarPagoProveedor(
  facturaId: string,
  fecha: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("programar_pago_proveedor", {
    p_factura_id: facturaId,
    p_fecha: fecha,
  });
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
