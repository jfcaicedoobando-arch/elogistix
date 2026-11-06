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
proyecto. No se regeneró el baseline SQL ni se ejecutó despliegue, backfill,
cambio de datos históricos o aplicación remota de migraciones.

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
