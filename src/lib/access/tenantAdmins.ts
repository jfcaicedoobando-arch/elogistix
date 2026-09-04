import type { AppRole } from "@/types/appRole";

/**
 * Roles considerados administradores del tenant.
 *
 * Extraído a un módulo independiente para evitar el ciclo de importación
 * entre `permissionMatrix.ts` (re-exporta capacidades del CRM) y
 * `permissionMatrix.crm.ts` (necesita la lista de admins).
 */
export const TENANT_ADMINS: readonly AppRole[] = ["super_admin", "admin_org", "admin"];
