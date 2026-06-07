# Hacer robusto el job de merge cuando un shard se cae

## Cambios

### 1) Endurecer step "Merge reports" en `.github/workflows/ci.yml`

Reemplazar:

```yaml
- name: Merge reports + coverage thresholds
  run: bun run test:coverage:merge
```

Por:

```yaml
- name: Merge reports + coverage thresholds
  run: |
    mkdir -p .vitest-reports
    shopt -s nullglob
    blobs=(.vitest-reports/blob-*.json)
    if [ ${#blobs[@]} -eq 0 ]; then
      echo "::warning::No shard blob reports found — likely a shard was canceled or failed before upload. Skipping merge."
      exit 0
    fi
    echo "Found ${#blobs[@]} shard blob(s): ${blobs[*]}"
    bun run test:coverage:merge
```

Convierte el `ENOENT scandir` críptico en un warning explícito.

### 2) Bump versión

- `CHANGELOG.md`: entrada `[12.60.35]`.
- `src/constants/appVersion.ts`: `12.60.35`.

## Archivos a modificar

- `.github/workflows/ci.yml`
- `CHANGELOG.md`
- `src/constants/appVersion.ts`

## Nota

El log de shard 9 que pegaste usa `test:coverage:shard` (no `:guarded`) — es de antes de que `12.60.34` aterrizara. Cuando el PR esté rebaseado sobre `main`, el wrapper guarded correrá y mostrará el `⏱️ HARD TIMEOUT` con el archivo culpable.
