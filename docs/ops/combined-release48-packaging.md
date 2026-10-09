# Propuesta local 13.824.48: composición y contrato

## Alcance

Paquete local sobre la composición original congelada que incluye las propuestas
46 y 47. Las entradas históricas35–44,46 y47, su changelog, SQL, guards y replay
se conservan; no se crea45. No contiene el nuevo fix148 de selectores de escritura
ni el trabajo en curso de precisión. No acredita publicación, aplicación remota,
despliegue, cierre GUI ni operaciones fiscales.

La release48 registra seis migraciones que faltaban en el manifest47:

- `20261007235500_audit54_saldo_monetario_real.sql`
- `20261007235600_audit141_cobranza_conteos.sql`
- `20261007235700_audit141_conteos_todas_monedas.sql`
- `20261007235900_audit147_demoras_moneda_unica.sql`
- `20261008000000_audit145_cotizacion_venta_lineage.sql`
- `20261008210000_audit129_132_148_pnl_documentacion.sql`

Los primeros cinco son los bytes originales de la composición congelada. El
sexto es exactamente el forward SAVEPOINT/ACL revisado de forma independiente.
Su comentario histórico de candidato sin versión se conserva, igual que el resto
de sus bytes. Registro de archivos no significa registro de aplicación en una BD.

## Manifest y snapshot

`scripts/audit-release-manifest.ts --update` genera la entrada48 directamente de
los1503 SQL del disco. Como ese script conserva sólo tres versiones, el paquete
recupera íntegro el prefijo serializado original y le agrega sólo la entrada48
generada. No se cambia el auditor ni su política de retención. El audit posterior
debe verificar que la entrada de APP_VERSION coincide exactamente con el disco.

Baseline no se regenera con un cliente distinto: sólo adopta la normalización
P&L ya revisada (delimitador, vacíos y comentarios de columna cero), manteniendo
todos los bytes ajenos a esa declaración. Las funciones canónicas y el SQL que
ejecutaría el forward siguen conservando el cuerpo crudo aprobado.

El workflow real de snapshot sigue siendo `scripts/db/schema-snapshot.sh`, con
pg_dump17.9 de la imagen pinneada que usan `scripts/db/local-verify.sh` y CI:
`postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae`.
El cliente local encontrado es17.11; no sustituye este gate ni acredita paridad
del snapshot completo. El empaquetado no ejecuta SQL ni inicia un clúster.

## Contrato obligatorio del caller

El primer statement del forward P&L es `SAVEPOINT pnl_exact_acl_forward`.
Debe ejecutarse el archivo entero dentro de una única transacción ya abierta
por el caller, con stop-on-error. No abre BEGIN ni hace COMMIT/ROLLBACK global;
libera únicamente su savepoint. Los snapshots son transaction-local.

Las banderas equivalentes del runner revisado son
`psql -X -v ON_ERROR_STOP=1 --single-transaction`. No basta conocer esas banderas:
el aplicador concreto del destino debe demostrar que no fragmenta el archivo,
que respeta SAVEPOINT y que aborta toda la transacción si falla una precondición
o postcondición. Autocommit falla en el primer statement. Ante un error no se
debe continuar con otros statements ni tratar de registrar la migración aplicada.

El forward exige el catálogo, firma, owner postgres, identidad de sesión y cuerpo
revisados; authenticated debe tener EXECUTE directo del grantor postgres, sin
grant option. PUBLIC/anon ya deben estar cerrados. Conserva exactamente ACL,
grantor, opciones, permisos efectivos y presencia/ausencia de la entrada directa
service_role; sólo cambia prosrc de la función objetivo. No modifica membresías
ni amplía acceso. Debe verificarse este contrato en el destino autorizado.

Los cinco archivos de54/141/147/145 tienen timestamps anteriores a190000/190100/
190200 de46. Cualquier aplicación futura usa la lista explícita de faltantes y
compara hash/catálogo/ledger; no selecciona sólo timestamps mayores al último.
El mismo cuidado aplica a los dos SQL de47 si aún no estuvieran registrados.

## Gates pendientes

1. Revisión independiente del paquete final y sus hashes.
2. SQL combinado fresh y forward real, idempotencia y preservación de catálogos,
   ACL/RLS y datos, sobre el árbol final autorizado. La evidencia de otras bases
   o de candidatos individuales no se presenta como un nuevo PASS de este paquete.
3. Snapshot completo normalizado por el workflow real con pg_dump17.9 pinneado;
   comparar contra baseline sin sustituirlo por un dump distinto para forzar verde.
4. CI completo, build y validaciones de comportamiento/UI que correspondan.
5. Preflight de destino: historia exacta, faltantes y checksums, catálogo,
   permisos, backups/rollback y contrato transaccional del aplicador.

Este documento no es autorización para aplicar migraciones o desplegar.
