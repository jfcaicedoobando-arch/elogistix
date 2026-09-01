# Squash de migraciones de base de datos

Hoy el repositorio tiene **1193 archivos de migración (6.5 MB)**. Cada corrida de CI y cada verificación local reconstruyen la base aplicándolos uno por uno, con parches de excepción para migraciones legacy que ya no aplican en base limpia. Eso hace lento y frágil todo cambio de base.

La propuesta: reemplazarlos por **una sola migración base** que ya contiene el esquema completo tal como quedó verificado hoy (v13.820.7), y archivar el historial.

## Qué NO cambia

- La base de datos real (producción y preview) **no se toca**: es sólo una reorganización de archivos del repositorio. No se aplica nada nuevo al servidor.
- El esquema resultante debe ser **byte a byte idéntico** al actual (`supabase/schema/baseline.sql`). Si difiere aunque sea una línea, se detiene el trabajo.
- Los archivos canónicos de `supabase/schema/**` (fuentes de funciones y RPCs) siguen igual.

## Qué se hace

1. **Generar la migración base**: se levanta un Postgres limpio 17.9, se aplican las 1193 migraciones actuales y se vuelca el esquema resultante a un único archivo `supabase/migrations/00000000000000_baseline_squash_v13_820_7.sql`.
2. **Archivar el historial**: los 1193 archivos se mueven a `supabase/migrations-archive/` (quedan consultables, ya no se ejecutan).
3. **Verificar equivalencia**: se reconstruye una segunda base limpia sólo con la migración base y se compara contra `supabase/schema/baseline.sql`. Debe dar diff vacío.
4. **Limpiar las muletas que ya no aplican**: exenciones de migraciones legacy en CI (`MIGRACIONES_EXENTAS`), `drift-anclas.txt` y las partes de `_ci_drift.sql` que el volcado ya incorpora.
5. **Actualizar guardas y manifiesto**: fecha de corte del auditor de higiene de migraciones, manifiesto de release, y documentación (`ARCHITECTURE.md`, `docs/migrations-hygiene.md`).
6. **Correr la verificación completa**: `db:postcheck` (guards + 6 suites RLS) y `ci:fast` en verde antes de cerrar.

## Detalles técnicos

- La migración base es el volcado de `pg_dump --schema-only --schema=public` normalizado con `scripts/db/schema-snapshot.sh`, la misma herramienta que genera el baseline actual, con el contenedor pinneado 17.9 (si Docker no está disponible, con el backend `initdb` local que ya usa `local-verify.sh`).
- Se conserva el orden de aplicación de CI: `_ci_bootstrap.sql` (stubs de `auth`/`storage`/`cron`/`net`/`pgmq`) → migración base → `_ci_post_migrate.sql` → verificación RLS.
- Protección contra reejecución en el servidor: la migración base lleva un encabezado explícito y un `DO` inicial que aborta con mensaje claro si detecta que el esquema ya existe (`to_regclass('public.embarques')`), de modo que un intento accidental de aplicarla sobre una base poblada falle limpio en lugar de a medias.
- El auditor `audit:migrations` conserva su lógica; sólo sube su fecha de corte al timestamp de la migración base.
- `audit:manifest` exige "manifest == disco": se regenera con `db:release-manifest:update` bajo la nueva versión.
- Bump de versión a **13.821.0** + entrada en `CHANGELOG.md`.

## Riesgo y salida

El riesgo principal es una diferencia silenciosa entre el esquema reconstruido y el actual; el paso 3 (diff contra `baseline.sql`) es el candado que lo hace imposible de pasar por alto. Si el diff no queda vacío, se revierte el archivado y se reporta la divergencia en lugar de forzar el squash.
