# Catálogos globales: privilegios mínimos (13.824.75)

Estado: preparado y probado localmente. No acredita aplicación remota, publicación ni un cambio de seguridad en Lovable.

## Alcance

La migración `20261013040000_global_catalog_permission_hardening.sql` realiza cuatro cambios restrictivos sobre `planes`, `navieras`, `puertos`, `tipos_contenedor` y `tipos_cambio_dof`:

1. Retira todos los privilegios de tabla de `anon`.
2. Retira `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN` de `authenticated`.
3. Retira además `INSERT`, `UPDATE` y `DELETE` de `authenticated` en DOF.
4. Cambia sólo `Authenticated read planes` a `USING (activo IS TRUE)`.

No modifica datos, funciones, propietarios, roles, membresías, default privileges, otras políticas ni tablas empresariales. No introduce aislamiento por organización en catálogos globales. No demuestra una filtración de facturas ni una ruta explotable de PostgREST para ejecutar `TRUNCATE`.

| Identidad | Planes | Otros tres catálogos | DOF |
| --- | --- | --- | --- |
| anon | Sin privilegios directos | Sin privilegios directos | Sin privilegios directos |
| authenticated común | Lee activos; escrituras limitadas por RLS | Lectura global; escrituras limitadas por RLS | Lectura global; sin DML directo |
| authenticated con super_admin | CRUD y planes inactivos conservados | CRUD conservado | Lectura y RPC manual autorizada |
| service_role / propietario | Conservado | Conservado | Conservado, incluido UPSERT del cron |

Los roles SQL no son los roles funcionales. `has_role(..., 'super_admin')` sólo admite esa asignación, no `admin` ni `admin_org`. `tc_dof_upsert_manual` conserva su cuerpo, `SECURITY DEFINER`, ACL y guard de super_admin. La vista `costeo_tarifas_vigentes_v`, con `security_invoker`, conserva sus dependencias de lectura.

Antes, `anon` tenía grants de tabla aunque ninguna política aplicable: un SELECT devolvía cero filas. Después falla por privilegios. No se garantiza el mismo código HTTP. Los 24 consumidores del repositorio inspeccionados no mostraron lectura pública de estos servicios; la guía pública de puertos es estática. No se inspeccionaron clientes externos al repositorio.

## Dos artefactos distintos

- `supabase/migrations/20261013040000_global_catalog_permission_hardening.sql`: payload canónico portable, 1,056 bytes, SHA-256 `da199ffb6b8b7685cf352eb279818b562a078e4aa01d16dee7757cf641e1e93a`. Lo reproduce el replay transaccional del repositorio. No contiene registro manual en el ledger.
- `scripts/db/global-catalog-permissions/apply_guarded_PREPARED_ONLY.sql`: envelope operativo ligado a snapshot de metadatos y entorno remoto PostgreSQL 17.6. No forma parte del replay automático ni debe sustituirse por la migración suelta al operar sobre el entorno remoto.

El envelope bloquea las tablas revisadas y el ledger, exige metadatos/contexto exactos, ejecuta los bytes canónicos, verifica postcondiciones y registra `version='20261013040000'`, `name='global_catalog_permission_hardening'`, `statements=ARRAY[payload]` en la misma transacción. Un reintento sólo es no-op cuando el estado objetivo y la fila completa coinciden. La captura contiene definiciones y privilegios, sin filas empresariales ni secretos.

La aplicación remota sigue pendiente. Requiere autorización específica para estos permisos, un preflight fresco y el literal revisado, evitar escritores concurrentes de migraciones/roles y verificar el resultado/ledger después. Un merge o un test local no prueba aplicación.

La reversión preparada es otra migración forward `20261013040001`; requiere nueva autorización porque reotorga privilegios, verifica el estado esperado y conserva la fila `40000`. El archivo `rollback_guarded_PREPARED_ONLY.sql` queda fuera de `supabase/migrations`: incluirlo en el replay automático desharía el hardening. Nunca borrar o reescribir el ledger aplicado.

## Replay, baseline y pruebas

El baseline de CI se genera tras bootstrap, squash, replay ordenado y `_ci_post_migrate.sql`. El esquema limpio histórico no posee exactamente los mismos grants positivos que el entorno remoto; por ejemplo, `navieras.DELETE` llega del harness. Por ello:

- `_ci_check_global_catalog_acl.sql` comprueba privilegios prohibidos, columnas, RLS, SELECT, política de planes y canal RPC **antes** de los grants del harness. No repara estado. Una migración omitida o revertida debe fallar aquí.
- El GRANT masivo de CRUD del harness reabriría el DML DOF. Se revocan sólo esas tres capacidades inmediatamente después y se vuelve a comprobar el límite restrictivo.
- `global_catalog_acl.sql`, registrado en `_guards_manifest.txt`, verifica la matriz positiva completa después del harness.
- `test_rls_global_catalog_permissions.sql`, descubierto por el runner estándar, prueba anon, todos los roles funcionales del enum, usuario sin rol, super_admin, RPC DOF, vista invoker y service_role. Todos los datos son sintéticos y cada ejecución termina en ROLLBACK.
- Los roles legacy se modelan insertando una asignación moderna y actualizándola dentro del fixture rollback-only; no se deshabilita el trigger que prohíbe altas legacy.
- `test-negative.py`, ejecutado también por el job RLS de Actions, introduce permisos/columnas/políticas incorrectos en transacciones que deben abortar, y verifica reejecución idempotente. Nunca conecta a una base remota.

El delta del baseline es únicamente la política de planes, tres grants anon que existían en el replay y DOF de CRUD a SELECT. Las ACL sobrantes presentes sólo en el snapshot remoto no aparecen artificialmente en el baseline. No se editan migraciones históricas ni squash.

Reproducción local con PostgreSQL 17 y cliente 17.9 en PATH:

```sh
bash scripts/db/global-catalog-permissions/run-local.sh
node --import tsx scripts/audit-release-manifest.ts
node --import tsx scripts/audit-migrations.ts
node --import tsx scripts/audit-replay-mirror.ts
npx vitest run scripts/__tests__/global-catalog-permissions.test.ts
```

El runner crea su propio clúster vacío en loopback, rechaza URLs de DB/servicios heredadas y lo detiene al salir. `PG_BIN` puede indicar las carpetas de ejecutables y `GLOBAL_CATALOG_TEST_PORT` otro puerto libre. `GLOBAL_CATALOG_REPORTS` selecciona la carpeta de evidencia. Los tests locales PostgreSQL 17.9 no equivalen a ejecutar el literal ligado a PostgreSQL 17.6. Tampoco sustituyen CI remota, pruebas GUI o verificación de despliegue. Los checks opcionales históricos de concurrencia/instaladores ajenos a este cambio no forman parte de este runner.

## Trazabilidad de release

Base: `a9faa570fbaa764398844ed6e987288c764c2576`, árbol `446a23c35928d155387cbd4b7cace1395acab09a`, APP_VERSION previa 13.824.74. Los 24 consumidores y el baseline revisados en `3e2956b781d0574ad48b4e04be5b970fcd8c687a` permanecen idénticos en esta base.

El manifest conserva las 39 entradas históricas completas y agrega 13.824.75 con 1,525 migraciones, exactamente una más. No usar el `--update` actual del auditor para esta entrega: su poda a tres versiones descartaría historia. El modo de auditoría sin `--update` no modifica archivos.

Referencias: [Row Security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [privilegios](https://www.postgresql.org/docs/17/ddl-priv.html), [ALTER POLICY](https://www.postgresql.org/docs/17/sql-alterpolicy.html).
