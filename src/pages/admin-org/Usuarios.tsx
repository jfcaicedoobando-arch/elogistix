import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import NuevoUsuarioDialog from "@/components/usuario/NuevoUsuarioDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { useUsuarios, useUpdateUserRole, useDeleteUser, type UserRow } from "@/hooks/usuario/useUsuarios";
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

  const columns: DataTableColumn<UserRow>[] = [
    { key: "email", header: "Email", width: "min-w-[200px]", className: "font-medium", sortable: true, sortValue: (u) => u.email, render: (u) => u.email },
    { key: "created_at", header: "Fecha de registro", width: "w-[140px]", className: "text-xs text-muted-foreground", sortable: true, sortValue: (u) => u.created_at, render: (u) => formatDate(u.created_at) },
    { key: "role", header: "Rol actual", width: "w-[120px]", sortable: true, sortValue: (u) => u.role, render: (u) => <Badge className={roleBadge[u.role]}>{getRoleLabel(u.role)}</Badge> },
    {
      key: "change_role", header: "Cambiar rol", width: "w-[160px]", render: (u) => (
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
      ),
    },
    {
      key: "actions", header: "", width: "w-[50px]", render: (u) => {
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
  ];

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
        />
      </div>
    </div>
  );
}
