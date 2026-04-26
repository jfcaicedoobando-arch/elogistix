/**
 * Barrel del dominio admin. La implementación se divide en:
 *  - services/admin/stats.ts        → KPIs globales y por organización
 *  - services/admin/organizations.ts → CRUD de organizaciones
 *  - services/admin/members.ts      → miembros y usuarios globales
 */
export * from "./admin/stats";
export * from "./admin/organizations";
export * from "./admin/members";
