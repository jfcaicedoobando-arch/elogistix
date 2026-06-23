import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/shared";
import { Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import NuevoUsuarioDialog from "@/features/admin/components/usuario/NuevoUsuarioDialog";
import { DataTable } from "@/components/shared/DataTable";
import {
  useUsuarios,
  useUpdateUserRole,
  useDeleteUser,
  type UserRow,
} from "@/features/admin/hooks/usuario";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";

import { useAuth } from "@/lib/contexts/AuthContext";
import { notifyWarning } from "@/components/shared/utils/appFeedback";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";
import { useUsuarioColumns } from "./usuariosColumns";
import { RoleChangeAlertDialog, type PendingRoleChange } from "./RoleChangeAlertDialog";
import {
  ASSIGNABLE_ROLE_GROUPS,
  ROLE_LABELS,
  obtenerRangoRol,
} from "@/features/admin/domain/roles/roleCatalog";

const TODOS = "todos" as const;

export default function Usuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
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
      notifyWarning(toast, {
        title: "Correos no disponibles",
        description: `No se pudieron resolver los correos de ${unresolved} usuario(s). Verifica la conexión con el servidor de autenticación.`,
      });
    }
  }, [users, isLoading, toast]);

  // Debounce búsqueda (200 ms) para evitar re-renders por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [busqueda]);

  // 13.85.9 — Toasts gestionados por los hooks. No duplicar.
  const confirmRoleChange = async () => {
    if (!pendingRole) return;
    try {
      await updateRole.mutateAsync({ userId: pendingRole.user.user_id, newRole: pendingRole.newRole });
    } catch {
      // Notificación gestionada por el hook.
    } finally {
      setPendingRole(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.user_id);
    } catch {
      // Notificación gestionada por el hook.
    }
  };

  // Filtrado + orden jerárquico inicial (en cliente; lista pequeña por org).
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
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-primary" />}
        title="Gestión de Usuarios"
        description="Administra roles y permisos de los usuarios del sistema."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        }
      />

      <NuevoUsuarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          /* invalidación automática vía useCreateUser */
        }}
      />

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

      {/* Barra de búsqueda + filtro + resumen */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por correo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filtroRol} onValueChange={setFiltroRol}>
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los roles</SelectItem>
              {ASSIGNABLE_ROLE_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </SelectLabel>
                  {group.roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            <strong className="text-foreground">{usuariosFiltrados.length}</strong> de{" "}
            {users.length} usuario{users.length === 1 ? "" : "s"} · {rolesPresentes} rol
            {rolesPresentes === 1 ? "" : "es"}
          </span>
        </div>
      </div>

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
          initialSort={{ key: "role", dir: "asc" }}
        />
      </div>
    </div>
  );
}
