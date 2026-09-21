/** Tipos de `scripts/lib/features.mjs` (consumido por eslint.config.js y tests). */
export declare const PUBLIC_SUBLAYERS: readonly string[];
/** Carpetas inmediatas de `src/features`, ordenadas. */
export declare function listFeatures(root: string): string[];
/** Patrones `no-restricted-imports` que blindan la frontera del feature `self`. */
export declare function crossFeaturePatterns(
  self: string,
  features: readonly string[],
): Array<{ group: string[]; message: string }>;
