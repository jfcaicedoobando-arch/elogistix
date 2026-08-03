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
    .select("id, folio, cliente_id, organization_id, origen, destino, tipo")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (error || !data?.cliente_id || !data.organization_id) return false;

  // FIX 6 (P3): el mensaje incluye ruta y tipo de operación en es-MX (nunca el
  // valor crudo del enum) para que el cliente identifique la cotización sin abrirla.
  const ruta = [data.origen, data.destino].filter(Boolean).join(" → ");
  const tipoTxt = humanizarEnum(data.tipo);
  const detalles = [ruta, tipoTxt].filter(Boolean).join(" · ");

  const payload: TablesInsert<"notificaciones_cliente"> = {
    cliente_id: data.cliente_id,
    organization_id: data.organization_id,
    tipo: "cotizacion_enviada",
    titulo: `Nueva cotización enviada ${data.folio ?? ""}`.trim(),
    mensaje: detalles
      ? `${detalles}. Tienes una nueva cotización lista para revisar.`
      : "Tienes una nueva cotización lista para revisar.",
    url: `/portal/cotizaciones/${data.id}`,
  };
  const { error: errIns } = await supabase.from("notificaciones_cliente").insert(payload);
  return !errIns;
}
