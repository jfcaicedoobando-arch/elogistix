## Auditoría de GitHub Actions

Revisé los 8 workflows (`actionlint`, `ci`, `codeql`, `dependency-review`, `e2e`, `gitleaks`, `post-deploy-smoke`, `rls-tests`) + la composite `setup-bun` + `dependabot.yml`. En general están bien (SHAs pinneados, `concurrency`, permisos mínimos, dependabot activo). Estos son los hallazgos por severidad:

### CRÍTICO

1. **`ci.yml` — Steps engañosamente llamados "(informational logs)" que SÍ tumban el job** (líneas 53-57): `Architecture audit` y `Casts audit` corren sin `continue-on-error: true`. Si exit ≠ 0, el job entero falla, contradiciendo el nombre. Hoy pasan, pero si alguien añade un finding, el bloqueo será sorpresivo y difícil de diagnosticar. Decidir: o son informativos (agregar `continue-on-error: true`) o son gating y quitamos el "(informational logs)" del nombre.

2. **`ci.yml` — `lint:unused:strict` con `continue-on-error: true`** (línea 47): ya pasa local; el flag oculta regresiones. Endurecerlo: si vuelve a tronar (otra vez `glob` no instalado, p.ej.), nos enteramos.

### ALTO

3. **`post-deploy-smoke.yml` — `user-management-smoke` gating frágil** (línea 32): `if: vars.DEMO_USER_EMAIL_PRESENT == 'true'` depende de una variable manual que nadie mantiene; si se olvida ponerla, el smoke se salta sin avisar. Reemplazar por validación dentro del step (que ya existe en líneas 41-49) y quitar el `if`, así el cron siempre intenta correr y falla ruidosamente si faltan secrets.

4. **`rls-tests.yml` — Drift de versión de `actions/cache`**: usa `v4.2.0` (línea 105) mientras los demás workflows están en `v5.0.5`. Unificar a v5.0.5 para que dependabot agrupe upgrades.

### MEDIO

5. **`e2e.yml` — Reinstala Playwright incluso con cache hit** (línea 76): `bunx playwright install --with-deps chromium` corre siempre. Agregar `if: steps.pw-cache.outputs.cache-hit != 'true'` para ahorrar ~30s por run. (Las deps de sistema sí se reinstalan; partir en dos steps).

6. **`ci.yml` edge-functions — `deno test --no-check`** (línea 139): salta el type-checking de los tests Deno; un error de tipos pasa de largo. Agregar un step previo `deno check supabase/functions/**/*.ts` (sin `--no-check`) o quitar `--no-check` aquí.

7. **`actionlint.yml` — solo en PR** (línea 7): si alguien hace push directo a `main` (admin), no se valida. Añadir `push: { branches: [main], paths: [...] }`.

### BAJO / NIT

8. **`setup-bun/action.yml` — `bun install --ignore-scripts`** (línea 22): bueno para seguridad, pero `esbuild`, `@swc/core` y `@react-pdf/renderer` necesitan postinstalls. Hoy funciona porque los binarios se descargan en runtime, pero documentar el riesgo en un comentario más explícito.

9. **Inconsistencia de cache keys**: `setup-bun` hashea `bun.lockb, bun.lock, package.json`; `e2e.yml` (que no usa la composite) sólo hashea `bun.lockb, package.json`. Migrar `e2e.yml` a usar `./.github/actions/setup-bun` y eliminar duplicación (~25 líneas).

10. **`codeql.yml` — sin `paths-ignore`** para `**/*.md` y `docs/**`: corre análisis pesado por cambios de docs. Agregar.

11. **`dependency-review.yml` — `fail-on-severity: high`**: si queremos posture más estricta, bajar a `moderate`. Opcional.

## Plan de implementación

Voy a aplicar las 11 correcciones en un solo PR, ordenadas por archivo:

### `ci.yml`
- Quitar `continue-on-error: true` de `lint:unused:strict` (#2).
- Renombrar `Architecture audit` y `Casts audit` quitando "(informational logs)" para reflejar que son gating (#1). Si prefieres que sean informativos, agrego `continue-on-error: true` en su lugar — me dices.
- Quitar `--no-check` del `deno test` del job `edge-functions` y/o agregar un step `deno check` previo (#6).

### `post-deploy-smoke.yml`
- Eliminar el `if: vars.DEMO_USER_EMAIL_PRESENT == 'true'` del job `user-management-smoke`; el step de validación ya falla si faltan secrets (#3).

### `rls-tests.yml`
- Subir `actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57 # v4.2.0` → `@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5` (#4).

### `e2e.yml`
- Reescribir para usar la composite `./.github/actions/setup-bun` (elimina ~15 líneas duplicadas) (#9).
- Partir Playwright install: `--with-deps` siempre (deps de sistema), `bunx playwright install chromium` sólo si no hubo cache hit (#5).

### `actionlint.yml`
- Añadir trigger `push: { branches: [main], paths: [...] }` (#7).

### `codeql.yml`
- Añadir `paths-ignore: ["**/*.md", "docs/**"]` a ambos triggers (#10).

### `setup-bun/action.yml`
- Comentario más explícito sobre `--ignore-scripts` y qué deps lo asumen (#8).

### `dependency-review.yml`
- Dejar como está, anotar en comentario que se puede bajar a `moderate` cuando queramos endurecer (#11).

### Validación
- Correr `actionlint` local (vía `nix run nixpkgs#actionlint`) sobre todos los YAMLs modificados antes de cerrar.
- Bump `APP_VERSION` a `13.69.0` (cambio CI considerable, no fix de bug) + entrada en CHANGELOG.

### Errores suprimidos en el código (fuera de Actions, fyi)

Encontré 17 `@ts-nocheck` y 14 `@ts-expect-error` en `supabase/functions/**` — casi todos son "Deno runtime" legítimos (el bundle web no tiene tipos Deno). Limpiarlos requiere agregar `deno.json` con `compilerOptions.types` y configurar el typecheck del CI Deno. **No lo incluyo en este PR** porque es trabajo independiente y arriesga romper más de lo que arregla. Si quieres, te armo un plan aparte después.

¿Vamos con todo el plan, o quieres ajustar algo antes de implementarlo?
