/**
 * Hooks para la Card "Migración de roles legacy" en `/admin/auditoria`.
 * Encapsula `useQuery` (vista previa) y `useMutation` (ejecución).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import {
  migrarRolesLegacyDryRun,
  migrarRolesLegacyEjecutar,
  type MigrarRolesLegacyDryRun,
  type MigrarRolesLegacyResult,
} from "@/features/admin/services/migrarRolesLegacy";

const QUERY_KEY = queryKeys.admin.migrarRolesLegacyDryRun;

export function useMigrarRolesLegacyDryRun(enabled: boolean) {
  return useQuery<MigrarRolesLegacyDryRun>({
    queryKey: QUERY_KEY,
    queryFn: migrarRolesLegacyDryRun,
    enabled,
    staleTime: 30_000,
  });
}

export interface UseMigrarRolesLegacyOptions {
  onSuccess?: (data: MigrarRolesLegacyResult) => void;
}

export function useMigrarRolesLegacy(options: UseMigrarRolesLegacyOptions = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: migrarRolesLegacyEjecutar,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      qc.invalidateQueries({ queryKey: ["admin", "orgMembers"] });
      notifySuccess(toast, {
        title: `Migración completada: ${data.total_migrados} rol(es) actualizado(s).`,
      });
      options.onSuccess?.(data);
    },
    onError: (err) => {
      notifyError(toast, {
        title: err instanceof Error ? err.message : "Error al migrar roles legacy",
        error: err,
        method: "USE_MIGRAR_ROLES_LEGACY",
      });
    },
  });
}
