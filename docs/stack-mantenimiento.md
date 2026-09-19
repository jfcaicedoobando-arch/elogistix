# Mantenimiento del stack de build y pruebas (P2)

Decisiones medidas, no intuidas. Fecha de medición: 2026-09-19, sandbox de 8 vCPU.

## Minificador: se conserva Terser

| Configuración | Tiempo de build | Entry `index-*.js` (gzip) | Budget |
| --- | --- | --- | --- |
| `minify: "terser"` (actual) | 67 s | **355–364 KB** | 365 KB |
| `minify: "esbuild"` | 48 s (−19 s) | **376 KB** | ✗ excede |
| `terser` + `reportCompressedSize: false` | 70 s (sin mejora medible) | 364 KB | — |

Conclusión: esbuild ahorra ~19 s de build pero engorda el entry ~13 KB gz y
rompe el gate de 365 KB. `reportCompressedSize: false` no dio mejora
reproducible (la diferencia queda dentro del ruido). **No se cambia nada**: se
conserva `minify: "terser"` y el reporte de tamaños tal como estaban.

## Sourcemaps

- Producción con `SENTRY_AUTH_TOKEN`: `sourcemap: "hidden"`; el plugin de Sentry
  los sube y los borra del `dist` (`filesToDeleteAfterUpload`).
- Producción **sin** token: `sourcemap: false`. Antes se generaban `.map` que
  quedaban dentro del `dist` publicado (no referenciados, pero descargables).
- Guard: `scripts/check-sourcemaps.sh`, conectado al job `build` de `ci.yml`
  después del gate de tamaño. Falla si aparece cualquier `.map` o una
  referencia `sourceMappingURL` en `dist`.

## Cobertura: manual / nightly, NO gate por commit

- `ci.yml` corre las pruebas en 3 shards **sin cobertura**. Los thresholds de
  `vitest.config.ts` **no son gate de cada commit ni de cada PR**.
- Para medirla a propósito:
  - Local completo: `bun run test:coverage` (requiere bastante RAM).
  - Por partes: `bun run test:coverage:shard -- --shard=1/3` (×3, genera blobs
    en `.vitest-reports`) y luego `bun run test:coverage:merge` (= `test:ci`),
    que aplica los thresholds sobre el total unido.
  - Reporte legible: `bun run coverage:report`.
- Los scripts se conservan porque son el procedimiento oficial de esa medición
  manual/nightly; no son huérfanos.

## Aliases de React Router en Vitest

Los alias a `node_modules/react-router*/dist/*.mjs` siguen siendo necesarios
(evitan la doble instancia del contexto del router entre CJS y ESM con
`nuqs/adapters/react-router/v7`). Están encapsulados en `aliasVitest()` de
`vitest.shared.ts` y cubiertos por el contract test
`src/__tests__/scripts/routerAliasContract.test.ts`, que falla si el paquete
cambia el layout de archivos o si `react-router` y `react-router-dom`
divergen de minor. No se migra a Data Router.

## Entorno de pruebas declarado por archivo

`scripts/lib/testEnvSplit.ts` reparte los tests entre los proyectos `node` y
`jsdom`. Además de la heurística, un archivo puede declarar su entorno:

```ts
// @vitest-environment jsdom
```

La declaración manda sobre la extensión y sobre los marcadores. Es la vía para
casos nuevos; la lista `FORCE_JSDOM` queda como legado.
