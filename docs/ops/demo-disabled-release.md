# Release 13.824.84: demo temporalmente no disponible

Base: `a58228ae4c696c542b8042010de8b5abfda97d8c`. Candidato local para coordinación;
sin publicación, migraciones en bases reales ni despliegue. No incluye el escritor,
issuer de máquina ni preparador de identidad pendientes de revisión.

## Contrato de acceso

- La UI muestra «Demo no disponible» y no abre el formulario. El diálogo y el hook
  de este flujo no registran `demo_leads`, invocan Edge, inician sesión ni navegan,
  tampoco al abrir directamente el diálogo o reenviar un submit. La copia de
  errores de este flujo siempre devuelve el aviso saneado. El mensaje permite contactar al equipo,
  sin recomendar reintentos. La captación comercial restante no cambia.
- `demo-access` conserva OPTIONS y el CORS público original. El adaptador no
  conecta proveedor de disponibilidad ni configuración de credenciales: responde 503 `{"error":"demo_unavailable"}`
  con Retry-After 30 y Cache-Control no-store antes de crear clientes, consultar,
  resetear o crear usuarios, asegurar membresía o ejecutar SQL/RPC.
- Los límites por IP/global permanecen detrás de una eventual decisión confiable
  del servidor. No hay flag/request/credencial alternativa que habilite esta release.
- No se borran ni cambian cuentas, sesiones, memberships, organizaciones o datos.
  **No se revocan sesiones existentes.** Usuarios ya autenticados pueden conservar
  acceso según sus permisos actuales; no se afirma cierre retroactivo de sesiones.

## SQL forward atómico

`20261015050000_disable_demo_reseed.sql` verifica los cuerpos exactos conocidos del
candidato, firma/defaults, propietario postgres, lenguaje, SECURITY DEFINER,
configuración y ACL preexistentes de las cuatro funciones. Acepta sólo las
pre/postimágenes fijadas, incluido el dump normalizado revisado. Cualquier drift
aborta, sin reparar privilegios ni admitir funciones de otra rama.

En una única transacción reemite completas `_seed_demo_limpiar_financiero`, core,
legacy y guarded con SQLSTATE 55000 y
`LC_SEED_DEMO_CONSERVACION_PENDIENTE`. Conserva primero los rechazos anteriores de
autorización, incluido `auth.uid()` nulo del core. El bloqueo está antes de locks,
cooldown/false, ensure, DML, flags de limpieza y marcador. No hay opción de bypass.
Tras el lote, exige la misma metadata completa de pg_proc —OID, owner, ACL y demás
atributos— salvo prosrc, cuya postimagen también debe coincidir. Un fallo revierte
las cuatro definiciones juntas. REVOKE/GRANT sólo reafirman la ACL ya comprobada.

Los cuerpos actuales se conservan detrás del rechazo; no se restaura una versión
vieja destructiva. Los cuatro canónicos y baseline reflejan el nuevo forward.
El historial Drizzle 0014/0015 y sus replay mappings no se reescriben. El manifest
agrega la release y conserva todas las entradas históricas, sin poda.

## Evidencia y límites de validación

Las pruebas SQL preparadas ejercitan las funciones reales, sin core/helper stub:
45 rechazos por matriz, cuatro rutas, dos organizaciones, usuario técnico y legacy
authenticated/super_admin, cooldown ausente/antiguo/reciente y argumentos
0/600000/default/NULL. Observers BEFORE STATEMENT con secuencia no transaccional
detectan DML aunque una excepción lo revierta. Snapshots completos comprueban
filas/secuencias, cotizaciones/embarques manuales, pricing, costeo y marcador.
Las suites finales exigen el mismo bloqueo con READ COMMITTED, REPEATABLE READ y
SERIALIZABLE. El runner conserva inspección del servicio, clones propietarios,
fingerprint del origen y limpieza. En cada clone final también confirma fixtures
en una conexión A, confirma 15 rechazos en B por cada marcador y compara en una
conexión C READ ONLY todos los datos, secuencias, marcador y metadata. Son 45
llamadas confirmadas por clone además de las 45 de la matriz rollback; no hay
reparación de datos entre los rechazos y su comprobación persistida.

