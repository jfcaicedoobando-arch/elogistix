/**
 * Plantillas de mensajes (email/WhatsApp) reutilizables por organización.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";

export type PlantillaCanal = "email" | "whatsapp";

export interface PlantillaMensajeRow {
  id: string;
  organization_id: string;
  nombre: string;
  canal: PlantillaCanal;
  asunto: string;
  cuerpo: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

const COLS = "id, organization_id, nombre, canal, asunto, cuerpo, activa, created_at, updated_at";

export function usePlantillasMensaje(canal?: PlantillaCanal, soloActivas = true) {
  return useQuery<PlantillaMensajeRow[]>({
    queryKey: queryKeys.crm.plantillas.list(canal, soloActivas),
    queryFn: async () => {
      let q = supabase.from("crm_plantillas_mensaje").select(COLS).order("nombre");
      if (canal) q = q.eq("canal", canal);
      if (soloActivas) q = q.eq("activa", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PlantillaMensajeRow[];
    },
    staleTime: 60_000,
  });
}

export interface PlantillaInput {
  nombre: string;
  canal: PlantillaCanal;
  asunto?: string;
  cuerpo: string;
  activa?: boolean;
}

export function useCrearPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlantillaInput) => {
      const { error } = await supabase.from("crm_plantillas_mensaje").insert({
        nombre: input.nombre,
        canal: input.canal,
        asunto: input.asunto ?? "",
        cuerpo: input.cuerpo,
        activa: input.activa ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all }),
  });
}

export function useActualizarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PlantillaInput> }) => {
      const { error } = await supabase.from("crm_plantillas_mensaje").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all }),
  });
}

export function useEliminarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_plantillas_mensaje")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all }),
  });
}

/** Sustituye variables {{contacto}}, {{empresa}}, etc. */
export function renderPlantilla(
  texto: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}
