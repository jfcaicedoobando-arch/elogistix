/**
 * Portal del cliente — Solicitudes de cotización.
 *
 * El cliente sólo captura la ruta y los datos mínimos de su carga; la
 * solicitud aterriza como cotización en Borrador para que el equipo comercial
 * la trabaje (política tarifa-first).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ModoTransporte = Database["public"]["Enums"]["modo_transporte"];
export type TipoOperacion = Database["public"]["Enums"]["tipo_operacion"];

export interface SolicitudCotizacionInput {
  clienteId: string;
  modo: ModoTransporte;
  tipo: TipoOperacion;
  origen: string;
  destino: string;
  tipoEmbarque: string;
  tipoContenedor?: string | null;
  descripcionMercancia?: string;
  notas?: string;
}

export interface SolicitudCotizacionResult {
  id: string;
  folio: string;
}

export async function solicitarCotizacionPortal(
  input: SolicitudCotizacionInput,
): Promise<SolicitudCotizacionResult> {
  const { data, error } = await supabase.rpc("portal_solicitar_cotizacion", {
    p_cliente_id: input.clienteId,
    p_modo: input.modo,
    p_tipo: input.tipo,
    p_origen: input.origen,
    p_destino: input.destino,
    p_tipo_embarque: input.tipoEmbarque,
    p_tipo_contenedor: input.tipoContenedor ?? undefined,
    p_descripcion_mercancia: input.descripcionMercancia ?? "",
    p_notas: input.notas ?? undefined,
  });

  if (error) throw new Error(error.message);

  const fila = Array.isArray(data) ? data[0] : null;
  if (!fila) throw new Error("No se pudo registrar la solicitud de cotización");

  return { id: fila.id as string, folio: fila.folio as string };
}
