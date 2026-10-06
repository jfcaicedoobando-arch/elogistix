/**
 * Espejo en pantalla de `_crm_es_pricing` (la base es la que decide).
 */
const ROLES_PRICING = new Set(["ejecutivo_pricing", "gerente_operaciones", "admin_org", "admin", "super_admin"]);

export function esRolPricing(role: string | null | undefined): boolean {
  return !!role && ROLES_PRICING.has(role);
}

/** Quién puede agregar tarifas de respuesta: los mismos roles que `_crm_es_pricing`. */
const ROLES_TARIFA_RESPUESTA = new Set(["ejecutivo_pricing", "gerente_operaciones", "admin_org", "admin", "super_admin"]);

export function puedeAgregarTarifaRespuesta(role: string | null | undefined): boolean {
  return !!role && ROLES_TARIFA_RESPUESTA.has(role);
}
