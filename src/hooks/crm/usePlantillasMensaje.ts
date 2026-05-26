/**
 * Plantillas de mensajes (email/WhatsApp) reutilizables por organización.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPlantillasMensaje,
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
  type PlantillaCanal,
  type PlantillaMensajeRow,
  type PlantillaInput,
} from "@/services/crm";

export type { PlantillaCanal, PlantillaMensajeRow, PlantillaInput };

export function usePlantillasMensaje(canal?: PlantillaCanal, soloActivas = true) {
  return useQuery<PlantillaMensajeRow[]>({
    queryKey: queryKeys.crm.plantillas.list(canal, soloActivas),
    queryFn: () => fetchPlantillasMensaje(canal, soloActivas),
    staleTime: 60_000,
  });
}

export function useCrearPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crearPlantilla,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all }),
  });
}

export function useActualizarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarPlantilla,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all }),
  });
}

export function useEliminarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eliminarPlantilla,
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
