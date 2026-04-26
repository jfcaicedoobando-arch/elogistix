/**
 * Listado y mutaciones de miembros de una organización (consola super admin).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import {
  fetchOrgMembers,
  removeOrgMember,
  updateOrgMemberRole,
  type OrgMemberRow,
} from "@/services/adminServices";
import type { AppRole } from "@/types/types";

export type MemberRow = OrgMemberRow;

export function useAdminOrgMembers(id: string | undefined) {
  const { toast } = useToast();
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
      toast({ title: "Rol actualizado" });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeOrgMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(id!) });
      toast({ title: "Miembro eliminado de la organización" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar miembro", description: error.message, variant: "destructive" });
    },
  });

  const invalidateMembers = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgMembers(id!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.orgCountMembers(id!) });
  };

  return { members, loadingMembers, updateRole, removeMember, invalidateMembers };
}
