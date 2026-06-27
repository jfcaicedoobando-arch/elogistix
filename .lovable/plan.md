
## Diagnóstico

Los `TS2550/TS2554` que muestra el panel son del caché local del harness, **no** existen en CI. Lo que rompe el pipeline son:

1. `coverage=failure` — merge de Vitest abortado por blobs de v3.2.4 sobrantes.
2. `tests=failure` — `Tests (shard 8/20)` exit 1 sin pista del test culpable (reporter `blob`).

## Plan

### Parte A — Arreglar el merge de coverage (alta prioridad)
Limpiar `.vitest-reports/` **antes** de que el job de merge baje los artefactos, y volver opcionalmente la clave de caché de Vitest única por commit para que blobs viejos no vivan en caché entre runs.

Cambios en `.github/workflows/ci.yml` (job `coverage-merge`):
- Insertar paso `rm -rf .vitest-reports && mkdir -p .vitest-reports` justo antes del `actions/download-artifact`.
- Bumpear la `key` del caché `node_modules/.vitest` (sufijo `-v4` o incluir `${{ github.sha }}`) para invalidar de un golpe los blobs persistidos.

Validación: el log siguiente debe mostrar solo `blob-1.json … blob-20.json` (todos v4.1.9).

### Parte B — Identificar el test que rompe shard 8/20
El script `test:coverage:shard` corre con `--reporter=blob` puro, por eso CI no imprime el test fallido. Plan:
- En `package.json` cambiar a doble reporter: `--reporter=blob --reporter=default` para que stdout muestre el `FAIL` del archivo concreto sin perder el blob para merge.
- Una vez que CI reporte el archivo culpable, abrir un seguimiento focalizado (no incluido en este PR).

### Parte C — Higiene del cache stale del harness
Los `TS2550` que ve el usuario vienen del typechecker local del IDE. El root `tsconfig.json` ya tiene `lib`/`target` ES2022 (PR `13.138.1`). Para evitar que la deuda visible siga ruido, agregar un `restart_dev_server` mental: no hay cambio de código aquí — solo documentar el origen en `CHANGELOG`.

### Detalle técnico

- `.github/workflows/ci.yml` job `coverage-merge`: añadir `rm -rf .vitest-reports` antes de `download-artifact: name: vitest-blobs-*`, y bumpear `key: Linux-vitest-v4-${{ ... }}`.
- `package.json` script `test:coverage:shard`: `vitest run --coverage --reporter=blob --reporter=default --retry=2 --coverage.thresholds.…=0`.
- Bump versión `13.138.2`. Entrada en `CHANGELOG.md`.

### Fuera de alcance
- No tocar tests aún; primero queremos que el reporter exponga el test fallido del shard 8.
- No tocar `tsconfig` (ya está en ES2022 desde 13.138.1).
- No subir majors bloqueados (memoria `lovable-stack-pins`).
