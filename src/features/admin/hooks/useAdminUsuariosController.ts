import { useMemo, useState } from "react";
import { useAdminGlobalUsers, type GlobalUserRow } from "@/features/admin/hooks/useAdminData";
import { useDeleteUserAuth as useDeleteUser } from "@/features/admin/hooks/usuario";
import { uniqueSorted } from "@/lib/utils/uniqueSorted";

export function useAdminUsuariosController() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalUserRow | null>(null);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("todos");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
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

  // 13.85.10 — Toasts viven en `useDeleteUserAuth`. Aquí sólo refetch y reset de selección.
  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.user_id, {
      onSuccess: () => {
        refetch();
        setDeleteTarget(null);
      },
      onError: () => {
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

