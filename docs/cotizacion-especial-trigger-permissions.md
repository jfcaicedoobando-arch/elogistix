# Cotizaciones especiales: frontera de permisos del trigger

## Causa y cambio

La migración0031 hace privado `_cotizacion_margen_pct(uuid)`, un helper SECURITY DEFINER sin filtro de organización propio. La0032 llama ese helper desde `_cotizacion_autorizacion_guard`, que sigue SECURITY INVOKER. Un UPDATE con rol authenticated llega a la autorización automática y falla con `permission denied for function _cotizacion_margen_pct`.

La0037 es forward-only sobre main f8d80a (PR447 fusionado). No modifica0031/0032 ni añade permisos EXECUTE al helper. El trigger pasa a SECURITY DEFINER, con ejecución directa revocada a PUBLIC, anon, authenticated y service_role. Comprueba tabla, fase, nivel y operación; en la rama de cliente especial, antes de leer el margen, exige identidad autenticada, organización activa idéntica y que ni id ni organization_id cambien. El UPDATE original sigue sujeto a permisos y RLS del llamante. Los caminos de autorización normal, protección de metadatos y cálculo de margen se conservan.

Trigger y helper usan search_path `pg_catalog, public, pg_temp`; el cliente se referencia como `public.clientes`. Así una tabla temporal no puede sustituir las relaciones que lee el helper. El helper sigue privado: dar EXECUTE a authenticated permitiría consultar UUID de otras organizaciones.

La transición automática requiere actor y scope también para un llamante privilegiado. Un proceso service_role sin identidad/scope no obtiene autoautorización implícita. Esto es deliberado, no un permiso adicional. No se usa current_user para identificar al usuario porque cambia dentro de SECURITY DEFINER. No se alteran otros RPC, datos de negocio, márgenes mínimos ni políticas RLS.

## Verificación sintética

`scripts/tests/cotizacion-special-permissions.sh` inicia un PostgreSQL completamente nuevo en 127.0.0.1, sin consumir URLs ni variables de conexión remota. Requiere initdb, pg_ctl y psql; admite INITDB_BIN, PG_CTL_BIN, PSQL_BIN y TEST_PG_PORT. El fixture aplica0031/0032 reales, reproduce el error, aplica0037 y termina en ROLLBACK; el runner detiene el servidor.

Resultado: PASS en PostgreSQL17.9. Cubre authenticated enviar/aceptar con margen40%, helper y guard privados, cliente general sin autorización, referencia de cliente de otro tenant, manipulación de autorización, id/tenant alterados, RLS propio/ajeno, uid vacío, scope vacío, visibilidad privilegiada simulada con tenant incorrecto, anon y tablas temporales maliciosas. Confirma que el trigger handover se dispara, usando una implementación sintética del handover.

El fixture usa funciones auth.uid/org_scope y visibilidad de superadmin simuladas. No certifica integración del catálogo productivo, del handover completo ni la identidad real del propietario. La reconstrucción completa y CI son comprobaciones distintas. Antes de aplicación remota, verificar dueño confiable de ambas funciones, search_path, ACL y funciones org_scope reales; no añadir grants para hacer pasar pruebas.

El espejo de0037 es exclusivamente CI; journal, snapshot y hashes se añaden después de0036. No se crean copias Supabase elegibles para despliegue. Históricos intactos. No se ha aplicado ninguna migración a bases del proyecto ni desplegado.

## Rebase, catálogo y verificación final

La migración nunca aplicada se renumeró de0036 a0037 tras integrar PR447 en main f8d80a783f937e511b7ad6ba2eaaf17cff6b9a69. Se conservan los SQL/snapshots/journal históricos. El nuevo idx37 usa when1793990589448, estrictamente posterior a0036, y el prevId apunta a0036.

- Reconstrucción completa nueva en PostgreSQL17.9 local: squash +348 migraciones canónicas +historial aislado hasta0037, ACL previas al harness, candado service_role-only, cobertura RLS e integridad: PASS. Log `.db-verify-logs/20261106-134320/`.
-66/66 suites RLS y226/226 guards del catálogo oficial: PASS. Los guards están en `.db-verify-logs/special-0037-official-guards/`.
-El guard nuevo `supabase/tests/cotizacion_especial_autorizacion.sql` usa auth/org_scope/RLS reales y actores sintéticos. Comprueba envío autenticado, margen30%, aceptación, handover real asignado, creación de embarque Borrador, restauración de claims e idempotencia. Termina en ROLLBACK y está registrado para CI.
-78/78 tests focalizados de historial, catálogo y modelo bounded0035: PASS.13 tests del contrato H14: PASS. Auditorías de migraciones, replay mirror, funciones y manifest: PASS; las dos divergencias históricas exactas no cambian.
-Baseline regenerado con el normalizador existente, SHA-256 `f9f7c48067c3e9e1273eff373b16ebf8a68e644bdd395a058b01458c7d4c1a7d`. El diff contiene sólo el guard (cuerpo, definer, path y ACL) y el search_path del helper.

El primer ensayo detectó que comprobar identidad/scope antes de distinguir cliente especial cambiaba el error histórico del cliente general. La comprobación de scope se movió exclusivamente a la rama especial, antes del margen; la de id/tenant inmutable sigue antes de la rama. La regresión RLS r4 y todos los negativos sintéticos pasan después del ajuste. El primer fixture de integración también se corrigió para respetar la creación automática de user_roles al sembrar membresías.

El runner bruto que enumera todo supabase/tests ejecuta además `selector148_disabled_gate.sql`, fuera del catálogo automático y contradictorio con el endpoint habilitado; falló en ese ensayo. No se cambia ni se oculta ese test. La ejecución final usa el catálogo oficial y reporta los resultados anteriores, no una aprobación del glob completo.

## Fidelidad de ACL y auditoría

El harness amplio de CI reabría EXECUTE al trigger. Se comprueba su ACL owner-only exacta y ambos search_path antes de grants. Inmediatamente después del post-migrate, un soporte separado revoca sólo los dos grants artificiales y revalida. Ambos pasos están conectados en el workflow y el runner local; los soportes están registrados en el catálogo. El companion `_ci_post_migrate.sql` y los contratos H14 permanecen byte a byte intactos.

El modelo acotado del parche dinámico0035 rechaza journals nuevos por diseño. Se amplía únicamente para el orden exacto hasta0037 y un SHA-256 independiente del SQL0037 revisado. Éste no redefine ninguno de los dos targets0035. Preimágenes, contadores de reemplazo, parser y excepciones históricas no cambian; nuevos negativos rechazan tag/timestamp incorrectos, migración adicional y un0037 alterado.

El fixture sintético mínimo sigue siendo una orden explícita; el guard de integración real sí corre en el catálogo automático. CI remoto y revisión del catálogo desplegado siguen pendientes. No hubo conexiones a bases del proyecto, aplicación remota ni despliegue.
