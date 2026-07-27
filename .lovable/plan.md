# Auditoría · CI Fast (`scripts/ci-fast.sh`)

## Hallazgos (qué está mal hoy)

**Severidad ALTA**
1. **Sin paridad con CI real.** `ci:fast` corre 4 tareas (`lint`, `typecheck`, `audit:migrations`, `test:fast`), pero el workflow `.github/workflows/ci.yml` corre además: `knip:strict`, `audit:arch`, `audit:casts`, `audit:tests`, `audit:schema`, **architecture gating tests** y `build`. Podés ver verde en local y romper en PR.
2. **No hay fail-fast entre tareas.** Si `typecheck` truena en 5 s, `test:fast` sigue 2 min más. `--bail=1` sólo aplica dentro de Vitest.
3. **Trap ausente.** Si cancelás con Ctrl+C, quedan `bun`/`vitest`/`tsc` huérfanos consumiendo RAM.

**Severidad MEDIA**
4. **Orden del resumen no determinista.** El loop itera `${!PIDS[@]}` (associative array) → el orden de "✅/❌" cambia entre corridas y confunde.
5. **Sin duración por tarea.** No sabés cuál es el cuello de botella para atacarlo.
6. **`bun run lint -- --max-warnings 0`.** El `--` extra no aporta (bun ya forwardea). Cosmético pero engañoso.
7. **No hay selector `--only` / `--skip`.** Si querés re-correr sólo lint tras un fix, tenés que ejecutarlo a mano.
8. **`set -u` sin `pipefail`.** Errores en pipes (no hay hoy, pero es trampa futura).
9. **`LOG_DIR` en `/tmp` nunca se limpia.** Se acumula basura entre corridas.

**Severidad BAJA / OK**
10. **Preflight ausente:** no valida que `bun` esté en PATH ni que `node_modules/` exista.
11. **Sin salida "tail-live"** para depurar la tarea más lenta en tiempo real.

---

## Plan de mejora (una sola PR, sin cambiar código de app)

### Paso 1 · Reescribir `scripts/ci-fast.sh` con:
- `set -euo pipefail` + `trap` que mata a todos los hijos al salir/cancelar.
- Definir tareas como **arreglo ordenado** `TASKS=(name:cmd ...)` → resumen estable.
- Medir `SECONDS` por tarea y mostrar duración + total wall-clock.
- Flags CLI:
  - `--only lint,typecheck` (subset)
  - `--skip vitest` (excluir)
  - `--fail-fast` (default on): al primer ❌ mata a los hermanos.
  - `--no-fail-fast`: espera a todos (comportamiento actual).
  - `--parity`: corre el set completo (paridad con `ci.yml`).
- Preflight: validar `bun` en PATH y `node_modules/.bin` presente; si no, avisar.
- Al final, limpiar `LOG_DIR` si todo salió verde; conservarlo si hubo fallas y mostrar la ruta.
- Corregir el `--` redundante en lint.

### Paso 2 · Ampliar el set de tareas (paridad CI)
Set por defecto (rápido, ~1-2 min):
```text
lint         → bun run lint --max-warnings 0
typecheck    → bun run typecheck
migrations   → bun run audit:migrations
vitest-fast  → bun run test:fast --reporter=dot --bail=1
```
Set `--parity` (equivalente al CI, ~4-6 min):
```text
+ knip       → bun run lint:unused:strict
+ arch       → bun run audit:arch
+ casts      → bun run audit:casts
+ tests-aud  → bun run audit:tests
+ schema     → bun run audit:schema
+ arch-gate  → bunx vitest run <4 archivos gating>
```
`build` queda fuera de `--parity` (es lento y ya lo cachea Vite; se puede pedir con `--with-build`).

### Paso 3 · Documentación
- Comentario en cabecera del script explicando flags con ejemplos.
- Un renglón en `CHANGELOG.md` bajo una nueva versión patch.
- Nota corta en `README` (o `docs/`) si ya hay sección de "Running tests" — de lo contrario, sólo el header del script alcanza.

### Paso 4 · Bump de versión
`APP_VERSION` → `13.320.10` + entrada en `CHANGELOG.md`.

---

## Detalles técnicos (para revisión)

- El `trap` usa `trap 'kill 0' INT TERM EXIT` dentro de un subshell con `set -m` para poder matar el grupo de procesos completo — mata también a los hijos que `bun` lanza (esbuild workers, tsc, vitest workers).
- Fail-fast: al detectar el primer exit != 0 en el `wait -n` loop, se envía `SIGTERM` al resto de PIDs conocidos y se espera con timeout corto antes de `SIGKILL`.
- `wait -n` (bash 5+) permite reaccionar al primer proceso que termina sin polling. Ubuntu-24.04 y macOS con `bash` moderno lo soportan; añadimos check de versión y fallback al loop actual si `bash < 5`.
- Los logs se guardan en `.ci-fast-logs/<timestamp>/` bajo el repo (gitignored) en vez de `/tmp` — más fácil de compartir/adjuntar.

## Fuera de alcance
- No tocar `vitest.fast.config.ts`, `package.json` (más allá de bump), workflows de GitHub, ni la lógica de las tareas subyacentes.
- No cambiar el default de qué tareas se corren en un push de git (esto es local-only).

## Riesgos
- El `trap`/`kill 0` requiere que el script no se `source`e sino se ejecute (`bash scripts/ci-fast.sh`). Ya se invoca así vía `bun run ci:fast`.
- `wait -n` no está en bash 3.x (macOS default). Mitigado con fallback.
