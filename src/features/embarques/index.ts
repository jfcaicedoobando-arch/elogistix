/**
 * Feature slice: embarques.
 *
 * API pública del módulo. Consumidores externos (portal, facturación,
 * cotización, rutas) deben importar desde aquí o desde sub-paths
 * explícitos (`@/features/embarques/types`, `@/features/embarques/queryKeys`).
 *
 * Reglas internas:
 *   - El código dentro de `src/features/embarques/**` NO importa este barrel
 *     (evita ciclos). Usa paths absolutos `@/features/embarques/<sub>/...`
 *     o relativos.
 *   - `domain/` y `services/` cumplen las mismas restricciones de capa que
 *     `src/lib/` y `src/services/` (ver `src/lib/__tests__/architecture.test.ts`).
 */

// Rutas (lazy-loaded desde src/routes/appRoutes.lazy.ts)
export { default as Embarques } from "./routes/Embarques";
export { default as EmbarqueDetalle } from "./routes/EmbarqueDetalle";
export { default as NuevoEmbarque } from "./routes/NuevoEmbarque";
export { default as EditarEmbarque } from "./routes/EditarEmbarque";

// Hooks reusados fuera del feature
export * from "./hooks";

// Query keys
export { embarques as embarquesKeys } from "./queryKeys";
