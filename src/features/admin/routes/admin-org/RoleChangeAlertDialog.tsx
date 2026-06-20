import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UserRow } from "@/features/admin/hooks/usuario";
import type { AppRole } from "@/types/appRole";
import { getRoleLabel } from "@/components/shared/utils/uiMappings";

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
    <AlertDialog open={!!pendingRole} onOpenChange={(open) => { if (!open) onCancel(); }}>
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
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? "Cambiando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
