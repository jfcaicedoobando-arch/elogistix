import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import NuevoUsuarioDialog from "@/components/usuario/NuevoUsuarioDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useAdminGlobalUsers, type GlobalUserRow } from "@/hooks/admin/useAdminData";
import { useDeleteUser } from "@/hooks/usuario/useUsuarioMutations";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getRoleLabel } from "@/lib/ui/uiMappings";

export default function AdminUsuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalUserRow | null>(null);
  const { toast } = useToast();
  const { data: users = [], isLoading, refetch } = useAdminGlobalUsers();
  const deleteUser = useDeleteUser();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.user_id, {
      onSuccess: () => {
        notifySuccess(toast, { title: "Usuario eliminado", description: `Se eliminó ${deleteTarget.email} del sistema.` });
        refetch();
        setDeleteTarget(null);
      },
      onError: (err: unknown) => {
        notifyError(toast, { title: "Error", description: getErrorMessage(err)});
        setDeleteTarget(null);
      },
    });
  };

  const roleBadge: Record<string, string> = {
    super_admin: "bg-primary text-primary-foreground",
    admin: "bg-destructive text-destructive-foreground",
    operador: "bg-info text-info-foreground",
    viewer: "bg-muted text-muted-foreground",
  };

  const columns: DataTableColumn<GlobalUserRow>[] = [
    { key: "email", header: "Email", width: "min-w-[200px]", className: "font-medium", sortable: true, sortValue: (u) => u.email, render: (u) => u.email },
    { key: "org", header: "Organización", width: "w-[180px]", sortable: true, sortValue: (u) => u.org_nombre, render: (u) => u.org_nombre },
    { key: "role", header: "Rol", width: "w-[120px]", render: (u) => <Badge className={roleBadge[u.role] ?? ""}>{getRoleLabel(u.role)}</Badge> },
    {
      key: "actions", header: "", width: "w-[60px]",
      render: (u) => (
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(u)} title="Eliminar usuario" aria-label="Eliminar usuario">
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuarios Globales</h1>
            <p className="text-sm text-muted-foreground">Todos los usuarios de todas las organizaciones.</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <NuevoUsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => refetch()} showOrgSelector />

      <DoubleConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName={deleteTarget?.email ?? "usuario"}
        description={`El usuario ${deleteTarget?.email} será eliminado permanentemente del sistema, incluyendo sus membresías y roles.`}
        finalDescription="Esta acción eliminará la cuenta de autenticación, roles y membresías de organización. No se puede deshacer."
        onConfirm={handleDelete}
        isPending={deleteUser.isPending}
      />

      <div className="rounded-md border">
        <DataTable columns={columns} data={users} isLoading={isLoading} emptyMessage="No hay usuarios." rowKey={(u) => u.user_id + u.org_nombre} />
      </div>
    </div>
  );
}
