/**
 * Barrel re-export para mantener compatibilidad con consumidores existentes.
 * La lógica vive en submódulos por dirección de mapeo:
 *  - embarqueFromDb: BD → form (incluye defaults y tipo EmbarqueFormValues)
 *  - embarqueToDb: form → payloads de BD
 *  - embarqueCotizacion: vinculación con cotizaciones
 */

export * from "./embarqueFromDb";
export * from "./embarqueToDb";
export * from "./embarqueCotizacion";
