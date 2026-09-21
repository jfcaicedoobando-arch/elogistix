/**
 * Fuente ÚNICA del inventario de features y de los patrones de frontera
 * cross-feature. Consumido por `eslint.config.js` (generación de overrides)
 * y por `src/__tests__/architecture/cross-feature-boundaries.test.ts`.
 *
 * P1-A (ronda 1 arquitectura): antes el inventario era una lista manual de 32
 * entradas en `eslint.config.js` y `src/features` ya tenía 36 carpetas, por lo
 * que `anticipos-proveedor`, `cobranza`, `cxc` y `expediente` quedaban sin
 * regla. Ahora se descubre leyendo el directorio: un feature nuevo queda
 * protegido sin editar ninguna lista.
 *
 * Archivo `.mjs` (no `.ts`) porque `eslint.config.js` lo importa con Node sin
 * transpilación.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Superficie pública de un feature (barrels de subcapa, 1 solo segmento).
 * El barrel raíz `@/features/<f>` siempre está permitido. Estos barrels se
 * toleran como burn-down documentado (ver `feature-barrel-surface.test.ts`,
 * que ya exige barrel raíz en los features migrados).
 */
export const PUBLIC_SUBLAYERS = [
  "hooks",
  "services",
  "domain",
  "types",
  "queryKeys",
  "permissions",
];

/** Directorios inmediatos reales bajo `src/features`, ordenados. */
export function listFeatures(root = process.cwd()) {
  return readdirSync(join(root, "src", "features"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/**
 * Patrones `no-restricted-imports` para el feature `self`: bloquean CUALQUIER
 * ruta interna de otro feature (incluidas rutas profundas como
 * `@/features/dashboard/direccion/components/X`), y permiten sólo:
 *   · el barrel raíz            `@/features/<f>`
 *   · los barrels de subcapa    `@/features/<f>/<PUBLIC_SUBLAYERS>` (+ burn-down interno)
 *   · las rutas lazy            `@/features/<f>/routes/**`
 */
export function crossFeaturePatterns(self, features = listFeatures()) {
  return features
    .filter((f) => f !== self)
    .map((f) => ({
      group: [
        `@/features/${f}/*`,
        `@/features/${f}/*/**`,
        `!@/features/${f}`,
        ...PUBLIC_SUBLAYERS.flatMap((s) => [
          `!@/features/${f}/${s}`,
          `!@/features/${f}/${s}/**`,
        ]),
        `!@/features/${f}/routes/**`,
      ],
      message: `Cross-feature: no importes internals de '${f}'. Usa su barrel público '@/features/${f}' (o promueve lo compartido a 'src/components/shared/' o 'src/lib/'). Ver P1-A (frontera entre features).`,
    }));
}
