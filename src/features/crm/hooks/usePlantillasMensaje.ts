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
} from "@/features/crm/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export type { PlantillaCanal, PlantillaMensajeRow,  };

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all });
      notifySuccess(undefined, { title: "Plantilla creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear plantilla: ${error.message}`, error, method: "CREATE_PLANTILLA" });
    },
  });
}

export function useActualizarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarPlantilla,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all });
      notifySuccess(undefined, { title: "Plantilla actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar plantilla: ${error.message}`, error, method: "UPDATE_PLANTILLA" });
    },
  });
}

export function useEliminarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eliminarPlantilla,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.plantillas.all });
      notifySuccess(undefined, { title: "Plantilla eliminada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar plantilla: ${error.message}`, error, method: "DELETE_PLANTILLA" });
    },
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
