/**
 * Barrel del dominio Cliente (folder-style).
 *  - crud         → listados, detalle y CRUD del cliente
 *  - contactos    → contactos asociados (proveedores/exp/imp)
 *  - relacionados → embarques y cotizaciones del cliente
 */
export * from "./crud";
export * from "./contactos";
export * from "./relacionados";
export * from "./financials";
