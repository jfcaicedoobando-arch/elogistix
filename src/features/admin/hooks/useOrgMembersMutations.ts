/**
 * Mutaciones para crear miembros nuevos dentro de una organización.
 *
 * Regla de negocio: un usuario sólo puede pertenecer a una organización.
 * Por eso NO exponemos un flujo para "agregar" usuarios existentes —
 * el alta crea un usuario nuevo vía servicio `createOrgMember`.
 */
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createOrgMember } from "@/features/admin/services";
import { useMutationWithFeedback } from "@/hooks/shared";

export function useCreateOrgMember() {
  const qc = useQueryClient();
  return useMutationWithFeedback({
    mutationFn: createOrgMember,
    successTitle: "Miembro creado en la organización",
    errorTitle: "Error al crear miembro",
    errorMethod: "CREATE_ORG_MEMBER",
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(variables.organizationId) });
      qc.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(variables.organizationId) });
    },
  });
}
