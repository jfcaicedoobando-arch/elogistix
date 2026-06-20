import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useAdminGlobalUsers, type GlobalUserRow } from "@/features/admin/hooks/useAdminData";
import { useDeleteUserAuth as useDeleteUser } from "@/features/admin/hooks/usuario";
import { uniqueSorted } from "@/lib/utils/uniqueSorted";

export function useAdminUsuariosController() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalUserRow | null>(null);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("todos");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const { toast } = useToast();
  const { data: users = [], isLoading, refetch } = useAdminGlobalUsers();
  const deleteUser = useDeleteUser();

  const orgs = useMemo(() => uniqueSorted(users, (u) => u.org_nombre), [users]);
  const roles = useMemo(() => uniqueSorted(users, (u) => u.role), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (orgFilter !== "todos" && u.org_nombre !== orgFilter) return false;
      if (roleFilter !== "todos" && u.role !== roleFilter) return false;
      if (q && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, orgFilter, roleFilter]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.user_id, {
      onSuccess: () => {
        notifySuccess(toast, {
          title: "Usuario eliminado",
          description: `Se eliminó ${deleteTarget.email} del sistema.`,
        });
        refetch();
        setDeleteTarget(null);
      },
      onError: (err: unknown) => {
        notifyError(toast, { title: "Error", description: getErrorMessage(err), method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
        setDeleteTarget(null);
      },
    });
  };

  return {
    state: { dialogOpen, deleteTarget, search, orgFilter, roleFilter },
    setters: {
      setDialogOpen,
      setDeleteTarget,
      setSearch,
      setOrgFilter,
      setRoleFilter,
    },
    data: { users, filtered, orgs, roles, isLoading },
    actions: { handleDelete, refetch, deleteUserPending: deleteUser.isPending },
  };
}
