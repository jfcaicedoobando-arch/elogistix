# Reconstrucción aislada de Drizzle 0026–0034

## Alcance y procedencia

CI 42130629858, commit `101937c95c89c2ac45c3c541032921577fb8dbd6`,
falló con 9 DR1 y 24 DR4: las fuentes 0026–0034 estaban en Git y en el
journal, pero no tenían reconstrucción declarada. No había evidencia de que
los SQL hubieran cambiado de hash: faltaban las entradas completas.

Se conserva cada fuente byte a byte, incluido el salto final ausente cuando
corresponde. Las copias bajo `scripts/ci/drizzle-history/` son sólo entradas de
reconstrucción de pruebas. `control.mjs` fija sus SHA-256 de forma independiente
y `drizzle/replay.json` las declara `isolated-ci`. Ambos preparadores existentes
consumen realmente la lista verificada y ejecutan cada archivo en transacción;
no se añadió una allowlist para silenciar DR1/DR4.

No se modifica ninguna fuente, entrada de journal ni snapshot histórico.
Se añade el forward 0035 con una nueva entrada de journal y snapshot de cadena
(custom SQL, igual estructura vacía que 0034), además de su espejo aislado.
No se añaden migraciones elegibles a `supabase/migrations/` ni se cambia el
manifest de producción. Los nombres `eligibleName` del control son nombres
**prohibidos**, no archivos por publicar. También se rechazan copias literales
con cualquier otro nombre en el directorio productivo.

## Orden y dependencias

Después de la cadena canónica y las fuentes aisladas 0021–0023 (incluida la
0022 archivada), se ejecutan exactamente 0026, 0027, 0028, 0029, 0030, 0031,
0032, 0033 y 0034. 0024/0025 ya se reconstruyen por sus replays canónicos.

- 0026 instala los triggers de comisiones/herencia de vendedora.
- 0027 define `clientes.tipo_cliente`; 0032 depende de esta columna.
- 0028 agrega campos de Pricing consumidos por 0030.
- 0029 crea `cotizacion_handovers` y su trigger inicial.
- 0030 actualiza el contrato de solicitudes Pricing y sus RPC.
- 0031 crea autorización y sustituye el handover inicial por autorización.
- 0032 sustituye el guard de autorización y su trigger posterior.
- 0033 depende del handover y añade creación automática/candado de cierre.
- 0034 sustituye conversión de prospecto y su guard de cotización.

No se reordena ni combina el cuerpo efectivo de las funciones: se conserva
cada transición histórica, además de comprobar la definición final.

## Riesgos conservados, no certificados como seguros

La copia aislada no es una revisión de autorización para producción:

- 0027 contiene un UPDATE de dos clientes concretos. En el PostgreSQL nuevo no
  existen esos clientes; no se elimina ni se cambia ese SQL para lograr el replay.
- 0029 da SELECT a authenticated y ALL a service_role; su política permisiva
  usa la organización actual, pero **falta la política RESTRICTIVE de tenant
  activo** exigida por el guard de integridad. El replay real detecta este fallo.
- 0031 conserva el cálculo de margen y lectura de umbral originales. No escribe
  ni modifica la configuración comercial mediante este cambio de repositorio.
- 0032 mantiene la excepción histórica para clientes especiales. No se altera
  esa política comercial como parte de corregir infraestructura CI.
- 0033 conserva el cambio temporal de claims JWT a un coordinador/gerente y la
  restauración tanto en éxito como excepción. No se declara segura esa técnica
  por el hecho de poder reconstruir su SQL.
- Los REVOKE/GRANT presentes se preservan literalmente. CREATE OR REPLACE puede
  conservar ACL previas; por eso un hash o un examen de texto no sustituye una
  comprobación del catálogo real antes de cualquier aplicación remota.

## Validación de esta corrección

- 49/49 tests: historia aislada, reconstrucción canónica, demo 0014 y CRM
  0016–0018. Incluye deriva simultánea de fuente y fixture, falta de fixture y
  copia elegible renombrada para cada una de las nueve fuentes nuevas.
