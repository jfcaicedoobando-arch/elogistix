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
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { puedeConsultarCorreoVendedoras } from "../services/vendedorasIdentidad";

export function useVendedorasConfig() {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrganization();
  const conCorreos = puedeConsultarCorreoVendedoras(effectiveRole);
  return useQuery({
    queryKey: queryKeys.comisiones.vendedorasConfig({ organizationId, conCorreos }),
    queryFn: () => fetchVendedorasConfig(conCorreos, organizationId),
    enabled: Boolean(organizationId && effectiveRole),
    staleTime: 60_000,
  });
}

export function useUsuariosVendedores() {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrganization();
  const conCorreos = puedeConsultarCorreoVendedoras(effectiveRole);
  return useQuery({
    queryKey: queryKeys.comisiones.usuariosVendedores({ organizationId, conCorreos }),
    queryFn: () => fetchUsuariosVendedores(conCorreos, organizationId),
    enabled: Boolean(organizationId && effectiveRole),
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
      notifyError(undefined, { title: "No se pudo guardar configuración", description: getErrorMessage(error), error, method: "UPSERT_VENDEDORA_CONFIG" });
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
      notifyError(undefined, { title: "No se pudo actualizar configuración", description: getErrorMessage(error), error, method: "UPDATE_VENDEDORA_CONFIG" });
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
      notifyError(undefined, { title: "No se pudo asignar vendedora", description: getErrorMessage(error), error, method: "ASSIGN_VENDEDORA" });
    },
  });
}
