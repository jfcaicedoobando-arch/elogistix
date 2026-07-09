import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import type { UserRow } from "@/features/admin/hooks/usuario";
import type { AppRole } from "@/types/appRole";
import { obtenerEtiquetaRol } from "@/lib/ui/uiMappings";

export interface PendingRoleChange {
  user: UserRow;
  newRole: AppRole;
}

interface Props {
  pendingRole: PendingRoleChange | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RoleChangeAlertDialog({ pendingRole, isPending, onConfirm, onCancel }: Props) {
  return (
    <ConfirmActionDialog
      open={!!pendingRole}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="¿Cambiar rol del usuario?"
      description={
        pendingRole ? (
          <>
            Vas a cambiar el rol de <strong>{pendingRole.user.email}</strong> de{" "}
            <strong>{obtenerEtiquetaRol(pendingRole.user.role)}</strong> a{" "}
            <strong>{obtenerEtiquetaRol(pendingRole.newRole)}</strong>. Esto modifica los permisos del usuario inmediatamente.
          </>
        ) : undefined
      }
      confirmLabel="Confirmar"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