- `audit:migrations`: limpio, 139 archivos post-baseline / 1542 totales.
- PostgreSQL 17.11 efímero nuevo en loopback: bootstrap y squash, 348 migraciones
  canónicas posteriores, una omisión de datos preexistente, toda la historia
  aislada, candado service_role-only, post-migrate y cobertura RLS pasaron.
- Antes de añadir 0035, el guard final de integridad **falló** con
  `tabla_negocio_sin_scope_tenant|cotizacion_handovers`. No se ajustó el guard ni
  se reescribió 0029. Ese defecto se cierra con el forward 0035 descrito abajo; añadir sólo
  los espejos históricos no bastaba para dejar la reconstrucción en verde.

El harness local requirió únicamente desactivar sockets Unix en una copia
transitoria del ejecutor y usar TCP 127.0.0.1; no hubo conexiones a bases del
proyecto. Se regeneró posteriormente el baseline SQL de CI según la revisión descrita
abajo. No se ejecutó despliegue, backfill, cambio de datos históricos ni
aplicación remota de migraciones.

## Forward 0035: corrección de la barrera de tenant

El fallo real anterior no se silencia: `0035_cotizacion_handover_tenant_scope.sql`
añade una política RESTRICTIVE para authenticated con USING y WITH CHECK,
idéntica al patrón Ola16 vigente en `20261006234100_tarifario_cargos_tenant_scope.sql`.
No añade GRANT, no cambia la política permisiva de 0029, no modifica datos ni
funciones de autorización/margen. Se ejecuta en la reconstrucción después de
0034: ponerlo antes de 0029 en Supabase fallaría por tabla inexistente. No se usa
un IF EXISTS que permita omitir silenciosamente la nueva barrera.

El test previo a los GRANT masivos del harness fija SELECT-only authenticated,
sin privilegios anon, y CRUD service_role. El test transaccional posterior usa
dos organizaciones y usuarios sintéticos: lectura ordinaria propia/ajena,
escritura ordinaria bloqueada, anon, superadmin sin tenant y con A/B activo.
Una política permisiva artificial sólo dentro de la transacción comprueba que
la nueva restricción impide saltar entre tenants y bloquea el WITH CHECK incluso
si otra política concede acceso. Todo el fixture termina en ROLLBACK.

### Resultado final local

La segunda reconstrucción completa en un PostgreSQL nuevo pasó también la
comprobación ACL previa a post-migrate, la integridad final y el test SQL
`cotizacion_handover_tenant_scope.sql` (éxito y ROLLBACK). Log local:
`.db-verify-logs/20261106-065005/`. Tests estáticos finales: 49/49 y
`audit:migrations` limpio. Esta evidencia no equivale a CI remoto completo ni
a una revisión del catálogo productivo. No se conectó a una base del proyecto.


## Catálogo, fixtures y fidelidad de ACL

El primer CI remoto detectó que el nuevo test de handover no estaba clasificado.
Se registra como guard ejecutable en `_guards_manifest.txt`; su comprobación de
ACL vive en `supabase/tests/rls/_ci_check_handover_tenant_acl.sql`, clasificada
como soporte SQL y ejecutada por ambos preparadores antes de los grants del
harness. Las pruebas del catálogo comprueban la conexión efectiva, no sólo la
presencia del nombre.

La historia completa cambia prerrequisitos reales de cuatro fixtures:

- `ola6_transaccional.sql`: convierte prospecto desde Borrador mediante la RPC
  real y conserva las dos llamadas/idempotencia. Autoriza mediante RPC, envía y
  vence mediante `expirar_cotizaciones_job` antes de probar reactivación. Todo
  termina en ROLLBACK, sin fabricar ganadora ni autorización.
- `pricing_subtotal_moneda_canonica.sql`: autoriza con gerente sintético antes
  de la aceptación combinada con tipo de cambio. Conserva las aserciones de
  conversión monetaria e inmutabilidad originales.
