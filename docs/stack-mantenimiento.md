# Mantenimiento del stack de build y pruebas

Revisión del repositorio: **2026-09-26**. Stack: Vite 8, Vitest 5, Router 7,
TypeScript 6. [CI](ops/ci.md) es la guía de jobs/triggers.

## Build

`vite.config.ts` conserva Terser. No se mantienen `manualChunks` históricos.
Sourcemaps de producción sólo con token Sentry y sin `BUILD_SOURCEMAPS=false`;
se suben y eliminan del dist. Sin token se desactivan y se advierte.
`check-sourcemaps.sh` verifica el dist tras build en el job de comprobaciones.

`build:low-mem` desactiva maps; no cambia reglas del producto.
El tamaño/RAM de un build deben medirse en su entorno real.

## Coverage

CI principal usa **cinco shards sin coverage**.
No hay workflow nightly de coverage vigente. Medición optativa:

- `bun run test:coverage`.
- `test:coverage:shard -- --shard=N/TOTAL` con el mismo TOTAL en todas las partes.
- `test:coverage:merge` une blobs y aplica thresholds del total.
- `coverage:report` genera resumen.

No confundir `test:ci` (alias de merge de coverage) con el comando real de CI.

## Vitest/Router

Proyectos node/jsdom definidos explícitamente con `extends: false` para
evitar herencia/duplicación de plugins. Benchmarks `perf` están separados.
`clearMocks: false` es una decisión de compatibilidad de la suite.

Aliases ESM de Router evitan doble contexto CJS/ESM con nuqs v7.
Contract test comprueba layout; no eliminar alias por estética.
`testEnvSplit.ts` reparte archivos; un `@vitest-environment` explícito manda.

## Evidencia histórica

El ensayo de minificadores del 2026-09-19 midió Terser 67 s / 355–364 KB gzip
frente a esbuild 48 s / 376 KB. Son datos del stack/entorno de entonces,
no un benchmark de Vite 8 ni budgets actuales garantizados.
[Historia de shards](ci-vitest-shards.md).

No se cambió configuración ni se repitieron benchmarks en esta actualización.
