/**
 * Espejo en pantalla de `_crm_es_pricing` (la base es la que decide).
 */
const ROLES_PRICING = new Set(["ejecutivo_pricing", "gerente_operaciones", "admin_org", "admin", "super_admin"]);

export function esRolPricing(role: string | null | undefined): boolean {
  return !!role && ROLES_PRICING.has(role);
}
