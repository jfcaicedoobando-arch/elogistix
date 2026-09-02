import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";

type CotizacionInsert = Database["public"]["Tables"]["cotizaciones"]["Insert"];

export interface CrearCotizacionDesdeOpInput {
  folio: string;
  modo: "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal";
  oportunidad: {
    id: string;
    cliente_id: string | null;
    cliente_nombre: string | null;
    origen: string | null;
    destino: string | null;
  };
  operador: string;
}

/**
 * v13.823.32: idempotente por oportunidad. Si el cambio de etapa falla o el
 * usuario reintenta tras un timeout, ya NO se crea una segunda cotización:
 * se devuelve el borrador vivo que ya existe para esa oportunidad.
 */
export async function insertCotizacionDesdeOportunidad(
  input: CrearCotizacionDesdeOpInput,
): Promise<{ id: string; folio: string; reutilizada: boolean }> {
  const { data: existente, error: errBusca } = await supabase
    .from("cotizaciones")
    .select("id, folio")
    .eq("oportunidad_id", input.oportunidad.id)
    .eq("estado", "Borrador")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (existente) {
    return { id: existente.id, folio: existente.folio, reutilizada: true };
  }

  const payload: CotizacionInsert = {
    folio: input.folio,
    modo: input.modo,
    tipo: "Importación",
    cliente_id: input.oportunidad.cliente_id,
    cliente_nombre: input.oportunidad.cliente_nombre ?? "",
    origen: input.oportunidad.origen ?? "",
    destino: input.oportunidad.destino ?? "",
    oportunidad_id: input.oportunidad.id,
    operador: input.operador,
    es_prospecto: !input.oportunidad.cliente_id,
  };
  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select("id, folio")
    .single();
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "crear_cotizacion_desde_oportunidad",
    entidadId: input.oportunidad.id,
    entidadNombre: input.folio,
    detalles: { cotizacion_id: data.id },
  });
  return { id: data.id, folio: data.folio, reutilizada: false };
}


export async function actualizarEtapaOportunidad(
  oportunidadId: string,
  etapaId: string,
  probabilidad: number,
): Promise<void> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .update({ etapa_id: etapaId, probabilidad })
    .eq("id", oportunidadId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  // 0 filas (RLS o eliminada): no anunciamos un cambio de etapa que no ocurrió.
  if (!data) {
    throw new Error(
      "No se pudo mover la etapa: no tienes permiso o la oportunidad ya no existe.",
    );
  }

  await registrarActividad({
    modulo: "crm",
    accion: "actualizar_etapa_oportunidad_desde_cotizacion",
    entidadId: oportunidadId,
    detalles: { etapa_id: etapaId, probabilidad },
  });
}
