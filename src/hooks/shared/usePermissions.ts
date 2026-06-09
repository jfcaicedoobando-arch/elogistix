import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/appRole";

/**
 * Permisos de UI por rol.
 *
 * Centraliza la matriz de capacidades para los 10 roles soportados (más legacy)
 * de modo que los componentes y rutas la consuman vía booleans estables.
 *
 * La API pública (`canEdit`, `canViewFinancials`, `canEditCrm`, `isAdmin`,
 * `isSuperAdmin`, `isOperador`) se conserva por compatibilidad con los
 * consumidores existentes.
 */

const TENANT_ADMINS: readonly AppRole[] = ["super_admin", "admin_org", "admin"];
const OPERATIONS: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "operador",
  "ejecutivo_pricing",
];
const FINANCE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "tesorero",
];
const FINANCE_VIEWERS: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "contador",
  "tesorero",
  "ejecutivo_pricing",
];
const SALES: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "vendedor",
  "ejecutivo_pricing",
];

const has = (list: readonly AppRole[], role: AppRole | null | undefined) =>
  !!role && list.includes(role);

export function usePermissions() {
  const { role, effectiveRole } = useAuth();
  const roleStr = effectiveRole as AppRole | null;

  // Capacidades por área
  const canAdminTenant = has(TENANT_ADMINS, roleStr);
  const canEditOperations = has(OPERATIONS, roleStr);
  const canEditFinance = has(FINANCE, roleStr);
  const canViewFinancials = has(FINANCE_VIEWERS, roleStr);
  const canEditSales = has(SALES, roleStr);

  // API pública (compatibilidad)
  const canEdit = canEditOperations || canEditFinance;
  const isAdmin = canAdminTenant;
  const isSuperAdmin = (role as AppRole) === "super_admin";
  const isOperador = roleStr === "operador" || roleStr === "coordinador_logistico";
  const canEditCrm = canEdit || canEditSales;

  return {
    // legacy / public
    canEdit,
    canEditCrm,
    isAdmin,
    isSuperAdmin,
    isOperador,
    canViewFinancials,
    role: effectiveRole,
    // nuevas (matriz por área)
    canAdminTenant,
    canEditOperations,
    canEditFinance,
    canEditSales,
  };
}
