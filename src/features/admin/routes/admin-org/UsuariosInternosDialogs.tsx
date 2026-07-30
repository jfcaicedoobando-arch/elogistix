import { useState } from "react";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
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
import type { UserRow } from "@/features/admin/services/usuario";
import { RoleChangeAlertDialog, type PendingRoleChange } from "./RoleChangeAlertDialog";

interface Props {
  deleteTarget: UserRow | null;
  onDeleteTargetChange: (u: UserRow | null) => void;
  onDelete: () => void;
  deletePending: boolean;
  quitarTarget: UserRow | null;
  onQuitarTargetChange: (u: UserRow | null) => void;
  onQuitar: () => void;
  quitarPending: boolean;
  pendingRole: PendingRoleChange | null;
  onConfirmRole: () => void;
  onCancelRole: () => void;
  rolePending: boolean;
}

/**
 * Diálogos del tab de usuarios internos (borrado duro, quitar de organización
 * y cambio de rol). Extraído de `UsuariosInternosTab.tsx` (Power of 10 ≤200).
 */
export function UsuariosInternosDialogs({
  deleteTarget,
  onDeleteTargetChange,
  onDelete,
  deletePending,
  quitarTarget,
  onQuitarTargetChange,
  onQuitar,
  quitarPending,
  pendingRole,
  onConfirmRole,
  onCancelRole,
  rolePending,
}: Props) {
  return (
    <>
      <DoubleConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) onDeleteTargetChange(null);
        }}
        entityName={deleteTarget?.email ?? "usuario"}
        description={`El usuario ${deleteTarget?.email} será eliminado permanentemente del sistema y de la organización.`}
        finalDescription="Esta acción eliminará al usuario completamente. No se puede deshacer."
        onConfirm={onDelete}
        isPending={deletePending}
      />

      <AlertDialog
        open={!!quitarTarget}
        onOpenChange={(open) => {
          if (!open) onQuitarTargetChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar de la organización</AlertDialogTitle>
            <AlertDialogDescription>
              {quitarTarget?.email} perderá el acceso a{" "}
              {quitarTarget?.organizacion_nombre ?? "la organización"}, pero su cuenta y su
              historial se conservan. Puedes volver a agregarlo después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onQuitar();
              }}
              disabled={quitarPending}
            >
              Quitar acceso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RoleChangeAlertDialog
        pendingRole={pendingRole}
        isPending={rolePending}
        onConfirm={onConfirmRole}
        onCancel={onCancelRole}
      />
    </>
  );
}

export function useUsuariosInternosTargets() {
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [quitarTarget, setQuitarTarget] = useState<UserRow | null>(null);
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null);
  return {
    deleteTarget,
    setDeleteTarget,
    quitarTarget,
    setQuitarTarget,
    pendingRole,
    setPendingRole,
  };
}
