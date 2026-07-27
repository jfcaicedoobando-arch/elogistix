/**
 * Listado y mutaciones de miembros de una organización (consola super admin).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchOrgMembers,
  removeOrgMember,
  updateOrgMemberRole,
  type OrgMemberRow,
} from "@/features/admin/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { AppRole } from "@/types/appRole";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
export type MemberRow = OrgMemberRow;

export function useAdminOrgMembers(id: string | undefined) {
  const queryClient = useQueryClient();

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: queryKeys.admin.orgMembers(id!),
    queryFn: () => fetchOrgMembers(id!),
    enabled: !!id,
  });

  const updateRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: AppRole }) =>
      updateOrgMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
      notifySuccess(undefined, { title: "Rol actualizado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error al actualizar rol", description: error.message, method: "UPDATE_ORG_MEMBER_ROLE", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeOrgMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(id!) });
      notifySuccess(undefined, { title: "Miembro eliminado de la organización" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error al eliminar miembro", description: error.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });

  const invalidateMembers = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(id!) });
  };

  return { members, loadingMembers, updateRole, removeMember, invalidateMembers };
}
