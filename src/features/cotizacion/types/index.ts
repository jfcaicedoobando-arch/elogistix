/**
 * Barrel del dominio de tipos de Cotización.
 *
 * Consolida los archivos antes dispersos en `src/types/cotizacion*.ts`
 * (core, costo, form, informativa, pl) en una sola superficie pública.
 * Cualquier importador debe usar `@/types/cotizacion`.
 */
export * from "./core";
export * from "./costo";
export * from "./form";
export * from "./informativa";
export * from "./pl";
