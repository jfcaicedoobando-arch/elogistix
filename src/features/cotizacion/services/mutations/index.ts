/**
 * Barrel — Mutations del dominio Cotizaciones, una operación por archivo.
 * Mantiene la API histórica que exponía `services/cotizacion/mutations.ts`.
 */
export { crearCotizacion } from "./crear";
export { updateCotizacion } from "./update";
export { deleteCotizacion } from "./delete";
export { updateEstadoCotizacion } from "./estado";
export { reactivarCotizacion } from "./reactivar";
