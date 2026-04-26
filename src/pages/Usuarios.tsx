import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import NuevoUsuarioDialog from "@/components/usuario/NuevoUsuarioDialog";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useUsuarios, useUpdateUserRole, useDeleteUser, type UserRow } from "@/hooks/useUsuarios";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";
import type { AppRole } from "@/types/appRole";
import { useAuth } from "@/contexts/AuthContext";

const roleBadge: Record<AppRole, string> = {
  super_admin: "bg-primary text-primary-foreground",
  admin: "bg-destructive text-destructive-foreground",
  operador: "bg-info text-info-foreground",
  viewer: "bg-muted text-muted-foreground",
  cliente: "bg-accent text-accent-foreground",
};

import { formatDate } from "@/lib/formatters";

export default function Usuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: users = [], isLoading } = useUsuarios();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      await updateRole.mutateAsync({ userId, newRole });
      toast({ title: "Rol actualizado" });
    } catch (err: unknown) {
      toast({ title: "Error al cambiar rol", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.user_id);
      toast({ title: "Usuario eliminado", description: `${deleteTarget.email} fue eliminado del sistema.` });
    } catch (err: unknown) {
      toast({ title: "Error al eliminar usuario", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const columns: DataTableColumn<UserRow>[] = [
    { key: "email", header: "Email", width: "min-w-[200px]", className: "font-medium", sortable: true, sortValue: (u) => u.email, render: (u) => u.email },
    { key: "created_at", header: "Fecha de registro", width: "w-[140px]", className: "text-xs text-muted-foreground", sortable: true, sortValue: (u) => u.created_at, render: (u) => formatDate(u.created_at) },
    { key: "role", header: "Rol actual", width: "w-[100px]", sortable: true, sortValue: (u) => u.role, render: (u) => <Badge className={roleBadge[u.role]}>{u.role}</Badge> },
    {
      key: "change_role", header: "Cambiar rol", width: "w-[160px]", render: (u) => (
        <Select value={u.role} onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
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
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
            <p className="text-sm text-muted-foreground">Administra roles y permisos de los usuarios del sistema.</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

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
