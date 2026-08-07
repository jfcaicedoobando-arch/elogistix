/**
 * Servicios de acciones masivas sobre Facturas Emitidas.
 * Encapsulan las llamadas a Supabase usadas por la UI de selección múltiple
 * (descargar ZIP, marcar como enviada).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface FacturaParaZip {
  id: string;
  numero: string;
  factura_pdf_url: string | null;
  factura_xml_url: string | null;
}

export async function fetchFacturasParaZip(ids: string[]): Promise<FacturaParaZip[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, factura_pdf_url, factura_xml_url")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as FacturaParaZip[];
}

export async function marcarFacturasComoEnviadas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("facturas")
    .update({ enviada_cliente_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
  await registrarActividad({
    modulo: "facturacion",
    accion: "Envió facturas por correo",
    entidadNombre: `${ids.length} factura(s)`,
    detalles: { facturaIds: ids },
  });
}
