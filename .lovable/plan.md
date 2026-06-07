
## Fix: blob output path explícito por shard (CI verde)

### Problema
Tras restaurar CI a default, los 16 shards reportan `No files were found with the provided path: .vitest-reports/` y el merge falla con `ENOENT scandir .vitest-reports`. La doc de Vitest dice que con `--reporter=blob --shard=N/M` el archivo se escribe en `.vitest-reports/blob-N-M.json` por defecto, pero combinado con `--coverage` + invocación `bun run script -- args` en GitHub Actions, eso no ocurre y el directorio queda vacío.

### Solución
Volver a fijar **`--outputFile=.vitest-reports/blob-${{ matrix.shard }}.json`** explícitamente en el step de tests. La doc oficial lista esto como la forma canónica y determinista para sharded CI ("can be overridden with `--outputFile` or `--outputFile.blob` flags"). No es debug instrumentation — es best practice explícita.

Lo que **NO** vuelve: `--reporter=verbose` (eso sí era ruido de debug), el watchdog, ni el bash defensivo del merge.

### Cambios

**`.github/workflows/ci.yml`** — paso `tests`:
```yaml
run: bun run test:coverage:shard -- --shard=${{ matrix.shard }}/${{ matrix.total }} --outputFile=.vitest-reports/blob-${{ matrix.shard }}.json
```

No se tocan: merge step, package.json, vitest.config.ts, setup.ts, scripts/.

### Changelog
- Bump `APP_VERSION` a `12.60.40`.
- Entrada `[12.60.40]`: re-añadido `--outputFile` explícito por shard tras detectar que sin él Vitest no escribe los blobs combinado con `--coverage` en GH Actions (verbose y watchdog se quedan fuera).
