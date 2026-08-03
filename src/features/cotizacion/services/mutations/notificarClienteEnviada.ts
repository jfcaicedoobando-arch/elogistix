/**
 * R6-FIX5 — Notificación al cliente cuando su cotización pasa a "Enviada".
 *
 * El portal del cliente lee `notificaciones_cliente`; antes nadie insertaba la
 * fila al enviar la cotización, así que la campana quedaba vacía.
 *
 * No lanza: la notificación es un efecto secundario y no debe revertir el
 * cambio de estado de la cotización.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export async function notificarClienteCotizacionEnviada(cotizacionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, cliente_id, organization_id")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (error || !data?.cliente_id || !data.organization_id) return false;

  const payload: TablesInsert<"notificaciones_cliente"> = {
    cliente_id: data.cliente_id,
    organization_id: data.organization_id,
    tipo: "cotizacion_enviada",
    titulo: `Cotización ${data.folio ?? ""}`.trim(),
    mensaje: "Tienes una nueva cotización lista para revisar.",
    url: `/portal/cotizaciones/${data.id}`,
  };
  const { error: errIns } = await supabase.from("notificaciones_cliente").insert(payload);
  return !errIns;
}
