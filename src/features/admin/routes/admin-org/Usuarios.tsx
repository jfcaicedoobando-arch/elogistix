import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/shared";
import { ShieldCheck, UserPlus } from "lucide-react";
import NuevoUsuarioDialog from "@/features/admin/components/usuario/NuevoUsuarioDialog";
import { DataTable } from "@/components/shared/DataTable";
import { useUsuarios, useUpdateUserRole, useDeleteUser, type UserRow } from "@/features/admin/hooks/usuario";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";

import { useAuth } from "@/lib/contexts/AuthContext";
import { notifyWarning } from "@/components/shared/utils/appFeedback";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";
import { useUsuarioColumns } from "./usuariosColumns";
import { RoleChangeAlertDialog, type PendingRoleChange } from "./RoleChangeAlertDialog";

export default function Usuarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null);
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


  // 13.85.9 — Los toasts de éxito/error los emite el hook (`useUpdateUserRole`).
  // No duplicar aquí: causaría doble toast.
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

  // 13.85.9 — Los toasts de éxito/error los emite el hook (`useDeleteUser`).
  // No duplicar aquí: causaría doble toast.
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.user_id);
    } catch {
      // Notificación gestionada por el hook.
    }
  };


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

      <RoleChangeAlertDialog
        pendingRole={pendingRole}
        isPending={updateRole.isPending}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRole(null)}
      />

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
