import type { AppRole } from "@/types/appRole";

/**
 * Replica del agrupador funcional implementado en `public.has_role()` (BD).
 * Permite que los guardas de frontend (ProtectedRoute, etc.) acepten cualquier rol
 * moderno equivalente al rol "lógico" solicitado, evitando que regrese una pantalla
 * de "sin acceso" para usuarios con roles modernos.
 *
 * Si el agrupador de BD cambia, ESTE archivo debe actualizarse en paralelo.
 */
/**
 * Espejo TS exacto del `CASE` que vive en `public.has_role()` (BD).
 * Cualquier drift lo detecta `roleHierarchy.invariant.test.ts` (Sprint 2 · ítem 1).
 * Se exporta para permitir su verificación en tests de invariantes.
 */
export const ROLE_EQUIVALENTS: Record<AppRole, readonly AppRole[]> = {
  super_admin: ["super_admin"],
  admin: ["admin", "admin_org", "super_admin"],
  admin_org: ["admin_org", "super_admin"],
  operador: [
    "operador",
    "coordinador_logistico",
    "ejecutivo_pricing",
    "gerente_operaciones",
    "admin",
    "admin_org",
    "super_admin",
  ],
  viewer: [
    "viewer",
    "customer_service",
    "vendedor",
    "contador",
    "tesorero",
    "auxiliar_contable",
    "ejecutivo_cobranza",
    "ejecutivo_pricing",
    "gerente_operaciones",
    "gerente_visor",
    "gerente_comercial",
    "coordinador_logistico",
    "admin",
    "admin_org",
    "super_admin",
  ],
  vendedor: ["vendedor", "gerente_comercial", "admin_org", "super_admin"],
  // Contador puede ver lo que el auxiliar captura.
  contador: ["contador", "auxiliar_contable", "admin_org", "super_admin"],
  tesorero: ["tesorero", "admin_org", "super_admin"],
  auxiliar_contable: ["auxiliar_contable", "contador", "admin_org", "super_admin"],
  ejecutivo_cobranza: ["ejecutivo_cobranza", "contador", "admin_org", "super_admin"],
  // Roles sin agrupación: coincidencia exacta (fallback ELSE del CASE en BD).
  coordinador_logistico: ["coordinador_logistico"],
  ejecutivo_pricing: ["ejecutivo_pricing"],
  gerente_operaciones: ["gerente_operaciones"],
  gerente_visor: ["gerente_visor"],
  gerente_comercial: ["gerente_comercial"],
  customer_service: ["customer_service"],
  cliente: ["cliente"],
  agente_carga: ["agente_carga"],
} as const;

/**
 * ¿El rol efectivo del usuario satisface el rol requerido por la ruta?
 * Refleja el agrupador de `public.has_role()`.
 */
export function roleSatisfies(required: AppRole, actual: AppRole): boolean {
  const group = ROLE_EQUIVALENTS[required];
  if (!group) return required === actual;
  return group.includes(actual);
}

/** Versión multi-required: el usuario pasa si satisface al menos uno. */
export function anyRoleSatisfies(allowed: readonly AppRole[], actual: AppRole): boolean {
  return allowed.some((r) => roleSatisfies(r, actual));
}
