import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/appRole";

export function usePermissions() {
  const { role, effectiveRole } = useAuth();
  const roleStr = effectiveRole as AppRole;
  const canEdit = roleStr === "admin" || roleStr === "operador" || roleStr === "super_admin";
  const isAdmin = roleStr === "admin" || roleStr === "super_admin";
  const isSuperAdmin = (role as AppRole) === "super_admin";
  /** Permite editar en módulo CRM: incluye al rol vendedor además de los staff. */
  const canEditCrm = canEdit || roleStr === "vendedor";
  return { canEdit, canEditCrm, isAdmin, isSuperAdmin, role: effectiveRole };
}
