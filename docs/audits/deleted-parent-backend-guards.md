# Defensas backend para facturas eliminadas

Base revisada: `ee8ba3ac15720680a1d2de82eaec2e1bd73ece96`.
Candidato local; no demuestra aplicación en una base remota, despliegue ni timbrado.

## Alcance

- NC: `_nc_validar_linaje_conceptos` exige factura no eliminada del mismo tenant antes de interpretar conceptos. También aplica a borradores manuales, arreglos vacíos y JSON no-array; conserva las reglas anteriores de linaje/moneda y permite padre Borrador vivo. El trigger cubre restauración, cambio de padre/tenant y transición de estado. Una NC eliminada o Cancelada conserva la salida temprana histórica.
- REP: `cargarFacturaPpd` filtra por `deleted_at IS NULL` y por la organización del pago previamente autorizado. La orquestación corta antes de resumen del proveedor, claim o emisión. El trigger SQL exige el mismo padre vigente cuando existen identificadores REP/claim y también cubre cambio de padre/tenant. Conserva la salida temprana para pagos sin identificadores REP y las reglas previas de UUID/estado.
- Sustitución: `duplicar_factura_para_sustitucion` selecciona una factura no eliminada, conserva su membresía/roles, UUID, validación de estado, conceptos y tabla puente; bloquea esa fila antes de duplicar.

No se modifican consultas históricas, RLS, roles, GRANT/REVOKE, datos existentes ni la RPC idempotente de pago individual. No se pretende una auditoría general de todos los caminos de emisión/restauración.

## Migración preservadora

`20261013141500_factura_eliminada_guard_hijos.sql` es forward-only y transaccional. Antes de cambiar funciones exige existencia, SECURITY y search_path esperados y el MD5 exacto del cuerpo canónico revisado, de las dos variantes concretas del squash descritas abajo o del candidato. Reaplicar los bytes exactos es admisible; drift de cuerpo/security/search_path falla antes de reemitir funciones.

CREATE OR REPLACE conserva OID, propietario y ACL existentes. La migración captura y comprueba al terminar OID, propietario, ACL, SECURITY, search_path, tipo de retorno y argumentos. No normaliza ni certifica los permisos preexistentes. El registro H6 contiene exclusivamente el nombre y SHA-256 exactos del forward; cualquier cambio vuelve a exigir el auditor ordinario. Sus pruebas conservan la prohibición de GRANT TO PUBLIC.

El guard NC y el RPC de sustitución conservan SECURITY DEFINER y bloquean el padre. REP conserva SECURITY INVOKER y SELECT sin row lock: añadir un lock requeriría privilegios UPDATE sobre facturas. No se han ampliado permisos para obtenerlo.

## Evidencia local

- 29 casos SQL positivos/negativos por perfil (`source` y `squash`), sobre funciones canónicas extraídas del historial y luego reemitidas por la migración real, en PostgreSQL 17 desechable; incluye reaplicación y comparación de metadata. Guard estructural registrado en `_guards_manifest.txt`.
- 124 pruebas Deno del directorio REP con I/O simulado, incluida emisión permitida, pending, claim ocupado, error de persistencia, padre borrado/ajeno, fallo de lectura y PUE/no timbrada. No se concede acceso de red a los tests.
- 47 pruebas Vitest del auditor ACL, perfiles exactos de replay y cobertura de mensajes LC; ESLint de archivos TS cambiados y Deno check enfocado.
- Auditores de migraciones, manifiesto, cuerpos de espejo y replay/mirror.
- Controles negativos: restaurar cada guard SQL anterior hace fallar su caso de padre eliminado; restaurar loader/orquestación REP anteriores conserva seis casos antiguos pero falla las dos nuevas regresiones. Mutaciones de cuerpo, SECURITY y search_path hacen rechazar la migración en precondiciones.

## Reproducción SQL

Requiere binarios PostgreSQL 17 y Python ya instalados. Desde el repositorio:

```sh
POSTGRES_BIN=/ruta/postgres/bin PSQL_BIN=/ruta/psql \
  bash scripts/ci/deleted-parent/run-local.sh
```

El runner crea un cluster nuevo en un directorio temporal, sólo escucha en loopback, no acepta DATABASE_URL remoto y detiene el proceso al salir. Puede usarse `TEST_PG_PORT` para evitar un puerto ocupado. No instala software ni crea/cambia roles o grants dentro del cluster. Opciones de control negativo: `NEGATIVE_CONTROL=1`, `NEGATIVE_SCOPE=rep|duplicate|nc`, `ADMISSION_NEGATIVE=body|security|search_path`; se espera salida no cero.

## Límites

La matriz SQL usa schema sintético reducido, no replay integral de Supabase ni prueba RLS con usuarios reales. Su ACL inicial es NULL, propia del cluster nuevo. Como validación separada, el preparador CI real reconstruye bootstrap, squash y 332 migraciones en un cluster UTF8 nuevo: conserva owner, ACL no triviales, SECURITY y search_path de las tres funciones. Esto no ejecuta todas las suites RLS ni certifica permisos del entorno remoto.

Hay un candado existente que impide eliminar una factura con hijos vivos. Estas regresiones introducen estados sintéticos para probar defensa en profundidad; no demuestran explotación en el flujo normal ni una carrera concurrente reproducible. No se reclama cierre global de concurrencia ni se ha alterado el protocolo idempotente de pagos.

No se ejecutó base compartida/remota, PAC, emisión/cancelación fiscal, navegador ni despliegue. La eventual aplicación debe pasar la revisión e integración correspondientes y sus precondiciones; un registro en Git no aplica una migración.

## Corrección del replay CI de PR313

La admisión original reproducía los cuerpos de las migraciones históricas. El squash versionado guarda las mismas instrucciones pero suprime exactamente cuatro líneas vacías del REP y doce de sustitución, todas separadores entre sentencias. Los cuerpos raw almacenados por PostgreSQL difieren, aunque su SQL sea idéntico. No cambió la metadata ni la función NC posterior al squash.

Se añaden únicamente estos MD5 de `prosrc`, extraídos del blob de squash `a74b0a5d2ab96ea720d414e388bf6f203649a606` y comprobados mediante replay real:

- `assert_factura_viva_para_rep()`: `40badfd37ee72215f3b81c21c3f0bc50` (fuente original `10621bffc7289d11acf116b24f9fe966`).
- `duplicar_factura_para_sustitucion(uuid)`: `e0b8bdc97556afd0cba54c11104eebfb` (fuente original `51cd445e39365a256a4864cf1d871cb3`).

La migración no normaliza cuerpos ni calcula listas de hashes dinámicamente. Conserva las tres preimágenes originales y las verificaciones de metadata, y el registro H6 se vuelve a fijar a los bytes completos del forward. Los tests demuestran la diferencia de líneas exacta y rechazan cambios de cuerpo, SECURITY y search_path en ambos perfiles.

Se registra texto amigable para los tres códigos nuevos `LC_FACTURA_HIJOS_METADATA`, `LC_FACTURA_HIJOS_PRECONDITION` y `LC_NC_FACTURA_NO_VIVA`, sin ignorarlos en `lcCodeCoverage.test.ts`.

El mismo runner local acepta `BASELINE_PROFILE=source` (predeterminado) o `BASELINE_PROFILE=squash`. El preparador CI real usa sin modificar el bootstrap revisado, incluidos sus roles de prueba del cluster desechable; no crea accesos en sistemas compartidos. Se reprodujo el fallo del forward anterior contra el head inmutable, y el candidato completó el preparador completo. Esas ejecuciones no son un despliegue ni reemplazan CI del futuro head publicado.
