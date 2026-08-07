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

export async function insertCotizacionDesdeOportunidad(
  input: CrearCotizacionDesdeOpInput,
): Promise<{ id: string }> {
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
    .select("id")
    .single();
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "crear_cotizacion_desde_oportunidad",
    entidadId: input.oportunidad.id,
    entidadNombre: input.folio,
    detalles: { cotizacion_id: data.id },
  });
  return { id: data.id };
}

export async function actualizarEtapaOportunidad(
  oportunidadId: string,
  etapaId: string,
  probabilidad: number,
): Promise<void> {
  const { error } = await supabase
    .from("crm_oportunidades")
    .update({ etapa_id: etapaId, probabilidad })
    .eq("id", oportunidadId);
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "actualizar_etapa_oportunidad_desde_cotizacion",
    entidadId: oportunidadId,
    detalles: { etapa_id: etapaId, probabilidad },
  });
}
