import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useAdminGlobalUsers, type GlobalUserRow } from "@/hooks/admin/useAdminData";
import { useDeleteUserAuth as useDeleteUser } from "@/hooks/usuario";

export function useAdminUsuariosController() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalUserRow | null>(null);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("todos");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const { toast } = useToast();
  const { data: users = [], isLoading, refetch } = useAdminGlobalUsers();
  const deleteUser = useDeleteUser();

  const orgs = useMemo(
    () => Array.from(new Set(users.map((u) => u.org_nombre))).sort(),
    [users],
  );
  const roles = useMemo(
    () => Array.from(new Set(users.map((u) => u.role))).sort(),
    [users],
  );

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
        notifyError(toast, { title: "Error", description: getErrorMessage(err) });
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
