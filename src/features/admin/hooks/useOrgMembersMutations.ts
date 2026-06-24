/**
 * Mutaciones para crear miembros nuevos dentro de una organización.
 *
 * Regla de negocio: un usuario sólo puede pertenecer a una organización.
 * Por eso NO exponemos un flujo para "agregar" usuarios existentes —
 * el alta crea un usuario nuevo vía servicio `createOrgMember`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createOrgMember } from "@/features/admin/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

export function useCreateOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrgMember,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(variables.organizationId) });
      qc.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(variables.organizationId) });
      notifySuccess(undefined, { title: "Miembro creado en la organización" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear miembro: ${error.message}`, error, method: "CREATE_ORG_MEMBER" });
    },
  });
}
