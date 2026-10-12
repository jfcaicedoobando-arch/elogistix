# Propuesta de revisión de PR para replay NC

Estado: **propuesta estática, no ejecutada ni disparada**. El workflow nuevo
`nc-publica-replay-review.yml` acepta sólo `pull_request` opened/synchronize/
reopened hacia `main`, con base y head en `jfcaicedoobando-arch/elogistix` y head
exactamente `fix/nc-replay-canonical-20261012`. El filtro enumera las 15 rutas
candidatas más `supabase/schema/baseline.sql`: 16 rutas exactas, sin globs.
No usa `pull_request_target`, workflow_dispatch ni eventos push/schedule.

REVIEW_COMMIT y checkout toman `github.event.pull_request.head.sha`. El runner
lee GITHUB_EVENT_PATH como JSON y valida acción, repositorios, ramas y SHA de
head; no ejecuta contenido del payload. Exige 40 hex minúsculas y HEAD igual a
ese SHA. No compara GITHUB_SHA, porque un PR puede usar un merge sintético.
Usa `contents: read`, checkout sin persistir credenciales, ningún secret/input
de conexión, y no hace push, despliegue, migración remota ni cambios de baseline
en el checkout.

Dos jobs independientes crean cada uno su propio contenedor. Imagen única:

```text
postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae
```

Es la imagen PG17.9 fijada en `rls-tests.yml` y `local-verify.sh`; además se
verifican initdb/pg_ctl/postgres/psql/pg_dump 17.9 antes de inicializar/conectar.
`--network=none`, sin puertos publicados ni Docker socket, rootfs y staging RO, usuario postgres,
sin capabilities, con tempfs propio. `env -i` elimina variables heredadas; el
cliente Docker usa sólo el daemon Unix local y un DOCKER_CONFIG nuevo/vacío.
No se busca ni reutiliza una BD o contenedor; `docker rm --force --volumes` usa
únicamente el ID devuelto por `docker create` en este run. No hay fallback local.

## Job mínimo explícito

Node corre **fuera** del contenedor. Exporta exactamente las seis migraciones
indicadas por el preparer y prepare.mjs/matrix.sql/container-run.sh, nunca el
checkout completo. Ejecuta el preparer sin dependencias sobre ese staging de
archivos del commit exacto. Sus SQL entran
en mount RO separado de la evidencia RW; el contenedor no necesita Node.
El runner llama realmente `/prepared/driver.sql` con ON_ERROR_STOP y una sola
transacción. Ejecuta AUD DO histórico, 24 casos before y 24 after del forward
completo, y exige valores/paridad/metadata OID-owner-ACL-search_path-STABLE-
SECURITY DEFINER, interno y datos intactos. No es sólo una prueba estática ni
una invocación a un script que no está conectado al workflow.

Artefactos mínimos: source-hashes, runtime-versions, results.csv (48 filas),
metadata.csv, summary.json, logs y run.json con SHA revisado/digest/hashes.
Node vuelve a validar las salidas reales: exactamente 48 resultados (24/24),
todos passed, exactamente tres helpers, preserved=true y comparación explícita
de cada par de OID/owner/ACL/config/STABLE/DEFINER. No acepta sólo un marker de log.
Su alcance sigue siendo el fixture mínimo, no replay completo ni RLS de la app.

## Job full / baseline oficial

El host exporta únicamente scripts/db, scripts/ci y supabase/migrations,
migrations_archive (si existe), schema y tests; permite extensiones de código/SQL e ignora
por nombre .env*, .git, credentials/config y archivos de credenciales, sin
leerlos. Rechaza symlinks. `staging.json` registra rutas/hashes exportados.
El contenedor nunca monta el checkout completo, .env/.git ni Docker socket.

En una copia temporal de ese staging dentro del contenedor, llama sin reimplementar el flujo:

```bash
bash scripts/db/local-verify.sh --backend local --only-schema --keep \
  --port 5432 --snapshot-pre /evidence/schema.pre-ci-post-migrate.sql \
  --snapshot /evidence/baseline.generated.sql
```

El script oficial carga bootstrap, squash por inventario, migraciones restantes
ordenadas y su mismo stubbing CI de extensiones managed-only; ejecuta candado
service_role-only antes de post-migrate, cobertura RLS, integridad y genera el
dump normalizado mediante `schema-snapshot.sh`. `pg_dump` está dentro de la
imagen exacta 17.9. **El dump se toma antes de fixtures**. El modo `--keep` sólo
permite usar ese cluster propio para los siguientes guards/RLS; el wrapper lo
detiene y elimina el contenedor al terminar.

El dump pre-post-migrate conserva los GRANT del replay sin permisos amplios de
fixtures CI. La baseline golden y catalog.after-ci-post-migrate.csv reflejan el
estado posterior a post-migrate, como el flujo oficial; ese catálogo no prueba
ACL alojadas ni sustituye las assertions previas/posteriores del job mínimo.

Luego registra diff contra la baseline del commit, catálogo de los tres helpers
y ejecuta `run-guards.sh` (serial) y `run-rls-suites.sh`. Si hay drift, continúa
para conservar sus logs, pero el resultado final falla: no acepta la baseline
generada ni silencia guards. El dump es sólo un artifact revisable. No copia
SQL sobre `supabase/schema/baseline.sql`, no edita squash/historia, y no hace Git.

Esto sigue el flujo baseline de `local-verify.sh`; no sustituye todo el job
`RLS tests result`, sus controles opt-in de otros instaladores ni concurrencia.
Esos checks existentes siguen siendo obligatorios para aprobación final.

## Fuentes y validación pendiente

Leídos en commit base `f428dc3c3f79ad4a1083de6c3ed8ba21c7b419d4`:
`.github/workflows/rls-tests.yml`, `scripts/db/local-verify.sh`,
`scripts/db/schema-snapshot.sh`, `scripts/ci/rls-prepare-db.sh`,
`scripts/ci/run-guards.sh`, `scripts/ci/run-rls-suites.sh` y cutoff del squash.
El run futuro registra hashes del commit seleccionado, sin usar main flotante.

No hubo Docker, PostgreSQL, Bash, Gitwrite, CI trigger ni instalación local.
La validación local autorizada se limita a lectura y `node --check`; Bash
mantiene el bloqueo AccessDenied previo, y PG17.9 falta. No se afirma que este
workflow/SQL ya pasó. La ejecución del PR debe revisarse antes de aceptar sus
artefactos o completar la regeneración de baseline.
