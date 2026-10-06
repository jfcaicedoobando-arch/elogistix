/** Tipos de actividad compartidos por dominio, servicios e interfaz. */
import type { Database } from "@/integrations/supabase/types";

export type CrmActividadTipo = Database["public"]["Enums"]["crm_actividad_tipo"];
export type CrmEntidadTipo = Database["public"]["Enums"]["crm_entidad_tipo"];

export interface ActividadEntidadContexto {
  entidad_nombre?: string | null;
  entidad_estado?: "disponible" | "no_disponible" | "error";
}

export type CrmActividadRow = Database["public"]["Tables"]["crm_actividades"]["Row"] & ActividadEntidadContexto;

export interface ProximaActividad {
  id: string;
  entidad_tipo: CrmEntidadTipo;
  entidad_id: string;
  tipo: CrmActividadTipo;
  asunto: string;
  fecha_programada: string | null;
}