- `cotizacion_ganadora_autoridad_unica.sql`: exige el rechazo por embarque vivo,
  cancela mediante RPC autenticada y luego verifica que Papelera conserve la
  ganadora y valor histórico.
- `test_rls_reg_r4_cotizacion_guard.sql`: prueba el rechazo específico sin
  autorización y usa la RPC para habilitar Enviada/Aceptada. Conserva las
  transiciones y snapshots originales.

No se deshabilitan triggers ni se escriben columnas de autorización directamente.
Los actores, organizaciones y operaciones son sintéticos y transaccionales.

Drizzle0031 deja `_cotizacion_margen_pct(uuid)` sólo al propietario postgres.
Los grants masivos del harness reabrían su ejecución a authenticated/service_role
antes del linter. Se comprueba la ACL exacta antes del harness, se retiran sólo
esos dos grants artificiales y se vuelve a comprobar la ACL. No se cambia el
cuerpo de la función, el umbral, su configuración ni la ACL de producción.
El nuevo soporte `_ci_check_cotizacion_margen_acl.sql` falla si falta la función,
los roles, el propietario esperado, SECURITY DEFINER, retorno numeric o ACL
exacta owner-only. No se incorpora a una lista de excepciones del linter.

## Snapshot revisado y evidencia recuperada

El baseline de CI fue generado con PostgreSQL17.11 y el normalizador existente.
Una revisión independiente comparó los22 cuerpos nuevos/modificados contra la
última definición de0026–0034 y revisó los restantes objetos de0026–0035.
La corrección posterior sólo quita los dos GRANT artificiales al helper de
margen. SHA-256 del baseline final revisado:
`0f00dbd7e1e2d6a9917e33dbe865d1b3ca6a1bc021e5ec6e557183bcce3a2408`.
No se cambió la normalización para esconder deriva.

La validación local previa a la pérdida del checkout pasó224/224 guards,
66/66 suites RLS y34/34 pruebas del catálogo. Sobreviven los logs y el snapshot
exacto. El checkout compartido desapareció durante la publicación; esta sección
se reconstruye de nuevo, no se presenta como recuperación byte a byte del texto
anterior. Los parches de fixtures/ACL recuperados del diff independiente y las
nuevas ediciones requieren nueva validación en el checkout recuperado. Los
resultados anteriores no sustituyen esa ejecución.

### Hallazgo histórico separado, no corregido aquí

La ruta automática de cliente especial en `_cotizacion_autorizacion_guard`
(0032, SECURITY INVOKER) llama al helper owner-only de0031. En una prueba
sintética autenticada, enviar esa cotización produce `permission denied for
function _cotizacion_margen_pct`. Los grants artificiales anteriores del harness
ocultaban esta incompatibilidad. Se registra como defecto funcional separado:
no se amplían permisos ni se modifica producto/margen para hacer pasar CI.
El éxito de las suites enumeradas no certifica esa ruta especial.

### Nueva validación tras recuperar el checkout

Se repitió la reconstrucción completa en PostgreSQL17.9 efímero, con binaries
oficiales y conexión loopback, usando el checkout recuperado. Resultado:
224/224 guards,66/66 suites RLS y34/34 pruebas del catálogo en verde; inventario
completo224 guards,66 RLS y25 soportes SQL. La regeneración con pg_dump17.9
coincide byte a byte con el baseline final recuperado (SHA arriba), sin cambiar
el normalizador. Log de reconstrucción: `.db-verify-logs/20261106-074943/`.
`git diff --check` y sintaxis Bash de ambos preparadores pasaron.

Los cuatro fixtures y el ajuste ACL se restauraron del diff retenido por el
revisor independiente. El registro/wiring del test handover y su regresión de
catálogo se reconstruyeron y validaron de nuevo; no se afirma identidad de
bytes con la edición anterior. No hubo conexiones a bases del proyecto ni
aplicación remota de migraciones. El hallazgo del cliente especial permanece
fuera del alcance de esta corrección CI.
