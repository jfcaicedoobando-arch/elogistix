# Revisión de `.github/workflows/rls-tests.yml`

## Veredicto general

**Sí, está bien hecho.** Es un workflow sólido y por encima del promedio:

- Imagen Postgres pinneada por **digest SHA256** (reproducible, sin drift).
- Actions pinneadas por SHA (`checkout`, `upload/download-artifact`) — buena práctica de supply-chain.
- `permissions: contents: read` (mínimo privilegio).
- `concurrency` con `cancel-in-progress` para no apilar runs.
- `timeout-minutes` en ambos jobs (evita runners colgados).
- Patrón **prepare-once + matrix-restore** vía `pg_dump`/`pg_restore` — ahorra ~10x vs re-bootstrap por suite.
- `fail-fast: false` en la matriz para ver todas las suites rojas en un solo run.
- `psql -v ON_ERROR_STOP=1 -X -q` (falla rápido, sin `.psqlrc`).
- Filtros `paths:` correctos en triggers.
- Roles Supabase (`anon`, `authenticated`, `service_role`, …) creados antes del restore — corrige el problema clásico de "role does not exist".
- Comentarios explicando *por qué* se mantienen los GRANTs (lección aprendida del bug reciente).

## Mejoras propuestas (ordenadas por impacto)

### 1. Cachear el snapshot por hash de migraciones (alto impacto)
Hoy el job `rls` corre en **cada** PR aunque las migraciones no cambien. Añadir `actions/cache` con key derivada de `hashFiles('supabase/migrations/**', 'supabase/tests/rls/_ci_*.sql')` y saltar bootstrap+migrations si hay hit. Ahorra 1–3 min por PR.

### 2. Reportar resultados de cada suite en el PR
Hoy hay que abrir los logs. Capturar el stdout de cada suite a un archivo y publicarlo con `actions/github-script` o `dorny/test-reporter` como check summary. Mínimo, hacer `tee` a `suite-${{ matrix.suite }}.log` y subirlo como artifact con `if: always()`.

### 3. Validar que la matriz cubre **todos** los archivos `test_rls_*.sql`
Riesgo actual: si alguien agrega `supabase/tests/rls/test_rls_nuevo.sql` y olvida añadirlo a `matrix.suite`, **no se ejecuta y CI pasa en verde**. Añadir un step en el job `rls` que liste los archivos y falle si hay alguno no listado en la matriz (o generar la matriz dinámicamente con `outputs` + `fromJSON`).

### 4. Ejecutar cada suite en transacción + ROLLBACK
Envolver cada `test_rls_*.sql` con `BEGIN; … ROLLBACK;` (o usar `psql --single-transaction`) para garantizar que una suite no contamine a otra si en el futuro se reutiliza la BD. Hoy cada suite tiene su Postgres efímero así que no es crítico, pero protege contra regresiones de diseño.

### 5. `--single-transaction` en la aplicación de migraciones
En el step "Apply migrations", correr cada `.sql` con `psql --single-transaction` para evitar bases a medio aplicar si una migración rompe a mitad. Hoy ya tienes `ON_ERROR_STOP=1` pero sin transacción quedan objetos parciales.

### 6. Reducir privilegios del runner del job `rls-suites`
Usar `SET ROLE authenticated` ya está bien, pero conectar como un usuario no-superuser (no `postgres`) en las suites detectaría GRANTs faltantes más temprano. Crear `ci_runner` con `NOINHERIT` + `GRANT authenticated, anon TO ci_runner`.

### 7. Job final "all green" para branch protection
Añadir un job `rls-tests-result` con `needs: [rls-suites]` y `if: always()` que verifique `needs.rls-suites.result == 'success'`. Permite proteger main con **un único required check** en vez de 7.

### 8. Pequeños detalles
- `retention-days: 1` está bien para el snapshot; añadir `compression-level: 9` reduce ~40% del tamaño.
- Considerar `services.postgres.options` con `shm_size=256m` si alguna migración usa índices grandes.
- Renombrar `PSQL` env a algo no-reservado (no hay colisión real, pero es confuso porque `psql` también es comando).
- Triggerar también en cambios a `.github/workflows/rls-tests.yml` ✅ (ya está) y considerar `schedule:` semanal para detectar drift de la imagen Postgres aunque no haya PRs.

## Detalles técnicos

```text
Mejora #1 — cache key sugerida:
  key: rls-snapshot-${{ runner.os }}-pg15.8-${{ hashFiles(
        'supabase/migrations/**',
        'supabase/tests/rls/_ci_*.sql'
      ) }}
  path: .rls-snapshot/db.dump
```

```text
Mejora #3 — guardia de matriz (pseudo):
  expected=$(ls supabase/tests/rls/test_rls_*.sql | sed 's|.*test_rls_||;s|\.sql$||' | sort)
  declared="isolation financiero financiero_critico crm_operacional
            operaciones tarifas_y_costeo roles_no_admin" | tr ' ' '\n' | sort
  diff <(echo "$expected") <(echo "$declared") || exit 1
```

## Qué haría yo primero

Si solo eliges 3: **#3 (guardia de matriz)**, **#2 (logs por suite como artifact)** y **#7 (job all-green para branch protection)**. Son baratas, no tocan la lógica de tests, y cierran agujeros reales.

¿Quieres que implemente alguna(s) de estas mejoras? Indícame los números.
