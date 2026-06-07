
## Restaurar `ci.yml` a best practices (suite verde, fin del modo debug)

Con shard 9 ya estable, eliminamos toda la instrumentación temporal que metimos para cazar el hang (watchdog externo, reporter verbose, override de outputFile, defensa contra blobs ausentes) y volvemos al patrón oficial de Vitest para sharding + coverage merge.

### Cambios

**1. `.github/workflows/ci.yml`** — paso `tests`
- Reemplazar `test:coverage:shard:guarded` por el script default `test:coverage:shard`.
- Quitar `--reporter=verbose` (el blob reporter ya emite los datos necesarios; `verbose` infla logs y solo servía para diagnosticar).
- Quitar `--outputFile=.vitest-reports/blob-${shard}.json` — Vitest ya escribe blobs únicos por shard en `.vitest-reports/` automáticamente. Mantenemos `--shard=N/16`.
- Línea final del step:
  ```yaml
  run: bun run test:coverage:shard -- --shard=${{ matrix.shard }}/${{ matrix.total }}
  ```

**2. `.github/workflows/ci.yml`** — paso `coverage` → "Merge reports + coverage thresholds"
- Quitar el bloque defensivo (`mkdir -p`, `shopt -s nullglob`, conteo de blobs, `::warning::`). Era una muleta para no fallar cuando un shard moría sin subir artifact; ya no aplica.
- Volver a un único comando:
  ```yaml
  run: bun run test:coverage:merge
  ```

**3. `package.json`**
- Eliminar el script `test:coverage:shard:guarded` (ya no se invoca desde ningún lado).

**4. Borrar archivo**
- `scripts/run-shard-guarded.ts` — watchdog externo, ya no se usa.

### Lo que NO se toca
- `vitest.config.ts`: la configuración actual (forks aislados, heap 8 GB, fileParallelism=false, teardownTimeout=15s) **no es debug-instrumentation** sino la solución verificada al OOM/leak — se queda.
- `src/test/setup.ts`: cleanup global productivo, se queda.
- `test:coverage:shard` en package.json: es el script default oficial, se queda.
- `timeout-minutes: 20` del job tests: red de seguridad razonable, se queda.

### Verificación
- Correr localmente `bun run test:coverage:shard -- --shard=9/16` para confirmar que el shard 9 sigue verde con el flujo default.

### Changelog
- Bump `APP_VERSION` a `12.60.39`.
- Entrada `[12.60.39]`: restauración de CI a flujo Vitest default tras estabilizar shard 9 (eliminada toda instrumentación temporal: watchdog, verbose reporter, outputFile override, bash defensivo).
