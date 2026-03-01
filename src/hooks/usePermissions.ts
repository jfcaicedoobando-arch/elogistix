import { useAuth } from "@/contexts/AuthContext";

export function usePermissions() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "operador";
  const isAdmin = role === "admin";
  return { canEdit, isAdmin, role };
}
