/**
 * Barrel del dominio Admin (folder-style).
 *  - stats         → KPIs globales y por organización
 *  - organizations → CRUD de organizaciones
 *  - members       → miembros y usuarios globales
 */
export * from "./stats";
export * from "./organizations";
export * from "./members";
export * from "./papelera";
export * from "./idempotencia";
export * from "./exportOrg";
