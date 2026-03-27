import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/data/types";

export function usePermissions() {
  const { role } = useAuth();
  const roleStr = role as AppRole;
  const canEdit = roleStr === "admin" || roleStr === "operador" || roleStr === "super_admin";
  const isAdmin = roleStr === "admin" || roleStr === "super_admin";
  const isSuperAdmin = roleStr === "super_admin";
  return { canEdit, isAdmin, isSuperAdmin, role };
}
