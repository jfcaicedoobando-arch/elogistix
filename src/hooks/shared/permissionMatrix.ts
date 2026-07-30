/**
 * Re-export de la matriz de capacidades por rol.
 *
 * La implementación vive en `@/lib/access/permissionMatrix` (capa Lib) para
 * que `features/*\/domain` pueda consumirla sin violar la jerarquía de capas
 * Pages→Hooks→Services→Lib. Este archivo se conserva como fachada estable
 * para los consumidores existentes de la capa de hooks.
 */
export * from "@/lib/access/permissionMatrix";