Las cuatro suites positivas históricas permanecen byte a byte como en a58228a en
`supabase/tests/rls/history/demo-prefreeze/`. El preparador captura exactamente un
checkpoint inmediatamente antes del nuevo forward. Dos clones de ese checkpoint
ejecutan las cuatro suites y la concurrencia original, con sus locks/55P03. Sus
stubs transaccionales sólo pertenecen a los clones históricos; nunca se instalan
definiciones anteriores sobre la base final. El catálogo exige hashes, ejecución
completa, identidad de servicio, conservación del origen y limpieza antes de
aceptar la evidencia RLS. No basta clasificar las suites como soporte.

La validación local ejecutó el preparador canónico en PostgreSQL 17.9 fijado por
digest, dentro de un contenedor propio sin red, puertos ni mounts. Aplicó 342
migraciones y omitió una migración sólo de datos según el preparador existente.
El checkpoint histórico se ejecutó una vez; las cuatro suites históricas y la
concurrencia original pasaron en dos clones. El forward y su repetición exacta
conservaron OID, owner, ACL y atributos. Trece controles negativos comprobaron
drift de cuerpos, ACL y metadata, además de un fallo posterior a las cuatro
reemisiones, con rollback completo de las definiciones originales.

Las matrices finales y las conexiones A/B/C produjeron 360 rechazos reales
SQLSTATE 55000 sin ningún intento de DML. Los tres niveles de aislamiento pasaron.
El origen estricto conservó sus 13 FK hacia auth.users y sus tablas, permisos,
RLS, constraints y triggers; sólo cambiaron los cuatro cuerpos protegidos. Pasaron
los guards de servicio, las referencias RPC revisadas y tres controles de CRM.
La auditoría RPC real revisó 689 objetos sin excepciones nuevas ni drift.

Un clone separado ejecutó exclusivamente el `_ci_post_migrate.sql` canónico para
comprobar el contrato habitual posterior al harness: pasaron los guards de
catálogos y el dump resultó byte a byte igual al baseline del candidato. Este
resultado no se presenta como una ejecución del guard completo en el origen
estricto: su primer intento allí rechazó el permiso navieras.DELETE esperado por
el harness. No se añadieron grants ad hoc ni se alteró el origen para obtener PASS.
Las ocho bases QA y el contenedor de esa validación quedaron eliminados.

El helper de CI de catálogos comprueba ahora el conjunto exacto de las 13
políticas revisadas de los cinco catálogos, con EXCEPT en ambos sentidos y
normalización exclusiva de whitespace. En otro PostgreSQL 17.9 aislado pasó la
preimagen canónica; añadir OR true o una política permisiva extra produjo
GLOBAL_CATALOG_EXACT_POLICY_SET_DRIFT. Tras cada fixture, una conexión nueva
comprobó la restauración de las políticas, datos, roles y ACL. Esta mejora sólo
valida el catálogo; no aplica cambios de permisos ni migra bases de aplicación.

Esta evidencia corresponde al runtime local aislado y a sus hashes, no a una
ejecución remota de CI ni a una aprobación de despliegue. No demuestra regeneración
segura habilitada, procedencia de identidad ni idempotencia de un futuro seed.

El workflow `demo-disabled-validation.yml` fija Deno 2.9.7, caché nueva, resolución
del grafo original (incluido Sentry Deno 11.4.0), `deno info` y `deno check` sobre
el adaptador desplegable completo. No usa noCheck, ts-ignore, imports sustitutos
ni TLS relajado. Los tests puros del handler son evidencia distinta.
La entrega HTTP saneada recibió revisión canónica independiente con Deno 2.9.7,
imports originales y Sentry 11.4.0. Sus seis archivos finales se verifican por
blob, tamaño y SHA256 al integrar. No se añaden anotaciones/any, imports sustitutos
ni suppressions. En este entorno la descarga original esm.sh falló por el túnel;
esa limitación local se distingue de la evidencia canónica externa. Los 41 tests
puros se vuelven a ejecutar localmente con typecheck y sin red/entorno en runtime.

El smoke v3 aprobado sobre a58228a exige HTTP 503 con un único miembro textual
`{"error":"demo_unavailable"}`, sin campos adicionales, claves duplicadas,
escapes ni credenciales; admite whitespace JSON. Conserva
los pings independientes y declara las cuatro comprobaciones autenticadas
omitidas. Su test offline tiene ruta exacta en el catálogo y se ejecuta siempre
en el detector de CI ordinario después del inventario. El workflow remoto sigue
siendo manual y no se ejecuta durante esta preparación.
