/**
 * Shim de compatibilidad: la implementación canónica vive en
 * `../_shared/satExpresion.ts` para poder reutilizarla desde otras funciones
 * (ej. `verificar-sat-lote`). Este archivo se conserva para no romper los
 * imports existentes ni `expresion_test.ts`.
 */
export * from "../_shared/satExpresion.ts";
