
## Fix: upload-artifact path explícito al archivo blob

### Problema
Los shards ya escriben correctamente en `.vitest-reports/`, pero `actions/upload-artifact@v7` falla al resolver el directorio. La solución es apuntar al archivo concreto en lugar de la carpeta.

### Nota sobre el nombre del archivo
Actualmente el step de tests genera `blob-${{ matrix.shard }}-${{ matrix.total }}.json` (con `-16` al final). Tu propuesta usa `blob-${{ matrix.shard }}.json` (sin total). Para que ambos coincidan, voy a **alinear los dos** a `blob-${{ matrix.shard }}.json` (más limpio, como pides).

### Cambios en `.github/workflows/ci.yml`

**Job `tests`** — step "Tests + coverage":
```yaml
run: bun run test:coverage:shard -- --shard=${{ matrix.shard }}/${{ matrix.total }} --outputFile=.vitest-reports/blob-${{ matrix.shard }}.json
```

**Job `tests`** — step "Upload shard blob report":
```yaml
- name: Upload shard blob report
  if: always()
  uses: actions/upload-artifact@v7
  with:
    name: vitest-blob-${{ matrix.shard }}
    path: .vitest-reports/blob-${{ matrix.shard }}.json
    if-no-files-found: error
    retention-days: 1
```

**Job `coverage`** — step "Download shard blobs" (ya está casi así, confirmo el shape):
```yaml
- name: Download shard blobs
  uses: actions/download-artifact@v7
  with:
    pattern: vitest-blob-*
    path: .vitest-reports/
    merge-multiple: true
```

### Lo que NO cambia
- `package.json`, `vitest.config.ts`, `scripts/`, merge step, setup.ts.
- El step `mkdir -p .vitest-reports` y el `ls -la` de debug se mantienen.

### Changelog
- Bump `APP_VERSION` → `12.60.42`.
- Entrada `[12.60.42]`: upload-artifact apunta al archivo `.json` explícito; nombre de blob simplificado a `blob-{shard}.json` para que tests y upload coincidan.

¿Procedo?
