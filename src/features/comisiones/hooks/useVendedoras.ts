/**
 * Hooks de vendedoras: config % + listado usuarios + asignación embarques.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import {
  fetchVendedorasConfig,
  upsertVendedoraConfig,
  updateVendedoraConfig,
  fetchUsuariosVendedores,
  fetchEmbarquesSinVendedora,
  asignarVendedoraEmbarque,
} from "@/features/comisiones/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export function useVendedorasConfig() {
  return useQuery({
    queryKey: queryKeys.comisiones.vendedorasConfig(),
    queryFn: fetchVendedorasConfig,
    staleTime: 60_000,
  });
}

export function useUsuariosVendedores() {
  return useQuery({
    queryKey: queryKeys.comisiones.usuariosVendedores(),
    queryFn: fetchUsuariosVendedores,
    staleTime: 5 * 60_000,
  });
}

export function useEmbarquesSinVendedora() {
  return useQuery({
    queryKey: queryKeys.comisiones.embarquesSinVendedora(),
    queryFn: fetchEmbarquesSinVendedora,
    staleTime: 30_000,
  });
}

export function useUpsertVendedoraConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: TablesInsert<"vendedora_config">) => upsertVendedoraConfig(config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.vendedorasConfig() });
      notifySuccess(undefined, { title: "Configuración de vendedora guardada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al guardar configuración: ${error.message}`, error, method: "UPSERT_VENDEDORA_CONFIG" });
    },
  });
}

export function useUpdateVendedoraConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: string; changes: TablesUpdate<"vendedora_config"> }) =>
      updateVendedoraConfig(p.id, p.changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.vendedorasConfig() });
      notifySuccess(undefined, { title: "Configuración actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar configuración: ${error.message}`, error, method: "UPDATE_VENDEDORA_CONFIG" });
    },
  });
}

export function useAsignarVendedoraEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { embarqueId: string; vendedoraId: string }) =>
      asignarVendedoraEmbarque(p.embarqueId, p.vendedoraId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.embarquesSinVendedora() });
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.all });
      notifySuccess(undefined, { title: "Vendedora asignada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al asignar vendedora: ${error.message}`, error, method: "ASSIGN_VENDEDORA" });
    },
  });
}
