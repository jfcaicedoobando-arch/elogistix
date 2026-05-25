import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import NuevoUsuarioDialog from "@/components/usuario/NuevoUsuarioDialog";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { useUsuarios, useUpdateUserRole, useDeleteUser, type UserRow } from "@/hooks/usuario";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AppRole } from "@/types/appRole";
import { useAuth } from "@/contexts/AuthContext";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getRoleLabel } from "@/lib/ui/uiMappings";

const roleBadge: Record<AppRole, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-destructive text-destructive-foreground",
  operador: "bg-info text-info-foreground",
  vendedor: "bg-success text-success-foreground",
  viewer: "bg-muted text-muted-foreground",
  cliente: "bg-accent text-accent-foreground",
};

import { formatDate } from "@/lib/formatters";

interface PendingRoleChange {
  user: UserRow;
  newRole: AppRole;
}

export default function Usuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: users = [], isLoading } = useUsuarios();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  const confirmRoleChange = async () => {
    if (!pendingRole) return;
    try {
      await updateRole.mutateAsync({ userId: pendingRole.user.user_id, newRole: pendingRole.newRole });
      notifySuccess(toast, { title: "Rol actualizado", description: `${pendingRole.user.email} ahora es ${getRoleLabel(pendingRole.newRole)}.` });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al cambiar rol", description: getErrorMessage(err) });
    } finally {
      setPendingRole(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.user_id);
      notifySuccess(toast, { title: "Usuario eliminado", description: `${deleteTarget.email} fue eliminado del sistema.` });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al eliminar usuario", description: getErrorMessage(err)});
    }
  };

  const columns: ColumnDef<UserRow, unknown>[] = defineColumns<UserRow>([
    {
      id: "email", header: "Email",
      accessorFn: (u) => u.email, enableSorting: true,
      sortingFn: sortByString<UserRow>((u) => u.email),
      meta: { width: "min-w-[200px]", className: "font-medium" },
      cell: ({ row }) => row.original.email,
    },
    {
      id: "created_at", header: "Fecha de registro",
      accessorFn: (u) => u.created_at, enableSorting: true,
      sortingFn: sortByDate<UserRow>((u) => u.created_at),
      meta: { width: "w-[140px]", className: "text-xs text-muted-foreground" },
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "role", header: "Rol actual",
      accessorFn: (u) => u.role, enableSorting: true,
      sortingFn: sortByString<UserRow>((u) => u.role),
      meta: { width: "w-[120px]" },
      cell: ({ row }) => <Badge className={roleBadge[row.original.role]}>{getRoleLabel(row.original.role)}</Badge>,
    },
    {
      id: "change_role", header: "Cambiar rol", meta: { width: "w-[160px]" },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <Select
            value={u.role}
            onValueChange={(val) => {
              const newRole = val as AppRole;
              if (newRole === u.role) return;
              setPendingRole({ user: u, newRole });
            }}
          >
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="operador">Operador</SelectItem>
              <SelectItem value="viewer">Visor</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "actions", header: "", meta: { width: "w-[50px]" },
      cell: ({ row }) => {
        const u = row.original;
        const isSelf = u.user_id === user?.id;
        if (isSelf) return null;
        return (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }}
            aria-label={`Eliminar usuario ${u.email}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ]);

  return (
    <div className="space-y-6">
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

      <NuevoUsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => { /* invalidación automática vía useCreateUser */ }} />

      <DoubleConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        entityName={deleteTarget?.email ?? "usuario"}
        description={`El usuario ${deleteTarget?.email} será eliminado permanentemente del sistema y de la organización.`}
        finalDescription="Esta acción eliminará al usuario completamente. No se puede deshacer."
        onConfirm={handleDelete}
        isPending={deleteUser.isPending}
      />

      <AlertDialog open={!!pendingRole} onOpenChange={(open) => { if (!open) setPendingRole(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar rol del usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole && (
                <>
                  Vas a cambiar el rol de <strong>{pendingRole.user.email}</strong> de{" "}
                  <strong>{getRoleLabel(pendingRole.user.role)}</strong> a{" "}
                  <strong>{getRoleLabel(pendingRole.newRole)}</strong>. Esto modifica los permisos del usuario inmediatamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateRole.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={updateRole.isPending}>
              {updateRole.isPending ? "Cambiando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          emptyMessage="No hay usuarios registrados."
          rowKey={(u) => u.user_id}
          density="comfortable"
        />
      </div>
    </div>
  );
}
