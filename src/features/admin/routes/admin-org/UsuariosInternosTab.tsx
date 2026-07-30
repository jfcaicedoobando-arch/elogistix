import { useEffect, useMemo, useRef, useState } from "react";
import { pluralizar } from "@/lib/format/pluralizar";
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
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import {
  UNRESOLVED_EMAIL,
  fallóDirectorioUsuarios,
} from "@/features/admin/services/usuario";

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
  const { user } = useAuth();
  const { data: users = [], isLoading, refetch, isFetching } = useUsuarios();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
  const reportedRef = useRef(false);

  // P-09: si la edge function `user-management` falla, los correos quedan como
  // placeholder. Antes sólo había un toast efímero; ahora mostramos un banner
  // persistente con reintento y lo reportamos a Sentry una sola vez.
  const correosNoResueltos = useMemo(
    () => users.filter((u) => u.email === UNRESOLVED_EMAIL).length,
    [users],
  );

  useEffect(() => {
    if (isLoading || reportedRef.current || correosNoResueltos === 0) return;
    reportedRef.current = true;
    // Si el directorio falló por red/edge, es ruido de infraestructura: sólo
    // reportamos cuando la respuesta fue OK pero faltaron correos (bug real).
    if (fallóDirectorioUsuarios()) return;
    reportCaughtError(
      new Error("user-management: correos sin resolver"),
      { feature: "admin_usuarios", op: "list_emails" },
      { correosNoResueltos, total: users.length },
    );
  }, [correosNoResueltos, isLoading, users.length]);




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

      {correosNoResueltos > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>No se pudieron cargar los correos</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              {pluralizar(correosNoResueltos, "usuario")} sin correo visible porque el servicio de
              autenticación no respondió.
            </span>
            <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

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
