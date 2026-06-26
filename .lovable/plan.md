## Diagnóstico

**1. Lint/audit (`audit:tests` → exit 1)** — 2 violaciones de higiene:
- `src/features/costeo/services/__tests__/aprobacion.test.ts:50` usa `rejects.toBeTruthy()` (weak-rejects-assertion).
- `src/features/cxp/services/__tests__/cxpKpis.test.ts:21` y `src/features/facturacion/services/__tests__/cobranzaAggregates.test.ts:41` comparten el título `"ignora filas con saldo <= 0"` (duplicate-title).

**2. Tests shard 3/8 (exit 1, 24s)** — el shard reporta `blob` y termina con código 1, pero el reporter blob no imprime fallas a stdout. Es muy probable que sean tests recién añadidos en el último batch (~40 nuevos en CxP / costeo / facturación) con assertions débiles o expectativas erróneas. Hay que reproducirlo localmente con reporter `verbose` para identificar los `expect` fallidos y corregirlos.

**3. Tests shard 1/8 y 4/8 (timeout 20 min)** — La config de vitest fuerza `pool: 'forks'` con `singleFork: true` y `fileParallelism: false`, así que cada shard corre todos sus archivos **en serie en un único worker**. Shard 1 tiene 517 tests y shard 4 tiene 366 tests; el coverage v8 amplifica el costo. Los canaries de PDF (200 renders) y suites con jsdom pesado terminan saturando el límite. Hay que paralelizar el shard sin reintroducir las fugas que motivaron el `singleFork`.

## Cambios propuestos

### Paso A — Arreglar higiene de tests (desbloquea Lint y CI)
1. **`aprobacion.test.ts:50`**: reemplazar
   ```ts
   await expect(aprobarTarifa("t6")).rejects.toBeTruthy();
   ```
   por una assertion específica al error real lanzado (`rejects.toThrow(/no encontrada|inválida/i)` según el mensaje real del servicio).
2. **`cobranzaAggregates.test.ts:41`**: renombrar el título a algo contextual, p.ej. `"cobranza: ignora filas con saldo <= 0"`. Dejar el de CxP como está (es el dominio "natural" del título original).

### Paso B — Reproducir y arreglar shard 3
1. Correr local: `bunx vitest run --shard=3/8 --reporter=verbose 2>&1 | tee /tmp/shard3.log` y filtrar `FAIL`/`AssertionError`.
2. Por cada test fallido (esperamos 1-5 dentro de los recién agregados de CxP/facturación/costeo/financialMappers), ajustar fixture o assertion. Sin reescribir lógica de negocio.

### Paso C — Quitar el cuello de botella de shards (timeouts)
Editar `vitest.config.ts`:
- Eliminar `poolOptions.forks.singleFork: true`.
- Mantener `pool: 'forks'` pero permitir `fileParallelism: true` con `poolOptions.forks.maxForks: 2, minForks: 1` (2 workers por shard, conservador para 4 GB de runner + coverage v8 a 8 GB heap).
- Mantener `isolate: true` y el `afterEach` global que ya limpia RTL/PDF (ver `mem://technical/testing-cleanup-protocol`) para evitar regresión de fugas.
- Si tras correr local algún archivo concreto sigue siendo problemático (canary PDF), marcarlo con `// @vitest-environment node` + `test.sequential` o moverlo a su propio archivo con `describe.sequential`, sin tocar el resto.

Verificación post-cambio: correr en local los 3 shards más pesados (`1/8`, `4/8`, `8/8`) con `time bunx vitest run --shard=N/8 --coverage` y confirmar que terminan en <12 min cada uno y que ninguna suite revive leaks (chequear `mem://features/testing-regression-canary`).

### Paso D — Versionado y changelog
Bump `APP_VERSION` a `13.137.22` y agregar entrada en `CHANGELOG.md`:
> Reparada higiene de tests (aprobación, cobranza), arreglados tests fallidos en shard 3 y eliminado cuello de botella `singleFork` que disparaba timeouts de 20 min en shards 1 y 4.

## Notas

- No bajamos el threshold de coverage (regla `mem://principles/coverage-threshold`).
- No tocamos lógica de negocio: solo tests, configuración de vitest y versión.
- Si paralelizar reintroduce flakes en CI, el plan B (siguiente turno) es subir el split a 12 shards en `.github/workflows/ci.yml` en lugar de habilitar paralelismo intra-shard.
