/**
 * Hooks de plantillas de cotización (P2 — v13.295.0, refactor v13.297.4).
 *
 * El I/O contra Supabase vive en `services/plantillas.ts` para respetar la
 * jerarquía Pages → Hooks → Services → Lib.
 */
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { cotizacionPlantillas as keys } from "@/features/cotizacion/queryKeys";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchPlantillas,
  insertPlantilla,
  aplicarPlantillaRpc,
  softDeletePlantilla,
  updatePlantillaMeta,
  type CotizacionPlantilla,
  type PlantillaPayload,
  type PlantillaVisibilidad,
  type UpdatePlantillaMetaPatch,
} from "@/features/cotizacion/services/plantillas";

export type { CotizacionPlantilla, PlantillaPayload, PlantillaVisibilidad };

// ─── Query ─────────────────────────────────────────────────────────────────

export function plantillasQueryOptions(organizationId: string | null) {
  return queryOptions({
    queryKey: keys.byOrg(organizationId),
    queryFn: async (): Promise<CotizacionPlantilla[]> => {
      if (!organizationId) return [];
      return fetchPlantillas(organizationId);
    },
    staleTime: 60_000,
    enabled: !!organizationId,
  });
}

export function useCotizacionPlantillas(organizationId: string | null) {
  return useQuery(plantillasQueryOptions(organizationId));
}

// ─── Mutations ─────────────────────────────────────────────────────────────

interface GuardarInput {
  organizationId: string;
  usuarioId: string;
  nombre: string;
  descripcion?: string | null;
  visibilidad: PlantillaVisibilidad;
  values: Partial<CotizacionFormValues>;
}

export function useGuardarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardarInput): Promise<CotizacionPlantilla> => {
      const payload: PlantillaPayload = { version: 1, values: input.values };
      return insertPlantilla({
        organizationId: input.organizationId,
        usuarioId: input.usuarioId,
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        visibilidad: input.visibilidad,
        payload,
      });
    },
    onSuccess: (_row, input) => {
      void qc.invalidateQueries({ queryKey: keys.byOrg(input.organizationId) });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo guardar la plantilla",
        description: getErrorMessage(error),
        error,
        method: "COTIZACION_PLANTILLA_GUARDAR",
      });
    },
  });
}

export function useAplicarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plantillaId: string): Promise<PlantillaPayload> => aplicarPlantillaRpc(plantillaId),
    onSuccess: () => {
      // Invalida todas las listas — el contador de uso cambió.
      void qc.invalidateQueries({ queryKey: keys.all });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo aplicar la plantilla",
        description: getErrorMessage(error),
        error,
        method: "COTIZACION_PLANTILLA_APLICAR",
      });
    },
  });
}

export function useEliminarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; organizationId: string }): Promise<void> => {
      await softDeletePlantilla(input.id);
    },
    onSuccess: (_v, input) => {
      void qc.invalidateQueries({ queryKey: keys.byOrg(input.organizationId) });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo eliminar la plantilla",
        description: getErrorMessage(error),
        error,
        method: "COTIZACION_PLANTILLA_ELIMINAR",
      });
    },
  });
}

// P2 cierre (v13.296.0): edición de metadatos.
interface ActualizarInput {
  id: string;
  organizationId: string;
  nombre?: string;
  descripcion?: string | null;
  visibilidad?: PlantillaVisibilidad;
}

export function useActualizarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ActualizarInput): Promise<void> => {
      const patch: UpdatePlantillaMetaPatch = {};
      if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
      if (input.descripcion !== undefined) patch.descripcion = input.descripcion?.trim() || null;
      if (input.visibilidad !== undefined) patch.visibilidad = input.visibilidad;
      await updatePlantillaMeta(input.id, patch);
    },
    onSuccess: (_v, input) => {
      void qc.invalidateQueries({ queryKey: keys.byOrg(input.organizationId) });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo actualizar la plantilla",
        description: getErrorMessage(error),
        error,
        method: "COTIZACION_PLANTILLA_ACTUALIZAR",
      });
    },
  });
}
