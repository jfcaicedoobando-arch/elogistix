/**
 * Estado de los diálogos del tab de usuarios internos.
 * Vive aparte para no mezclar hooks con componentes (react-refresh).
 */
import { useState } from "react";
import type { UserRow } from "@/features/admin/services/usuario";
import type { PendingRoleChange } from "./RoleChangeAlertDialog";

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
