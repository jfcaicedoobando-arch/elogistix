# Hard per-file timeout for shard runs

## Problema

`vitest.config.ts` ya tiene `testTimeout: 15s` y `hookTimeout: 15s`, pero esos límites sólo aplican *dentro* de un `it(...)`/`beforeEach`. Cuando el cuelgue ocurre durante la **carga del módulo** del test (ej. `vi.mock` con factoría async, `setInterval` sin cleanup en un import, top-level `await`), Vitest nunca llega a ejecutar un test — el fork se queda ocupado y GitHub mata el job a los 20 min **sin decir qué archivo causó el problema**.

Eso fue lo que pasó en shard 8 (lead) y otra vez en shard 9: el log se corta después del último test impreso y no hay manera de saber cuál archivo nunca arrancó.

## Solución

Un wrapper en Node que envuelve a Vitest, hace `tail` de su `stdout`, lleva un watchdog por archivo y, si un archivo excede el límite, mata al proceso y reporta el culpable.

### 1) Nuevo script `scripts/run-shard-guarded.ts`

Responsabilidades:

- `spawn` de `vitest run …` con los args recibidos (passthrough).
- Pipe `stdout`/`stderr` al log del job (sin perder nada).
- Regex sobre cada línea para detectar:
  - Inicio de archivo: ` ❯ src/...test.ts` o primer `✓ src/...test.ts > …` (vitest verbose).
  - Cambios de archivo respecto al último visto.
- Mantener:
  - `currentFile: string | null`
  - `lastActivityAt: number` (se resetea con cada línea de stdout, no sólo cambio de archivo).
  - `fileStartedAt: number` (se resetea al cambiar `currentFile`).
- Dos timers:
  - **`FILE_TIMEOUT_MS`** (default 90 s): tiempo máximo en un mismo archivo.
  - **`IDLE_TIMEOUT_MS`** (default 60 s): tiempo máximo sin **ninguna** línea de stdout (cubre cuelgues en colección antes de imprimir el primer test).
- Al disparar cualquier timeout:
  1. Imprimir bloque destacado:
     ```
     ⏱️  HARD TIMEOUT  ─────────────────────────────
       Reason: file exceeded 90s  (o  idle 60s)
       Last file:  src/.../foo.test.tsx
       Last line:  <última línea de stdout>
       Elapsed in file: 92.3s
     ──────────────────────────────────────────────
     ```
  2. Mandar `SIGTERM` al child y, si en 5 s no muere, `SIGKILL`.
  3. `process.exit(124)` (mismo código que `timeout(1)` de coreutils, fácil de filtrar en CI).
- Si Vitest termina normalmente, propagar su exit code.

Sin dependencias nuevas: usa `node:child_process`, `node:readline`, y lee args con `process.argv.slice(2)`.

### 2) Nuevo script en `package.json`

```jsonc
"test:coverage:shard:guarded": "NODE_OPTIONS=\"--max-old-space-size=8192\" bun scripts/run-shard-guarded.ts -- vitest run --coverage --reporter=blob --coverage.thresholds.lines=0 --coverage.thresholds.statements=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0"
```

El wrapper recibe todo después de `--` como el comando real a ejecutar, y los flags propios (`--file-timeout=`, `--idle-timeout=`) van **antes** del `--` y son opcionales.

### 3) CI: usar el script guarded

En `.github/workflows/ci.yml`, paso "Tests + coverage":

```yaml
run: bun run test:coverage:shard:guarded -- --shard=${{ matrix.shard }}/${{ matrix.total }} --reporter=verbose --outputFile=.vitest-reports/blob-${{ matrix.shard }}.json
```

`timeout-minutes: 20` del job se mantiene como red de seguridad, pero ahora el wrapper falla **antes** y deja un mensaje claro identificando el archivo culpable.

### 4) Endurecer `vitest.config.ts`

Agregar `teardownTimeout: 15_000` por simetría con `testTimeout`/`hookTimeout` (cubre `afterAll` colgados, que también pueden quedarse silenciosos).

## Archivos a modificar

- **Nuevo:** `scripts/run-shard-guarded.ts` (~120 líneas, sin deps).
- **Editar:** `package.json` — agregar script `test:coverage:shard:guarded`.
- **Editar:** `.github/workflows/ci.yml` — cambiar el `run:` del paso "Tests + coverage" al script guarded.
- **Editar:** `vitest.config.ts` — agregar `teardownTimeout: 15_000`.
- **Editar:** `CHANGELOG.md` + `src/constants/appVersion.ts` (bump patch, ej. `12.60.34`).

## Validación

1. Correr localmente `bun run test:coverage:shard:guarded -- --shard=9/16 --reporter=verbose` y verificar exit code 0 cuando shard pasa.
2. Smoke test: inyectar temporalmente `await new Promise(() => {})` en un test de shard 9, correr el script y confirmar que reporta el archivo correcto y sale con 124.
3. CI: empujar y verificar que shard 9 (si se vuelve a colgar) ahora muestra `⏱️ HARD TIMEOUT` con el nombre del archivo, en lugar de cortar el log a los 20 min.

## Notas de diseño

- **¿Por qué no usar `--bail=1` + `testTimeout`?** Porque el cuelgue actual ocurre antes del primer `it()` y `testTimeout` nunca se evalúa. Necesitamos un watchdog externo al runner.
- **¿Por qué 90 s y 60 s?** El archivo más lento medido es 5.1 s (ver comentario en `vitest.config.ts`). 90 s deja ~18× de margen. El `idle` de 60 s cubre la fase de transform/collect del primer archivo de un fork frío.
- **No se modifica** la suite ni los tests existentes — esto es pura instrumentación de CI.
