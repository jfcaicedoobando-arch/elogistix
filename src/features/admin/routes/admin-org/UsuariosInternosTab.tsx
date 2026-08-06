import { useEffect, useMemo, useRef, useState } from "react";
import { pluralizar } from "@/lib/format/pluralizar";
import { useDebouncedValue } from "@/lib/hooks";
import { DataTable } from "@/components/shared/DataTable";
import {
  useUsuarios,
  useUpdateUserRole,
  useDeleteUser,
  useQuitarDeOrganizacion,
  useResetPasswordUsuario,
  useUsuariosOrgScope,
} from "@/features/admin/hooks/usuario";
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
import { UsuariosToolbar } from "./UsuariosToolbar";
import { UsuariosInternosDialogs } from "./UsuariosInternosDialogs";
import { useUsuariosInternosTargets } from "./usuariosInternosTargets";
import { TODOS, filtrarUsuarios, hayFiltrosActivos } from "./usuariosInternosFiltros";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

export function UsuariosInternosTab() {
  const targets = useUsuariosInternosTargets();
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebouncedValue(busqueda.trim().toLowerCase(), 200);
  const [filtroRol, setFiltroRol] = useState<string>(TODOS);
  const [filtroEstado, setFiltroEstado] = useState<string>(TODOS);
  const { user } = useAuth();
  const orgScope = useUsuariosOrgScope();
  const { data: users = [], isLoading, isError, refetch, isFetching } = useUsuarios();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
  const quitarDeOrg = useQuitarDeOrganizacion();
  const resetPassword = useResetPasswordUsuario();
  const reportedRef = useRef(false);

  // P-09: si la edge function `user-management` falla, los correos quedan como
  // placeholder. Mostramos un banner persistente con reintento y lo reportamos
  // a Sentry una sola vez.
  const correosNoResueltos = useMemo(
    () => users.filter((u) => u.email === UNRESOLVED_EMAIL).length,
    [users],
  );

  useEffect(() => {
    if (isLoading || reportedRef.current || correosNoResueltos === 0) return;
    reportedRef.current = true;
    if (fallóDirectorioUsuarios()) return;
    reportCaughtError(
      new Error("user-management: correos sin resolver"),
      { feature: "admin_usuarios", op: "list_emails" },
      { correosNoResueltos, total: users.length },
    );
  }, [correosNoResueltos, isLoading, users.length]);

  const confirmRoleChange = async () => {
    const pendiente = targets.pendingRole;
    if (!pendiente) return;
    try {
      await updateRole.mutateAsync({
        userId: pendiente.user.user_id,
        newRole: pendiente.newRole,
        // U-02: el cambio se acota a la organización de la fila editada.
        organizationId: pendiente.user.organization_id,
      });
    } catch {
      // hook notifica
    } finally {
      targets.setPendingRole(null);
    }
  };

  const handleDelete = async () => {
    if (!targets.deleteTarget) return;
    try {
      await deleteUser.mutateAsync(targets.deleteTarget.user_id);
      targets.setDeleteTarget(null);
    } catch {
      // hook notifica
    }
  };

  const handleQuitar = async () => {
    const objetivo = targets.quitarTarget;
    if (!objetivo) return;
    try {
      await quitarDeOrg.mutateAsync({
        userId: objetivo.user_id,
        organizationId: objetivo.organization_id,
      });
      targets.setQuitarTarget(null);
    } catch {
      // hook notifica
    }
  };

  const filtros = useMemo(
    () => ({ busqueda: busquedaDebounced, rol: filtroRol, estado: filtroEstado }),
    [busquedaDebounced, filtroRol, filtroEstado],
  );
  const usuariosFiltrados = useMemo(() => filtrarUsuarios(users, filtros), [users, filtros]);

  const rolesPresentes = useMemo(() => new Set(users.map((u) => u.role)).size, [users]);

  const columns = useUsuarioColumns({
    currentUserId: user?.id,
    onPendingRole: (u, newRole) => targets.setPendingRole({ user: u, newRole }),
    // U-01: sin organización activa (super_admin) mostramos a qué org pertenece.
    mostrarOrganizacion: !orgScope,
    acciones: {
      onResetPassword: (u) => void resetPassword.mutate(u.user_id),
      onQuitarDeOrg: targets.setQuitarTarget,
      onDelete: targets.setDeleteTarget,
    },
  });

  return (
    <div className="space-y-4">
      <UsuariosInternosDialogs
        deleteTarget={targets.deleteTarget}
        onDeleteTargetChange={targets.setDeleteTarget}
        onDelete={handleDelete}
        deletePending={deleteUser.isPending}
        quitarTarget={targets.quitarTarget}
        onQuitarTargetChange={targets.setQuitarTarget}
        onQuitar={handleQuitar}
        quitarPending={quitarDeOrg.isPending}
        pendingRole={targets.pendingRole}
        onConfirmRole={confirmRoleChange}
        onCancelRole={() => targets.setPendingRole(null)}
        rolePending={updateRole.isPending}
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
        filtroEstado={filtroEstado}
        onFiltroEstadoChange={setFiltroEstado}
        totalFiltrados={usuariosFiltrados.length}
        total={users.length}
        rolesPresentes={rolesPresentes}
      />

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={usuariosFiltrados}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          emptyMessage={
            hayFiltrosActivos(filtros)
              ? "Ningún usuario coincide con los filtros aplicados."
              : "No hay usuarios registrados."
          }
          rowKey={(u) => u.user_id}
          density={TABLE_DENSITY.listado}
          tableClassName="w-full"
          initialSort={{ key: "role", dir: "asc" }}
        />
      </div>
    </div>
  );
}
