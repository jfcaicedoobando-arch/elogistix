import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/shared";
import { useDebouncedValue } from "@/lib/hooks";
import { DataTable } from "@/components/shared/DataTable";
import {
  useUsuarios,
  useUpdateUserRole,
  useDeleteUser,
  type UserRow,
} from "@/features/admin/hooks/usuario";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useAuth } from "@/lib/contexts/AuthContext";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";
import { useUsuarioColumns } from "./usuariosColumns";
import { RoleChangeAlertDialog, type PendingRoleChange } from "./RoleChangeAlertDialog";
import { obtenerRangoRol } from "@/features/admin/domain/roles/roleCatalog";
import { TODOS, UsuariosToolbar } from "./UsuariosToolbar";

export function UsuariosInternosTab() {
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebouncedValue(busqueda.trim().toLowerCase(), 200);
  const [filtroRol, setFiltroRol] = useState<string>(TODOS);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: users = [], isLoading } = useUsuarios();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
  const warnedRef = useRef(false);

  useEffect(() => {
    if (isLoading || warnedRef.current) return;
    const unresolved = users.filter((u) => u.email === UNRESOLVED_EMAIL).length;
    if (unresolved > 0) {
      warnedRef.current = true;
      notifyWarning(undefined, {
        title: "Correos no disponibles",
        description: `No se pudieron resolver los correos de ${unresolved} usuario(s). Verifica la conexión con el servidor de autenticación.`,
      });
    }
  }, [users, isLoading, toast]);


  const confirmRoleChange = async () => {
    if (!pendingRole) return;
    try {
      await updateRole.mutateAsync({ userId: pendingRole.user.user_id, newRole: pendingRole.newRole });
    } catch {
      // hook notifica
    } finally {
      setPendingRole(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.user_id);
    } catch {
      // hook notifica
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const base = users.filter((u) => {
      if (filtroRol !== TODOS && u.role !== filtroRol) return false;
      if (busquedaDebounced && !u.email.toLowerCase().includes(busquedaDebounced)) return false;
      return true;
    });
    return [...base].sort((a, b) => {
      const ra = obtenerRangoRol(a.role);
      const rb = obtenerRangoRol(b.role);
      if (ra !== rb) return ra - rb;
      return a.email.localeCompare(b.email, "es-MX", { sensitivity: "base" });
    });
  }, [users, busquedaDebounced, filtroRol]);

  const rolesPresentes = useMemo(() => new Set(users.map((u) => u.role)).size, [users]);

  const columns = useUsuarioColumns({
    currentUserId: user?.id,
    onPendingRole: (u, newRole) => setPendingRole({ user: u, newRole }),
    onDelete: setDeleteTarget,
  });

  return (
    <div className="space-y-4">
      <DoubleConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        entityName={deleteTarget?.email ?? "usuario"}
        description={`El usuario ${deleteTarget?.email} será eliminado permanentemente del sistema y de la organización.`}
        finalDescription="Esta acción eliminará al usuario completamente. No se puede deshacer."
        onConfirm={handleDelete}
        isPending={deleteUser.isPending}
      />

      <RoleChangeAlertDialog
        pendingRole={pendingRole}
        isPending={updateRole.isPending}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRole(null)}
      />

      <UsuariosToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        filtroRol={filtroRol}
        onFiltroRolChange={setFiltroRol}
        totalFiltrados={usuariosFiltrados.length}
        total={users.length}
        rolesPresentes={rolesPresentes}
      />

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={usuariosFiltrados}
          isLoading={isLoading}
          emptyMessage={
            busquedaDebounced || filtroRol !== TODOS
              ? "Ningún usuario coincide con los filtros aplicados."
              : "No hay usuarios registrados."
          }
          rowKey={(u) => u.user_id}
          density="comfortable"
          tableClassName="w-full"
          initialSort={{ key: "role", dir: "asc" }}
        />
      </div>
    </div>
  );
}
