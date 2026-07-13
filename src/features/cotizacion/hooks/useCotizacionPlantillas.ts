/**
 * Hooks de plantillas de cotización (P2 — v13.295.0).
 *
 * Cumple regla core:
 *  - Query keys centralizadas en `queryKeys.ts`.
 *  - `queryOptions()` + `staleTime` explícito.
 *  - Mutaciones con invalidación de cache.
 *  - Manejo de `error` de Supabase (no lo tragamos).
 */
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cotizacionPlantillas as keys } from "@/features/cotizacion/queryKeys";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export type PlantillaVisibilidad = "yo" | "org";

export interface CotizacionPlantilla {
  id: string;
  organization_id: string;
  usuario_id: string | null;
  nombre: string;
  descripcion: string | null;
  visibilidad: PlantillaVisibilidad;
  payload: PlantillaPayload;
  veces_usada: number;
  ultima_uso_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlantillaPayload {
  /** Versión del payload — permite migración defensiva si el schema del form cambia. */
  version: 1;
  /** Valores base del wizard, sin folios/fechas/tarifa que se generan al aplicar. */
  values: Partial<CotizacionFormValues>;
}

// ─── Query ─────────────────────────────────────────────────────────────────

export function plantillasQueryOptions(organizationId: string | null) {
  return queryOptions({
    queryKey: keys.byOrg(organizationId),
    queryFn: async (): Promise<CotizacionPlantilla[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("cotizacion_plantillas")
        .select("id, organization_id, usuario_id, nombre, descripcion, visibilidad, payload, veces_usada, ultima_uso_at, created_at, updated_at")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("veces_usada", { ascending: false })
        .order("ultima_uso_at", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any as CotizacionPlantilla[];
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
      const { data, error } = await supabase
        .from("cotizacion_plantillas")
        .insert({
          organization_id: input.organizationId,
          usuario_id: input.usuarioId,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() || null,
          visibilidad: input.visibilidad,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: payload as any,
        })
        .select()
        .single();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any as CotizacionPlantilla;
    },
    onSuccess: (_row, input) => {
      void qc.invalidateQueries({ queryKey: keys.byOrg(input.organizationId) });
    },
  });
}

export function useAplicarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plantillaId: string): Promise<PlantillaPayload> => {
      const { data, error } = await supabase.rpc("aplicar_plantilla_cotizacion", {
        _plantilla_id: plantillaId,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any as PlantillaPayload;
    },
    onSuccess: () => {
      // Invalida todas las listas — el contador de uso cambió.
      void qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useEliminarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; organizationId: string }): Promise<void> => {
      const { error } = await supabase
        .from("cotizacion_plantillas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_v, input) => {
      void qc.invalidateQueries({ queryKey: keys.byOrg(input.organizationId) });
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
      const patch: {
        nombre?: string;
        descripcion?: string | null;
        visibilidad?: PlantillaVisibilidad;
      } = {};
      if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
      if (input.descripcion !== undefined) patch.descripcion = input.descripcion?.trim() || null;
      if (input.visibilidad !== undefined) patch.visibilidad = input.visibilidad;
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase
        .from("cotizacion_plantillas")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_v, input) => {
      void qc.invalidateQueries({ queryKey: keys.byOrg(input.organizationId) });
    },
  });
}
