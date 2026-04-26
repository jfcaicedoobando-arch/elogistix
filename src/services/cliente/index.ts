/**
 * Barrel del dominio cliente. La implementación se divide en:
 *  - services/cliente/crud.ts        → listados, detalle y CRUD del cliente
 *  - services/cliente/contactos.ts   → contactos asociados (proveedores/exp/imp)
 *  - services/cliente/relacionados.ts → embarques y cotizaciones del cliente
 */
export * from "./cliente/crud";
export * from "./cliente/contactos";
export * from "./cliente/relacionados";
